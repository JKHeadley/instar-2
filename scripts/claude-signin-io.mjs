// Physical Claude adapter. Ported from PlainChromeReloginBrowser (normal
// LaunchServices launch), FrameworkLoginDriver (isolated auth login), and
// CredentialIdentityOracle/OAuthRefresher (live identity and scoped Keychain).
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseClaudeSigninUrl } from './claude-signin-repair.mjs';
import { waitForSigninAuthorization } from './claude-signin-authorize.mjs';
import { readSigninCode } from './claude-signin-code.mjs';

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
  const { input, ...settings } = options;
  const child = execFile(file, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 65536, ...settings }, (error, stdout) => {
    if (error) reject(Error('signin-native-operation-unavailable')); else resolve(stdout);
  });
  child.stdin.end(input);
});

// PlainChromeReloginBrowser's pid-addressed Apple Event transport, narrowed to
// the tab we just opened. Page code (including the URL/state) goes over stdin,
// never argv, following 1.x PlainChromeReloginBrowser's transport.
const PAGE_SCRIPT = `ObjC.import('Foundation');
function fc(s){return (s.charCodeAt(0)<<24)|(s.charCodeAt(1)<<16)|(s.charCodeAt(2)<<8)|s.charCodeAt(3);}
function run(args){
 const D=$.NSAppleEventDescriptor;
 const data=$.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
 const code=$.NSString.alloc.initWithDataEncoding(data,$.NSUTF8StringEncoding).js;
 function spec(want,form,value,from){const r=D.recordDescriptor;
 r.setDescriptorForKeyword(D.descriptorWithTypeCode(fc(want)),fc('want'));
 r.setDescriptorForKeyword(D.descriptorWithEnumCode(fc(form)),fc('form'));
 r.setDescriptorForKeyword(value,fc('seld'));r.setDescriptorForKeyword(from||D.nullDescriptor,fc('from'));
 return r.coerceToDescriptorType(fc('obj '));}
 const tab=spec('prop','prop',D.descriptorWithTypeCode(fc('acTa')),spec('cwin','indx',D.descriptorWithInt32(1),null));
 const ev=D.appleEventWithEventClassEventIDTargetDescriptorReturnIDTransactionID(fc('CrSu'),fc('ExJa'),D.descriptorWithProcessIdentifier(Number(args[0])),-1,0);
 ev.setParamDescriptorForKeyword(tab,fc('----'));
 ev.setParamDescriptorForKeyword(D.descriptorWithString(code),fc('JvSc'));
 const reply=ev.sendEventWithOptionsTimeoutError(3,5,null);
 if(!reply||reply.isNil())return 'unavailable';const out=reply.paramDescriptorForKeyword(fc('----'));
 return out&&!out.isNil()&&out.stringValue?out.stringValue.js:'unavailable';
}`;

export async function evaluateSigninBrowser(pid, browser, code, signal, run = execute) {
  if (signal?.aborted) throw Error('signin-browser-stopped');
  const command = await run('/bin/ps', ['-p', String(pid), '-o', 'args=']);
  if (!command.startsWith('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome ')
    || !`${command.trim()} `.includes(`--user-data-dir=${browser} `) || command.includes('--type='))
    throw Error('signin-browser-process-differs');
  if (signal?.aborted) throw Error('signin-browser-stopped');
  return (await run('/usr/bin/osascript', ['-l', 'JavaScript', '-e', PAGE_SCRIPT, String(pid)],
    { input: code, signal })).trim();
}

export async function openSigninBrowser(url, browser, signal, run = execute,
  pause = ms => delay(ms, undefined, { signal })) {
  if (signal?.aborted || parseClaudeSigninUrl(`${url}\n`) !== url) throw Error('signin-browser-url-refused');
  await run('/usr/bin/open', ['-g', '-na', '/Applications/Google Chrome.app', '--args',
    `--user-data-dir=${browser}`, '--no-first-run', '--no-default-browser-check', '--disable-sync', 'about:blank']);
  for (let attempt = 0; attempt < 60 && !signal?.aborted; attempt++) {
    let match;
    try { match = /^(.*)-(\d+)$/u.exec(readlinkSync(join(browser, 'SingletonLock'))); } catch { /* Chrome is starting. */ }
    if (match && match[1] === hostname() && Number.isSafeInteger(Number(match[2])) && Number(match[2]) > 1) {
      const pid = Number(match[2]);
      // Chrome publishes its lock before the first window accepts Apple Events.
      // Poll only a read; never repeat navigation after an uncertain outcome.
      let ready;
      try { ready = await evaluateSigninBrowser(pid, browser,
        `location.href === 'about:blank' ? 'blank' : 'occupied'`, signal, run); }
      catch (error) {
        if (error.message !== 'signin-native-operation-unavailable') throw error;
        // A stale lock's absent PID or a not-yet-scriptable window is read-only.
      }
      if (ready === 'occupied') throw Error('signin-browser-navigation-unavailable');
      if (ready !== 'blank') { await pause(500); continue; }
      const code = `(() => { if (location.href !== 'about:blank') return 'refused';
        location.href = ${JSON.stringify(url)}; return 'opened'; })()`;
      if (await evaluateSigninBrowser(pid, browser, code, signal, run) !== 'opened')
        throw Error('signin-browser-navigation-unavailable');
      return pid;
    }
    await pause(500);
  }
  throw Error('signin-browser-start-unavailable');
}

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

