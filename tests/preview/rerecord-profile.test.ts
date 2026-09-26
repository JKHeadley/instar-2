// @ts-nocheck -- offline evidence for the reboot-stable login-profile identity and its one-use re-record.
// No live network, Telegram or model is contacted.
import { afterEach, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSubscriptionProviderIO, subscriptionProfileIdentity } from '../../scripts/production-boot-io.mjs';
import { value } from '../facts/fixtures.js';
import { encoded } from './stage2-provider.js';
import { RERECORD_SUFFIX, rerecordLoginProfileIdentity } from './rerecord-profile.js';
import { recoverPreDispatchSlot } from './recover-slot.js';
import { OFFLINE_STORAGE_KEY, offlineProfile, successiveWorld } from './successive-fixture.js';

const temporary: string[] = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
  await new Promise<void>(done => setImmediate(done));
});

it('identifies a login profile by path and inode only: a reboot-renumbered device keeps it, a recreated directory changes it', () => {
  const rows = [{ path: '/p/home', ino: 11 }, { path: '/p/config', ino: 12 }, { path: '/p/work', ino: 13 }];
  expect(subscriptionProfileIdentity(rows.map(row => ({ ...row, dev: 16777230 }))))
    .toBe(subscriptionProfileIdentity(rows.map(row => ({ ...row, dev: 16777234 }))));
  expect(subscriptionProfileIdentity(rows)).not.toBe(subscriptionProfileIdentity([rows[0], { ...rows[1], ino: 99 }, rows[2]]));

  // Physical host: recreating the (empty, private) working directory yields a new identity.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'profile-identity-'))); temporary.push(root);
  const profile = { home: join(root, 'home'), configDirectory: join(root, 'config'), workingDirectory: join(root, 'work'),
    organization: 'offline-org' };
  for (const path of [profile.home, profile.configDirectory, profile.workingDirectory]) mkdirSync(path, { mode: 0o700 });
  const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => true });
  const first = io.inspectSubscriptionProfile(profile);
  expect(io.inspectSubscriptionProfile(profile)).toEqual(first);
  rmSync(profile.workingDirectory, { recursive: true });
  mkdirSync(join(root, 'placeholder'), { mode: 0o700 }); // occupy the freed inode so the new one differs
  mkdirSync(profile.workingDirectory, { mode: 0o700 });
  const second = io.inspectSubscriptionProfile(profile);
  expect(second.loginProfileIdentity).not.toBe(first.loginProfileIdentity);
  expect(second.managedConfigurationDigest).toBe(first.managedConfigurationDigest);
});

