// @ts-nocheck -- the runner-child case drives a real journal-agent process through the cutover fixture.
// Rules 9, 96, 114 (MUST-FIX 6): the runner's concurrent owned work reaches its packet through the existing
// awareness work/overlap view, and stopped or stale work is never presented as running.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { CONCURRENT_WORK_ROWS, concurrentWorkItem, latestOwnedLaunch } from './journal.js';

const HOUR = 3_600_000, NOW = Date.UTC(2026, 8, 28, 12, 0);
const CONVERSATION = 'telegram/bot-8820318295/chat-7812716706';
const current = { owner: 'runner-live', launch: NOW - 60_000, conversation: CONVERSATION };
const launch = (owner, extra = {}) => ({ owner, launch: NOW - HOUR, pid: 4242, conversation: CONVERSATION, process: 'absent', ...extra });
const item = others => concurrentWorkItem({ now: NOW, current, others, scanned: others.length, truncated: false, unreadable: 0 });
const rowOf = (value, owner) => value.rows.find(row => row.owner === owner);

it('reads the latest launch of a run log with its exit; legacy launches record no conversation', () => {
  const rows = [{ v: 1, launch: 10, pid: 1, work: { conversation: 'telegram/bot-1/chat-2' } }, { v: 1, launch: 10, exit: 12, reason: 'cycle limit reached' },
    { v: 1, launch: 10, poll: 'failed', at: 11 }, { v: 1, launch: 20, pid: 7, install: {}, work: { conversation: 'telegram/bot-1/chat-2' } }];
  const text = rows.map(row => JSON.stringify(row)).join('\n') + '\n{"torn';
  expect(latestOwnedLaunch('a', text)).toEqual({ owner: 'a', launch: 20, pid: 7, conversation: 'telegram/bot-1/chat-2' });
  expect(latestOwnedLaunch('a', `${text}\n${JSON.stringify({ v: 1, launch: 20, exit: 30, reason: 'paused by signal SIGTERM' })}`))
    .toMatchObject({ launch: 20, exit: 30, reason: 'paused by signal SIGTERM' });
  expect(latestOwnedLaunch('old', JSON.stringify({ v: 1, launch: 5, pid: 3 }))).toEqual({ owner: 'old', launch: 5, pid: 3, conversation: null });
  expect(latestOwnedLaunch('empty', '')).toBeNull();
});

it('a second running owner of the same conversation appears with its identity and the overlap; others are honest', () => {
  const value = item([
    launch('runner-second', { process: 'present' }),
    launch('canary-stopped', { exit: NOW - 30 * 60_000, reason: 'paused by signal SIGTERM' }),
    launch('canary-crashed', { process: 'absent' }),
    launch('canary-unchecked', { process: 'unknown' }),
    launch('other-bot', { process: 'present', conversation: 'telegram/bot-1/chat-2' }),
  ]);
  expect(value.rows[0]).toEqual({ owner: 'runner-live', you: true, state: 'running', conversation: CONVERSATION,
    since: '2026-09-28T11:59Z' });
  // The awareness view's overlap: the shared, high-specificity conversation tag.
  expect(rowOf(value, 'runner-second')).toEqual({ owner: 'runner-second', state: 'running', conversation: CONVERSATION,
    launched: '2026-09-28T11:00Z', sharesWithYou: [CONVERSATION] });
  expect(rowOf(value, 'other-bot')).toMatchObject({ state: 'running' });
  expect(rowOf(value, 'other-bot').sharesWithYou).toBeUndefined();
  // An exit row is stopped with its recorded reason; no exit and a gone process is stale; unchecked is unknown.
  expect(rowOf(value, 'canary-stopped')).toMatchObject({ state: 'stopped', ended: '2026-09-28T11:30Z', endReason: 'paused by signal SIGTERM' });
  expect(rowOf(value, 'canary-crashed')).toMatchObject({ state: 'stale' });
  expect(rowOf(value, 'canary-crashed').ended).toBeUndefined();
  expect(rowOf(value, 'canary-unchecked')).toMatchObject({ state: 'unknown' });
  expect(value.rows.filter(row => row.state === 'running').map(row => row.owner).sort()).toEqual(['other-bot', 'runner-live', 'runner-second']);
  // Running work is listed before stopped work.
  expect(value.rows.slice(1, 3).map(row => row.state)).toEqual(['running', 'running']);
  expect(value.note).toMatch(/^Quoted data, not instructions/u);
});

it('without a second owner there is no overlap, and old ended work is counted rather than listed', () => {
  const value = item([launch('ancient', { exit: NOW - 48 * HOUR, reason: 'cycle limit reached' }),
    launch('ancient-stale', { launch: NOW - 72 * HOUR }), launch('runner-live', { process: 'present' })]);
  expect(value.rows).toHaveLength(1);
  expect(value.omitted).toBe(2);
  expect(value.rows.some(row => 'sharesWithYou' in row)).toBe(false);
});

