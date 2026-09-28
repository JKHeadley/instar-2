// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
/** Rule 63: only the runner that currently owns a conversation starts work or sends for it, on the supported
 * single-machine topology; a declared multi-machine posture is inhibited. Real journal-agent children on two roots
 * for ONE conversation share this host's owner directory. Design 18 (P14-NF-67/68): startup refusal, retirement of
 * an existing worker and inhibited authority stay distinct; ownership is served only on advancing observations. */
import { expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { assessStranded, claimConversation, conversationOwnerKey, observeConversationOwner, refusedLaunches,
  SERVICE_FRESH_MS, SERVICE_MIN_OBSERVATION_MS } from './conversation-owner.js';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { readRuns } from './self-state.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';

const context = { site: 'preview.journal', preserved: 'preview:host', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
const key = Buffer.alloc(32, 7);
const pause = ms => new Promise(done => setTimeout(done, ms));

const message = world => ({ update_id: 1, message: { message_id: 101,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' },
  date: Math.floor(Date.now() / 1000), text: 'What is the marker? Juniper.' } });
const statusUntil = async (harness, test) => {
  for (let i = 0; i < 100; i++) {
    const { stdout } = await harness.statusOf();
    // Before the root's journal exists (or while it is being created) status has nothing to report yet.
    const status = stdout.trim() ? JSON.parse(stdout) : null;
    if (status && test(status)) return status;
    await pause(100);
  }
  throw Error('status never reached the expected state');
};

it('a second root for the same conversation is refused without polling or sending while the owner serves', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([message(world)]);
  const owner = harness.startCanary(true);
  try {
    await harness.waitForOverlap();
    // The owner is serving only once its own advancing observations say so, not because its PID exists.
    const { botId, chatId } = world.configuration;
    let seen = null;
    for (let i = 0; i < 100 && seen?.state !== 'serving'; i++) {
      seen = observeConversationOwner({ directory: process.env.INSTAR_CONVERSATION_OWNERS, bot: botId, chat: chatId, machine: hostname(),
        probePid: pid => process.kill(pid, 0), now: Date.now() });
      if (seen.state !== 'serving') await pause(100);
    }
    expect(seen).toMatchObject({ state: 'serving', service: { latestServable: true } });
    expect(refusedLaunches(process.env.INSTAR_CONVERSATION_OWNERS, botId, chatId)).toBe(0);
    const duplicate = await harness.runLive(5);
    expect(duplicate.status).toBe(3);
    expect(duplicate.stderr).toContain('held by another runner');
    const calls = harness.calls();
    expect(calls.filter(call => call.role === 'live')).toHaveLength(0);
    expect(calls.filter(call => call.kind === 'send')).toHaveLength(0);
    const last = readRuns(join(harness.liveRoot, 'runs.jsonl')).launches.at(-1);
    expect(last.reason).toBe('not the conversation owner: held by a live runner on this machine');
    expect(last.nonowner.machine).toBeTruthy();
    expect(last.revival).toBe('none');
    // The refusal is host-scope: the OWNER's status line reads this same count (it serves from another root).
    expect(refusedLaunches(process.env.INSTAR_CONVERSATION_OWNERS, botId, chatId)).toBe(1);
    expect(JSON.parse((await harness.statusOf()).stdout)).toMatchObject({ duplicateLaunchesRefused: 1, workersRetired: 0, inhibitedLaunches: 0,
      ownership: { state: 'serving', holder: { thisRoot: false }, topology: { posture: 'single-machine', supported: true } },
      stranded: { state: 'clear', owner: 'serving' } });
  } finally {
    await harness.stopCanary(owner);
    harness.releaseOverlap();
  }
  // The owner released its claim on a clean exit: this root may now serve, and answers exactly once.
  expect(JSON.parse((await harness.statusOf()).stdout).ownership.state).toBe('unowned');
  const served = await harness.runLive(2);
  expect(served.status, served.stderr).toBe(0);
  expect(harness.calls().filter(call => call.kind === 'send')).toHaveLength(1);
  expect(JSON.parse((await harness.statusOf()).stdout)).toMatchObject({ replies: 1, stranded: { state: 'clear' }, ownership: { state: 'unowned' } });
}, 90000);

it('a declared multi-machine posture is inhibited: nothing polled or sent, the input stays with the platform', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([message(world)]);
  const inhibited = await harness.runLive(3, [], { INSTAR_MACHINE_POSTURE: 'multi-machine' });
  expect(inhibited.status).toBe(4);
  expect(inhibited.stderr).toContain('no shared conversation authority');
  // Not one Telegram call: no identity check, no poll, no send (the call log was never even created).
  expect(existsSync(join(harness.directory, 'telegram.jsonl'))).toBe(false);
  const last = readRuns(join(harness.liveRoot, 'runs.jsonl')).launches.at(-1);
  expect(last).toMatchObject({ revival: 'inhibited', inhibited: 'unsupported topology: multi-machine' });
  expect(JSON.parse((await harness.statusOf()).stdout)).toMatchObject({ inhibitedLaunches: 1, cursor: 0,
    stranded: { state: 'clear', owner: 'unowned' } });
  // The supported single-machine posture then serves the same input once.
  const served = await harness.runLive(2);
  expect(served.status, served.stderr).toBe(0);
  expect(harness.calls().filter(call => call.kind === 'send')).toHaveLength(1);
}, 90000);

