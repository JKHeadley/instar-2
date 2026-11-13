// Runner-local selection among explicitly reviewed profiles. Ported from 1.x SubscriptionPool's
// account/config-home selection: never rewrite a shared credential slot and never retry a call.
// Tokens remain in harness-user custody. This module consumes the adapter's typed failure only.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { durablePreviewWrite } from './durable-write.js';
import { harnessLoginPath } from './harness-user.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read = path => readFileSync(path, 'utf8');
const fail = reason => { throw Error(`preview: harness login pool ${reason}`); };

// Only installation-local file references move. Custody/profile contents (including harness
// homes) are independently admitted facts, never rewritten by a directory relocation.
export const harnessBuildRoot = path => typeof path === 'string'
  ? /^(.*)\/harness-login-builds\/[a-f0-9]{64}\/(?:pool|0-activation)\.json$/u.exec(path)?.[1] : undefined;
export function relocateHarnessRecords(value, from, to) {
  const relocate = path => {
    if (typeof path !== 'string' || !from || from === to) return path;
    const suffix = relative(from, path);
    return suffix !== '..' && !suffix.startsWith('../') && !isAbsolute(suffix) ? join(to, suffix) : path;
  };
  const row = entry => ({ ...entry, ...Object.fromEntries(
    ['profile', 'activation', 'authority', 'toolsActivation', 'sessionActivation', 'quotaLogin'].filter(key => entry[key] !== undefined)
      .map(key => [key, relocate(entry[key])])),
    ...(entry.sources ? { sources: entry.sources.map(source => ({ ...source, path: relocate(source.path) })) } : {}) });
  return { ...value, logins: value.logins?.map(row),
    ...Object.fromEntries(['preparedManifest', 'previousManifest', 'usageFile'].filter(key => value[key] !== undefined)
      .map(key => [key, relocate(value[key])])) };
}
export function resolveHarnessManifest(manifest, path, inherited) {
  if (!manifest || !Array.isArray(manifest.logins)) return { manifest };
  if (manifest.recordRoot !== undefined && (typeof manifest.recordRoot !== 'string' || !isAbsolute(manifest.recordRoot)))
    fail('record root must be absolute');
  const root = harnessBuildRoot(path);
  const origin = manifest.recordRoot ?? (root && basename(dirname(path)) === basename(dirname(manifest.logins?.[0]?.activation ?? ''))
    ? harnessBuildRoot(manifest.logins?.[0]?.activation) : undefined);
  const relocation = root && origin ? { from: origin, to: root } : inherited;
  return { manifest: relocation ? relocateHarnessRecords(manifest, relocation.from, relocation.to) : manifest, relocation };
}

/** --login-pool is an ordered manifest including the primary --login-profile/--activation-record.
 * Paths are absolute; each entry has its own sealed authority and (when tools are on) tools grant.
 * The primary remains the installation/renewal anchor; selection never changes installation policy. */
