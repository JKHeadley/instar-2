// Operator/installer entry, like onboarding. Same admitted account and custody;
// no new role, model, messaging sender or inference call is introduced.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { durablePreviewWrite } from '../tests/preview/durable-write.js';
import { reminderSchedule } from '../tests/preview/secret-custody.js';
import { harnessLoginPath, harnessSigninBinding, readHarnessLoginForSignin } from '../tests/preview/harness-user.mjs';
import { repairHarnessSignin } from './claude-signin-repair.mjs';
import { inspectSignin, readSigninCandidate, runClaudeSignin, signinDigest, validateSigninBrowser,
  verifySigninIdentity, verifySigninUse } from './claude-signin-io.mjs';

export const signinStatePath = profile => `${harnessLoginPath(profile)}.signin.json`;
const phases = ['detected', 'browser-driving', 'identity-verifying', 'auth-verifying', 'promoting', 'succeeded', 'waiting', 'stopped', 'refused'];
const reasons = new Set([...phases, 'stop-or-binding-withdrawn', 'repair-time-budget-exhausted', 'provider-auth-refused',
  'sign-in-unfinished', 'wrong-identity', 'wrong-existing-identity', 'identity-unavailable', 'authenticated-use-unavailable',
  'identity-and-authenticated-use-verified', 'repair-operation-unavailable']);
export function readHarnessSignin(profile, path = signinStatePath(profile), custodyPath = harnessLoginPath(profile)) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size > 262144 || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0)
      throw Error('invalid record');
    const state = JSON.parse(readFileSync(path, 'utf8'));
    if (state.version !== 1 || state.reference !== profile.reference || state.account !== profile.expectedAccount
      || !phases.includes(state.phase) || !reasons.has(state.reason)
      || !Number.isSafeInteger(state.updatedAt) || !Array.isArray(state.events) || state.events.length > 1008)
      throw Error('invalid record');
    if (state.phase === 'succeeded') {
      if (harnessSigninBinding(profile, custodyPath) !== state.binding || !Number.isSafeInteger(state.expiresAt)
        || signinDigest(readHarnessLoginForSignin(profile, custodyPath)) !== state.credentialDigest) throw Error('repair custody differs');
    }
    return state;
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (existsSync(`${path}.work`)) return { phase: 'unknown', reason: 'repair-record-lost' };
      try { if (harnessSigninBinding(profile, custodyPath) !== null) return { phase: 'unknown', reason: 'repair-record-lost' }; }
      catch { /* Missing custody is independently observed by the existing login detector. */ }
      return null;
    }
    return { phase: 'unknown', reason: 'repair-record-unavailable' };
  }
}

/** Explicitly invoked by the installation owner. An account-specific lock spans
 * roots sharing custody. Loss/uncertain locks are retained, never stolen on age. */
