// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
/** Rule 63: only the machine/runner that currently owns a conversation starts work or sends for it.
 * Real journal-agent children on two roots for ONE conversation, sharing this host's owner directory. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { claimConversation, conversationOwnerKey, observeConversationOwner } from './conversation-owner.js';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { readRuns } from './self-state.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';

const context = { site: 'preview.journal', preserved: 'preview:host', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
const key = Buffer.alloc(32, 7);

const message = world => ({ update_id: 1, message: { message_id: 101,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' },
  date: Math.floor(Date.now() / 1000), text: 'What is the marker? Juniper.' } });

it('a second root for the same conversation retires without polling or sending while the owner serves', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([message(world)]);
  const owner = harness.startCanary(true);
  try {
    await harness.waitForOverlap();
    const duplicate = harness.launchLive(5);
    expect(duplicate.error).toBeUndefined();
    expect(duplicate.status).toBe(3);
    expect(duplicate.stderr).toContain('served by another runner');
    const calls = harness.calls();
    expect(calls.filter(call => call.role === 'live')).toHaveLength(0);
    expect(calls.filter(call => call.kind === 'send')).toHaveLength(0);
    const last = readRuns(join(harness.liveRoot, 'runs.jsonl')).launches.at(-1);
    expect(last.reason).toBe('not the conversation owner: held by a live runner on this machine');
    expect(last.nonowner.machine).toBeTruthy();
    expect(last.revival).toBe('none');
    const status = JSON.parse(harness.status().stdout);
    expect(status.ownership).toMatchObject({ state: 'serving', holder: { thisRoot: false } });
    expect(status.duplicateLaunchesRetired).toBe(1);
  } finally {
    await harness.stopCanary(owner);
    harness.releaseOverlap();
  }
  // The owner released its claim on a clean exit: this root may now serve, and answers exactly once.
  expect(JSON.parse(harness.status().stdout).ownership.state).toBe('unowned');
  const served = harness.launchLive(2);
  expect(served.status, served.stderr).toBe(0);
  expect(harness.calls().filter(call => call.kind === 'send')).toHaveLength(1);
  expect(JSON.parse(harness.status().stdout)).toMatchObject({ replies: 1, stranded: null, ownership: { state: 'unowned' } });
}, 60000);

it('a crashed owner on this machine is observed stale, then recovered by the next launch which answers once', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  const owner = harness.startCanary(true);
  await harness.waitForOverlap();
  owner.kill('SIGKILL');
  await new Promise(done => owner.once('exit', done));
  harness.releaseOverlap();
  // Seed the live root with an accepted operator message while no live runner serves.
  harness.setUpdates([message(world)]);
  const directory = process.env.INSTAR_CONVERSATION_OWNERS;
  const observed = observeConversationOwner({ directory, bot: world.configuration.botId, chat: world.configuration.chatId,
    machine: JSON.parse(readFileSync(join(directory, conversationOwnerKey(world.configuration.botId, world.configuration.chatId), 'holder.json'), 'utf8')).machine,
    probePid: pid => process.kill(pid, 0), now: Date.now() });
  expect(observed.state).toBe('stale');
  const served = harness.launchLive(2);
  expect(served.status, served.stderr).toBe(0);
  expect(harness.calls().filter(call => call.kind === 'send')).toHaveLength(1);
}, 60000);

it('the fence: exclusive per conversation, refused across machines, lost when the owner record changes', () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'owner-unit-')));
  const claim = (machine, root) => claimConversation({ directory, bot: '1', chat: '2', machine, root, key, context,
    io: productionStorageIO, now: 1000 });
  const first = claim('studio', '/roots/a');
  expect(first.owner).toBe(true);
  expect(first.verify()).toBe(true);
  // Same machine, live holder: refused. Another conversation is independent.
  expect(claim('studio', '/roots/b')).toMatchObject({ owner: false, reason: 'held by a live runner on this machine',
    holder: { machine: 'studio', root: '/roots/a' } });
  expect(claimConversation({ directory, bot: '1', chat: '3', machine: 'studio', root: '/roots/b', key, context,
    io: productionStorageIO, now: 1000 }).owner).toBe(true);
  // Another machine can never recover this machine's claim from here, live or not.
  expect(claim('laptop', '/roots/c')).toMatchObject({ owner: false, reason: 'held from another machine' });
  const observe = machine => observeConversationOwner({ directory, bot: '1', chat: '2', machine,
    probePid: pid => process.kill(pid, 0), now: 2000 }).state;
  expect(observe('studio')).toBe('serving');
  expect(observe('laptop')).toBe('foreign');
  // An operator hand-off that replaces the owner record removes the fence from the old holder.
  const ownerPath = join(directory, conversationOwnerKey('1', '2'), '.boot-lease', 'owner.json');
  writeFileSync(ownerPath, JSON.stringify({ pid: 1, machine: 'studio', nonce: 'replacement' }));
  expect(first.verify()).toBe(false);
  first.release();
  expect(first.verify()).toBe(false);
});