it('re-records only the identity digests once, refusing a pending attempt, a live or stopped trial, and a second use; the next turn then answers', async () => {
  const world = successiveWorld();
  const profilePath = join(world.directory, 'profile.json'), activationPath = join(world.directory, 'activation.json');
  const oldActivation = world.activation();
  writeFileSync(profilePath, JSON.stringify(offlineProfile, null, 2), { mode: 0o600 });
  writeFileSync(activationPath, JSON.stringify(oldActivation, null, 2), { mode: 0o644 });
  const renewed = { ...offlineProfile, loginProfileIdentity: 'offline-profile-after-reboot' };
  const inspect = () => ({ loginProfileIdentity: renewed.loginProfileIdentity, managedConfigurationDigest: offlineProfile.managedConfigurationDigest });
  const request = (overrides = {}) => ({ root: world.root, profilePath, activationPath, model: world.model,
    reason: 'offline: identity form dropped st_dev', recordedBy: 'offline-desk', inspect, storageKey: OFFLINE_STORAGE_KEY,
    now: () => 1790000005000, alive: () => false, ...overrides });
  const marker = () => readdirSync(world.directory).filter(name => name.startsWith('.preview-profile-rerecord-'));

  // A provider attempt is open while Seven's prepared call waits for the provider: refuse.
  world.say('First question.'); world.answer('One.');
  let pendingRefusal;
  const c = world.compose({ hooks: { beforeProvider: () => {
    try { rerecordLoginProfileIdentity(request()); } catch (error) { pendingRefusal = error.message; }
  } } });
  try { await c.run({ maxCycles: 4, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); } finally { c.close(); }
  expect(pendingRefusal).toBe('preview: serving slot occupied, provider attempt in flight or serving latched');
  expect(world.sends()).toHaveLength(1);

  // A live preview process (its heartbeat pid is alive) refuses.
  world.state().heartbeat(process.pid);
  expect(() => rerecordLoginProfileIdentity(request({ alive: undefined }))).toThrow('preview: a preview process is live');
  // Unchanged directories need no re-record; a changed managed policy is never absorbed.
  expect(() => rerecordLoginProfileIdentity(request({ inspect: () => ({ loginProfileIdentity: offlineProfile.loginProfileIdentity,
    managedConfigurationDigest: offlineProfile.managedConfigurationDigest }) }))).toThrow('preview: identity already current');
  expect(() => rerecordLoginProfileIdentity(request({ inspect: () => ({ ...inspect(), managedConfigurationDigest: encoded({ x: 1 }).hash }) })))
    .toThrow('preview: managed configuration changed');
  // A profile edited in any other field breaks the recorded chain and refuses.
  writeFileSync(profilePath, JSON.stringify({ ...offlineProfile, plan: 'pro' }));
  expect(() => rerecordLoginProfileIdentity(request())).toThrow('preview: recorded activation chain is inconsistent');
  writeFileSync(profilePath, JSON.stringify(offlineProfile, null, 2));
  expect(marker()).toHaveLength(0);

  const sidecarPath = join(world.root, 'successive-state.json');
  const before = { profile: readFileSync(profilePath, 'utf8'), activation: readFileSync(activationPath, 'utf8'),
    sidecar: JSON.parse(readFileSync(sidecarPath, 'utf8')) };
  const result = rerecordLoginProfileIdentity(request());
  expect(result.changes.map(row => row.field)).toEqual(['loginProfileIdentity', 'profileDigest', 'activationDigest', 'policyDigest']);
  // Old bytes kept under the suffix; nothing deleted.
  expect(readFileSync(`${profilePath}${RERECORD_SUFFIX}`, 'utf8')).toBe(before.profile);
  expect(readFileSync(`${activationPath}${RERECORD_SUFFIX}`, 'utf8')).toBe(before.activation);
  expect(JSON.parse(readFileSync(`${sidecarPath}${RERECORD_SUFFIX}`, 'utf8'))).toEqual(before.sidecar);
  const profile = JSON.parse(readFileSync(profilePath, 'utf8')), activation = JSON.parse(readFileSync(activationPath, 'utf8'));
  const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8'));
  expect(profile).toEqual(renewed);
  expect(activation).toEqual({ ...oldActivation, profileDigest: encoded(renewed).hash });
  expect(sidecar).toEqual({ ...before.sidecar, activationDigest: encoded(activation).hash });
  expect(sidecar.policyDigest).toBe(before.sidecar.policyDigest);
  expect(JSON.parse(readFileSync(join(world.directory, marker()[0]), 'utf8')).completion.activationDigest).toBe(sidecar.activationDigest);

  // One use only.
  expect(() => rerecordLoginProfileIdentity(request({ inspect: () => ({ ...inspect(), loginProfileIdentity: 'a-third-identity' }) })))
    .toThrow();
  // The superseded activation no longer starts the trial; the re-recorded one answers the next turn.
  expect(() => world.compose({ profile: offlineProfile, activation: oldActivation }))
    .toThrow('preview: successive activation differs from the recorded activation');
  world.say('Second question after the reboot.'); world.answer('Two.');
  const next = world.compose({ profile: Object.freeze(profile), activation });
  try { await next.run({ maxCycles: 4, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); } finally { next.close(); }
  expect(world.models()).toHaveLength(2);
  expect(world.sends()).toHaveLength(2);
  expect(world.sends()[1].body.text).toContain('Two.');

  // A stopped trial refuses before anything is read or written.
  world.state().latchStop('operator');
  expect(() => rerecordLoginProfileIdentity(request())).toThrow('preview: trial is stopped, held or expired');
  expect(existsSync(join(world.root, 'preview-stop.json')) || world.state().read().stop !== null).toBe(true);
}, 1_800_000);

it('refuses an occupied settled slot, then retires only pre-dispatch failures through Six before re-record and the next answer', async () => {
  const world = successiveWorld(); temporary.push(world.directory);
  const profilePath = join(world.directory, 'profile.json'), activationPath = join(world.directory, 'activation.json');
  writeFileSync(profilePath, JSON.stringify(offlineProfile));
  writeFileSync(activationPath, JSON.stringify(world.activation()));
  const updateId = world.say('my test word is lighthouse');
  const failed = world.compose({ hooks: { beforeProvider: () => { throw Error('subscription profile or managed configuration changed'); } } });
  try {
    await failed.run({ maxCycles: 2, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep });
    expect(failed.status().serving).toMatchObject({ pendingAttempt: null, turns: 1 });
    expect(failed.status().serving.slot).not.toBeNull();
  } finally { failed.close(); }
  expect(world.models()).toHaveLength(0);
  expect(world.sends()).toHaveLength(0);
  const renewed = { ...offlineProfile, loginProfileIdentity: 'offline-profile-after-reboot' };
  const common = { root: world.root, profilePath, activationPath, model: world.model,
    reason: 'offline pre-dispatch failure', recordedBy: 'offline-desk', storageKey: OFFLINE_STORAGE_KEY,
    telegramToken: '8820318295:synthetic_recorded_test_only_value',
    now: () => 1790000005000, alive: () => false };
  const rerecord = () => rerecordLoginProfileIdentity({ ...common, inspect: () => ({
    loginProfileIdentity: renewed.loginProfileIdentity, managedConfigurationDigest: offlineProfile.managedConfigurationDigest }) });
  expect(() => rerecord()).toThrow('preview: serving slot occupied, provider attempt in flight or serving latched');
  const recover = (overrides = {}) => recoverPreDispatchSlot({ ...common, configuration: world.stateConfiguration,
    expectedUpdateId: updateId,
    ...overrides });
  expect(() => recover({ expectedUpdateId: updateId + 1 })).toThrow('preview recovery: admitted update differs');
  expect(() => recover({ now: () => world.state().read().trial.expiresAt }))
    .toThrow('preview recovery: trial stopped, held or expired');
  world.state().heartbeat(process.pid);
  expect(() => recover({ alive: pid => pid === process.pid })).toThrow('preview recovery: live preview process');
  world.state().heartbeat(999999);
  const orphan = world.compose();
  try {
    expect(() => recover({ alive: pid => pid === process.pid })).toThrow('preview recovery: live or unverifiable store holder');
    const slot = orphan.status().serving.slot;
    expect(slot).not.toBeNull();
    value(orphan.application.owners.serving.start('offline-orphan-start', orphan.built.f.effects.fence,
      'offline-orphan-attempt', slot));
  } finally { orphan.close(); }
  const result = recover();
  expect(result.noDispatchClaim).toBe(true);
  expect(result.noSend).toBe(true);
  expect(result.before.turns).toBe(1);
  expect(result.after.turns).toBe(1);
  expect(result.orphanAttempt).toBe('offline-orphan-attempt');
  expect(result.after.totalErrors).toBe(result.before.totalErrors + 1);
  expect(readFileSync(result.audit, 'utf8')).toContain('pre-dispatch-slot-recovery');
  expect(() => recover()).toThrow('preview recovery: already used');
  rerecord();
  const nextProfile = Object.freeze(JSON.parse(readFileSync(profilePath, 'utf8')));
  const nextActivation = JSON.parse(readFileSync(activationPath, 'utf8'));
  world.say('What was my test word?'); world.answer('lighthouse');
  const next = world.compose({ profile: nextProfile, activation: nextActivation });
  try { await next.run({ maxCycles: 4, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); }
  finally { next.close(); }
  expect(world.models()).toHaveLength(1);
  expect(world.models()[0].stdin).toContain('my test word is lighthouse');
  expect(world.models()[0].stdin).toContain('turn ended without an answer');
  expect(world.sends()).toHaveLength(1);
  expect(world.sends()[0].body.text).toContain('lighthouse');
}, 1_800_000);

it('refuses recovery when a provider dispatch claim exists', async () => {
  const world = successiveWorld(); temporary.push(world.directory);
  const profilePath = join(world.directory, 'profile.json'), activationPath = join(world.directory, 'activation.json');
  writeFileSync(profilePath, JSON.stringify(offlineProfile));
  writeFileSync(activationPath, JSON.stringify(world.activation()));
  const updateId = world.say('my test word is lighthouse');
  const failed = world.compose({ providerIO: io => ({ ...io, execute: async command => {
    if (command.args[0] === '--version' || command.args[0] === 'auth') return io.execute(command);
    throw Error('offline provider failed after dispatch claim');
  } }) });
  try { await failed.run({ maxCycles: 2, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); }
  finally { failed.close(); }
  expect(world.sends()).toHaveLength(0);
  expect(() => recoverPreDispatchSlot({ root: world.root, profilePath, activationPath, model: world.model,
    configuration: world.stateConfiguration, expectedUpdateId: updateId,
    reason: 'offline test', recordedBy: 'offline-desk',
    storageKey: OFFLINE_STORAGE_KEY, telegramToken: '8820318295:synthetic_recorded_test_only_value',
    now: () => 1790000005000, alive: () => false }))
    .toThrow('preview recovery: provider dispatch evidence exists');
}, 1_800_000);

it('answers after recovery when the prior context delivery was consumed but not settled', async () => {
  const world = successiveWorld(); temporary.push(world.directory);
  const profilePath = join(world.directory, 'profile.json'), activationPath = join(world.directory, 'activation.json');
  writeFileSync(profilePath, JSON.stringify(offlineProfile));
  writeFileSync(activationPath, JSON.stringify(world.activation()));
  const updateId = world.say('my test word is lighthouse');
  const failed = world.compose({ providerIO: io => ({ ...io, inspectSubscriptionProfile: profile => ({
    loginProfileIdentity: 'offline-profile-after-reboot',
    managedConfigurationDigest: profile.managedConfigurationDigest }) }) });
  try { await failed.run({ maxCycles: 2, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); }
  finally { failed.close(); }
  expect(world.models()).toHaveLength(0);
  let oldOperation;
  const before = world.compose();
  try {
    const facts = before.rows();
    expect(facts.length).toBeGreaterThan(66);
    const consumed = facts.filter(row => row.kind === 'transport-AdmissionReservation'
      && row.body.record?.state === 'consumed');
    expect(consumed.length).toBeGreaterThan(0);
    oldOperation = consumed[0].body.record.operation;
    expect(facts.filter(row => row.kind === 'transport-SettlementApplication')).toHaveLength(0);
  } finally { before.close(); }
  recoverPreDispatchSlot({ root: world.root, profilePath, activationPath, model: world.model,
    configuration: world.stateConfiguration, expectedUpdateId: updateId,
    reason: 'offline unsettled context delivery', recordedBy: 'offline-desk',
    storageKey: OFFLINE_STORAGE_KEY, telegramToken: '8820318295:synthetic_recorded_test_only_value',
    now: () => 1790000005000, alive: () => false });
  const renewed = { ...offlineProfile, loginProfileIdentity: 'offline-profile-after-reboot' };
  rerecordLoginProfileIdentity({ root: world.root, profilePath, activationPath, model: world.model,
    reason: 'offline profile re-record', recordedBy: 'offline-desk', storageKey: OFFLINE_STORAGE_KEY,
    now: () => 1790000005000, alive: () => false, inspect: () => ({
      loginProfileIdentity: renewed.loginProfileIdentity,
      managedConfigurationDigest: offlineProfile.managedConfigurationDigest }) });
  const profile = Object.freeze(JSON.parse(readFileSync(profilePath, 'utf8')));
  const activation = JSON.parse(readFileSync(activationPath, 'utf8'));
  world.say('What was my test word?'); world.answer('lighthouse');
  const next = world.compose({ profile, activation });
  try { await next.run({ maxCycles: 2, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); }
  finally { next.close(); }
  expect(world.sends()).toHaveLength(1);
  expect(world.models()[0].stdin).toContain('turn ended without an answer');
  world.say('What did you just answer?'); world.answer('I answered lighthouse.');
  const following = world.compose({ profile, activation });
  let finalFacts;
  try { await following.run({ maxCycles: 2, baseBackoffMs: 1, maxBackoffMs: 2, sleep: world.sleep }); finalFacts = following.rows(); }
  finally { following.close(); }
  expect(world.sends()).toHaveLength(2);
  expect(world.sends()[1].body.text).toContain('I answered lighthouse.');
  const secondContext = JSON.parse(JSON.parse(world.models()[1].stdin).messages[1].content).packet;
  expect(secondContext.history.find(row => row.update === updateId + 1)).toMatchObject({
    user: 'What was my test word?', answer: 'lighthouse', outcome: 'answer accepted; Telegram accepted the reply' });
  expect(finalFacts.some(row => row.kind === 'transport-SettlementApplication'
    && row.body.record?.operation === oldOperation)).toBe(false);
}, 1_800_000);