export function loadHarnessLogins(options, readText = read) {
  let primary = { profile: options['login-profile'], activation: options['activation-record'],
    authority: options['authority-record'], toolsActivation: options['tools-activation'],
    sessionActivation: options['session-work-activation'] };
  const path = options['login-pool'];
  const bytes = path === undefined ? null : readText(path);
  const rawManifest = bytes === null ? null : JSON.parse(bytes);
  const { manifest, relocation } = rawManifest === null ? { manifest: null }
    : resolveHarnessManifest(rawManifest, path, options.recordRelocation);
  if (relocation) primary = relocateHarnessRecords({ logins: [primary] }, relocation.from, relocation.to).logins[0];
  if (bytes !== null && (!manifest || manifest.version !== 1 || !Array.isArray(manifest.logins)
    || manifest.logins.length < 1 || manifest.logins.length > 8)) fail('manifest is malformed');
  if (manifest && (options['harness-user'] === undefined))
    fail('requires the separate Claude Code harness user');
  const rows = manifest?.logins ?? [primary];
  if (rows[0].profile !== primary.profile || rows[0].activation !== primary.activation) fail('primary differs from launch');
  const threshold = manifest?.thresholdPercent ?? 95;
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) fail('threshold must be above zero and at most 100');
  const entries = rows.map((row, index) => {
    if (!row || !['profile', 'activation'].every(key => typeof row[key] === 'string' && (!manifest || isAbsolute(row[key])))) fail('paths must be absolute');
    for (const key of ['authority', 'toolsActivation', 'sessionActivation', 'quotaLogin'])
      if (row[key] !== undefined && (typeof row[key] !== 'string' || !isAbsolute(row[key]))) fail('grant paths must be absolute');
    if (row.usageAccount !== undefined && (typeof row.usageAccount !== 'string' || !/^[a-z0-9-]{1,128}$/u.test(row.usageAccount)))
      fail('usage account id is malformed');
    // Retained admission evidence represents an excluded member and verifies predecessors.
    // Dispatchable members still require the live profile and all existing admission checks.
    const profile = Object.freeze((row.unavailable || options.previousManifest) && row.admittedProfile
      ? row.admittedProfile : JSON.parse(readText(row.profile)));
    if (manifest || options['harness-user'] !== undefined) harnessLoginPath(profile);
    return Object.freeze({ ...row, profilePath: row.profile, profile,
      // A manifest entry cannot inherit the primary account's authority implicitly.
      options: Object.freeze({ ...options, 'login-profile': row.profile, 'activation-record': row.activation,
        'authority-record': manifest ? row.authority : primary.authority }), index });
  });
  if (manifest) {
    for (const key of ['reference', 'expectedAccount', 'home', 'configDirectory', 'workingDirectory'])
      if (new Set(entries.map(entry => entry.profile[key])).size !== entries.length) fail(`duplicates ${key}`);
    for (const key of ['authority', 'toolsActivation', 'sessionActivation'])
      if (primary[key] !== undefined && rows[0][key] !== primary[key]) fail(`primary ${key} differs from launch`);
  }
  if (manifest?.usageFile !== undefined && (typeof manifest.usageFile !== 'string' || !isAbsolute(manifest.usageFile))) fail('usage path must be absolute');
  // Build records and executable pins are revalidated at launch, not pool membership.
  const identity = hash(entries.map(({ profile }) => Object.fromEntries(
    ['reference', 'expectedAccount', 'organization', 'plan', 'home', 'configDirectory', 'workingDirectory']
      .map(key => [key, profile[key]]))));
  const legacyIdentity = hash({ entries: entries.map(({ profile }, index) => {
    const { activation, authority, toolsActivation, sessionActivation, usageAccount } = rawManifest?.logins[index] ?? primary;
    return { profile, activation, authority, toolsActivation, sessionActivation, usageAccount };
  }), threshold });
  const legacyIdentities = [legacyIdentity];
  if (manifest?.previousManifest !== undefined) {
    if (typeof manifest.previousManifest !== 'string' || !isAbsolute(manifest.previousManifest) || options.previousManifest)
      fail('predecessor manifest must be one absolute retained manifest');
    const previous = JSON.parse(readText(manifest.previousManifest));
    const previousRelocation = manifest.previousRecordRoot && harnessBuildRoot(path)
      ? { from: manifest.previousRecordRoot, to: harnessBuildRoot(path) } : relocation;
    const first = resolveHarnessManifest(previous, manifest.previousManifest, previousRelocation).manifest?.logins?.[0];
    if (!first) fail('predecessor manifest is malformed');
    // Only one predecessor is needed for v1 adoption; ignore its own predecessor link.
    const prior = loadHarnessLogins({ ...options, previousManifest: true, recordRelocation: previousRelocation, 'login-pool': manifest.previousManifest,
      'login-profile': first.profile, 'activation-record': first.activation, 'authority-record': first.authority,
      'tools-activation': first.toolsActivation, 'session-work-activation': first.sessionActivation },
    path => {
      if (path === manifest.previousManifest) return JSON.stringify({ ...previous, previousManifest: undefined });
      try { return readText(path); } catch (error) {
        // Imported v1 manifests predate snapshots. Retain the admitted profile only for a
        // missing predecessor path; the legacy hash must still match the durable state.
        const retained = entries.find(entry => entry.unavailable && entry.profilePath === path && entry.admittedProfile);
        if (error?.code !== 'ENOENT' || !retained) throw error;
        return JSON.stringify(retained.admittedProfile);
      }
    });
    if (prior.identity !== identity) fail('predecessor members differ; explicit membership migration required');
    legacyIdentities.push(prior.legacyIdentity);
  }
  return Object.freeze({ entries: Object.freeze(entries), threshold, usageFile: manifest?.usageFile, identity, legacyIdentity,
    legacyIdentities: Object.freeze(legacyIdentities),
    current: () => bytes === null || readText(path) === bytes,
  });
}

/** Read 1.x SubscriptionPool's non-secret quota snapshot. Match email and either config home
 * or the reviewed usageAccount id (the pool may poll the same account in its original home);
 * stale, unavailable, mismatched and malformed readings are not evidence of exhaustion.
 * The provider result remains authoritative when a reading cannot be obtained. */