export async function runHarnessSignin(rootInput, reference, io = {}) {
  const root = realpathSync(resolve(rootInput)), inventoryPath = join(root, 'harness-logins.json');
  const bytes = readFileSync(inventoryPath, 'utf8'), inventory = JSON.parse(bytes);
  if (inventory.version !== 1 || !Array.isArray(inventory.logins) || inventory.logins.length > 8)
    throw Error('signin-installed-pool-required');
  const matches = inventory.logins.map(row => ({ row, profile: JSON.parse(readFileSync(row.profile, 'utf8')) }))
    .filter(item => item.profile.reference === reference);
  if (matches.length !== 1) throw Error('signin-installed-account-required');
  const { row, profile } = matches[0], profileBytes = readFileSync(row.profile, 'utf8');
  const path = signinStatePath(profile), lock = `${path}.lock`, directory = `${path}.work`;
  const priorBrowser = readHarnessSignin(profile, path)?.browser;
  const browser = validateSigninBrowser(row.signinBrowser
    ?? { account: profile.expectedAccount, directory: io.browser ?? priorBrowser }, profile);
  if (io.browser !== undefined && realpathSync(io.browser) !== browser) throw Error('signin-browser-binding-differs');
  if (inventory.logins.some(other => other !== row && other.signinBrowser?.directory === browser))
    throw Error('signin-browser-shared-between-accounts');
  const binding = signinDigest(JSON.stringify([root, row, profile, browser]));
  const current = () => {
    try { return readFileSync(inventoryPath, 'utf8') === bytes && readFileSync(row.profile, 'utf8') === profileBytes; }
    catch { return false; }
  };
  const controller = new AbortController();
  const stopped = () => controller.signal.aborted || existsSync(join(root, 'preview-stop.json')) || !current();
  if (stopped()) return { phase: 'stopped', reason: 'stop-or-binding-withdrawn' };
  // The existing custody directory is already private and owner-bound. Do not
  // invent custody for a profile which has never been installed there.
  const parent = lstatSync(dirname(path));
  if (!parent.isDirectory() || parent.uid !== process.getuid() || (parent.mode & 0o777) !== 0o700)
    throw Error('signin-custody-unavailable');
  mkdirSync(lock, { mode: 0o700 });
  const browserLock = join(browser, '.instar-signin-lock');
  let timer, browserLocked = false;
  const abort = () => controller.abort();
  process.once('SIGINT', abort); process.once('SIGTERM', abort);
  try {
    mkdirSync(browserLock, { mode: 0o700 }); browserLocked = true;
    let previous = readHarnessSignin(profile, path);
    if (previous && (previous.phase === 'unknown' || previous.binding !== binding)) throw Error('signin-record-binding-differs');
    if (previous?.events.length > 1000) throw Error('signin-history-capacity');
    const write = state => {
      previous = { ...state, reference, account: profile.expectedAccount, binding, browser,
        admission: { root, row, profile, browser, by: `local-installer:uid:${process.getuid()}` } };
      durablePreviewWrite(path, previous);
    };
    // Finite stop monitoring during the one active CLI/browser wait. No repair
    // retry timer; each continuation is an explicit invocation of this command.
    const deadline = Date.now() + 600_000;
    timer = setInterval(() => { if (stopped() || Date.now() >= deadline) controller.abort(); }, 250);
    let candidate = null;
    const candidateNow = async () => {
      const next = await readSigninCandidate(directory);
      return next && next.expiresAt > Date.now() + 5000 ? next : null;
    };
    const transport = { signal: controller.signal };
    const result = await repairHarnessSignin({ now: Date.now, stopped, current,
      read: () => previous, write,
      inspect: async () => {
        // Missing/unreadable custody is MissingLoginSessionDetector's SIGNAL,
        // never a corroborated provider-auth failure.
        try { return await inspectSignin(readHarnessLoginForSignin(profile), { ...transport, profile }); }
        catch { return { kind: 'unknown' }; }
      },
      login: async () => {
        io.write?.('Complete the sign-in in this account’s normal Chrome window. No password or code belongs in this terminal.\n');
        return runClaudeSignin({ profile, browser, directory, signal: controller.signal,
          onPid: pid => { if (Number.isSafeInteger(pid)) durablePreviewWrite(join(directory, 'process.json'), { pid, at: Date.now() }); } });
      },
      identity: async () => {
        candidate = await candidateNow();
        return candidate ? verifySigninIdentity(candidate.token, profile, transport) : { kind: 'unknown' };
      },
      authenticatedUse: async () => candidate ? verifySigninUse(candidate.token, transport) : { kind: 'unknown' },
      promote: async () => {
        const fresh = await candidateNow();
        if (stopped() || !fresh || fresh.token !== candidate?.token || fresh.expiresAt !== candidate.expiresAt)
          throw Error('signin-candidate-changed');
        // Same custody reader and account/org/plan binding as ordinary harness
        // dispatch. Durable before use. The native refresh token stays in Keychain.
        durablePreviewWrite(harnessLoginPath(profile), { v: 1, reference, token: fresh.token,
          account: profile.expectedAccount, organization: profile.organization, plan: profile.plan,
          expiresAt: fresh.expiresAt, signinBinding: binding });
        if (readHarnessLoginForSignin(profile) !== fresh.token) throw Error('signin-custody-readback-differs');
        return { expiresAt: fresh.expiresAt, credentialDigest: signinDigest(fresh.token), reminders: reminderSchedule(fresh.expiresAt) };
      },
    });
    return { phase: result.phase, reason: result.reason };
  } finally {
    clearInterval(timer); controller.abort();
    process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort);
    // The process record is retained in the private work directory. Only this
    // invocation releases its lock; a crash leaves an explicit uncertain lock.
    if (browserLocked) rmdirSync(browserLock);
    rmdirSync(lock);
  }
}
