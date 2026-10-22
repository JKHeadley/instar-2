// Physical Claude adapter. Ported from PlainChromeReloginBrowser (normal
// LaunchServices launch), FrameworkLoginDriver (isolated auth login), and
// CredentialIdentityOracle/OAuthRefresher (live identity and scoped Keychain).
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { parseClaudeSigninUrl } from './claude-signin-repair.mjs';

const PROFILE = 'https://api.anthropic.com/api/oauth/profile';
const USAGE = 'https://api.anthropic.com/api/oauth/usage';
export const signinDigest = value => createHash('sha256').update(value).digest('hex');

/** No error or response prose escapes this port. A 403 is unknown, not sign-out.
 * R26/36: identity comes from the provider, never auth-status metadata. */
export async function readSigninEndpoint(url, token, { signal, fetchImpl = fetch } = {}) {
  if (![PROFILE, USAGE].includes(url)) throw Error('signin-endpoint-refused');
  let response, reader;
  try {
    response = await fetchImpl(url, { redirect: 'error', signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'anthropic-beta': 'oauth-2025-04-20' } });
    if (response.status === 401) return { kind: 'auth-refused' };
    if (!response.ok) return { kind: 'unknown' };
    reader = response.body?.getReader();
    if (!reader) return { kind: 'unknown' };
    const chunks = []; let size = 0;
    for (let count = 0; count < 1024; count++) {
      const part = await reader.read();
      if (part.done) return { kind: 'read', body: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
      size += part.value.byteLength;
      if (size > 65536) return { kind: 'unknown' };
      chunks.push(part.value);
    }
  } catch { /* Transport errors are unknown and may contain secrets. */ }
  finally { if (reader) await reader.cancel().catch(() => {}); else await response?.body?.cancel().catch(() => {}); }
  return { kind: 'unknown' };
}
export async function inspectSignin(token, options) {
  const result = await readSigninEndpoint(PROFILE, token, options);
  const identity = profileIdentity(result, options?.profile);
  return { kind: result.kind !== 'read' ? result.kind : identity === 'match' ? 'healthy'
    : identity === 'mismatch' ? 'mismatch' : 'unknown', source: signinDigest(token) };
}
function profileIdentity(result, profile) {
  if (result.kind !== 'read' || typeof result.body?.account?.email !== 'string' || !result.body.account.email
    || typeof result.body?.organization?.uuid !== 'string' || !result.body.organization.uuid || !profile) return 'unknown';
  return result.body.account.email.toLowerCase() === profile.expectedAccount.toLowerCase()
    && result.body.organization.uuid === profile.organization ? 'match' : 'mismatch';
}
export async function verifySigninIdentity(token, profile, options) {
  const result = await readSigninEndpoint(PROFILE, token, options);
  return { kind: profileIdentity(result, profile) };
}
export async function verifySigninUse(token, options) {
  const result = await readSigninEndpoint(USAGE, token, options);
  if (result.kind !== 'read') return { kind: 'unknown' };
  const windows = [result.body?.five_hour, result.body?.seven_day];
  return { kind: windows.every(window => Number.isFinite(window?.utilization)
    && window.utilization >= 0 && window.utilization <= 100 && Number.isFinite(Date.parse(window.resets_at)))
    ? 'verified' : 'unknown' };
}

const execute = (file, args, options = {}) => new Promise((resolve, reject) => {
  execFile(file, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 65536, ...options }, (error, stdout) => {
    if (error) reject(Error('signin-native-operation-unavailable')); else resolve(stdout);
  });
});

/** The browser mapping is installed by the account owner, never guessed from
 * Chrome's ambient/default profile or copied from another account. */
export function validateSigninBrowser(binding, profile) {
  if (!binding || binding.account !== profile.expectedAccount || typeof binding.directory !== 'string'
    || !binding.directory.startsWith('/') || realpathSync(binding.directory) !== binding.directory)
    throw Error('signin-browser-binding-required');
  const stat = lstatSync(binding.directory);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0)
    throw Error('signin-browser-must-be-private');
  // A dedicated profile must not be the operator's normal Chrome user-data root.
  const personal = join(process.env.HOME, 'Library/Application Support/Google/Chrome');
  if (binding.directory === personal || binding.directory.startsWith(`${personal}/`))
    throw Error('signin-personal-browser-refused');
  return binding.directory;
}

