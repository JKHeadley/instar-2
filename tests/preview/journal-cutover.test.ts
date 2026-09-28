// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
import { expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { exhaustedPollReason } from './poll-failure-reason.mjs';
import { readRuns } from './self-state.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';

it('refuses a recorded long-poll overlap, then restarts and answers once from durable intake', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  const canary = harness.startCanary();
  try {
    const update = { update_id: 1, message: { message_id: 101,
      from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
      chat: { id: Number(world.configuration.chatId), type: 'private' },
      date: Math.floor(Date.now() / 1000), text: 'What is the marker? Juniper.' } };
    harness.setUpdates([update]);
    // The canary holds the bot's long-poll slot while the update waits.
    await harness.waitForOverlap();
    const refused = harness.launchLive(1000);
    expect(refused.error).toBeUndefined();
    expect(refused.status).toBe(1);
    const firstRuns = readFileSync(join(harness.liveRoot, 'runs.jsonl'), 'utf8');
    expect(firstRuns).toContain('Telegram polling conflict after 5 attempts');
    expect(harness.calls().filter(call => call.role === 'live' && call.kind === 'poll')).toHaveLength(5);
    expect(harness.calls().filter(call => call.role === 'live' && call.outcome === 'accepted')).toHaveLength(0);
    expect(harness.calls().filter(call => call.kind === 'send')).toHaveLength(0);
    expect(JSON.parse(harness.status().stdout)).toMatchObject({ cursor: 0, turns: 0, replies: 0 });
    await harness.stopCanary(canary);
    const canaryPollsAtStop = harness.calls().filter(call => call.role === 'canary' && call.kind === 'poll').length;
    harness.releaseOverlap();
    const resumed = harness.launchLive(2);
    expect(resumed.error).toBeUndefined();
    expect(resumed.status).toBe(0);
    const after = JSON.parse(harness.status().stdout);
    expect(after.cursor).toBe(2);
    expect(after.turns).toBe(1);
    expect(after.replies).toBe(1);
    expect(harness.calls().filter(call => call.role === 'live' && call.outcome === 'accepted').length).toBeGreaterThan(0);
    expect(harness.calls().filter(call => call.kind === 'send')).toHaveLength(1);
    expect(harness.calls().filter(call => call.role === 'canary' && call.kind === 'poll')).toHaveLength(canaryPollsAtStop);
    const repeated = harness.launchLive(1);
    expect(repeated.status).toBe(0);
    expect(harness.calls().filter(call => call.kind === 'send')).toHaveLength(1);
    expect(JSON.parse(harness.status().stdout).cursor).toBe(2);
  } finally {
    await harness.stopCanary(canary);
    harness.releaseOverlap();
  }
}, 60000);

it('recovers a short Telegram poll conflict within the same launch', () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  harness.setConflicts(2);
  const result = harness.launchLive(3);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(harness.calls().filter(call => call.kind === 'poll' && call.role === 'live')).toHaveLength(3);
  expect(JSON.parse(harness.status().stdout)).toMatchObject({ cursor: 0, turns: 0, replies: 0 });
});

it('reports the exhausted twenty-poll limit after mixed failures', () => {
  let failedPolls = 0, conflictedPolls = 0;
  for (let attempt = 1; attempt <= 20; attempt++) {
    const conflict = attempt === 20;
    failedPolls++;
    conflictedPolls = conflict ? conflictedPolls + 1 : 0;
    expect(exhaustedPollReason(failedPolls, conflictedPolls)).toBe(
      attempt === 20 ? 'Telegram polling failed 20 times in a row' : null);
  }
  expect(exhaustedPollReason(5, 5)).toBe('Telegram polling conflict after 5 attempts');
});

it('keeps an inherited TypeSafe key out of the offline child', () => {
  const world = successiveWorld();
  const attemptedFetch = join(world.directory, 'external-fetch-attempted');
  const preload = join(world.directory, 'reject-fetch.mjs');
  writeFileSync(preload, `import { writeFileSync } from 'node:fs';
globalThis.fetch = async () => {
  writeFileSync(${JSON.stringify(attemptedFetch)}, 'called');
  throw Error('external fetch refused');
};
`);
  const harness = cutoverHarness(world, offlineProfile, {
    INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'dummy-inherited-key',
    NODE_OPTIONS: `--import=${preload}` });
  harness.setUpdates([{ update_id: 1, message: { message_id: 101,
    from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
    chat: { id: Number(world.configuration.chatId), type: 'private' },
    date: Math.floor(Date.now() / 1000), text: 'What is the marker? Juniper.' } }]);
  const result = harness.launchLive(2);
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  expect(existsSync(attemptedFetch)).toBe(false);
  expect(harness.calls().filter(call => call.kind === 'send')).toHaveLength(1);
});

it('a relaunch inherits an exhausted poll episode: one delayed trial poll, not a fresh five (Rule 55)', () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  harness.setConflicts(100);
  const first = harness.launchLive(1000);
  expect(first.status).toBe(1);
  const polls = () => harness.calls().filter(call => call.kind === 'poll' && call.role === 'live').length;
  expect(polls()).toBe(5);
  const second = harness.launchLive(1000);
  expect(second.status).toBe(1);
  expect(polls()).toBe(6);
  const runs = () => readRuns(join(harness.liveRoot, 'runs.jsonl'));
  expect(runs().pollPressure).toEqual({ failed: 6, conflicted: 6 });
  expect(runs().launches.map(run => run.revival)).toEqual(['none', 'none']);
  harness.setConflicts(0);
  const healed = harness.launchLive(2);
  expect(healed.status).toBe(0);
  expect(runs().pollPressure).toEqual({ failed: 0, conflicted: 0 });
  expect(readFileSync(join(harness.liveRoot, 'runs.jsonl'), 'utf8')).toContain('"poll":"restored"');
}, 60000);

it('a process killed mid-episode keeps every failed poll it made: the replacement continues the same episode (Rule 55)', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([]);
  harness.setConflicts(100);
  const polls = () => { try { return harness.calls().filter(call => call.kind === 'poll' && call.role === 'live').length; } catch { return 0; } };
  const runs = () => readRuns(join(harness.liveRoot, 'runs.jsonl'));
  // Killed during its backoff after two failed polls, before it can write any exit record.
  const child = harness.startLive(1000);
  const exited = new Promise(done => child.once('exit', (_code, signal) => done(signal)));
  for (let i = 0; i < 400 && polls() < 2; i++) await new Promise(done => setTimeout(done, 25));
  await new Promise(done => setTimeout(done, 100));
  child.kill('SIGKILL');
  expect(await exited).toBe('SIGKILL');
  expect(runs().launches.at(-1)!.exit).toBeUndefined();
  const made = polls();
  expect(made).toBeGreaterThanOrEqual(1);
  expect(made).toBeLessThan(5);
  expect(runs().pollPressure).toEqual({ failed: made, conflicted: made });
  const replacement = harness.launchLive(1000);
  expect(replacement.status).toBe(1);
  // It spends only the attempts the episode had left, never a fresh five.
  expect(polls() - made).toBe(5 - made);
  expect(runs().pollPressure).toEqual({ failed: 5, conflicted: 5 });
}, 60000);
