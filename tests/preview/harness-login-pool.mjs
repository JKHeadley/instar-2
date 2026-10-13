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
    ['profile', 'activation', 'authority', 'toolsActivation', 'sessionActivation'].filter(key => entry[key] !== undefined)
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
    for (const key of ['authority', 'toolsActivation', 'sessionActivation'])
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
  return { at, windows };
}

function quotaLimit(reading, threshold) {
  const windows = reading?.windows.filter(window => window && window.utilizationPct >= threshold) ?? [];
  return windows.length ? { reason: 'usage-threshold', resetAt: Math.max(...windows.map(window => window.resetAt)) } : null;
}

export function harnessQuotaLimit(document, profile, threshold, now, usageAccount) {
  return quotaLimit(harnessQuotaReading(document, profile, now, usageAccount), threshold);
}

/** The root's existing writer lease serializes this small durable selection record. History contains
 * only profile references, causes and times; retained for audit, never model text or credentials.
 * A missing initial record is installed durably before use; corrupt/mismatched state holds admission.
 * No timer retries: an exhausted profile becomes eligible after a provider/reading reset time.
 * Unknown resets recover from newer matched readings with capacity in both quota windows. */
export function createHarnessLoginPool({ configuration, statePath, now, validate,
  unavailable = new Map(), readText = read, write = durablePreviewWrite, previouslyLaunched = () => false, usage = () => configuration.usageFile
    ? JSON.parse(readText(configuration.usageFile)) : null }) {
  const { entries, identity } = configuration;
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
  const admitted = (entry, tools) => {
    if (!configuration.current()) fail('manifest changed; restart with reviewed configuration');
    validate(entry, tools);
    return entry;
  };
  return Object.freeze({
    select(tools = false) {
      const at = now();
      let reading = null;
      try { reading = usage(); } catch { /* A failed quota observation cannot create a limit. */ }
      for (const entry of entries) {
        const quota = harnessQuotaReading(reading, entry.profile, at, entry.usageAccount);
        const limit = quotaLimit(quota, configuration.threshold);
        if (limit) hold(entry, { ...limit, observedAt: quota.at });
        const previous = state.holds[entry.index];
        if (previous?.resetAt === null && quota && quota.at > previous.observedAt
          && quota.windows.every(window => window && window.utilizationPct < configuration.threshold)) {
          const holds = { ...state.holds };
          delete holds[entry.index];
          persist({ ...state, holds });
        }
      }
      const limited = index => state.holds[index] && (state.holds[index].resetAt === null || state.holds[index].resetAt > at);
      if (!limited(state.active) && !unavailable.has(state.active)) return admitted(entries[state.active], tools);
      for (let offset = 1; offset < entries.length; offset++) {
        const index = (state.active + offset) % entries.length;
        if (limited(index) || unavailable.has(index)) continue;
        const next = admitted(entries[index], tools);
        const event = { from: entries[state.active].profile.reference, to: next.profile.reference,
          reason: unavailable.has(state.active) ? 'member-unavailable' : state.holds[state.active].reason, at, sequence: state.switches.length + 1 };
        persist({ ...state, active: index, switches: [...state.switches, event] });
        return next;
      }
      fail('has no reviewed login with available capacity');
    },
    observe(entry, result) {
      if (entries[entry?.index] !== entry) fail('observation names an unreviewed login');
      if (result?.failure?.failureClass !== 'limit') return;
      const reset = result.failure.resetAt;
      hold(entry, { reason: 'provider-limit', observedAt: now(), resetAt: Number.isSafeInteger(reset) && reset > now() ? reset : null });
    },
    notices: () => [
      ...state.switches.filter(event => event.reason !== 'member-unavailable').map(event => ({ key: `doorway:harness-login:${state.noticeIdentity ?? identity}:${event.sequence}`,
        line: `The model login reached its ${event.reason === 'usage-threshold' ? 'configured usage threshold' : 'usage limit'}. I switched to the next approved login for this runner.` })),
      ...(state.exclusions ?? []).map(({ index }) => ({ key: `doorway:harness-login:${identity}:unavailable:${index}`,
        line: `Approved model login ${index + 1} was unavailable and was removed from selection. See status for current login availability.` })),
    ],
    status: () => harnessLoginPoolStatus(configuration, state, unavailable, usage, now),
    get state() { return structuredClone(state); },
  });
}

export function harnessLoginPoolStatus(configuration, state, unavailable, usage, now) {
  const { entries } = configuration;
  let document = null;
  try { document = usage(); } catch { /* Report unknown freshness on the pull surface. */ }
  const at = now();
  const members = entries.map(entry => {
    const held = state.holds[entry.index];
    const quota = harnessQuotaReading(document, entry.profile, at, entry.usageAccount);
    return `${entry.index + 1}: ${entry.profile.reference}${entry.index === state.active ? ' (active)' : ''}; `
      + (unavailable.has(entry.index) ? `unavailable (${unavailable.get(entry.index)})`
        : held && (held.resetAt === null || held.resetAt > at)
          ? `hold ${held.reason}, reset ${held.resetAt ?? 'unknown'}` : 'no observed hold')
      + (quota?.windows.some(Boolean) ? `; fresh usage, switches at ${configuration.threshold}%`
        : '; usage stale or unavailable, switching only after a typed limit reply');
  });
  const last = state.switches.at(-1);
  return `Model login pool: using approved login ${state.active + 1} of ${entries.length}. ` + members.join(' | ')
    + (last ? ` Last switch: ${last.from} to ${last.to}, ${last.reason}, at ${last.at}.` : ' Last switch: none.');
}

/** Session steps expose the registered driver's typed observation rather than CLI result frames.
 * Reuse that classification; preserve the uncertain step and select only for subsequent work. */
export function observeHarnessSessionLimit(pool, entry, observation) {
  if (observation.kind === 'Success' && observation.value.phase === 'pause-observed' && observation.value.detail === 'rate-limited')
    pool?.observe(entry, { failure: { failureClass: 'limit', resetAt: null } });
  return observation;
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
