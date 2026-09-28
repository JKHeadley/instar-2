// @ts-nocheck -- process-level fixture; physical ports are replaced by its test loader.
/** Rule 33: declared cross-store agreements are checked at launch and on a cadence, and every
 * completed check is durable. Both sides of each decision: agreement, detected disagreement, and an
 * honestly unmeasurable comparison that is never reported as either. */
import { expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cutoverHarness } from './journal-cutover-harness.mjs';
import { STORE_AGREEMENTS, readAgreementLog } from './store-agreements.js';
import { offlineProfile, successiveWorld } from './successive-fixture.js';
import { createJournalWorker, openPreviewJournal, projectionDigest } from './journal-test-worker.js';
import { readRuns } from './self-state.js';

const message = (world, id, text) => ({ update_id: id, message: { message_id: 100 + id,
  from: { id: Number(world.configuration.operatorSenderId), is_bot: false, first_name: 'Justin' },
  chat: { id: Number(world.configuration.chatId), type: 'private' }, date: Math.floor(Date.now() / 1000), text } });
const verdicts = harness => Object.fromEntries([...readAgreementLog(join(harness.liveRoot, 'agreements.jsonl')).values()]
  .map(row => [row.id, row.agree]));
const check = id => STORE_AGREEMENTS.find(item => item.id === id).check;

it('records every declared agreement at launch, then detects a run log that disagrees with the journal at its frontier', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([message(world, 1, 'What is the marker? Juniper.')]);
  expect((await harness.runLive(2)).status).toBe(0);
  // First launch: no earlier exit to compare, so that one is honestly unmeasured (null), never "agree".
  // The snapshot comparison replays the durable journal bytes read-only and compares them with the live projection.
  expect(verdicts(harness)).toEqual({ 'memory-provenance': true, 'unfinished-at-exit': null, 'serving-runner': true, 'snapshot-replay': true });
  const runs = join(harness.liveRoot, 'runs.jsonl');
  const exit = readRuns(runs).launches.at(-1);
  expect(exit.frontier).toMatch(/^[a-f0-9]{64}$/);
  // A forged exit row at the SAME journal frontier claims five unfinished requests; the journal has none. Detected, not repaired.
  const at = Date.now() - 5000;
  appendFileSync(runs, `\n${JSON.stringify({ v: 1, launch: at, pid: 1 })}\n${JSON.stringify({ v: 1, launch: at, exit: at + 1, reason: 'forged',
    unfinished: 5, revival: 'queued', frontier: exit.frontier })}\n`);
  expect((await harness.runLive(1)).status).toBe(0);
  let status = JSON.parse((await harness.statusOf()).stdout);
  const row = id => status.storeAgreements.find(item => item.id === id);
  expect(row('unfinished-at-exit')).toMatchObject({ agree: false, detail: 'run log exit says 5 unfinished, journal says 0' });
  expect(row('serving-runner').agree).toBe(true);
  expect(row('snapshot-replay').agree).toBe(true);
  // A crashed launch never recorded its end: the owner record and the run log now disagree.
  appendFileSync(runs, `\n${JSON.stringify({ v: 1, launch: Date.now() - 1000, pid: 2 })}\n`);
  expect((await harness.runLive(1)).status).toBe(0);
  status = JSON.parse((await harness.statusOf()).stdout);
  expect(row('serving-runner').agree).toBe(false);
  expect(row('serving-runner').detail).toContain('never recorded');
  expect(status.storeAgreements.every(item => item.lastCheckedAt !== null && item.authoritative && item.projection)).toBe(true);
  // The run log itself is left as written: detection never rebuilds it from the journal.
  expect(readFileSync(runs, 'utf8')).toContain('"reason":"forged"');
}, 90000);

it('the Telegram status reply carries ownership and the store-check verdict', async () => {
  const world = successiveWorld(), harness = cutoverHarness(world, offlineProfile);
  harness.setUpdates([message(world, 1, 'status')]);
  expect((await harness.runLive(2)).status).toBe(0);
  const sent = harness.calls().filter(call => call.kind === 'send').map(call => call.text).join('\n');
  expect(sent).toMatch(/Serving: this runner on .+ owns this conversation .+; 0 duplicate launch\(es\) refused on this machine\./);
  expect(sent).toMatch(/Store checks: \d of 4 agree/);
}, 90000);

it('unfinished-at-exit is measured only at the exit\'s own frontier: completing that work later is unmeasurable, not a disagreement', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'agreement-frontier-')));
  const now = 1790000000000;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(23), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
    configurationDigest: 'sha256:offline', expires: now + 99999999, maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 8000, cursor: 0 });
  try {
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      prepareModel: input => input.context, model: async () => 'Noted.', send: async () => 1, checkOutbound: () => {} });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'Hello', date: Math.floor(now / 1000) } }]);
    const frontier = projectionDigest(journal.view);
    const runs = (unfinished, recorded = frontier) => ({ view: journal.view, now: now + 40, runs: { launches: [
      { at: now - 10, exit: now + 10, unfinished, frontier: recorded }, { at: now + 20 } ], unreadable: 0 } });
    expect(check('unfinished-at-exit')(runs(1))).toEqual({ agree: true, detail: '1 unfinished in both at that exit' });
    expect(check('unfinished-at-exit')(runs(3)).agree).toBe(false);
    expect(check('unfinished-at-exit')(runs(1, null)).agree).toBeNull();
    // Healthy completion of the old turn after the next launch: the journal moved past that frontier.
    await worker.drain();
    expect(check('unfinished-at-exit')(runs(1))).toEqual({ agree: null, detail: 'the journal changed since that exit' });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('snapshot-replay compares a real replay every time; no replay is unmeasurable, a differing replay disagrees', () => {
  // No replay available (e.g. from a reader without the key): never claimed as agreement.
  expect(check('snapshot-replay')({ view: { order: [] } }).agree).toBeNull();
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'agreement-replay-')));
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(5);
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 1890000000000, maxCalls: 4, maxReplies: 2, maxTurns: 2, maxBytes: 8000, cursor: 0 });
  try {
    const replay = () => { const copy = openPreviewJournal(path, key, undefined, undefined, true); try { return projectionDigest(copy.view); } finally { copy.close(); } };
    expect(check('snapshot-replay')({ view: journal.view, replay })).toMatchObject({ agree: true });
    expect(check('snapshot-replay')({ view: journal.view, replay: () => 'f'.repeat(64) })).toMatchObject({ agree: false });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('serving-runner compares the owner claim against open launches on both sides of each state', () => {
  const serving = check('serving-runner');
  const holder = { machine: 'studio', root: '/r', pid: 7, since: 1 };
  const input = (launches, state, root = '/r') => ({ runs: { launches, unreadable: 0 }, ownership: { state, holder, observedAt: 2 }, root });
  expect(serving(input([{ at: 1, pid: 7 }], 'serving')).agree).toBe(true);
  expect(serving(input([{ at: 1, pid: 7 }], 'cannot-assess')).agree).toBe(true);
  expect(serving(input([{ at: 1, pid: 8 }], 'serving')).agree).toBe(false);
  expect(serving(input([{ at: 0 }, { at: 1, pid: 7 }], 'serving')).agree).toBe(false);
  expect(serving(input([{ at: 1, exit: 2 }], 'unowned')).agree).toBe(true);
  expect(serving(input([{ at: 1 }], 'stale')).agree).toBe(false);
  expect(serving(input([{ at: 1 }], 'serving', '/other')).agree).toBe(false);
  expect(serving(input([{ at: 1 }], 'foreign')).agree).toBeNull();
});
