// @ts-nocheck -- physical desk preflight; no provider call or credential read.
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkTestLogin } from '../../scripts/check-test-login.mjs';

const policy = { version: 1, reserved: [{ account: 'reserved@example.invalid', usageAccounts: ['reserved'],
  reason: 'This account is reserved for the operator.' }] };
const safe = { expectedAccount: 'test@example.invalid' }, reserved = { expectedAccount: 'reserved@example.invalid' };
const files = { '/safe': safe, '/renamed': reserved, '/pool': { version: 1, logins: [{ profile: '/safe' },
  { profile: '/renamed', unavailable: true }] }, '/root/harness-logins.json': { version: 1, logins: [{ profile: '/renamed' }] } };
const read = path => { if (!(path in files)) throw Error('missing'); return files[path]; };

it('admits a separate explicit test login and refuses the actual reserved account even under a renamed file', () => {
  expect(checkTestLogin(policy, { 'login-profile': '/safe' }, read)).toBe(1);
  expect(() => checkTestLogin(policy, { 'login-profile': '/renamed' }, read)).toThrow('reserved for the operator');
});
it('refuses a reserved fallback, copied inventory, or implicit installed login, including unavailable members', () => {
  for (const options of [{ 'login-profile': '/safe', 'login-pool': '/pool' },
    { 'login-profile': '/safe', inventory: '/pool' }, { root: '/root' }])
    expect(() => checkTestLogin(policy, options, read, () => true)).toThrow('reserved for the operator');
});
it('checks both retained admission and account ids and preserves the explicit single-profile override', () => {
  expect(checkTestLogin(policy, { root: '/root', 'login-profile': '/safe' }, read)).toBe(1);
  for (const row of [{ profile: '/safe', admittedProfile: reserved }, { profile: '/safe', usageAccount: 'reserved' }])
    expect(() => checkTestLogin(policy, { inventory: '/inventory' }, path => path === '/inventory'
      ? { version: 1, logins: [row] } : read(path))).toThrow('reserved for the operator');
});
it('refuses missing policy, account, inventory and metadata instead of assuming a test login is safe', () => {
  expect(() => checkTestLogin({}, { 'login-profile': '/safe' }, read)).toThrow('policy');
  expect(() => checkTestLogin(policy, { root: '/absent' }, read, () => false)).toThrow('no test login');
  expect(() => checkTestLogin(policy, { 'login-profile': '/absent' }, read)).toThrow();
  expect(() => checkTestLogin(policy, { 'login-profile': '/bad' }, () => ({}))).toThrow('account cannot');
  expect(() => checkTestLogin(policy, { inventory: '/bad' }, () => ({version: 1, logins: []}))).toThrow('malformed');
});
it('returns a plain nonzero CLI refusal without disclosing malformed file bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'test-login-'));
  try {
    const p = join(root, 'policy.json'), profile = join(root, 'profile.json');
    writeFileSync(p, JSON.stringify(policy));
    const run = (...extra) => spawnSync(process.execPath, ['scripts/check-test-login.mjs', '--policy', p,
      '--', '--login-profile', profile, ...extra], { encoding: 'utf8' });
    writeFileSync(profile, JSON.stringify(safe)); expect(run().status).toBe(0);
    writeFileSync(profile, JSON.stringify(reserved));
    expect(run()).toMatchObject({ status: 2, stdout: '' });
    expect(run().stderr).toContain('reserved for the operator');
    writeFileSync(profile, 'PRIVATE_MALFORMED_BYTES');
    expect(run().stderr).not.toContain('PRIVATE_MALFORMED_BYTES');
    expect(run().status).toBe(2);
    expect(run('--login-profile', profile).stderr).toContain('duplicate launch option');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