function harnessQuotaReading(document, profile, now, usageAccount) {
  if (document?.version !== 1 || !Array.isArray(document.accounts)) return null;
  const matches = document.accounts.filter(account => account && typeof account === 'object' && account.email === profile.expectedAccount
    && account.identityDrifted !== true
    && (usageAccount === undefined ? account.configHome === profile.configDirectory : account.id === usageAccount));
  if (matches.length !== 1) return null;
  const quota = matches[0].lastQuota;
  const at = typeof quota?.measuredAt === 'string' ? Date.parse(quota.measuredAt) : NaN;
  if (!Number.isFinite(at) || at > now || now - at > 5 * 60_000) return null;
  const windows = [quota?.fiveHour, quota?.sevenDay].map(window => window
    && Number.isFinite(window.utilizationPct) && window.utilizationPct >= 0 && window.utilizationPct <= 100
    && typeof window.resetsAt === 'string' && Number.isFinite(Date.parse(window.resetsAt)) && Date.parse(window.resetsAt) > now
    ? { utilizationPct: window.utilizationPct, resetAt: Date.parse(window.resetsAt) } : null);
  const rawShort = quota?.fiveHour;
  const shortAbsent = rawShort === undefined || rawShort === null;
  const scoped = Array.isArray(quota?.scopedWeekly) ? quota.scopedWeekly.map(window =>
    Number.isFinite(window?.utilizationPct) && window.utilizationPct >= 0 && window.utilizationPct <= 100
      && Number.isFinite(Date.parse(window?.resetsAt)) && Date.parse(window.resetsAt) > now
      ? { utilizationPct: window.utilizationPct, resetAt: Date.parse(window.resetsAt) } : null) : [];
  return { at, windows, scoped, scopedUnknown: quota?.scopedWeeklyUnknown === true || scoped.includes(null),
    // 1.x snapshots have no fiveHourUnreported marker. Absence beside a fresh,
    // valid weekly window has the same meaning as live provider omission.
    fiveHourUnreported: shortAbsent && windows[0] === null };
}

const capacityWindows = reading => reading?.windows[1] && !reading.scopedUnknown
  && (reading.windows[0] || reading.fiveHourUnreported)
  ? [...reading.windows.filter(Boolean), ...reading.scoped] : null;

function quotaLimit(reading, threshold) {
  const windows = [...(reading?.windows ?? []), ...(reading?.scoped ?? [])].filter(window => window && window.utilizationPct >= threshold);
  return windows.length ? { reason: 'usage-threshold', resetAt: Math.max(...windows.map(window => window.resetAt)) } : null;
}

export function harnessQuotaLimit(document, profile, threshold, now, usageAccount) {
  return quotaLimit(harnessQuotaReading(document, profile, now, usageAccount), threshold);
}

function matchingUsageAccount(document, entry) {
  if (document?.version !== 1 || !Array.isArray(document.accounts)) return null;
  const matches = document.accounts.filter(account => account?.email === entry.profile.expectedAccount
    && account.identityDrifted !== true && (entry.usageAccount === undefined
      ? account.configHome === entry.profile.configDirectory : account.id === entry.usageAccount));
  return matches.length === 1 ? matches[0] : null;
}

/** The root's existing writer lease serializes this small durable selection record. History contains
 * only profile references, causes and times; retained for audit, never model text or credentials.
 * A missing initial record is installed durably before use; corrupt/mismatched state holds admission.
 * No timer retries: an exhausted profile becomes eligible after a provider/reading reset time.
 * Unknown resets recover from newer matched readings with capacity in both quota windows. */
/** 1.x QuotaPoller CLI_LOGIN_EXPIRED_HOLD_MAX_MS: a signed-out hold is released by a changed stored
 * credential (a fresh sign-in) or, at the latest, after this ceiling; a still-broken login is observed again. */
export const SIGNED_OUT_HOLD_MAX_MS = 12 * 60 * 60_000;

