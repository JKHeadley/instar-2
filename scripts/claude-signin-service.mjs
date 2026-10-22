// 1.x SubscriptionReloginService owns approval/unattended policy, the repair-cell
// route, browser navigation and single flight. This adapter only observes it.
// No PIN, operator session or approval POST belongs to the agent-side adapter.
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname } from 'node:path';
import { readSigninCandidateConfig } from './claude-signin-io.mjs';

const ID = /^[a-zA-Z0-9._:-]{1,160}$/u;
const validId = value => typeof value === 'string' && ID.test(value);
const ACTIVE = ['approved', 'cli-starting', 'artifact-ready', 'browser-driving', 'cli-finishing',
  'identity-verifying', 'auth-verifying', 'waiting-operator-only'];
const terminal = reason => ({ kind: 'held', reason });
const receiptOf = e => ({ id: e.id, accountId: e.accountId, machineId: e.machineId, profileId: e.profileId,
  sourceEpisodeId: e.sourceEpisodeId, inputDigest: e.inputDigest, createdAt: e.createdAt });

/** Keep the already-running command attached to the phone approval. No new
 * scheduler, sender or retry is created; every iteration is a read only. */
export async function waitForSigninService({ observe, save, notice, stopped, now = Date.now,
  pause = ms => delay(ms), receipt, since }) {
  const until = now() + 600_000;
  let last = terminal('repair-service-unavailable'), announced = false;
  for (let count = 0; count < 300 && now() < until && !stopped(); count++) {
    last = await observe(receipt, since);
    if (stopped()) return terminal('repair-service-unavailable');
    if (last.receipt && JSON.stringify(last.receipt) !== JSON.stringify(receipt)) {
      receipt = last.receipt; save(receipt);
    }
    if (last.kind !== 'pending') return last;
    if (!announced) { notice(); announced = true; }
    await pause(2000);
  }
  return last;
}

/** Port the 1.x cell's suggested/active/terminal distinction and exact target
 * binding. A service success is permission to VERIFY, never proof of recovery. */
export async function observeSigninService({ binding, get, since, previous }) {
  try {
    let episode;
    if (previous) {
      if (!validId(previous.id)) return terminal('repair-service-binding-differs');
      const response = await get(`/subscription-relogin/${encodeURIComponent(previous.id)}/events`);
      if (response.enabled !== true) return terminal('repair-service-unavailable');
      episode = response.episode;
    } else {
      const response = await get(`/subscription-relogin?accountId=${encodeURIComponent(binding.accountId)}&limit=100`);
      if (response.enabled !== true || !Array.isArray(response.episodes) || response.episodes.length > 100)
        return terminal('repair-service-unavailable');
      const matches = response.episodes.filter(e => e.accountId === binding.accountId && e.machineId === binding.machineId
        && (e.state === 'suggested' || ACTIVE.includes(e.state) || Date.parse(e.createdAt) >= since));
      if (matches.length !== 1) return terminal('repair-service-incident-unavailable');
      [episode] = matches;
    }
    if (!episode || !validId(episode.id) || episode.accountId !== binding.accountId
      || episode.machineId !== binding.machineId || episode.profileId !== binding.profileId
      || !Number.isSafeInteger(episode.sourceEpisodeId) || episode.sourceEpisodeId < 1
      || !/^sha256:[a-f0-9]{64}$/u.test(episode.inputDigest) || !Number.isFinite(Date.parse(episode.createdAt)))
      return terminal('repair-service-binding-differs');
    const receipt = receiptOf(episode);
    if (previous && Object.keys(receipt).some(key => previous[key] !== receipt[key]))
      return terminal('repair-service-binding-differs');
    if (!['approval', 'unattended'].includes(episode.mode)) return terminal('repair-service-observe-only');
    if (episode.state === 'suggested') return { kind: 'pending', reason: 'phone-approval-required', receipt };
    // The 1.x service consumed the operator act or its current unattended policy.
    // Never manufacture that act, renew it, or treat a mere state label as one.
    const approved = Date.parse(episode.approvedAt), expires = Date.parse(episode.approvalExpiresAt);
    if (!Number.isFinite(approved) || !Number.isFinite(expires) || expires <= approved)
      return terminal('repair-service-approval-unavailable');
    if (episode.state === 'succeeded') {
      const finished = Date.parse(episode.finishedAt);
      if (!Number.isFinite(finished) || finished < approved || finished > expires)
        return terminal('repair-service-approval-unavailable');
      return { kind: 'complete', receipt };
    }
    if (ACTIVE.includes(episode.state)) return { kind: 'pending', receipt,
      reason: episode.state === 'waiting-operator-only' ? 'phone-action-required' : 'repair-service-running' };
    return terminal('repair-service-refused');
  } catch { return terminal('repair-service-unavailable'); }
}

