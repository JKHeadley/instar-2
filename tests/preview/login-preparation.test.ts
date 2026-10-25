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
