// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
/** Rule 33: declared cross-store agreements are checked at launch and on a cadence, and every
 * completed check is durable. Both sides of each decision: agreement and detected disagreement. */
import { expect, it } from 'vitest';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { STORE_AGREEMENTS, readAgreementLog } from './store-agreements.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';

const message = (world, id, text) => ({ update_id: id, message: { message_id: 100 + id,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' }, date: Math.floor(Date.now() / 1000), text } });
const verdicts = harness => Object.fromEntries([...readAgreementLog(join(harness.liveRoot, 'agreements.jsonl')).values()]
  .map(row => [row.id, row.agree]));

it('records every declared agreement at launch, then detects a run log that disagrees with the journal', () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([message(world, 1, 'What is the marker? Juniper.')]);
  expect(harness.launchLive(2).status).toBe(0);
  // First launch: no earlier exit to compare, so that one is honestly unmeasured (null), never "agree".
  expect(verdicts(harness)).toEqual({ 'memory-provenance': true, 'unfinished-at-exit': null, 'serving-runner': true, 'snapshot-replay': true });
  expect(harness.launchLive(1).status).toBe(0);
  expect(verdicts(harness)).toMatchObject({ 'unfinished-at-exit': true, 'serving-runner': true });
  // A forged exit row claims five unfinished requests; the journal has none. Detected, not repaired.
  const runs = join(harness.liveRoot, 'runs.jsonl'), at = Date.now() - 5000;
  appendFileSync(runs, `\n${JSON.stringify({ v: 1, launch: at, pid: 1 })}\n${JSON.stringify({ v: 1, launch: at, exit: at + 1, reason: 'forged', unfinished: 5, revival: 'queued' })}\n`);
  expect(harness.launchLive(1).status).toBe(0);
  let status = JSON.parse(harness.status().stdout);
  const row = id => status.storeAgreements.find(item => item.id === id);
  expect(row('unfinished-at-exit')).toMatchObject({ agree: false, detail: 'run log exit says 5 unfinished, journal says 0' });
  expect(row('serving-runner').agree).toBe(true);
  // A crashed launch never recorded its end: the owner record and the run log now disagree.
  appendFileSync(runs, `\n${JSON.stringify({ v: 1, launch: Date.now() - 1000, pid: 2 })}\n`);
  expect(harness.launchLive(1).status).toBe(0);
  status = JSON.parse(harness.status().stdout);
  expect(row('serving-runner').agree).toBe(false);
  expect(row('serving-runner').detail).toContain('never recorded');
  // With a later launch in between, the exit comparison is honestly unmeasurable, not "agree".
  expect(row('unfinished-at-exit').agree).toBeNull();
  expect(status.storeAgreements.every(item => item.lastCheckedAt !== null && item.authoritative && item.projection)).toBe(true);
  // The run log itself is left as written: detection never rebuilds it from the journal.
  expect(readFileSync(runs, 'utf8')).toContain('"reason":"forged"');
}, 60000);

it('the Telegram status reply carries ownership and the store-check verdict', () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([message(world, 1, 'status')]);
  expect(harness.launchLive(2).status).toBe(0);
  const sent = harness.calls().filter(call => call.kind === 'send').map(call => call.text).join('\n');
  expect(sent).toMatch(/Serving: this runner on .+ owns this conversation/);
  expect(sent).toMatch(/Store checks: \d of 4 agree/);
}, 60000);

it('serving-runner compares the owner claim against open launches on both sides of each state', () => {
  const check = STORE_AGREEMENTS.find(item => item.id === 'serving-runner').check;
  const holder = { machine: 'studio', root: '/r', pid: 7, since: 1 };
  const input = (launches, state, root = '/r') => ({ runs: { launches, unreadable: 0 }, ownership: { state, holder, observedAt: 2 }, root });
  expect(check(input([{ at: 1, pid: 7 }], 'serving')).agree).toBe(true);
  expect(check(input([{ at: 1, pid: 8 }], 'serving')).agree).toBe(false);
  expect(check(input([{ at: 0 }, { at: 1, pid: 7 }], 'serving')).agree).toBe(false);
  expect(check(input([{ at: 1, exit: 2 }], 'unowned')).agree).toBe(true);
  expect(check(input([{ at: 1 }], 'stale')).agree).toBe(false);
  expect(check(input([{ at: 1 }], 'serving', '/other')).agree).toBe(false);
  expect(check(input([{ at: 1 }], 'foreign')).agree).toBeNull();
});
