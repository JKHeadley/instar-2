import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const capture = readFileSync(new URL('../fixtures/claude-signed-cache-2026-11-05/policy-limits.json.signature.json', import.meta.url), 'utf8');
const signature = JSON.parse(capture) as { jws: string; receivedAt: number };
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'subscription-signature-'))); roots.push(root);
  const profile = { home: join(root, 'home'), configDirectory: join(root, 'config'), workingDirectory: join(root, 'work'), organization: 'synthetic' };
  for (const path of [profile.home, profile.configDirectory, profile.workingDirectory]) mkdirSync(path, { mode: 0o700 });
  for (const name of ['policy-limits.json', 'policy-limits.json.stamp.json', 'remote-settings.json']) {
    writeFileSync(join(profile.configDirectory, name), readFileSync(new URL(`../fixtures/claude-server-policy-2.1.280/${name}`, import.meta.url)));
  }
  const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => true });
  return { profile, io, directory: profile.configDirectory, inspect: () => io.inspectSubscriptionProfile(profile),
    hooks: () => io.managedHooksDisabled(profile), write: (name: string, value: unknown) => writeFileSync(join(profile.configDirectory, name), JSON.stringify(value)) };
}

it('replays the proof-room signature without changing effective policy, including refresh and removal', () => {
  const f = fixture(), before = f.inspect();
  f.write('policy-limits.json.signature.json', signature);
  expect(f.inspect()).toEqual(before); expect(f.hooks()).toBe(false);
  // These metadata files are produced by the same pinned CLI cache helper for both policy caches.
  for (const base of ['policy-limits.json', 'remote-settings.json']) {
    f.write(`${base}.signature.json`, { ...signature, receivedAt: signature.receivedAt + 1 });
    f.write(`${base}.signature-iat.json`, { typ: 'policy-limits', aud: 'synthetic-audience', sub: 'synthetic-account', ws: 'synthetic-workspace', iat: 123 });
    expect(f.inspect()).toEqual(before);
    f.write(`${base}.signature-iat.json`, { typ: 'policy-limits', iat: 124 });
    expect(f.inspect()).toEqual(before);
    rmSync(join(f.directory, `${base}.signature.json`)); rmSync(join(f.directory, `${base}.signature-iat.json`));
    expect(f.inspect()).toEqual(before);
  }
});

it('still binds effective policy and identity while signature metadata is present', () => {
  const f = fixture(), before = f.inspect();
  f.write('policy-limits.json.signature.json', signature);
  const path = join(f.directory, 'policy-limits.json');
  const policy = JSON.parse(readFileSync(path, 'utf8'));
  f.write('policy-limits.json', { ...policy, restrictions: {} });
  expect(f.inspect().managedConfigurationDigest).not.toBe(before.managedConfigurationDigest);
  f.write('policy-limits.json', { ...policy, defaults: { remote_control_at_startup: true } });
  expect(f.inspect).toThrow('expected false');
  f.write('policy-limits.json', policy);
  const stamp = JSON.parse(readFileSync(join(f.directory, 'policy-limits.json.stamp.json'), 'utf8'));
  f.write('policy-limits.json.stamp.json', { ...stamp, identity: 'a'.repeat(64) });
  expect(f.inspect().managedConfigurationDigest).not.toBe(before.managedConfigurationDigest);
});

it.each([
  ['signature.json', null], ['signature.json', {}], ['signature.json', { ...signature, extra: true }],
  ['signature.json', { ...signature, jws: '' }], ['signature.json', { ...signature, jws: 'opaque' }],
  ['signature.json', { ...signature, receivedAt: -1 }], ['signature.json', { ...signature, receivedAt: 1.5 }],
  ['signature-iat.json', { typ: 'policy-limits', iat: '1' }], ['signature-iat.json', { typ: '', iat: 1 }],
  ['signature-iat.json', { typ: 'policy-limits', iat: 1, sub: null }],
  ['signature-iat.json', { typ: 'policy-limits', iat: 1, aud: 'x'.repeat(1025) }],
  ['signature-iat.json', { typ: 'policy-limits', iat: 1, extra: true }],
] as const)('refuses malformed %s metadata (case %#)', (suffix, metadata) => {
  const f = fixture(); f.write(`policy-limits.json.${suffix}`, metadata);
  expect(f.inspect).toThrow('subscription server policy:');
});

it('refuses unknown files, orphaned metadata, redirected files and oversized captures', () => {
  const f = fixture(), name = 'policy-limits.json.signature.json', path = join(f.directory, name);
  f.write('policy-limits.json.unknown', {}); expect(f.inspect).toThrow('unexpected file');
  rmSync(join(f.directory, 'policy-limits.json.unknown'));
  f.write(name, signature); rmSync(join(f.directory, 'policy-limits.json')); rmSync(join(f.directory, 'policy-limits.json.stamp.json'));
  expect(f.inspect).toThrow('missing policy-limits.json');
  f.write('policy-limits.json', { restrictions: {}, compliance_taints: [], monitoring_notice: null, defaults: {} });
  writeFileSync(path, '{'); expect(f.inspect).toThrow('unreadable JSON');
  writeFileSync(path, ' '.repeat(65537)); expect(f.inspect).toThrow('unsafe path or size');
  rmSync(path); symlinkSync(join(f.directory, 'remote-settings.json'), path); expect(f.inspect).toThrow('unsafe path or size');
});

it('keeps pre-cache enrollment usable only through the reviewed restrictive cache schema', () => {
  const f = fixture();
  const files = ['policy-limits.json', 'policy-limits.json.stamp.json', 'remote-settings.json'];
  const captured = files.map(name => readFileSync(join(f.directory, name), 'utf8'));
  for (const name of files) rmSync(join(f.directory, name));
  const enrolled = { ...f.profile, ...f.inspect() };
  const inspect = () => f.io.inspectSubscriptionProfile(enrolled);
  files.forEach((name, index) => writeFileSync(join(f.directory, name), captured[index]!));
  f.write('policy-limits.json.signature.json', signature);
  expect(inspect().managedConfigurationDigest).toBe(enrolled.managedConfigurationDigest);
  expect(f.io.managedHooksDisabled(enrolled)).toBe(false);
  f.write('managed-settings.json', { disableAllHooks: true });
  expect(inspect().managedConfigurationDigest).not.toBe(enrolled.managedConfigurationDigest);
  expect(f.io.managedHooksDisabled(enrolled)).toBe(true);
  rmSync(join(f.directory, 'managed-settings.json'));
  f.write('policy-limits.json', { restrictions: { allow_network: { allowed: true } }, compliance_taints: [], monitoring_notice: null, defaults: {} });
  expect(inspect).toThrow('expected false');
  f.write('policy-limits.json', JSON.parse(captured[0]!));
  f.write('remote-settings.json', { disableAllHooks: true });
  expect(inspect).toThrow('unexpected key');
});

it('retains policy and identity bindings for a profile enrolled with cache already present', () => {
  const f = fixture(), enrolled = { ...f.profile, ...f.inspect() };
  const inspect = () => f.io.inspectSubscriptionProfile(enrolled);
  f.write('policy-limits.json.signature.json', signature);
  expect(inspect().managedConfigurationDigest).toBe(enrolled.managedConfigurationDigest);
  const stamp = JSON.parse(readFileSync(join(f.directory, 'policy-limits.json.stamp.json'), 'utf8'));
  f.write('policy-limits.json.stamp.json', { ...stamp, identity: 'a'.repeat(64) });
  expect(inspect().managedConfigurationDigest).not.toBe(enrolled.managedConfigurationDigest);
});