export function createHarnessLoginPool({ configuration, statePath, now, validate,
  machine = 'local', unavailable = new Map(), readText = read, write = durablePreviewWrite, previouslyLaunched = () => false, quotaReader = null, usage = () => configuration.usageFile
    ? JSON.parse(readText(configuration.usageFile)) : null, credential = () => null }) {
  const { entries, identity } = configuration;
  // 1.x ProactiveSwapMonitor's lag-aware ceiling reserves 20 percentage points
  // for delayed provider reporting and a turn finishing before its safe boundary.
  // A lower installation threshold still wins; the model is never an input here.
  const threshold = Math.min(configuration.threshold, 80);
  const observedUsage = () => {
    let fallback = null;
    try { fallback = usage(); } catch { /* Keep live telemetry when an imported snapshot is unreadable. */ }
    if (!quotaReader) return fallback;
    const live = quotaReader.read();
    return { version: 1, accounts: entries.map(entry => {
      const observed = matchingUsageAccount(live, entry);
      // A known live window remains evidence even when its companion is unknown.
      return harnessQuotaReading(live, entry.profile, now(), entry.usageAccount)?.windows.some(Boolean)
        ? observed : matchingUsageAccount(fallback, entry) ?? observed;
    }) };
  };
  let state;
  try { state = JSON.parse(readText(statePath)); }
  catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    if (previouslyLaunched()) fail('selection state was lost after launch; desk recovery required');
    state = { version: 1, identity, active: 0, holds: {}, switches: [] };
    write(statePath, state);
  }
  const adoptLegacy = state?.identity !== identity && configuration.legacyIdentities?.includes(state?.identity);
  if (state?.version !== 1 || (state.identity !== identity && !adoptLegacy) || !Number.isInteger(state.active)
    || !entries[state.active] || !state.holds || typeof state.holds !== 'object' || Array.isArray(state.holds) || !Array.isArray(state.switches)) fail('state differs; desk migration required');
  for (const [index, hold] of Object.entries(state.holds))
    if (!/^[0-7]$/u.test(index) || !entries[index] || !['provider-limit', 'usage-threshold'].includes(hold?.reason)
      || !(hold.resetAt === null || Number.isSafeInteger(hold.resetAt))
      || (hold.observedAt !== undefined && !Number.isSafeInteger(hold.observedAt))) fail('hold is malformed');
  // Sign-in evidence is kept apart from quota/provider holds (1.x QuotaPoller's cliLoginExpiredHolds beside its quota
  // readings): each has its own recovery evidence, so a fresh sign-in never erases a quota hold and a quota
  // observation never replaces the sign-in deadline.
  if (state.signedOut !== undefined && (!state.signedOut || typeof state.signedOut !== 'object' || Array.isArray(state.signedOut)))
    fail('sign-in hold is malformed');
  for (const [index, held] of Object.entries(state.signedOut ?? {}))
    if (!/^[0-7]$/u.test(index) || !entries[index] || !Number.isSafeInteger(held?.resetAt) || !Number.isSafeInteger(held.observedAt)
      || !(held.credential === null || /^[a-f0-9]{16}$/u.test(held.credential))) fail('sign-in hold is malformed');
  for (const [index, event] of state.switches.entries())
    if (event?.sequence !== index + 1 || !Number.isSafeInteger(event.at)
      || !entries.some(entry => entry.profile.reference === event.from)
      || !entries.some(entry => entry.profile.reference === event.to) || event.from === event.to
      || !['provider-limit', 'usage-threshold', 'member-unavailable'].includes(event.reason)) fail('switch history is malformed');
  const persist = next => { write(statePath, next); state = next; };
  if (adoptLegacy) persist({ ...state, identity, noticeIdentity: state.noticeIdentity ?? state.identity,
    migrations: [...(state.migrations ?? []), { from: state.identity, to: identity, at: now(),
      reason: 'build-independent ordered login identity; verified predecessor manifest' }] });
  const excluded = [...unavailable].filter(([index]) => !(state.exclusions ?? []).some(item => item.index === index));
  if (excluded.length) persist({ ...state, exclusions: [...(state.exclusions ?? []),
    ...excluded.map(([index, reason]) => ({ index, reason, at: now() }))] });
  // Legacy holds have no observation time. Establish a durable freshness boundary once;
  // only a subsequent measurement can release one, including after another restart.
  const legacy = Object.entries(state.holds).filter(([, hold]) => hold.observedAt === undefined);
  if (legacy.length) persist({ ...state, holds: { ...state.holds,
    ...Object.fromEntries(legacy.map(([index, hold]) => [index, { ...hold, observedAt: now() }])) } });
  const hold = (entry, evidence) => {
    const previous = state.holds[entry.index];
    // A shorter quota window cannot erase a still-active weekly/provider hold.
    if (previous && (previous.resetAt === null || previous.resetAt > now())) evidence = {
      reason: previous.reason === 'provider-limit' ? previous.reason : evidence.reason,
      observedAt: Math.max(previous.observedAt, evidence.observedAt),
      resetAt: previous.resetAt === null || evidence.resetAt === null ? null : Math.max(previous.resetAt, evidence.resetAt),
    };
    if (previous?.reason === evidence.reason && previous.resetAt === evidence.resetAt
      && previous.observedAt === evidence.observedAt) return;
    persist({ ...state, holds: { ...state.holds, [entry.index]: evidence } });
  };
  // 1.x QuotaPoller (CMT-1008): the CLI's own signed-out report holds a login while the stored credential is the
  // SAME one it refused. Only a truncated fingerprint is kept, never the credential; an unreadable one reads as null.
  const fingerprint = entry => { try { const value = credential(entry); return typeof value === 'string' && /^[a-f0-9]{16}$/u.test(value) ? value : null; } catch { return null; } };
  const signedOutHeld = (entry, at) => {
    const held = state.signedOut?.[entry.index];
    return held !== undefined && held.resetAt > at && fingerprint(entry) === held.credential;
  };
  // A fresh sign-in or the ceiling clears only the sign-in evidence; any quota/provider hold stays bound.
  const releaseSignedOut = at => {
    const released = entries.filter(entry => state.signedOut?.[entry.index] !== undefined && !signedOutHeld(entry, at));
    if (!released.length) return;
    const signedOut = { ...state.signedOut };
    for (const entry of released) delete signedOut[entry.index];
    persist({ ...state, signedOut });
  };
  const admitted = (entry, tools, waitOnUnavailable) => {
    if (!configuration.current()) fail('manifest changed; restart with reviewed configuration');
    // Session intake has not dispatched: retain it for the host's ordinary retry.
    // Manifest and durable-state failures stay outside this availability boundary.
    try { validate(entry, tools); } catch (error) {
      if (waitOnUnavailable) return null;
      throw error;
    }
    return entry;
  };
  const select = (tools = false, current = state.active, requireRoom = false, onlyCurrent = false) => {
    const at = now();
    releaseSignedOut(at);
    let reading = null;
    try { reading = observedUsage(); } catch { /* A failed quota observation cannot create a limit. */ }
    for (const entry of entries) {
      const quota = harnessQuotaReading(reading, entry.profile, at, entry.usageAccount);
      // R95: only the configured cutoff creates a durable availability hold.
      // The 80% placement optimization below depends on the current observation.
      const limit = quotaLimit(quota, configuration.threshold);
      if (limit) hold(entry, { ...limit, observedAt: quota.at });
      const previous = state.holds[entry.index];
      if (previous?.resetAt === null && quota && quota.at > previous.observedAt
        && (previous.reason !== 'provider-limit' || quota.windows[0])
        && capacityWindows(quota)?.every(window => window.utilizationPct < threshold)) {
        const holds = { ...state.holds };
        delete holds[entry.index];
        persist({ ...state, holds });
      }
    }
    const signedOut = new Set(entries.filter(entry => matchingUsageAccount(reading, entry)?.status === 'needs-reauth'
      || state.signedOut?.[entry.index] !== undefined).map(entry => entry.index));
    const repairs = entries.filter(entry => signedOut.has(entry.index) && !(state.signinRepairs ?? []).some(item => item.index === entry.index));
    if (repairs.length) persist({ ...state, signinRepairs: [...(state.signinRepairs ?? []),
      ...repairs.map(entry => ({ index: entry.index, account: entry.profile.expectedAccount, machine, at }))] });
    const limited = index => state.holds[index] && (state.holds[index].resetAt === null || state.holds[index].resetAt > at);
    const source = harnessQuotaReading(reading, entries[current].profile, at, entries[current].usageAccount);
    const pressure = quotaLimit(source, threshold);
    const reason = limited(current) ? state.holds[current].reason : pressure?.reason;
    const usable = !limited(current) && !unavailable.has(current) && !signedOut.has(current);
    if (usable && !pressure) {
      if (onlyCurrent && !capacityWindows(source)?.every(window => window.utilizationPct <= Math.max(0, threshold - 15))) return null;
      return admitted(entries[current], tools, requireRoom);
    }
    if (onlyCurrent) return null;
    // A login that cannot serve at all (excluded or signed out) moves as member-unavailable, whatever quota cause
    // it also carries: the usage-threshold headroom brake below is for a login that could still serve.
    const moveReason = unavailable.has(current) || signedOut.has(current) ? 'member-unavailable' : reason;
    // 1.x QuotaAwareScheduler: drain usable headroom before its soonest reset.
    // Fresh, complete windows are mandatory for a proactive destination (QuotaTracker).
    const candidates = entries.filter(entry => entry.index !== current).map(entry => {
      const quota = harnessQuotaReading(reading, entry.profile, at, entry.usageAccount);
      const windows = capacityWindows(quota);
      const utilization = windows ? Math.max(...windows.map(window => window.utilizationPct)) : null;
      const hours = windows ? Math.max(0.25, (Math.min(...windows.map(window => window.resetAt)) - at) / 3_600_000) : Infinity;
      return { index: entry.index, quota, utilization, score: windows ? (100 - utilization) / hours : -1 };
    }).sort((a, b) => b.score - a.score || a.index - b.index);
    for (const { index, quota, utilization } of candidates) {
      if (limited(index) || unavailable.has(index) || signedOut.has(index)) continue;
      if (requireRoom && !capacityWindows(quota)?.every(window => window.utilizationPct <= Math.max(0, threshold - 15))) continue;
      // 1.x SwapAntiThrash target-headroom brake. Durable cutoff/provider holds and
      // the existing five-attempt cap prevent reversals without a new swap ledger.
      if (moveReason === 'usage-threshold'
        && (utilization === null || utilization > Math.max(0, threshold - 15))) continue;
      // 1.x SessionRefresh's five-attempt / ten-minute brake, durable across host restarts.
      if (requireRoom && (state.handoffAttempts ?? []).filter(event => at - event.at < 600_000).length >= 5) break;
      const next = admitted(entries[index], tools, requireRoom);
      if (!next) continue;
      const event = { from: entries[current].profile.reference, to: next.profile.reference,
        reason: moveReason, at, sequence: state.switches.length + 1 };
      if (requireRoom) persist({ ...state, handoffAttempts: [...(state.handoffAttempts ?? []),
        { ...event, sequence: (state.handoffAttempts?.length ?? 0) + 1, phase: 'prepared' }] });
      else persist({ ...state, active: index, switches: [...state.switches, event] });
      return next;
    }
    // 1.x all-hot brake: optimization must not strand usable work simply because
    // no cooler destination exists or the attempt bound is reached. Cutoff/provider
    // holds still bind, and ordinary authority/stop admission is always rechecked.
    if (usable) return admitted(entries[current], tools, requireRoom);
    if (requireRoom) return null;
    throw Object.assign(Error('preview: harness login pool has no reviewed login with available capacity'), { reviewCause: 'no-account' });
  };
  return Object.freeze({
    select,
    refresh: () => quotaReader?.refresh() ?? Promise.resolve(),
    registerTopic(topic) {
      if (!(state.topicLogins ?? []).includes(topic)) persist({ ...state, topicLogins: [...(state.topicLogins ?? []), topic] });
    },
    recordHandoff(move) {
      if (move.id && (state.handoffs ?? []).some(event => event.id === move.id)) return;
      const attempts = state.handoffAttempts ?? [];
      const attempt = attempts.findLastIndex(event => event.phase === 'prepared' && event.from === move.from && event.to === move.to
        && (move.attempt === undefined || event.sequence === move.attempt));
      const next = entries.find(entry => entry.profile.reference === move.to);
      if (attempt < 0 || !next) fail('handoff has no prepared selection');
      persist({ ...state, active: next.index,
        handoffAttempts: attempts.map((event, index) => index === attempt ? { ...event, phase: 'completed' } : event),
        switches: [...state.switches, { from: move.from, to: move.to, reason: attempts[attempt].reason,
          at: now(), sequence: state.switches.length + 1 }],
        handoffs: [...(state.handoffs ?? []), { ...move, machine, at: now() }] });
    },
    /** limit-notice-1020: read-only mirror of select()'s exclusions. Null while any reviewed login may have
     * room (a stale or missing reading is not evidence); otherwise the earliest reset any login names, or null. */
    outage() {
      const at = now();
      let reading = null;
      try { reading = observedUsage(); } catch { /* A failed quota observation cannot create a limit. */ }
      const resets = [];
      for (const entry of entries) {
        if (unavailable.has(entry.index) || matchingUsageAccount(reading, entry)?.status === 'needs-reauth'
          || signedOutHeld(entry, at)) continue;
        const quota = harnessQuotaReading(reading, entry.profile, at, entry.usageAccount);
        const limit = quotaLimit(quota, configuration.threshold), held = state.holds[entry.index];
        const recovered = held?.resetAt === null && quota && quota.at > held.observedAt
          && (held.reason !== 'provider-limit' || quota.windows[0])
          && capacityWindows(quota)?.every(window => window.utilizationPct < threshold);
        const holding = held && !recovered && (held.resetAt === null || held.resetAt > at);
        if (!holding && !limit) return null;
        const known = [holding ? held.resetAt : at, limit ? limit.resetAt : at];
        if (!known.includes(null)) resets.push(Math.max(...known));
      }
      return { resetAt: resets.length ? Math.min(...resets) : null };
    },
    selectSession: current => select('session', current, true),
    readySession: current => select('session', current, true, true),
    signinRepairs: () => (state.signinRepairs ?? []).map(item => ({
      key: `login-signin:${identity}:${item.index}:${item.machine}`, account: item.account, machine: item.machine,
      profile: entries[item.index].profile.reference, action: 'desk: run /subscription-signin for this account and machine',
    })),
    observe(entry, result) {
      if (entries[entry?.index] !== entry) fail('observation names an unreviewed login');
      if (result?.failure?.failureClass !== 'limit') return;
      const reset = result.failure.resetAt;
      hold(entry, { reason: 'provider-limit', observedAt: now(), resetAt: Number.isSafeInteger(reset) && reset > now() ? reset : null });
    },
    /** The harness CLI's own login check reported this login signed out. The next selection moves to another
     * approved login with room; the desk sign-in repair item is recorded by select() as for needs-reauth. */
    observeSignedOut(entry) {
      if (entries[entry?.index] !== entry) fail('observation names an unreviewed login');
      const at = now(), credentialNow = fingerprint(entry);
      if (signedOutHeld(entry, at)) return;
      persist({ ...state, signedOut: { ...state.signedOut, [entry.index]: { observedAt: at,
        resetAt: at + SIGNED_OUT_HOLD_MAX_MS, credential: credentialNow } } });
    },
    // stale-login-line-1107: a successful switch adds no line to a reply (Rules 87/88): it needs no operator action
    // and is not the task's result. The switch stays in durable history and on the status pull surface.
    // reply-noise-1108: a login dropped from selection while another approved login still serves changes nothing for
    // the person's work (Rules 87/88): it stays in state.exclusions and on the status pull surface. A reply carries one
    // plain line, keyed once per pool, only while no approved login can be used at all; a timed hold is the outage notice's.
    notices: () => entries.length && entries.every(entry => unavailable.has(entry.index)) ? [{
      key: `doorway:harness-login:${state.noticeIdentity ?? identity}:none-usable`,
      line: 'None of my approved model logins can be used right now, so new work will wait until one is working again.' }] : [],
    /** Content-free per-turn counterpart of status; no account/profile/path is disclosed. */
    brief() {
      const at = now();
      let reading = null;
      try { reading = observedUsage(); } catch { /* Unknown readings never imply zero usage. */ }
      let usable = 0;
      const groups = new Map();
      entries.forEach(entry => {
        const quota = harnessQuotaReading(reading, entry.profile, at, entry.usageAccount);
        const held = state.holds[entry.index], limit = quotaLimit(quota, configuration.threshold);
        const recovered = held?.resetAt === null && quota && quota.at > held.observedAt
          && (held.reason !== 'provider-limit' || quota.windows[0])
          && capacityWindows(quota)?.every(window => window.utilizationPct < threshold);
        const holding = held && !recovered && (held.resetAt === null || held.resetAt > at) ? held : limit;
        const resets = [holding?.resetAt ?? null, limit ? limit.resetAt : at];
        const reset = resets.includes(null) ? null : Math.max(...resets);
        const signedOut = signedOutHeld(entry, at) || matchingUsageAccount(reading, entry)?.status === 'needs-reauth';
        const unavailableNow = unavailable.has(entry.index);
        if (!holding && !signedOut && !unavailableNow) usable++;
        const resetText = reset === null ? null : new Date(reset).toISOString().replace('.000Z', 'Z');
        const reason = unavailableNow ? 'unavailable (recovery unknown)' : signedOut ? 'needs sign-in (recovery unknown)'
          : holding ? `${holding.reason === 'usage-threshold' ? 'usage threshold' : 'provider limit'}; reset ${resetText === null ? 'unknown' : resetText.slice(0, 10) + ' UTC'} (#=time)` : 'no hold';
        const detail = `${entry.index + 1}` + (holding && !signedOut && !unavailableNow
          ? `=${resetText === null ? 'unknown' : resetText.slice(11, -1)}` : '') + (!holding && quota?.windows.some(Boolean)
          ? ` (5h ${quota.windows[0]?.utilizationPct ?? '?'}%,week ${quota.windows[1]?.utilizationPct ?? '?'}%)` : '');
        groups.set(reason, [...(groups.get(reason) ?? []), detail]);
      });
      const members = [...groups].map(([reason, details]) => `${reason}: ${details.join(',')}`);
      return `${entries.length} logins, ${usable} usable. `
        + (usable ? 'Work can continue. ' : 'No usable login; new model work unavailable now. ')
        + (usable === entries.length ? 'None are currently held or limited. ' : '') + members.join(' | ') + '. Other quotas unknown.';
    },
    status: () => harnessLoginPoolStatus(configuration, state, unavailable, observedUsage, now),
    get state() { return structuredClone(state); },
  });
}

