// @ts-nocheck -- installation host composition, real validators and sealed synthetic grants.
import { afterEach, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installHarnessLogin, installedHarnessLaunch, prepareInstalledHarnessLogins, verifyPreparedHarnessLogin } from './installed-harness-logins.mjs';
import { loadHarnessLogins } from './harness-login-pool.mjs';
import { successiveWorld, offlineProfile, offlineActivationAuthority, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { authoritySealKey, resolveActivationAuthority, sealAuthorityRecord } from './activation-authority.js';
import { subscriptionDoorway, DEFAULT_SUBSCRIPTION_DOORWAY } from '../../src/assembly/production-provider.js';
import { FULL_TOOLS_CLASS } from './tools-policy-class.js';
import { encoded } from './stage2-provider.js';

const roots = [];
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
const read = path => JSON.parse(readFileSync(path, 'utf8'));
function fixture() {
  const world = successiveWorld(); roots.push(world.directory);
  const root = join(world.directory, 'installation'); mkdirSync(root);
  const doorway = subscriptionDoorway(DEFAULT_SUBSCRIPTION_DOORWAY);
  const now = Date.now(), authenticated = new Set(['member-a', 'member-b']);
  const directory = join(world.directory, 'operator-records');
  const lines = name => readFileSync(join(directory, name), 'utf8').trim().split('\n').map(JSON.parse);
  const records = { messages: lines('telegram-messages.jsonl'), provenance: lines('asp-classifications.jsonl'),
    bindings: read(join(directory, 'state/topic-operators.json')) };
  const logins = ['member-a', 'member-b'].map(reference => {
    const profile = { ...offlineProfile, reference, activationReference: `${reference}-activation`, expectedAccount: `${reference}@example.invalid`,
      home: `/offline/${reference}/home`, configDirectory: `/offline/${reference}/config`, workingDirectory: `/offline/${reference}/work` };
    const activation = { ...world.activation(), reference: profile.activationReference, profileDigest: encoded(profile).hash,
      expectedAccount: profile.expectedAccount, observedAccount: profile.expectedAccount };
    const authority = offlineActivationAuthority(activation);
    const classGrant = { ...authority.grants[0], id: `${reference}-tools`, scope: { ...authority.grants[0].scope,
      invocationPolicyDigest: undefined, invocationPolicyClass: FULL_TOOLS_CLASS } };
    delete classGrant.scope.invocationPolicyDigest;
    const row = { profile: join(root, `${reference}.json`), activation: join(root, `${reference}-activation.json`), authority: join(root, `${reference}-authority.json`) };
    writeFileSync(row.profile, JSON.stringify(profile)); writeFileSync(row.activation, JSON.stringify(activation));
    writeFileSync(row.authority, JSON.stringify(sealAuthorityRecord({ ...authority, grants: [...authority.grants, classGrant] }, authoritySealKey(OFFLINE_STORAGE_KEY))));
    return row;
  });
  const options = row => ({ model: world.model, 'harness-user': 'offline', 'login-profile': row.profile,
    'activation-record': row.activation, 'authority-record': row.authority });
  const verify = (row, profile, activation = read(row.activation), tools = null) => {
    if (!authenticated.has(profile.reference)) throw Error('not authenticated');
    for (const [record, framing] of [[activation, doorway.conversationFraming], ...(tools ? [[tools, doorway.toolsFraming]] : [])]) {
      doorway.validateActivation(record, profile, world.model, now, framing, activation.expiresAt);
      const result = resolveActivationAuthority(record, read(row.authority), world.configuration.operatorSenderId,
        world.state().read().trial.expiresAt, now, records, authoritySealKey(OFFLINE_STORAGE_KEY), doorway.policyFor(world.model, framing));
      if (result.kind !== 'resolved') throw Error(result.reason);
    }
  };
  const install = row => installHarnessLogin({ root, options: options(row), verify });
  const prepare = (build = 'build-a') => prepareInstalledHarnessLogins({ root, options: options(logins[0]), doorway, build, now, verify });
  return { world, root, doorway, logins, options, verify, install, prepare, authenticated };
}

it('two individually admitted logins get current conversation/tools records in stable order and default launch needs no pool/profile flag', () => {
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  const before = f.logins.map(row => read(row.authority));
  const first = read(f.prepare());
  expect(first.logins.map(row => read(row.profile).reference)).toEqual(['member-a', 'member-b']);
  for (const [index, row] of first.logins.entries()) {
    expect(read(row.authority)).toEqual(before[index]);
    f.verify(row, read(row.profile), read(row.activation), read(row.toolsActivation));
    verifyPreparedHarnessLogin(row);
  }
  const options = { model: f.world.model, 'harness-user': 'offline' };
  const selected = installedHarnessLaunch({ root: f.root, options, prepare: () => f.prepare() });
  expect(selected.mode).toBe('installed-pool'); expect(selected.options['login-profile']).toBe(f.logins[0].profile);
  const a = loadHarnessLogins(selected.options);
  const bPath = f.prepare('build-b'), b = read(bPath);
  expect(b.logins[0].activation).not.toBe(first.logins[0].activation);
  expect(b.previousManifest).toBe(selected.options['login-pool']);
  const next = loadHarnessLogins({ ...selected.options, 'login-pool': bPath, 'activation-record': b.logins[0].activation,
    'authority-record': b.logins[0].authority, 'tools-activation': b.logins[0].toolsActivation });
  expect(next.identity).toBe(a.identity);
  expect(f.prepare('build-b')).toBe(bPath); // repeat preparation is idempotent
});

it('single login preserves launch options and an explicit profile overrides a two-member installation', () => {
  const f = fixture();
  expect(installedHarnessLaunch({ root: f.root, options: {}, prepare: () => { throw Error('unexpected preparation'); } }))
    .toEqual({ options: {}, mode: 'legacy-single' });
  f.install(f.logins[0]);
  const options = f.options(f.logins[0]);
  const never = () => { throw Error('singleton must not prepare a pool'); };
  expect(installedHarnessLaunch({ root: f.root, options, prepare: never })).toEqual({ options, mode: 'explicit-profile' });
  expect(installedHarnessLaunch({ root: f.root, options: { model: f.world.model, 'harness-user': 'offline' }, prepare: never }))
    .toEqual({ options: { ...options, 'tools-activation': undefined, 'session-work-activation': undefined }, mode: 'single-installed' });
  f.install(f.logins[1]);
  expect(installedHarnessLaunch({ root: f.root, options, prepare: never })).toEqual({ options, mode: 'explicit-profile' });
});

it('unauthenticated login is not installed; another member cannot inherit primary authority; missing secondary drops only that member', () => {
  const f = fixture(); f.install(f.logins[0]);
  f.authenticated.delete('member-b'); expect(() => f.install(f.logins[1])).toThrow('not authenticated');
  expect(read(join(f.root, 'harness-logins.json')).logins).toHaveLength(1);
  f.authenticated.add('member-b');
  expect(() => f.install({ ...f.logins[1], authority: f.logins[0].authority })).toThrow(/grant/);
  f.install(f.logins[1]); rmSync(f.logins[1].authority);
  const manifest = read(f.prepare());
  expect(manifest.logins[1].unavailable).toBe('build records or authentication unavailable');
  expect(() => verifyPreparedHarnessLogin(manifest.logins[1])).toThrow(/unavailable/);
  f.verify(manifest.logins[0], read(manifest.logins[0].profile), read(manifest.logins[0].activation), read(manifest.logins[0].toolsActivation));
  rmSync(f.logins[0].activation);
  expect(() => f.prepare('build-b')).toThrow();
});

it('source withdrawal remains authoritative after build-record copies; changed members refuse once selection state exists', () => {
  const f = fixture(); f.install(f.logins[0]);
  writeFileSync(join(f.root, 'harness-login-pool.json'), '{}');
  expect(() => f.install(f.logins[1])).toThrow(/members changed/);
  rmSync(join(f.root, 'harness-login-pool.json'));
  f.install(f.logins[1]); const first = read(f.prepare());
  writeFileSync(f.logins[1].authority, '{}');
  expect(() => verifyPreparedHarnessLogin(first.logins[1])).toThrow(/source withdrawn/);
  expect(() => verifyPreparedHarnessLogin(first.logins[0])).not.toThrow();
});

it('imports an existing reviewed manifest as predecessor evidence instead of requiring hand-made new-build manifests', () => {
  const f = fixture();
  const path = join(f.root, 'old-pool.json');
  writeFileSync(path, JSON.stringify({ version: 1, logins: f.logins }));
  installHarnessLogin({ root: f.root, options: { ...f.options(f.logins[0]), 'login-pool': path }, verify: f.verify });
  const next = read(f.prepare());
  expect(next.previousManifest).toBe(path);
  expect(next.logins).toHaveLength(2);
});

it('successful re-admission prepares a previously unavailable member without resetting membership or history', () => {
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  f.authenticated.delete('member-b');
  const before = f.prepare(); expect(read(before).logins[1].unavailable).toBeDefined();
  const identity = read(join(f.root, 'harness-logins.json')).identity;
  f.authenticated.add('member-b'); f.install(f.logins[1]);
  const after = f.prepare(); expect(after).not.toBe(before);
  expect(read(after).logins[1].unavailable).toBeUndefined();
  expect(read(after).previousManifest).toBe(before);
  expect(read(join(f.root, 'harness-logins.json')).identity).toBe(identity);
  f.verify(read(after).logins[1], read(f.logins[1].profile), read(read(after).logins[1].activation));
});

it('prepares policy successors under each existing exact grant, and excludes a successor that its own grant does not cover', () => {
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  const original = f.logins.map(row => read(row.activation));
  const oldDigest = `sha256:${'0'.repeat(64)}`;
  for (const row of f.logins) writeFileSync(row.activation, JSON.stringify({ ...read(row.activation), invocationPolicyDigest: oldDigest }));
  const prepared = read(f.prepare());
  for (const [index, row] of prepared.logins.entries()) {
    const activation = read(row.activation);
    expect(activation.previousInvocationPolicyDigest).toBe(oldDigest);
    expect(activation.invocationPolicyDigest).toBe(original[index].invocationPolicyDigest);
    expect(activation.observedAt).toBe(original[index].observedAt);
    expect(activation.expiresAt).toBe(original[index].expiresAt);
    expect(activation.predecessor.reference).toBe(original[index].reference);
    expect(read(row.authority)).toEqual(read(f.logins[index].authority));
  }
  const authority = read(f.logins[1].authority);
  authority.grants[0].scope.invocationPolicyDigest = oldDigest;
  writeFileSync(f.logins[1].authority, JSON.stringify(sealAuthorityRecord(authority, authoritySealKey(OFFLINE_STORAGE_KEY))));
  expect(read(f.prepare('build-b')).logins[1].unavailable).toBeDefined();
});