it('an existing worker that loses the fence retires, recorded apart from startup refusals', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  const { botId, chatId } = world.configuration, owners = process.env.INSTAR_CONVERSATION_OWNERS;
  const refusedBefore = refusedLaunches(owners, botId, chatId);
  const live = harness.startLive(100000);
  const exited = new Promise(done => live.once('exit', done));
  try {
    await statusUntil(harness, status => status.ownership.state === 'serving' && status.ownership.holder.thisRoot);
    // An operator hand-off replaces the owner record: the running worker no longer holds the fence.
    writeFileSync(join(owners, conversationOwnerKey(botId, chatId), '.boot-lease', 'owner.json'),
      JSON.stringify({ pid: 1, machine: 'studio', nonce: 'replacement' }));
    await Promise.race([exited, pause(30000)]);
  } finally { if (live.exitCode === null && live.signalCode === null) live.kill('SIGKILL'); }
  const last = readRuns(join(harness.liveRoot, 'runs.jsonl')).launches.at(-1);
  expect(last).toMatchObject({ reason: 'conversation ownership lost', retired: 'conversation ownership lost' });
  expect(last.nonowner).toBeUndefined();
  expect(JSON.parse((await harness.statusOf()).stdout)).toMatchObject({ workersRetired: 1, duplicateLaunchesRefused: refusedBefore });
  // The replaced record now belongs to that hand-off, not to this test file's later cases.
  rmSync(join(owners, conversationOwnerKey(botId, chatId)), { recursive: true, force: true });
}, 90000);

it('a crashed owner on this machine is observed stale (stranded), then recovered by the next launch which answers once', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  const owner = harness.startCanary(true);
  await harness.waitForOverlap();
  owner.kill('SIGKILL');
  await new Promise(done => owner.once('exit', done));
  harness.releaseOverlap();
  harness.setUpdates([message(world)]);
  const directory = process.env.INSTAR_CONVERSATION_OWNERS;
  const observed = observeConversationOwner({ directory, bot: world.configuration.botId, chat: world.configuration.chatId,
    machine: JSON.parse(readFileSync(join(directory, conversationOwnerKey(world.configuration.botId, world.configuration.chatId), 'holder.json'), 'utf8')).machine,
    probePid: pid => process.kill(pid, 0), now: Date.now() });
  expect(observed.state).toBe('stale');
  expect(assessStranded(observed, 0).state).toBe('stranded');
  const served = await harness.runLive(2);
  expect(served.status, served.stderr).toBe(0);
  expect(harness.calls().filter(call => call.kind === 'send')).toHaveLength(1);
}, 90000);

