import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
// @ts-expect-error installer host module
import { prepareLogin } from '../../scripts/login-preparation.mjs';

const roots: string[] = [];
const request = { provider: 'anthropic', account: 'installer@example.test' };
function fixture() {
  const parent = mkdtempSync(join(tmpdir(), 'instar-login-preparation-')); roots.push(parent);
  const root = join(parent, 'agent'); mkdirSync(root);
  const run = (command: string, input: string) => execFileSync(process.execPath,
    [resolve('bin/instar2.mjs'), command, root], { input, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] });
  run('setup', 'Assistant\nHelp with my work\n0\nnone\n');
  return { parent, root, run };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it('prepares and reopens a fresh role setup through the product entry without granting a login', () => {
  const { root, run, parent } = fixture();
  const first = run('prepare-login', JSON.stringify(request));
  expect(first).toContain('No login is connected or authorized');
  expect(run('prepare-login', JSON.stringify(request))).toBe(first);
  const saved = JSON.parse(readFileSync(join(root, 'login-preparation/request.json'), 'utf8'));
  expect(saved).toMatchObject({ ...request, authority: null, custody: null, state: 'awaiting-verified-enrollment' });
  expect(readdirSync(join(root, 'login-preparation/profile')).sort()).toEqual(['config', 'home', 'work']);
  expect(readdirSync(parent)).toEqual(['agent']);
  expect(readdirSync(root)).not.toContain('harness-logins.json');
});

it('retains the original request when a different account is supplied', () => {
  const { root } = fixture(); prepareLogin(root, request);
  const path = join(root, 'login-preparation/request.json'), before = readFileSync(path, 'utf8');
  expect(() => prepareLogin(root, { ...request, account: 'different@example.test' })).toThrow('Resume the saved enrollment');
  expect(readFileSync(path, 'utf8')).toBe(before);
});

it('requires completed role setup and never upgrades its receipt to standing', () => {
  const parent = mkdtempSync(join(tmpdir(), 'instar-no-role-')); roots.push(parent);
  expect(() => prepareLogin(parent, request)).toThrow('Run setup');
  expect(readdirSync(parent)).toEqual([]);
});

it.each(['../outside', '/tmp/outside'])('refuses caller write paths %s before creating preparation', path => {
  const { root } = fixture();
  expect(() => prepareLogin(root, { ...request, path })).toThrow('Supply only provider and account');
  expect(readdirSync(root)).not.toContain('login-preparation');
});

it('rejects a symlinked root and an escaping profile subtree before any write', () => {
  const { root, parent } = fixture();
  const alias = join(parent, 'alias'); symlinkSync(root, alias);
  expect(() => prepareLogin(alias, request)).toThrow('unsafe installation path');
  const outside = join(parent, 'outside'); mkdirSync(outside);
  mkdirSync(join(root, 'login-preparation'));
  symlinkSync(outside, join(root, 'login-preparation/profile'));
  expect(() => prepareLogin(root, request)).toThrow('unsafe installation path');
  expect(readdirSync(outside)).toEqual([]);
  expect(readdirSync(join(root, 'login-preparation'))).toEqual(['profile']);
});

it('rejects hard-linked request files', () => {
  const { root, parent } = fixture();
  mkdirSync(join(root, 'login-preparation'));
  const outside = join(parent, 'outside'); writeFileSync(outside, '{}');
  linkSync(outside, join(root, 'login-preparation/request.json'));
  expect(() => prepareLogin(root, request)).toThrow('unsafe installation path');
  expect(readFileSync(outside, 'utf8')).toBe('{}');
});

it('refuses an occupied profile directory before publishing a request', () => {
  const { root } = fixture();
  mkdirSync(join(root, 'login-preparation'));
  writeFileSync(join(root, 'login-preparation/profile'), 'retained');
  expect(() => prepareLogin(root, request)).toThrow('profile path is occupied');
  expect(readdirSync(join(root, 'login-preparation'))).toEqual(['profile']);
});

it('resumes a partially created directory tree without replacing prior files', () => {
  const { root } = fixture();
  mkdirSync(join(root, 'login-preparation/profile/home'), { recursive: true });
  writeFileSync(join(root, 'login-preparation/profile/home/kept'), 'retained');
  expect(prepareLogin(root, request).state).toBe('awaiting-verified-enrollment');
  expect(readFileSync(join(root, 'login-preparation/profile/home/kept'), 'utf8')).toBe('retained');
});

it.each([{}, { ...request, provider: 'unknown' }, { ...request, account: '' }, { ...request, token: 'do-not-store' }])
('rejects malformed or credential-bearing selections', selection => {
  const { root } = fixture();
  expect(() => prepareLogin(root, selection)).toThrow('Supply only provider and account');
  expect(readdirSync(root)).not.toContain('login-preparation');
});

