// @ts-nocheck -- real disposable process/filesystem; provider/browser seams never open live accounts.
import { afterEach, expect, it, vi } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostname, tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { openSigninBrowser, runClaudeSignin, signinDigest, validateSigninBrowser, readSigninEndpoint } from '../../scripts/claude-signin-io.mjs';
import { readHarnessSignin } from '../../scripts/harness-signin.mjs';
import { createHarnessLoginPool } from './harness-login-pool.mjs';
import { readHarnessLogin, readHarnessLoginForSignin } from './harness-user.mjs';

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function disk() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'signin-test-'))); roots.push(root); chmodSync(root, 0o700);
  const browser = join(root, 'browser'); mkdirSync(browser, { mode: 0o700 });
  const profile = { reference: 'signin-test', expectedAccount: 'a@example.invalid', organization: 'org', plan: 'max' };
  return { root, browser, profile };
}
it.each([true, false])('isolates native config while retaining the OS Keychain home, prompt newline=%s', async newline => {
  const f = disk(), executable = join(f.root, 'fixture-cli');
  const capture = JSON.parse(readFileSync(new URL('./fixtures/signin/claude-login-studio.json', import.meta.url), 'utf8')).terminal;
  writeFileSync(executable, '#!/usr/bin/python3\nimport os,sys,time,json\n'
    + 'assert sys.argv[1:]==["auth","login"]\nassert os.environ["BROWSER"]=="true"\n'
    + 'assert os.environ["CLAUDE_CONFIG_DIR"].endswith("/repair/config")\n'
    + `assert os.environ["HOME"]==${JSON.stringify(process.env.HOME)}\n`
    + `sys.stdout.write(${JSON.stringify(newline ? `${capture}\n` : capture)}); sys.stdout.flush(); time.sleep(.1)\n`, { mode: 0o700 });
  f.profile.executable = executable; f.profile.artifact = `sha256:${signinDigest(readFileSync(executable))}`;
  const openBrowser = vi.fn(async () => {}), onPid = vi.fn();
  const result = await runClaudeSignin({ ...f, directory: join(f.root, 'repair'), signal: new AbortController().signal, openBrowser, onPid });
  expect(result.kind).toBe('complete'); expect(openBrowser).toHaveBeenCalledTimes(1);
  expect(new URL(openBrowser.mock.calls[0][0]).searchParams.get('code')).toBe('true');
  expect(onPid.mock.calls[0][0]).toBeGreaterThan(1);
});
it('does not attach to an already-open profile, including Chrome’s dangling SingletonLock symlink', async () => {
  const f = disk(); f.profile.executable = realpathSync('/bin/echo');
  f.profile.artifact = `sha256:${signinDigest(readFileSync(f.profile.executable))}`;
  symlinkSync('host-12345678', join(f.browser, 'SingletonLock'));
  const openBrowser = vi.fn(), spawnCli = vi.fn();
  await expect(runClaudeSignin({ ...f, directory: join(f.root, 'repair'), signal: new AbortController().signal,
    openBrowser, spawnCli })).rejects.toThrow('signin-browser-in-use');
  expect(spawnCli).not.toHaveBeenCalled();
});
it('lets normal Chrome recover its own local stale lock only after the exact PID is absent', async () => {
  const f = disk(); f.profile.executable = realpathSync('/bin/echo');
  f.profile.artifact = `sha256:${signinDigest(readFileSync(f.profile.executable))}`;
  expect(() => process.kill(2147483647, 0)).toThrow();
  symlinkSync(`${hostname()}-2147483647`, join(f.browser, 'SingletonLock'));
  // No provider URL: echo terminates unfinished. Reaching it proves admission,
  // and Chrome's lock remains untouched for Chrome itself to recover.
  const onPid = vi.fn();
  expect(await runClaudeSignin({ ...f, directory: join(f.root, 'repair'), signal: new AbortController().signal,
    openBrowser: vi.fn(), onPid })).toEqual({ kind: 'unfinished' });
  expect(onPid).toHaveBeenCalledTimes(1);
});
it('requires an exact, private, dedicated browser binding', () => {
  const f = disk();
  expect(validateSigninBrowser({ account: f.profile.expectedAccount, directory: f.browser }, f.profile)).toBe(f.browser);
  expect(() => validateSigninBrowser({ account: 'other@example.invalid', directory: f.browser }, f.profile)).toThrow();
  chmodSync(f.browser, 0o755);
  expect(() => validateSigninBrowser({ account: f.profile.expectedAccount, directory: f.browser }, f.profile)).toThrow();
});
it('opens normal Chrome in the background and passes the authorization URL only over stdin', async () => {
  const f = disk(), url = 'https://claude.ai/oauth/authorize?response_type=code&state=synthetic-private-state';
  symlinkSync(`${hostname()}-${process.pid}`, join(f.browser, 'SingletonLock'));
  const run = vi.fn(async (file, args, options) => file === '/bin/ps'
    ? `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=${f.browser} about:blank`
    : file === '/usr/bin/osascript' ? (options.input.includes('location.href = ') ? 'opened\n' : 'blank') : '');
  await openSigninBrowser(url, f.browser, new AbortController().signal, run);
  expect(run.mock.calls[0][1]).toContain('-g'); expect(run.mock.calls[0][1]).toContain('about:blank');
  expect(JSON.stringify(run.mock.calls.map(c => c.slice(0, 2)))).not.toContain('synthetic-private-state');
  const location = { href: 'about:blank' };
  expect(runInNewContext(run.mock.calls[4][2].input, { location })).toBe('opened');
  expect(location.href).toBe(url);
  expect(runInNewContext(run.mock.calls[4][2].input, { location })).toBe('refused');
  run.mockImplementation(async file => file === '/bin/ps' ? 'another process' : '');
  await expect(openSigninBrowser(url, f.browser, new AbortController().signal, run)).rejects.toThrow('process-differs');
});
it.each(['window-unavailable', 'stale-lock-pid'])('waits for the newly launched Chrome tab before navigating once: %s', async startup => {
  const f = disk(), url = 'https://claude.ai/oauth/authorize?response_type=code&state=synthetic-private-state';
  symlinkSync(`${hostname()}-${process.pid}`, join(f.browser, 'SingletonLock'));
  let ready = false, navigations = 0;
  const pause = vi.fn(async () => { ready = true; });
  const run = vi.fn(async (file, args, options) => {
    if (file === '/bin/ps' && !ready && startup === 'stale-lock-pid') throw Error('signin-native-operation-unavailable');
    if (file === '/bin/ps') return `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=${f.browser} about:blank`;
    if (file !== '/usr/bin/osascript') return '';
    if (!ready) return 'unavailable'; // Startup neighbor: Chrome can publish its lock before a scriptable window.
    if (options.input.includes('location.href = ')) { navigations++; return 'opened'; }
    return 'blank';
  });
  await expect(openSigninBrowser(url, f.browser, new AbortController().signal, run, pause)).resolves.toBe(process.pid);
  expect(pause).toHaveBeenCalledWith(500); expect(navigations).toBe(1);
});
it.each(['occupied', 'never-ready', 'stop', 'uncertain-navigation'])('bounds startup and never repeats navigation: %s', async outcome => {
  const f = disk(), controller = new AbortController();
  symlinkSync(`${hostname()}-${process.pid}`, join(f.browser, 'SingletonLock'));
  let navigations = 0;
  const pause = vi.fn(async () => { if (outcome === 'stop') controller.abort(); });
  const run = vi.fn(async (file, args, options) => {
    if (file === '/bin/ps') return `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=${f.browser} about:blank`;
    if (file !== '/usr/bin/osascript') return '';
    if (options.input.includes('location.href = ')) {
      navigations++; throw Error('signin-native-operation-unavailable');
    }
    return outcome === 'occupied' ? 'occupied' : outcome === 'uncertain-navigation' ? 'blank' : 'unavailable';
  });
  await expect(openSigninBrowser('https://claude.ai/oauth/authorize?response_type=code&state=fixture',
    f.browser, controller.signal, run, pause)).rejects.toThrow();
  expect(navigations).toBe(outcome === 'uncertain-navigation' ? 1 : 0);
  expect(pause).toHaveBeenCalledTimes(outcome === 'never-ready' ? 60 : outcome === 'stop' ? 1 : 0);
});
it('detects a missing repair record from the credential it promoted, and validates receipt/custody agreement', () => {
  const f = disk(), custody = join(f.root, 'login.json'), state = join(f.root, 'repair.json');
  const token = 'synthetic-test-credential';
  writeFileSync(custody, JSON.stringify({ v: 1, ...f.profile, account: f.profile.expectedAccount, token, signinBinding: 'binding' }), { mode: 0o600 });
  expect(readHarnessSignin(f.profile, state, custody).reason).toBe('repair-record-lost');
  const receipt = { version: 1, reference: f.profile.reference, account: f.profile.expectedAccount, binding: 'binding',
    phase: 'succeeded', reason: 'identity-and-authenticated-use-verified', updatedAt: 1000, expiresAt: 2000, credentialDigest: signinDigest(token), events: [] };
  writeFileSync(state, JSON.stringify(receipt), { mode: 0o600 });
  expect(readHarnessSignin(f.profile, state, custody).phase).toBe('succeeded');
  writeFileSync(state, JSON.stringify({ ...receipt, credentialDigest: 'wrong' }));
  expect(readHarnessSignin(f.profile, state, custody).phase).toBe('unknown');
  unlinkSync(state); unlinkSync(custody);
  expect(readHarnessSignin(f.profile, state, custody)).toBeNull();
  mkdirSync(`${state}.work`, { mode: 0o700 });
  expect(readHarnessSignin(f.profile, state, custody).reason).toBe('repair-record-lost');
});
it('the pool excludes a repairing login, returns it after verification, and retains new auth failures', () => {
  const f = disk(); let phase = 'browser-driving', needsAuth = false;
  const entries = ['a', 'b'].map((id, index) => ({ index, profile: { ...f.profile, reference: id, expectedAccount: `${id}@example.invalid`, configDirectory: `/test/${id}` } }));
  const pool = createHarnessLoginPool({ configuration: { entries, identity: 'test', current: () => true, threshold: 95 },
    statePath: join(f.root, 'pool.json'), now: () => 1000, validate: () => {},
    readRepair: profile => profile.reference === 'a' ? { phase, updatedAt: 900, expiresAt: 5000, reminders: [500, 2000] } : null,
    usage: () => ({ version: 1, accounts: entries.map(e => ({ email: e.profile.expectedAccount, configHome: e.profile.configDirectory,
      status: needsAuth && e.index === 0 ? 'needs-reauth' : 'active' })) }) });
  expect(pool.select(false, 0).index).toBe(1);
  phase = 'succeeded'; expect(pool.select(false, 0).index).toBe(0);
  expect(pool.notices().filter(n => n.key.startsWith('credential:signin:'))).toHaveLength(1);
  needsAuth = true; expect(pool.select(false, 0).index).toBe(1);
});
it('bounds response bytes and does not echo network exceptions', async () => {
  expect(await readSigninEndpoint('https://api.anthropic.com/api/oauth/profile', 'synthetic-secret',
    { fetchImpl: async () => new Response('x'.repeat(65537)) })).toEqual({ kind: 'unknown' });
  expect(await readSigninEndpoint('https://api.anthropic.com/api/oauth/profile', 'synthetic-secret',
    { fetchImpl: async () => { throw Error('synthetic-secret'); } })).toEqual({ kind: 'unknown' });
});
it('an already-stopped repair creates no native process', async () => {
  const f = disk(), controller = new AbortController(), spawnCli = vi.fn(); controller.abort();
  expect(await runClaudeSignin({ ...f, directory: join(f.root, 'repair'), signal: controller.signal, spawnCli }))
    .toEqual({ kind: 'unfinished' });
  expect(spawnCli).not.toHaveBeenCalled();
});
it('ordinary custody cannot bypass a pending repair, a missing receipt, or expiry', () => {
  const f = disk(), custody = join(f.root, 'login.json'), receiptPath = `${custody}.signin.json`;
  const token = 'synthetic-test-credential';
  writeFileSync(custody, JSON.stringify({ v: 1, ...f.profile, account: f.profile.expectedAccount, token }), { mode: 0o600 });
  expect(readHarnessLogin(f.profile, custody)).toBe(token);
  writeFileSync(receiptPath, JSON.stringify({ phase: 'browser-driving' }), { mode: 0o600 });
  expect(() => readHarnessLogin(f.profile, custody)).toThrow();
  for (const malformed of [null, false, 0, []]) {
    writeFileSync(receiptPath, JSON.stringify(malformed));
    expect(() => readHarnessLogin(f.profile, custody)).toThrow();
  }
  expect(readHarnessLoginForSignin(f.profile, custody)).toBe(token);
  writeFileSync(custody, JSON.stringify({ v: 1, ...f.profile, account: f.profile.expectedAccount, token, signinBinding: 'binding' }));
  const receipt = { phase: 'succeeded', reference: f.profile.reference, account: f.profile.expectedAccount, binding: 'binding',
    credentialDigest: signinDigest(token), expiresAt: Date.now() + 100000 };
  writeFileSync(receiptPath, JSON.stringify(receipt));
  expect(readHarnessLogin(f.profile, custody)).toBe(token);
  writeFileSync(receiptPath, JSON.stringify({ ...receipt, expiresAt: 1 }));
  expect(() => readHarnessLogin(f.profile, custody)).toThrow();
  unlinkSync(receiptPath); expect(() => readHarnessLogin(f.profile, custody)).toThrow();
});
