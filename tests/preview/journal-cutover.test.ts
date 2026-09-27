// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
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