export function harnessLoginPoolStatus(configuration, state, unavailable, usage, now) {
  const { entries } = configuration;
  let document = null;
  try { document = usage(); } catch { /* Report unknown freshness on the pull surface. */ }
  const at = now();
  const members = entries.map(entry => {
    const held = state.holds[entry.index], signedOut = state.signedOut?.[entry.index];
    const quota = harnessQuotaReading(document, entry.profile, at, entry.usageAccount);
    return `${entry.index + 1}: ${entry.profile.reference}${entry.index === state.active ? ' (active)' : ''}; `
      + (unavailable.has(entry.index) ? `unavailable (${unavailable.get(entry.index)})`
        : held && (held.resetAt === null || held.resetAt > at)
          ? `hold ${held.reason}, reset ${held.resetAt ?? 'unknown'}` : 'no observed hold')
      + (signedOut && signedOut.resetAt > at ? `; signed out, held until a fresh sign-in or ${signedOut.resetAt}` : '')
      + (quota?.windows.some(Boolean) ? `; fresh usage, switches at ${Math.min(configuration.threshold, 80)}%`
        + `; five-hour ${quota.fiveHourUnreported ? 'unreported' : `${quota.windows[0]?.utilizationPct ?? 'unknown'}%`}, weekly ${quota.windows[1]?.utilizationPct ?? 'unknown'}%, measured at ${quota.at}`
        : '; usage stale or unavailable, switching only after a typed limit reply');
  });
  const last = state.switches.at(-1);
  return `Model login pool: using approved login ${state.active + 1} of ${entries.length}. ` + members.join(' | ')
    + (state.handoffAttempts?.at(-1)?.phase === 'prepared' ? ' A continuing-session login move was prepared but is not confirmed.' : '')
    + (state.signinRepairs?.length ? ` Recorded sign-in repair items: ${state.signinRepairs.map(item => `${item.account} on ${item.machine}; desk /subscription-signin`).join(' | ')}.` : '')
    + (last ? ` Last switch: ${last.from} to ${last.to}, ${last.reason}, at ${last.at}.` : ' Last switch: none.');
}