/** One CLI, one normal Chrome launch, bounded lifetime; no CDP, headless flags,
 * Apple Events, synthetic input, page bypass or arbitrary command from config.
 * The person completes the offered sign-in controls in their account's profile. */
export async function runClaudeSignin({ profile, browser, directory, signal, onPid = () => {}, openBrowser,
  spawnCli = spawn }) {
  if (signal.aborted) return { kind: 'unfinished' };
  if (process.platform !== 'darwin' && !openBrowser) throw Error('signin-normal-browser-platform-unavailable');
  if (`sha256:${signinDigest(readFileSync(profile.executable))}` !== profile.artifact
    || realpathSync(profile.executable) !== profile.executable) throw Error('signin-executable-changed');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const home = join(directory, 'home'), config = join(directory, 'config');
  for (const path of [directory, home, config]) {
    mkdirSync(path, { recursive: true, mode: 0o700 });
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0)
      throw Error('signin-staging-not-private');
  }
  // Never attach to or close an existing Chrome owned by another activity.
  try { lstatSync(join(browser, 'SingletonLock')); throw Error('signin-browser-in-use'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const launch = openBrowser ?? (async url => {
    await execute('/usr/bin/open', ['-na', '/Applications/Google Chrome.app', '--args',
      `--user-data-dir=${browser}`, '--no-first-run', '--no-default-browser-check', '--disable-sync', url]);
  });
  return await new Promise(resolve => {
    let text = '', opened = false, opening = Promise.resolve(), settled = false, stopping = false, launchFailed = false;
    const child = spawnCli(profile.executable, ['auth', 'login'], { cwd: directory,
      env: { PATH: '/usr/bin:/bin', HOME: home, CLAUDE_CONFIG_DIR: config, BROWSER: 'true' },
      stdio: ['pipe', 'pipe', 'pipe'] });
    let killTimer;
    const stop = () => {
      if (settled) return;
      stopping = true;
      child.kill('SIGTERM');
      if (!killTimer) killTimer = setTimeout(() => { if (!settled) child.kill('SIGKILL'); }, 2000);
    };
    const timer = setTimeout(stop, 600_000);
    const abort = () => stop();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) stop();
    const capture = bytes => {
      text += bytes.toString('utf8');
      if (text.length > 65536) { stop(); return; }
      if (opened || signal.aborted || !text.endsWith('\n')) return;
      const url = parseClaudeSigninUrl(text);
      if (url) {
        opened = true;
        opening = launch(url).catch(() => { launchFailed = true; stop(); });
      }
    };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    child.on('error', () => finish(false));
    child.on('close', code => finish(code === 0 && opened && !signal.aborted && !stopping));
    try { onPid(child.pid); } catch { stop(); }
    async function finish(ok) {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(killTimer); signal.removeEventListener('abort', abort);
      text = ''; child.stdin.destroy(); await opening;
      resolve({ kind: ok && !launchFailed ? 'complete' : 'unfinished' });
    }
  });
}

/** 1.x OAuthRefresher's exact non-default per-slot Keychain service. The CLI
 * stores first; only then do we read. Never open the ambient/default service. */
export async function readSigninCandidate(directory, exec = execute) {
  try {
    const service = `Claude Code-credentials-${signinDigest(join(directory, 'config')).slice(0, 8)}`;
    const raw = await exec('/usr/bin/security', ['find-generic-password', '-s', service, '-w']);
    const candidate = JSON.parse(raw).claudeAiOauth;
    if (typeof candidate?.accessToken !== 'string' || !/^[\x21-\x7e]{16,4096}$/u.test(candidate.accessToken)
      || !Number.isSafeInteger(candidate.expiresAt)) return null;
    return { token: candidate.accessToken, expiresAt: candidate.expiresAt };
  } catch { return null; }
}