const privatePath = (path, directory) => {
  if (typeof path !== 'string' || !path.startsWith('/') || realpathSync(path) !== path)
    throw Error('signin-service-private-path-required');
  const s = lstatSync(path);
  if (s.uid !== process.getuid() || (s.mode & 0o077) !== 0 || (directory ? !s.isDirectory() : !s.isFile() || s.size > 4096))
    throw Error('signin-service-private-path-required');
  if (!directory) privatePath(dirname(path), true);
  return path;
};

/** An installation-owner binding to the existing LOCAL service. Credentials and
 * browser profiles never cross machines; only the existing HTTPS dashboard is
 * handed to the phone. The API bearer is a private file, never an argv value. */
export function createSigninService(binding, profile, { signal, fetchImpl = fetch } = {}) {
  if (!binding || ['accountId', 'machineId', 'profileId'].some(key => !validId(binding[key]))
    || binding.account !== profile.expectedAccount) throw Error('signin-service-binding-required');
  const base = new URL(binding.url), dashboard = new URL(binding.dashboardUrl);
  if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || !base.port || base.pathname !== '/'
    || base.username || base.password || base.search || base.hash) throw Error('signin-service-loopback-required');
  if (dashboard.protocol !== 'https:' || dashboard.username || dashboard.password || dashboard.search
    || ['localhost', '127.0.0.1', '[::1]'].includes(dashboard.hostname)) throw Error('signin-service-phone-link-required');
  const config = privatePath(profile.configDirectory, true), tokenFile = privatePath(binding.tokenFile, false);
  const token = readFileSync(tokenFile, 'utf8').trim();
  if (!/^[\x21-\x7e]{16,4096}$/u.test(token)) throw Error('signin-service-token-unavailable');
  const current = () => {
    try { return privatePath(config, true) === config && privatePath(tokenFile, false) === tokenFile
      && readFileSync(tokenFile, 'utf8').trim() === token; } catch { return false; }
  };
  const get = async path => {
    if (!current() || signal?.aborted) throw Error('signin-service-binding-withdrawn');
    const response = await fetchImpl(new URL(path, base), { method: 'GET', redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
    let reader;
    try {
      if (!response.ok) throw Error('signin-service-unavailable');
      reader = response.body?.getReader();
      if (!reader) throw Error('signin-service-unavailable');
      const chunks = []; let size = 0;
      for (let count = 0; count < 1024; count++) {
        const part = await reader.read();
        if (part.done) return JSON.parse(Buffer.concat(chunks).toString('utf8'));
        size += part.value.byteLength;
        if (size > 262144) break;
        chunks.push(part.value);
      }
      throw Error('signin-service-response-limit');
    } finally { if (reader) await reader.cancel().catch(() => {}); else await response.body?.cancel(); }
  };
  return { link: dashboard.href, current,
    observe: async (previous, since) => {
      try {
        // Layer below: the service must still map this same account to this same
        // native config home. An episode alone cannot establish that mapping.
        const pool = await get('/subscription-pool');
        const matches = pool.accounts?.filter(a => a.id === binding.accountId);
        if (!Array.isArray(matches) || matches.length !== 1 || matches[0].email !== profile.expectedAccount
          || matches[0].configHome !== config || matches[0].identityDrifted === true)
          return terminal('repair-service-binding-differs');
        return await observeSigninService({ binding, get, previous, since });
      } catch { return terminal('repair-service-unavailable'); }
    },
    candidate: () => current() && !signal?.aborted ? readSigninCandidateConfig(config) : null };
}