/** One CLI, one normal Chrome launch, bounded lifetime; no CDP or headless flags.
 * The offered Claude consent uses the measured main-world focus guard. Other
 * provider sign-in controls stay with the existing account browser flow. */
export async function runClaudeSignin({ profile, browser, directory, signal, onPid = () => {}, openBrowser,
  spawnCli = spawn, runBrowser = execute, pause }) {
  if (signal.aborted) return { kind: 'unfinished' };
  if (process.platform !== 'darwin' && !openBrowser) throw Error('signin-normal-browser-platform-unavailable');
  if (`sha256:${signinDigest(readFileSync(profile.executable))}` !== profile.artifact
    || realpathSync(profile.executable) !== profile.executable) throw Error('signin-executable-changed');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const config = join(directory, 'config');
  for (const path of [directory, config]) {
    mkdirSync(path, { recursive: true, mode: 0o700 });
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0)
      throw Error('signin-staging-not-private');
  }
  // Never attach to or close an existing Chrome owned by another activity.
  try {
    const lock = join(browser, 'SingletonLock'); lstatSync(lock);
    const match = /^(.*)-(\d+)$/u.exec(readlinkSync(lock));
    if (!match || match[1] !== hostname() || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) <= 1)
      throw Error('signin-browser-in-use');
    let absent = false;
    try { process.kill(Number(match[2]), 0); } catch (error) { absent = error.code === 'ESRCH'; }
    if (!absent) throw Error('signin-browser-in-use');
    // No unlink and no signal: normal Chrome recovers its own stale local lock.
  }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const browserController = new AbortController();
  const browserSignal = AbortSignal.any([signal, browserController.signal]);
  const launch = openBrowser ?? (async url => {
    const pid = await openSigninBrowser(url, browser, browserSignal, runBrowser);
    const page = { expectedAccount: profile.expectedAccount,
      state: new URL(url).searchParams.get('state'), signal: browserSignal,
      evaluate: code => evaluateSigninBrowser(pid, browser, code, browserSignal, runBrowser),
      pause: pause ?? (ms => delay(ms, undefined, { signal: browserSignal })) };
    const result = await waitForSigninAuthorization(page);
    if (result !== 'clicked' && !browserSignal.aborted) throw Error('signin-authorization-unfinished');
    if (browserSignal.aborted) return;
    const code = await readSigninCode(page);
    if (!code && !browserSignal.aborted) throw Error('signin-code-unavailable');
    return code;
  });
  return await new Promise(resolve => {
    let text = '', opened = false, opening = Promise.resolve(), settled = false, stopping = false, launchFailed = false;
    const child = spawnCli(profile.executable, ['auth', 'login'], { cwd: directory,
      // 1.x isolates CLAUDE_CONFIG_DIR, not the OS user home: security resolves
      // the user's Keychain through HOME. An empty HOME cannot save a login.
      env: { PATH: '/usr/bin:/bin', HOME: process.env.HOME, CLAUDE_CONFIG_DIR: config, BROWSER: 'true' },
      stdio: ['pipe', 'pipe', 'pipe'] });
    let killTimer;
    const stop = () => {
      if (settled) return;
      stopping = true;
      browserController.abort();
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
      if (opened || signal.aborted) return;
      // readline leaves its paste prompt unterminated. Parse complete lines,
      // not whether the most recent chunk happened to end in a newline.
      const url = parseClaudeSigninUrl(text.slice(0, text.lastIndexOf('\n') + 1));
      if (url) {
        opened = true;
        opening = launch(url).then(code => {
          if (!code || settled || browserSignal.aborted) return;
          // 1.x readiness-before-paste, narrowed to this process's private pipe.
          if (!text.trimEnd().endsWith('Paste code here if prompted >') || !child.stdin.writable)
            throw Error('signin-native-paste-not-ready');
          child.stdin.write(`${code}\n`); // Once, in memory; native custody precedes verification.
        }).catch(() => {
          // A native exit cancels the read/wait still in flight. That cleanup is
          // not a browser failure; an actual failed action while alive still is.
          if (settled && browserSignal.aborted) return;
          launchFailed = true; stop();
        });
      }
    };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    child.stdin.on('error', stop);
    child.on('error', () => finish(false));
    child.on('close', code => finish(code === 0 && opened && !signal.aborted && !stopping));
    try { onPid(child.pid); } catch { stop(); }
    async function finish(ok) {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(killTimer); signal.removeEventListener('abort', abort);
      browserController.abort();
      text = ''; child.stdin.destroy(); await opening;
      resolve({ kind: ok && !launchFailed ? 'complete' : 'unfinished' });
    }
  });
}

/** 1.x OAuthRefresher's exact non-default per-slot Keychain service. The CLI
 * stores first; only then do we read. Never open the ambient/default service. */
export async function readSigninCandidate(directory, exec = execute) {
  return readSigninCandidateConfig(join(directory, 'config'), exec);
}
export async function readSigninCandidateConfig(config, exec = execute) {
  try {
    const service = `Claude Code-credentials-${signinDigest(config).slice(0, 8)}`;
    const raw = await exec('/usr/bin/security', ['find-generic-password', '-s', service, '-w']);
    const candidate = JSON.parse(raw).claudeAiOauth;
    if (typeof candidate?.accessToken !== 'string' || !/^[\x21-\x7e]{16,4096}$/u.test(candidate.accessToken)
      || !Number.isSafeInteger(candidate.expiresAt)) return null;
    return { token: candidate.accessToken, expiresAt: candidate.expiresAt };
  } catch { return null; }
}
