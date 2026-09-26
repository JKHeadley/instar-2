// @ts-nocheck -- offline evidence for the reboot-stable login-profile identity and its one-use re-record.
// No live network, Telegram or model is contacted.
import { afterEach, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSubscriptionProviderIO, subscriptionProfileIdentity } from '../../scripts/production-boot-io.mjs';
import { encoded } from './stage2-provider.js';
import { RERECORD_SUFFIX, rerecordLoginProfileIdentity } from './rerecord-profile.js';
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
  expect(pendingRefusal).toBe('preview: provider attempt in flight or serving latched');
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