/** Session steps expose the registered driver's typed observation rather than CLI result frames.
 * Reuse that classification; preserve the uncertain step and select only for subsequent work. */
export function observeHarnessSessionLimit(pool, entry, observation) {
  if (observation.kind === 'Success' && observation.value.phase === 'pause-observed' && observation.value.detail === 'rate-limited')
    pool?.observe(entry, { failure: { failureClass: 'limit', resetAt: null } });
  return observation;
}

/** The harness CLI's own signed-out evidence, as 1.x QuotaPoller treats the CLI's signed-out report: its login
 * check (`auth status --json`) reporting `loggedIn: false`, or a model result frame whose provider status is 401
 * (tests/fixtures/provider-failure/claude-auth-401-result.json: a handed-over token the provider refuses still
 * reports `loggedIn: true`). Either holds that login so the next selection takes another approved login with
 * room. Only those two exact fields are read; the turn's own outcome is unchanged and never retried here. */
export function observeHarnessSignIn(pool, entry, io) {
  if (!pool) return io;
  return { ...io, execute: async input => {
    const result = await io.execute(input);
    const status = input.args?.[0] === 'auth' && input.args[1] === 'status';
    const model = typeof input.stdin === 'string' && input.stdin.length > 0;
    if (status || model) {
      let frame = null;
      try { frame = JSON.parse(result.stdout); } catch { /* not a status report or result frame: no signal */ }
      if (frame && typeof frame === 'object' && !Array.isArray(frame) && (status ? frame.loggedIn === false
        : frame.type === 'result' && frame.is_error === true && frame.api_error_status === 401)) pool.observeSignedOut(entry);
    }
    return result;
  } };
}

/** The existing durable run log is the loss detector for the selection sidecar. A run cannot
 * dispatch before its launch row names this configuration; missing state on restart is not fresh. */
export function harnessPoolPreviouslyLaunched(path, identity, readText = read) {
  let text;
  try { text = readText(path); } catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
  return text.split('\n').filter(Boolean).some(line => {
    let row; try { row = JSON.parse(line); } catch { fail('run log is unreadable; cannot establish selection history'); }
    return Array.isArray(identity) ? identity.includes(row.harnessLoginPool) : row.harnessLoginPool === identity;
  });
}
