// @ts-nocheck -- installation host composition, real validators and sealed synthetic grants.
import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installHarnessLogin, installedHarnessLaunch, prepareInstalledHarnessLogins, verifyPreparedHarnessLogin, observeInstalledSessionLogin } from './installed-harness-logins.mjs';
import { readHarnessLogin } from './harness-user.mjs';
import { createHarnessLoginPool, loadHarnessLogins } from './harness-login-pool.mjs';
import { successiveWorld, offlineProfile, offlineActivationAuthority, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { authoritySealKey, resolveActivationAuthority, sealAuthorityRecord } from './activation-authority.js';
import { subscriptionDoorway, DEFAULT_SUBSCRIPTION_DOORWAY } from '../../src/assembly/production-provider.js';
import { FULL_TOOLS_CLASS } from './tools-policy-class.js';
import { buildRunArgv } from '../../scripts/product-run.mjs';
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
  expect(next.thresholdPercent).toBe(95);
  expect(next.usageFile).toBeUndefined();
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


it('keeps a missing secondary profile only as history across preparation and predecessor verification', () => {
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  const launch = () => installedHarnessLaunch({ root: f.root, options: { model: f.world.model, 'harness-user': 'offline' }, prepare: () => f.prepare() });
  const first = loadHarnessLogins(launch().options);
  const statePath = join(f.root, 'harness-login-pool.json');
  const settings = { statePath, now: () => Date.now(), validate: verifyPreparedHarnessLogin };
  const pool = createHarnessLoginPool({ ...settings, configuration: first });
  pool.observe(pool.select(), { failure: { failureClass: 'limit', resetAt: null } });
  expect(pool.select().index).toBe(1);
  const before = pool.state;
  // Exercise v1 adoption as well as build-independent membership; old notice keys must survive.
  writeFileSync(statePath, JSON.stringify({ ...before, identity: first.legacyIdentity, holds: {} }));
  rmSync(f.logins[1].profile);
  const nextOptions = launch().options, next = loadHarnessLogins(nextOptions);
  expect(next.identity).toBe(first.identity);
  expect(next.legacyIdentities).toContain(first.legacyIdentity);
  expect(next.entries[1].profile).toEqual(first.entries[1].profile);
  expect(() => verifyPreparedHarnessLogin(next.entries[1])).toThrow(/unavailable/);
  const reopened = createHarnessLoginPool({ ...settings, configuration: next,
    unavailable: new Map([[1, 'missing profile']]) });
  expect(reopened.select().index).toBe(0);
  expect(reopened.state.switches[0]).toEqual(before.switches[0]);
  expect(reopened.state.noticeIdentity).toBe(first.legacyIdentity);
  expect(reopened.state.active).toBe(0);
  // A dispatchable member must still be read from disk, never from retained evidence.
  rmSync(f.logins[0].profile);
  expect(() => loadHarnessLogins(nextOptions)).toThrow(/ENOENT/);
});

it('retains admitted secondary identity even when its profile disappears before first preparation', () => {
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  rmSync(f.logins[1].profile);
  const selected = installedHarnessLaunch({ root: f.root, options: { model: f.world.model, 'harness-user': 'offline' }, prepare: () => f.prepare() });
  expect(loadHarnessLogins(selected.options).entries[1].profile.reference).toBe('member-b');
});

it('prepares explicit tools successors under each own class grant and refuses uncovered successors', () => {
  const f = fixture();
  const current = f.logins.map(row => ({ ...read(row.activation),
    invocationPolicyDigest: encoded(f.doorway.policyFor(f.world.model, f.doorway.toolsFraming)).hash }));
  for (const [index, row] of f.logins.entries()) {
    row.toolsActivation = join(f.root, `tools-${index}.json`);
    writeFileSync(row.toolsActivation, JSON.stringify(current[index]));
    installHarnessLogin({ root: f.root, options: { ...f.options(row), 'tools-activation': row.toolsActivation }, verify: f.verify });
  }
  expect(read(f.prepare()).logins.every(row => !row.unavailable)).toBe(true);
  const oldDigest = `sha256:${'0'.repeat(64)}`;
  for (const row of f.logins) writeFileSync(row.toolsActivation, JSON.stringify({ ...read(row.toolsActivation), invocationPolicyDigest: oldDigest }));
  const prepared = read(f.prepare('build-b'));
  for (const [index, row] of prepared.logins.entries()) {
    const tools = read(row.toolsActivation);
    expect(tools.invocationPolicyDigest).toBe(current[index].invocationPolicyDigest);
    expect(tools.previousInvocationPolicyDigest).toBe(oldDigest);
    expect(tools.observedAt).toBe(current[index].observedAt);
    expect(tools.expiresAt).toBe(current[index].expiresAt);
    expect(tools.predecessor.reference).toBe(current[index].reference);
    expect(tools.predecessor.digest).toBe(`sha256:${createHash('sha256').update(readFileSync(f.logins[index].toolsActivation)).digest('hex')}`);
    f.verify(row, read(row.profile), read(row.activation), tools);
  }
  for (const index of [1, 0]) {
    const row = f.logins[index], authority = read(row.authority);
    authority.grants = authority.grants.filter(grant => !grant.scope.invocationPolicyClass);
    writeFileSync(row.authority, JSON.stringify(sealAuthorityRecord(authority, authoritySealKey(OFFLINE_STORAGE_KEY))));
    if (index === 1) expect(read(f.prepare('build-c')).logins[1].unavailable).toBeDefined();
    else expect(() => f.prepare('build-d')).toThrow(/grant/);
  }
});

it.each([false, true])('imports quota source and threshold with explicit usage override=%s', override => {
  const f = fixture(), path = join(f.root, 'old-quota-pool.json');
  const usageFile = join(f.root, 'usage.json'), replacement = join(f.root, 'replacement-usage.json');
  writeFileSync(path, JSON.stringify({ version: 1, logins: f.logins, usageFile, thresholdPercent: 80 }));
  installHarnessLogin({ root: f.root, options: { ...f.options(f.logins[0]), 'login-pool': path,
    ...(override ? { 'usage-file': replacement } : {}) }, verify: f.verify });
  const next = read(f.prepare());
  expect(next.thresholdPercent).toBe(80);
  expect(next.usageFile).toBe(override ? replacement : usageFile);
  const at = Date.now();
  const reading = utilizationPct => ({ version: 1, accounts: f.logins.map((row, index) => {
    const profile = read(row.profile), pct = index === 0 ? utilizationPct : 20;
    return { email: profile.expectedAccount, configHome: profile.configDirectory,
      lastQuota: { measuredAt: new Date(at).toISOString(),
        fiveHour: { utilizationPct: pct, resetsAt: new Date(at + 600000).toISOString() },
        sevenDay: { utilizationPct: pct, resetsAt: new Date(at + 600000).toISOString() } } };
  }) });
  writeFileSync(usageFile, JSON.stringify(reading(99)));
  writeFileSync(next.usageFile, JSON.stringify(reading(79)));
  const selected = installedHarnessLaunch({ root: f.root, options: { model: f.world.model, 'harness-user': 'offline' }, prepare: () => f.prepare() });
  const pool = createHarnessLoginPool({ configuration: loadHarnessLogins(selected.options),
    statePath: join(f.root, 'harness-login-pool.json'), now: () => at, validate: verifyPreparedHarnessLogin });
  expect(pool.select().index).toBe(0);
  writeFileSync(next.usageFile, JSON.stringify(reading(85)));
  expect(pool.select().index).toBe(1);
  expect(pool.state.switches[0].reason).toBe('usage-threshold');
});


it('verifies imported v1 predecessor identity after a secondary profile disappears', () => {
  const f = fixture(), path = join(f.root, 'old-pool.json');
  writeFileSync(path, JSON.stringify({ version: 1, logins: f.logins }));
  const before = loadHarnessLogins({ ...f.options(f.logins[0]), 'login-pool': path });
  installHarnessLogin({ root: f.root, options: { ...f.options(f.logins[0]), 'login-pool': path }, verify: f.verify });
  rmSync(f.logins[1].profile);
  const selected = installedHarnessLaunch({ root: f.root, options: { model: f.world.model, 'harness-user': 'offline' }, prepare: () => f.prepare() });
  const next = loadHarnessLogins(selected.options);
  expect(next.identity).toBe(before.identity);
  expect(next.legacyIdentities).toContain(before.legacyIdentity);
  // The retained witness cannot bless a different predecessor member or order.
  const changed = { ...read(path), logins: [...f.logins].reverse() };
  writeFileSync(path, JSON.stringify(changed));
  expect(() => loadHarnessLogins(selected.options)).toThrow(/predecessor members differ/);
});

it('correlates a verified running session with missing custody, never identity drift or an unreadable observation', () => {
  const profile = { reference: 'member-a', activationReference: 'grant-a' };
  const live = { subject: 'session-claim', at: 100, progress: null, wait: null };
  const missing = () => { throw Object.assign(Error('synthetic missing custody'), { code: 'ENOENT' }); };
  expect(observeInstalledSessionLogin(profile, live, missing)).toMatchObject({ state: 'missing', at: 100 });
  expect(observeInstalledSessionLogin(profile, live, () => 'synthetic-token')).toMatchObject({ state: 'present' });
  for (const failure of [Error('bound to another account'), Object.assign(Error('denied'), { code: 'EACCES' })])
    expect(observeInstalledSessionLogin(profile, live, () => { throw failure; }).state).toBe('unknown');
  expect(observeInstalledSessionLogin(profile, null, missing)).toBeNull();
});

it('keys missing custody to machine and admitted lifetime, and the launcher uses the verified activity callback', () => {
  const source = readFileSync('tests/preview/journal-agent.mjs', 'utf8');
  const start = source.indexOf('          observeActivity: observation => {');
  const end = source.indexOf('          maxSessions:', start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const property = source.slice(start, end).trim().replace(/,$/u, '');
  const profile = { reference: 'member-a', activationReference: 'grant-a' };
  const activity = { subject: 'live-claim', at: 100, progress: null, wait: null };
  let missing = true;
  const login = () => { if (missing) throw Object.assign(Error('private detail'), { code: 'ENOENT' }); return 'synthetic-token-never-in-observation'; };
  const observations = new Map(), work = new Map();
  const observer = new Function('workActivity', 'binding', 'observeInstalledSessionLogin', 'sessionLoginObservations', 'ownerMachine',
    `return ({${property}}).observeActivity`)(work, { entry: () => ({ profile, index: 1 }), harness: () => ({}) },
      (p, a, _login, machine) => observeInstalledSessionLogin(p, a, login, machine), observations, 'machine-a');
  observer(activity);
  expect([...observations.values()]).toMatchObject([{ state: 'missing', slot: 2, at: 100 }]);
  const first = [...observations.keys()][0];
  expect(observeInstalledSessionLogin(profile, activity, login, 'machine-a').key).toBe(first);
  expect(observeInstalledSessionLogin(profile, activity, login, 'machine-b').key).not.toBe(first);
  expect(observeInstalledSessionLogin({ ...profile, activationReference: 'grant-b' }, activity, login, 'machine-a').key).not.toBe(first);
  missing = false; observer({ ...activity, at: 200 });
  expect([...observations.values()]).toMatchObject([{ state: 'present', slot: 2, at: 200 }]);
  expect(JSON.stringify([...observations.values()])).not.toMatch(/synthetic-token|private detail|member-a/);
});

it('observes actual isolated custody removal and restoration without confusing a changed identity with absence', () => {
  const f = fixture(), profile = read(f.logins[0].profile);
  const custody = join(f.root, 'custody'); mkdirSync(custody, { mode: 0o700 });
  const path = join(custody, 'login.json');
  const value = { v: 1, reference: profile.reference, token: 'synthetic-login-expiry-test-token',
    account: profile.expectedAccount, organization: profile.organization, plan: profile.plan };
  const activity = { subject: 'verified-live-session', at: 100 };
  const observe = () => observeInstalledSessionLogin(profile, activity, p => readHarnessLogin(p, path));
  writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
  expect(observe().state).toBe('present');
  rmSync(path); expect(observe().state).toBe('missing');
  writeFileSync(path, JSON.stringify({ ...value, account: 'different@example.invalid' }), { mode: 0o600 });
  expect(observe().state).toBe('unknown');
  writeFileSync(path, JSON.stringify(value)); expect(observe().state).toBe('present');
  expect(JSON.stringify(observe())).not.toContain(value.token);
});

it('retains an explicit session activation through the installed pool (969390553 regression)', () => {
  // Live update 969390553 / Telegram 494: both installed members lacked sessionActivation.
  // The launcher supplied one, but default pool resolution erased it before sessionSetup.
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/sessionflip-1017.json', import.meta.url), 'utf8'));
  expect(read(join(f.root, 'harness-logins.json')).logins.map(row => row.sessionActivation ?? null))
    .toEqual(recorded.installedSessionActivations);
  expect(recorded.frames.find(row => row.kind === 'hold')).toMatchObject({
    id: `telegram:8820318295:update:${recorded.update}`, reason: 'model not started',
    unusedModel: { corrections: [], toolCalls: 0 } });
  const before = f.prepare();
  const session = join(f.root, 'launch-session.json');
  writeFileSync(session, JSON.stringify({ reference: 'reviewed-primary-session' }));
  const options = { model: f.world.model, 'harness-user': 'offline',
    'conversation-session': 'on', 'session-work-activation': session };
  const prepare = selected => prepareInstalledHarnessLogins({ root: f.root, options: selected,
    doorway: f.doorway, build: 'build-a', now: Date.now(), verify: f.verify });
  const selected = installedHarnessLaunch({ root: f.root, options, prepare });
  expect(selected.options['session-work-activation']).toBe(session);
  expect(selected.options['login-pool']).not.toBe(before);
  const pool = loadHarnessLogins(selected.options);
  expect(pool.entries[0].sessionActivation).toBe(session);
  expect(pool.entries[1].sessionActivation).toBeUndefined();
  expect(pool.entries[0].sources).toContainEqual({ path: session,
    digest: createHash('sha256').update(JSON.stringify(read(session))).digest('hex') });
  expect(read(join(f.root, 'harness-logins.json')).logins[0].sessionActivation).toBeUndefined();
  expect(prepare(selected.options)).toBe(selected.options['login-pool']);
  writeFileSync(session, JSON.stringify({ reference: 'withdrawn' }));
  expect(() => verifyPreparedHarnessLogin(pool.entries[0])).toThrow('source withdrawn');
  expect(prepare(selected.options)).not.toBe(selected.options['login-pool']);
  const ordinary = installedHarnessLaunch({ root: f.root,
    options: { model: f.world.model, 'harness-user': 'offline' }, prepare });
  expect(ordinary.options['session-work-activation']).toBeUndefined();
  expect(ordinary.options['login-pool']).toBe(before);
});

it('a singleton keeps the launch session grant and an installed grant remains the default', () => {
  const f = fixture(); f.install(f.logins[0]);
  const options = { model: f.world.model, 'harness-user': 'offline',
    'conversation-session': 'on', 'session-work-activation': '/reviewed/session.json' };
  const prepare = () => { throw Error('singleton must not prepare'); };
  expect(installedHarnessLaunch({ root: f.root, options, prepare }).options['session-work-activation'])
    .toBe(options['session-work-activation']);
  installHarnessLogin({ root: f.root,
    options: { ...f.options(f.logins[0]), 'session-work-activation': '/installed/session.json' }, verify: f.verify });
  expect(installedHarnessLaunch({ root: f.root, options: { model: f.world.model }, prepare }).options['session-work-activation'])
    .toBe('/installed/session.json');
  expect(installedHarnessLaunch({ root: f.root, options, prepare }).options['session-work-activation'])
    .toBe('/reviewed/session.json');
});

it('retains each account-bound quota custody reference through import and build preparation', () => {
  const f = fixture(), path = join(f.root, 'quota-logins.json');
  const logins = f.logins.map((row, index) => ({ ...row, quotaLogin: join(f.root, `private-quota-${index}.json`) }));
  writeFileSync(path, JSON.stringify({ version: 1, logins }));
  installHarnessLogin({ root: f.root, options: { ...f.options(f.logins[0]), 'login-pool': path }, verify: f.verify });
  expect(read(f.prepare()).logins.map(row => row.quotaLogin)).toEqual(logins.map(row => row.quotaLogin));
});

it.each(['profile', 'authority'])('product launch preserves verified primary and secondary history after secondary %s loss', field => {
  // Reviewer reproduction: astra-unit-update-b-1021-regression.test.ts, using real sealed grant validators.
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  const write = (name, value) => writeFileSync(join(f.root, name), JSON.stringify(value));
  write('model-setting.json', { model: f.world.model });
  write('journal.encrypted', { fixture: true });
  write('yes.json', { fixture: true });
  write('run-config.json', { version: 1, options: {
    'bot-id': '12345678', 'bot-username': '@fixture_bot', 'operator-sender-id': '12345',
    'chat-id': '-1001234567890', forum: true, 'grant-reference': 'preview-trial:fixture',
    'configuration-digest': `sha256:${'a'.repeat(64)}`, 'expires-at': '2026-11-12T21:40:00Z',
    'operator-records': f.root, 'explicit-yes-installation': join(f.root, 'yes.json'),
    'review-repository': 'fixture/repository', 'harness-user': '_instarharness', 'conversation-session': 'off'
  }});
  const expected = buildRunArgv(f.root);
  const before = read(join(f.root, 'harness-logins.json'));
  rmSync(f.logins[1][field]);
  expect(buildRunArgv(f.root)).toEqual(expected);
  expect(read(join(f.root, 'harness-logins.json'))).toEqual(before);
  const launch = installedHarnessLaunch({ root: f.root,
    options: { model: f.world.model, 'harness-user': 'offline' }, prepare: () => f.prepare() });
  expect(launch.mode).toBe('installed-pool');
  const manifest = read(launch.options['login-pool']);
  expect(manifest.logins).toHaveLength(2);
  expect(manifest.logins[1].admittedProfile).toEqual(before.logins[1].admittedProfile);
  expect(manifest.logins[1].unavailable).toBeDefined();
  expect(() => verifyPreparedHarnessLogin(manifest.logins[1])).toThrow(/unavailable/);
  const primary = manifest.logins[0];
  expect(() => verifyPreparedHarnessLogin(primary)).not.toThrow();
  expect(() => f.verify(primary, read(primary.profile), read(primary.activation), read(primary.toolsActivation))).not.toThrow();
});

// Real filesystem regression for the 2026-10-13 canary rename failure; custody is synthetic.
it.each(['rename', 'copy'])('prepared installation survives a real %s with selection and notice identity intact', move => {
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  const launch = root => installedHarnessLaunch({ root, options: { model: f.world.model, 'harness-user': 'offline' },
    prepare: options => prepareInstalledHarnessLogins({ root, options, doorway: f.doorway,
      build: 'build-a', now: Date.now(), verify: f.verify }) });
  const configuration = loadHarnessLogins(launch(f.root).options);
  const poolAt = root => createHarnessLoginPool({ configuration: loadHarnessLogins(launch(root).options),
    statePath: join(root, 'harness-login-pool.json'), now: () => Date.now(), validate: entry => {
      verifyPreparedHarnessLogin(entry);
      f.verify({ ...entry, profile: entry.profilePath }, entry.profile, read(entry.activation), read(entry.toolsActivation));
    } });
  const before = poolAt(f.root);
  before.observe(before.select(), { failure: { failureClass: 'limit', resetAt: null } });
  expect(before.select().index).toBe(1);
  const state = before.state, notices = before.notices();
  const destination = join(f.world.directory, 'moved-installation');
  if (move === 'rename') renameSync(f.root, destination); else cpSync(f.root, destination, { recursive: true });
  const after = poolAt(destination);
  expect(after.select().index).toBe(1);
  expect(after.state).toEqual(state); expect(after.notices()).toEqual(notices);
  expect(loadHarnessLogins(launch(destination).options).identity).toBe(configuration.identity);
  // Status reads the raw retained manifest before calling the same loader.
  const movedOptions = launch(destination).options, raw = read(movedOptions['login-pool']);
  expect(loadHarnessLogins({ ...f.options(raw.logins[0]), 'login-pool': movedOptions['login-pool'] }).identity)
    .toBe(configuration.identity);
  if (move === 'copy') {
    // The copied root must not silently borrow records from the original, even while it exists.
    expect(poolAt(f.root).select().index).toBe(1);
    const selected = loadHarnessLogins(launch(destination).options);
    expect(selected.entries.every(row => row.activation.startsWith(destination + '/'))).toBe(true);
    rmSync(join(destination, 'member-a-activation.json'));
    expect(() => launch(destination)).toThrow();
    expect(() => poolAt(f.root).select()).not.toThrow();
  }
});

it.each(['activation', 'directory'])('repairs missing prepared %s from admitted source records', missing => {
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  const path = f.prepare(), manifest = read(path);
  rmSync(missing === 'directory' ? join(path, '..') : manifest.logins[0].activation, { recursive: true });
  expect(f.prepare()).toBe(path);
  const repaired = read(path);
  f.verify(repaired.logins[0], read(repaired.logins[0].profile), read(repaired.logins[0].activation), read(repaired.logins[0].toolsActivation));
});


it.each(['same-build', 'next-build', 'imported'])('loads vanished-root legacy absolute records on %s and preserves v1 notices', mode => {
  const f = fixture();
  if (mode === 'imported') {
    const path = join(f.root, 'old-pool.json');
    writeFileSync(path, JSON.stringify({ version: 1, logins: f.logins }));
    installHarnessLogin({ root: f.root, options: { ...f.options(f.logins[0]), 'login-pool': path }, verify: f.verify });
  } else { f.install(f.logins[0]); f.install(f.logins[1]); }
  const preparedPath = f.prepare(), manifest = read(preparedPath);
  // Exact old family format: absolute paths, without newly added root metadata.
  delete manifest.recordRoot; delete manifest.previousRecordRoot;
  writeFileSync(preparedPath, JSON.stringify(manifest));
  const inventoryPath = join(f.root, 'harness-logins.json'), inventory = read(inventoryPath);
  delete inventory.recordRoot; writeFileSync(inventoryPath, JSON.stringify(inventory));
  const before = loadHarnessLogins({ ...f.options(manifest.logins[0]), 'login-pool': preparedPath });
  const pool = createHarnessLoginPool({ configuration: before, statePath: join(f.root, 'harness-login-pool.json'),
    now: () => Date.now(), validate: verifyPreparedHarnessLogin });
  pool.observe(pool.select(), { failure: { failureClass: 'limit', resetAt: null } }); pool.select();
  writeFileSync(join(f.root, 'harness-login-pool.json'), JSON.stringify({ ...pool.state, identity: before.legacyIdentity }));
  const root = join(f.world.directory, 'renamed'); renameSync(f.root, root);
  const selected = installedHarnessLaunch({ root, options: { model: f.world.model, 'harness-user': 'offline' },
    prepare: options => prepareInstalledHarnessLogins({ root, options, doorway: f.doorway,
      build: mode === 'same-build' ? 'build-a' : 'build-b', now: Date.now(), verify: f.verify }) });
  const next = loadHarnessLogins(selected.options);
  expect(next.legacyIdentities).toContain(before.legacyIdentity);
  const after = createHarnessLoginPool({ configuration: next, statePath: join(root, 'harness-login-pool.json'),
    now: () => Date.now(), validate: verifyPreparedHarnessLogin });
  expect(after.select().index).toBe(1);
  expect(after.state.holds).toEqual(pool.state.holds); expect(after.state.switches).toEqual(pool.state.switches);
  expect(after.state.noticeIdentity).toBe(before.legacyIdentity);
  for (const row of next.entries) f.verify(row, row.profile, read(row.activation), read(row.toolsActivation));
});

it.each(['foreign-path', 'foreign-record', 'tampered-record', 'profile', 'sources'])('refuses %s instead of blessing or replacing it during preparation', fault => {
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  const path = f.prepare(), manifest = read(path), target = manifest.logins[0].activation;
  if (fault === 'foreign-path') {
    manifest.logins[0].authority = manifest.logins[1].authority;
    writeFileSync(path, JSON.stringify(manifest));
  } else if (fault === 'foreign-record') writeFileSync(target, readFileSync(manifest.logins[1].activation));
  else if (fault === 'tampered-record') writeFileSync(target, JSON.stringify({ ...read(target), observedAccount: 'foreign@example.invalid' }));
  else if (fault === 'profile') writeFileSync(f.logins[0].profile, JSON.stringify({ ...read(f.logins[0].profile), reference: 'foreign' }));
  else {
    manifest.logins[0].sources[0].digest = 'changed'; writeFileSync(path, JSON.stringify(manifest));
  }
  const bytes = readFileSync(target, 'utf8');
  expect(() => f.prepare()).toThrow(/differ|does not belong/);
  expect(readFileSync(target, 'utf8')).toBe(bytes);
});

it('retains a launch-only primary session grant across relocation without lending or persisting it', () => {
  const f = fixture(); f.install(f.logins[0]); f.install(f.logins[1]);
  const session = join(f.root, 'launch-session.json');
  writeFileSync(session, JSON.stringify({ reference: 'reviewed-primary-session' }));
  const launch = (root, granted) => installedHarnessLaunch({ root,
    options: { model: f.world.model, 'harness-user': 'offline',
      ...(granted ? { 'session-work-activation': join(root, 'launch-session.json') } : {}) },
    prepare: options => prepareInstalledHarnessLogins({ root, options, doorway: f.doorway,
      build: 'build-a', now: Date.now(), verify: f.verify }) });
  launch(f.root, false); launch(f.root, true);
  const root = join(f.world.directory, 'moved-session-installation'); renameSync(f.root, root);
  const selected = launch(root, true), pool = loadHarnessLogins(selected.options);
  expect(pool.entries[0].sessionActivation).toBe(join(root, 'launch-session.json'));
  expect(pool.entries[1].sessionActivation).toBeUndefined();
  expect(() => verifyPreparedHarnessLogin(pool.entries[0])).not.toThrow();
  expect(launch(root, true).options['login-pool']).toBe(selected.options['login-pool']);
  expect(read(join(root, 'harness-logins.json')).logins[0].sessionActivation).toBeUndefined();
  expect(launch(root, false).options['session-work-activation']).toBeUndefined();
  writeFileSync(join(root, 'launch-session.json'), JSON.stringify({ reference: 'withdrawn' }));
  expect(() => verifyPreparedHarnessLogin(pool.entries[0])).toThrow('source withdrawn');
});