async function prompt(root: string, values: Array<string | null>) {
  // @ts-expect-error installer host module
  const { promptLoginPreparation } = await import('../../scripts/login-preparation.mjs');
  let output = '', reads = 0;
  const status = await promptLoginPreparation(root, {
    write: (text: string) => { output += text; },
    read: async () => { reads += 1; return values.shift() ?? null; },
  });
  return { status, output, reads };
}

it.each(['anthropic', 'openai'])('prompts for %s and consumes the same installed selection without repeating questions', async provider => {
  const { root } = fixture();
  const first = await prompt(root, [provider, request.account]);
  expect(first.status).toBe(0); expect(first.reads).toBe(2);
  expect(first.output).toContain('Never enter passwords');
  const path = join(root, 'login-preparation/request.json'), bytes = readFileSync(path, 'utf8');
  expect(JSON.parse(bytes)).toMatchObject({ provider, account: request.account, authority: null, custody: null });
  const resumed = await prompt(root, []);
  expect(resumed.status).toBe(0); expect(resumed.reads).toBe(0);
  expect(resumed.output).toContain('No login is connected or authorized');
  expect(readFileSync(path, 'utf8')).toBe(bytes);
  expect(readdirSync(root)).not.toContain('harness-logins.json');
  expect(readdirSync(root)).not.toContain('run-config.json');
});

it.each([{ values: [] }, { values: ['anthropic'] }])('pauses incomplete terminal input without publishing a request: $values', async ({ values }) => {
  const { root } = fixture();
  expect(await prompt(root, values)).toMatchObject({ status: 2 });
  expect(readdirSync(root)).not.toContain('login-preparation');
  expect((await prompt(root, [request.provider, request.account])).status).toBe(0);
});

it('refuses an invalid provider before reading the account, and never echoes rejected input', async () => {
  const { root } = fixture();
  await expect(prompt(root, ['unknown-private-value', request.account])).rejects.toThrow('choose anthropic or openai');
  expect(readdirSync(root)).not.toContain('login-preparation');
  await expect(prompt(root, ['anthropic', ''])).rejects.toThrow('invalid account selection');
});

it('revalidates saved preparation rather than trusting a completion label', async () => {
  const { root } = fixture(); prepareLogin(root, request);
  const path = join(root, 'login-preparation/request.json');
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...saved, authority: 'forged-grant' }));
  const before = readFileSync(path, 'utf8');
  await expect(prompt(root, [])).rejects.toThrow('different account request');
  expect(readFileSync(path, 'utf8')).toBe(before);
});

it('requires role setup and safe paths before asking anything', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'instar-terminal-no-role-')); roots.push(parent);
  await expect(prompt(parent, [])).rejects.toThrow('Run setup');
  const { root, parent: installed } = fixture();
  const alias = join(installed, 'alias'); symlinkSync(root, alias);
  await expect(prompt(alias, [])).rejects.toThrow('unsafe installation path');
});

// Exercise isTTY through an actual terminal, not an injected boolean. Python's
// standard-library PTY works on both supported POSIX hosts; no provider is called.
function terminal(root: string, input: string) {
  const python = `import json,os,pty,subprocess,sys
master,slave=pty.openpty()
try:
 p=subprocess.Popen([sys.argv[1],sys.argv[2],'prepare-login',sys.argv[3]],stdin=slave,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 os.close(slave)
 os.write(master,sys.argv[4].encode())
 try: out,err=p.communicate(timeout=30)
 except subprocess.TimeoutExpired:
  p.kill()
  p.communicate()
  raise
 print(json.dumps({'status':p.returncode,'stdout':out,'stderr':err}))
finally: os.close(master)
`;
  return JSON.parse(execFileSync('python3', ['-c', python, process.execPath, resolve('bin/instar2.mjs'), root, input],
    { encoding: 'utf8', timeout: 35000 }));
}

it('runs terminal setup → preparation → repeat through the shipped CLI; run still requires admission', () => {
  const { root } = fixture();
  const first = terminal(root, 'anthropic\ninstaller@example.test\n');
  expect(first.status, first.stderr).toBe(0);
  expect(first.stdout).toContain('Provider (anthropic or openai)');
  expect(first.stdout).toContain('Protected operator enrollment and phone confirmation are not implemented');
  const resumed = terminal(root, '');
  expect(resumed.status, resumed.stderr).toBe(0);
  expect(resumed.stdout).not.toContain('Provider (');
  expect(() => execFileSync(process.execPath, [resolve('bin/instar2.mjs'), 'run', root],
    { encoding: 'utf8', stdio: 'pipe', timeout: 30000 })).toThrow();
});

it('terminal EOF pauses and invalid input fails with no saved selection', () => {
  const { root } = fixture();
  expect(terminal(root, '\x04').status).toBe(2);
  const bad = terminal(root, 'private-invalid-provider\n');
  expect(bad.status).toBe(1);
  expect(bad.stderr).toContain('choose anthropic or openai');
  expect(bad.stderr).not.toContain('private-invalid-provider');
  expect(readdirSync(root)).not.toContain('login-preparation');
});