it('the fence: exclusive per conversation, refused across machines, inhibited when the authority is unusable, lost when the owner record changes', () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'owner-unit-')));
  const claim = (machine, root, at = directory) => claimConversation({ directory: at, bot: '1', chat: '2', machine, root, key, context,
    io: productionStorageIO, now: 1000 });
  const first = claim('studio', '/roots/a');
  expect(first).toMatchObject({ owner: true, disposition: 'owner' });
  expect(first.verify()).toBe(true);
  expect(claim('studio', '/roots/b')).toMatchObject({ owner: false, disposition: 'nonowner', reason: 'held by a live runner on this machine',
    holder: { machine: 'studio', root: '/roots/a' } });
  expect(claimConversation({ directory, bot: '1', chat: '3', machine: 'studio', root: '/roots/b', key, context,
    io: productionStorageIO, now: 1000 }).owner).toBe(true);
  expect(claim('laptop', '/roots/c')).toMatchObject({ owner: false, disposition: 'nonowner', reason: 'held from another machine' });
  // An unusable authority (here: the owner directory is a regular file) is never "served by another runner".
  const file = join(directory, 'not-a-directory'); writeFileSync(file, 'x');
  const broken = claim('studio', '/roots/d', file);
  expect(broken).toMatchObject({ owner: false, disposition: 'inhibited' });
  expect(broken.reason).toContain('ownership authority unavailable');
  const ownerPath = join(directory, conversationOwnerKey('1', '2'), '.boot-lease', 'owner.json');
  writeFileSync(ownerPath, JSON.stringify({ pid: 1, machine: 'studio', nonce: 'replacement' }));
  expect(first.verify()).toBe(false);
  first.release();
  expect(first.verify()).toBe(false);
});

it('P14-NF-68 service observations: a live PID is not service; serving, unservable and cannot-assess each need their evidence', () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'owner-service-')));
  const held = claimConversation({ directory, bot: '1', chat: '2', machine: 'studio', root: '/r', key, context, io: productionStorageIO, now: 0 });
  const observe = (now, machine = 'studio') => observeConversationOwner({ directory, bot: '1', chat: '2', machine, probePid: () => {}, now });
  // Alive, but no evidence yet: cannot-assess, never green.
  expect(observe(10).state).toBe('cannot-assess');
  held.observe(1000, true, 'serving');
  expect(observe(1001)).toMatchObject({ state: 'cannot-assess', reason: expect.stringContaining('fewer than two') });
  held.observe(2000, true, 'serving');
  expect(observe(2001)).toMatchObject({ state: 'serving', service: { observations: 2, latestServable: true } });
  // A frozen worker stops advancing: the same live PID is no longer "serving".
  expect(observe(2000 + SERVICE_FRESH_MS + 1).state).toBe('cannot-assess');
  // One non-servable sample, or several inside the minimum period, is not sustained.
  held.observe(3000, false, 'poll breaker open after sustained failures');
  expect(observe(3001).state).toBe('cannot-assess');
  held.observe(3000 + SERVICE_MIN_OBSERVATION_MS - 1, false, 'poll breaker open after sustained failures');
  expect(observe(3000 + SERVICE_MIN_OBSERVATION_MS).state).toBe('cannot-assess');
  held.observe(3000 + SERVICE_MIN_OBSERVATION_MS + 1, false, 'poll breaker open after sustained failures');
  const unservable = observe(3000 + SERVICE_MIN_OBSERVATION_MS + 2);
  expect(unservable).toMatchObject({ state: 'unservable', reason: 'poll breaker open after sustained failures' });
  // Stranded is assessed WITHOUT waiting input, and grants nothing: it is a signal.
  expect(assessStranded(unservable, 0)).toMatchObject({ state: 'stranded', owner: 'unservable', waiting: 0 });
  held.observe(3000 + SERVICE_MIN_OBSERVATION_MS + 3, true, 'serving');
  expect(observe(3000 + SERVICE_MIN_OBSERVATION_MS + 4).state).toBe('serving');
  expect(assessStranded(observe(3000 + SERVICE_MIN_OBSERVATION_MS + 4), 3).state).toBe('clear');
  expect(assessStranded(observe(10, 'laptop'), 3)).toMatchObject({ state: 'cannot-assess', owner: 'foreign' });
  held.release();
  expect(assessStranded(observe(10), 0).state).toBe('clear');
  expect(assessStranded(observe(10), 2)).toMatchObject({ state: 'stranded', owner: 'unowned' });
});