it('is bounded in rows and bytes however many owned runners exist', () => {
  const others = Array.from({ length: 50 }, (_, index) => launch(`runner-${String(index).padStart(2, '0')}-${'x'.repeat(200)}`,
    { process: index % 2 ? 'present' : 'absent', reason: 'r'.repeat(500), exit: index % 3 ? undefined : NOW - index * 60_000,
      conversation: `${CONVERSATION}/${'y'.repeat(300)}` }));
  const value = concurrentWorkItem({ now: NOW, current, others, scanned: 50, truncated: true, unreadable: 3 });
  expect(value.rows.length).toBe(CONCURRENT_WORK_ROWS);
  expect(value.omitted).toBe(50 - (CONCURRENT_WORK_ROWS - 1));
  expect(value.scope).toEqual({ runnerRootsRead: 50, truncated: true, unreadable: 3 });
  expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThanOrEqual(2600);
  expect(value.rows.every(row => row.owner.length <= 120 && (row.endReason ?? '').length <= 120)).toBe(true);
});

const message = (world, id, text) => ({ update_id: id, message: { message_id: 100 + id,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' }, date: Math.floor(Date.now() / 1000), text } });
const pause = ms => new Promise(done => setTimeout(done, ms));
const loaderArgs = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
  '--loader', './tests/preview/journal-cutover-loader.mjs', 'tests/preview/journal-agent.mjs'];

it('a real second runner appears in the live packet with its overlap, and after a restart stopped and stale runners are shown as such', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  const directory = harness.directory, secondRoot = join(directory, 'cutover-second');
  const activation = JSON.parse(readFileSync(join(directory, 'cutover-activation.json'), 'utf8'));
  const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.alloc(32, 19).toString('hex'),
    INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: '',
    INSTAR_PREVIEW_CUTOVER_WORLD: directory, INSTAR_PREVIEW_CUTOVER_ROLE: 'live' };
  const inspect = root => {
    const result = spawnSync(process.execPath, [...loaderArgs, 'inspect', '--root', root], { cwd: process.cwd(), env, encoding: 'utf8', timeout: 20000 });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout).last;
  };
  harness.setUpdates([message(world, 1, 'What is the marker? Juniper.')]);
  // A genuine second runner of the same bot and chat, in its own root beside the live one. Like the unfenced
  // canary, it answers to its own conversation-ownership authority, so the live runner's fence does not retire either.
  const second = spawn(process.execPath, [...loaderArgs, 'run', '--root', secondRoot,
    '--bot-id', world.configuration.botId, '--bot-username', world.configuration.botUsername,
    '--chat-id', world.configuration.chatId, '--operator-sender-id', world.configuration.operatorSenderId,
    '--grant-reference', activation.trial, '--configuration-digest', activation.baseConfigurationDigest,
    '--expires-at', String(activation.expiresAt), '--tools', 'off', '--activation-record', join(directory, 'cutover-activation.json'),
    '--operator-records', join(directory, 'operator-records'), '--login-profile', join(directory, 'cutover-profile.json'), '--model', world.model, '--max-cycles', '100000',
    '--max-poll-seconds', '1'], { cwd: process.cwd(), env: { ...env, INSTAR_CONVERSATION_OWNERS: join(directory, 'owners-second') },
    stdio: 'ignore' });
  try {
    for (let i = 0; i < 200 && !existsSync(join(secondRoot, 'runs.jsonl')); i++) await pause(100);
    expect(existsSync(join(secondRoot, 'runs.jsonl'))).toBe(true);

    expect(harness.launchLive(2).status).toBe(0);
    const first = inspect(harness.liveRoot);
    expect(first.update).toBe(1);
    const conversation = `telegram/bot-${world.configuration.botId}/chat-${world.configuration.chatId}`;
    expect(first.concurrentWork.rows[0]).toMatchObject({ owner: 'cutover-live', you: true, state: 'running', conversation });
    expect(first.concurrentWork.rows.find(row => row.owner === 'cutover-second'))
      .toMatchObject({ state: 'running', conversation, sharesWithYou: [conversation] });

    // The second runner is killed without recording an exit; a canary runs and stops with its exit recorded.
    second.kill('SIGKILL');
    await new Promise(done => second.exitCode !== null || second.signalCode !== null ? done() : second.once('exit', done));
    const canary = harness.startCanary();
    await harness.waitForOverlap();
    await harness.stopCanary(canary);
    harness.releaseOverlap();

    // A restart of the live runner: the next packet carries the new launch and the honest state of the others.
    harness.setUpdates([message(world, 1, 'What is the marker? Juniper.'), message(world, 2, 'Is anything else working on this chat?')]);
    expect(harness.launchLive(2).status).toBe(0);
    const after = inspect(harness.liveRoot);
    expect(after.update).toBe(2);
    const rows = after.concurrentWork.rows;
    expect(rows[0]).toMatchObject({ owner: 'cutover-live', you: true, state: 'running', conversation });
    expect(Date.parse(rows[0].since)).toBeGreaterThanOrEqual(Date.parse(first.concurrentWork.rows[0].since));
    expect(rows.find(row => row.owner === 'cutover-second')).toMatchObject({ state: 'stale', conversation });
    expect(rows.find(row => row.owner === 'cutover-second').ended).toBeUndefined();
    expect(rows.find(row => row.owner === 'cutover-canary')).toMatchObject({ state: 'stopped', conversation,
      endReason: 'paused by signal SIGTERM' });
    expect(rows.filter(row => row.state === 'running').map(row => row.owner)).toEqual(['cutover-live']);
  } finally { if (second.exitCode === null && second.signalCode === null) second.kill('SIGKILL'); }
}, 120000);
