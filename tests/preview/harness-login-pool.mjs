// Runner-local selection among explicitly reviewed profiles. Ported from 1.x SubscriptionPool's
// account/config-home selection: never rewrite a shared credential slot and never retry a call.
// Tokens remain in harness-user custody. This module consumes the adapter's typed failure only.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { durablePreviewWrite } from './durable-write.js';
import { harnessLoginPath } from './harness-user.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read = path => readFileSync(path, 'utf8');
const fail = reason => { throw Error(`preview: harness login pool ${reason}`); };

/** --login-pool is an ordered manifest including the primary --login-profile/--activation-record.
 * Paths are absolute; each entry has its own sealed authority and (when tools are on) tools grant.
 * The primary remains the installation/renewal anchor; selection never changes installation policy. */
export function loadHarnessLogins(options, readText = read) {
  const primary = { profile: options['login-profile'], activation: options['activation-record'],
    authority: options['authority-record'], toolsActivation: options['tools-activation'],
    sessionActivation: options['session-work-activation'] };
  const path = options['login-pool'];
  const bytes = path === undefined ? null : readText(path);
  const manifest = bytes === null ? null : JSON.parse(bytes);
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
    const profile = Object.freeze(JSON.parse(readText(row.profile)));
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
  return Object.freeze({ entries: Object.freeze(entries), threshold, usageFile: manifest?.usageFile,
    current: () => bytes === null || readText(path) === bytes,
    identity: hash({ entries: entries.map(({ profile, activation, authority, toolsActivation, sessionActivation, usageAccount }) =>
      ({ profile, activation, authority, toolsActivation, sessionActivation, usageAccount })), threshold }) });
}

/** Read 1.x SubscriptionPool's non-secret quota snapshot. Match email and either config home
 * or the reviewed usageAccount id (the pool may poll the same account in its original home);
 * stale, unavailable, mismatched and malformed readings are not evidence of exhaustion.
 * The provider result remains authoritative when a reading cannot be obtained. */
export function harnessQuotaLimit(document, profile, threshold, now, usageAccount) {
  if (document?.version !== 1 || !Array.isArray(document.accounts)) return null;
  const matches = document.accounts.filter(account => account.email === profile.expectedAccount
    && account.identityDrifted !== true
    && (usageAccount === undefined ? account.configHome === profile.configDirectory : account.id === usageAccount));
  if (matches.length !== 1) return null;
  const quota = matches[0].lastQuota;
  const at = Date.parse(quota?.measuredAt);
  if (!Number.isFinite(at) || at > now || now - at > 5 * 60_000) return null;
  const windows = [quota?.fiveHour, quota?.sevenDay].filter(window => window
    && Number.isFinite(window.utilizationPct) && window.utilizationPct >= threshold && window.utilizationPct <= 100
    && Number.isFinite(Date.parse(window.resetsAt)) && Date.parse(window.resetsAt) > now);
  return windows.length ? { reason: 'usage-threshold', resetAt: Math.max(...windows.map(window => Date.parse(window.resetsAt))) } : null;
}

/** The root's existing writer lease serializes this small durable selection record. History contains
 * only profile references, causes and times; retained for audit, never model text or credentials.
 * A missing initial record is installed durably before use; corrupt/mismatched state holds admission.
 * No timer retries: an exhausted profile becomes eligible after a provider/reading reset time.
 * Unknown reset times stay exhausted until the desk reviews a new pool configuration. */
export function createHarnessLoginPool({ configuration, statePath, now, validate,
  readText = read, write = durablePreviewWrite, previouslyLaunched = () => false, usage = () => configuration.usageFile
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
  if (state?.version !== 1 || state.identity !== identity || !Number.isInteger(state.active)
    || !entries[state.active] || !state.holds || typeof state.holds !== 'object' || Array.isArray(state.holds) || !Array.isArray(state.switches)) fail('state differs; desk migration required');
  for (const [index, hold] of Object.entries(state.holds))
    if (!/^[0-7]$/u.test(index) || !entries[index] || !['provider-limit', 'usage-threshold'].includes(hold?.reason)
      || !(hold.resetAt === null || Number.isSafeInteger(hold.resetAt))) fail('hold is malformed');
  for (const [index, event] of state.switches.entries())
    if (event?.sequence !== index + 1 || !Number.isSafeInteger(event.at)
      || !entries.some(entry => entry.profile.reference === event.from)
      || !entries.some(entry => entry.profile.reference === event.to) || event.from === event.to
      || !['provider-limit', 'usage-threshold'].includes(event.reason)) fail('switch history is malformed');
  const persist = next => { write(statePath, next); state = next; };
  const hold = (entry, evidence) => {
    const previous = state.holds[entry.index];
    // A shorter quota window cannot erase a still-active weekly/provider hold.
    if (previous && (previous.resetAt === null || previous.resetAt > now())) evidence = {
      reason: previous.reason === 'provider-limit' ? previous.reason : evidence.reason,
      resetAt: previous.resetAt === null || evidence.resetAt === null ? null : Math.max(previous.resetAt, evidence.resetAt),
    };
    if (previous?.reason === evidence.reason && previous.resetAt === evidence.resetAt) return;
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
        const limit = harnessQuotaLimit(reading, entry.profile, configuration.threshold, at, entry.usageAccount);
        if (limit) hold(entry, limit);
      }
      const limited = index => state.holds[index] && (state.holds[index].resetAt === null || state.holds[index].resetAt > at);
      if (!limited(state.active)) return admitted(entries[state.active], tools);
      for (let offset = 1; offset < entries.length; offset++) {
        const index = (state.active + offset) % entries.length;
        if (limited(index)) continue;
        const next = admitted(entries[index], tools);
        const event = { from: entries[state.active].profile.reference, to: next.profile.reference,
          reason: state.holds[state.active].reason, at, sequence: state.switches.length + 1 };
        persist({ ...state, active: index, switches: [...state.switches, event] });
        return next;
      }
      fail('has no reviewed login with available capacity');
    },
    observe(entry, result) {
      if (entries[entry?.index] !== entry) fail('observation names an unreviewed login');
      if (result?.failure?.failureClass !== 'limit') return;
      const reset = result.failure.resetAt;
      hold(entry, { reason: 'provider-limit', resetAt: Number.isSafeInteger(reset) && reset > now() ? reset : null });
    },
    notices: () => state.switches.map(event => ({ key: `doorway:harness-login:${identity}:${event.sequence}`,
      line: `The model login reached its ${event.reason === 'usage-threshold' ? 'configured usage threshold' : 'usage limit'}. I switched to the next approved login for this runner.` })),
    status: () => `Model login pool: using approved login ${state.active + 1} of ${entries.length}; `
      + `${entries.filter(entry => !state.holds[entry.index] || state.holds[entry.index].resetAt !== null
        && state.holds[entry.index].resetAt <= now()).length} with no observed usage limit.`,
    get state() { return structuredClone(state); },
  });
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
    return row.harnessLoginPool === identity;
  });
}
