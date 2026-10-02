import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, summarySpanFailures } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';

// The proof room of 2026-10-01 (room two, proofroom2-small, 32,768-byte context, 18:40-19:02 PDT, live build
// L19s 51dab1e0): nine "Reserve check note N: the kettle is on shelf N." messages, one every four minutes.
// Notes 1 and 2 were answered (reply-2.json: "PREVIEW — Changed the kettle is on shelf 1. → the kettle is on
// shelf 2."); note 3 (update 6230417) was held with reasons ["memory correction pending", "summary faithfulness:
// stale corrected or forgotten claim"]; notes 4-9 were accepted as turns and never answered at all
// (status-wedged.json: turns 9, replies 2, obligations.unansweredTurns 6, inhibition "held: summary
// faithfulness: stale corrected or forgotten claim", reply-3.json .. reply-7.json all empty).
//
// Two recorded facts drive the fixture below, both read off that status:
//  * packet.dropped listed two `candidate` rows omitted for the "packet or prepared prompt byte envelope", so the
//    memory candidate the correction needed was not offered and the model's own memory update could not be
//    validated against it. The turn became a memory request only the rolling summary could decide.
//  * the summary restated the already-corrected clause, so the faithfulness check refused it (modelFailureClasses
//    {malformed: 7} over nine summary calls, summaryThrough still 6230414, summaries [{through: 6230414}]).
// A `summary faithfulness:` hold is released only by an accepted summary covering the turn, so the refusal that
// set the hold was also the thing that made its release impossible: a latch, not a wait.
const STALE = 'the kettle is on shelf 1.';
const REASON = 'summary faithfulness: stale corrected or forgotten claim';
const key = new Uint8Array(32).fill(77);
const start = Date.UTC(2026, 10, 2, 1, 40); // 18:40 in Los Angeles.
const note = (n: number) => `Reserve check note ${String(n)}: the kettle is on shelf ${String(n)}.`;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:correction-faithfulness', configurationDigest: 'sha256:correction-faithfulness',
  expires: Date.UTC(2026, 10, 10), maxCalls: 1000, maxReplies: 1000, maxTurns: 20,
  // The live room's reserve squeeze, scaled to this fixture's shorter history: the packet keeps fitting while the
  // optional memory candidates are dropped, which is the recorded shape (packet.dropped, two `candidate` rows).
  maxBytes: 6000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(start / 1000) + id * 240 } });
type Input = { id: string; question: string; context: string };

const world = (root: string, first = true) => {
  const contexts: { id: string; context: string }[] = [], sent: string[] = [];
  const ports = { now: () => start + 60 * 60_000, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => {
      contexts.push({ id: input.id, context: input.context });
      // What the live model wrote: a summary of the early notes, restating the first one word for word.
      if (input.id.startsWith('summary:'))
        return JSON.stringify({ summary: `The operator reported ${STALE} Then corrected it.`, people: [], memory: [] });
      const packet = JSON.parse(input.context) as { memoryCandidates?: { id: string; message: string }[] };
      const shelf = /shelf (\d)/u.exec(input.question)![1]!;
      if (shelf === '1') return JSON.stringify({ reply: `Noted: ${input.question}`, memory: [], dated: [] });
      const prior = packet.memoryCandidates?.find(item => /the kettle is on shelf \d\./u.test(item.message));
      if (prior) {
        const quote = /the kettle is on shelf \d\./u.exec(prior.message)![0]!;
        return JSON.stringify({ reply: `Changed ${quote} -> the kettle is on shelf ${shelf}.`,
          memory: [{ mode: 'update', source: prior.id, quote, replacement: `the kettle is on shelf ${shelf}.` }], dated: [] });
      }
      // The candidate was dropped for the byte envelope: the update cites a source the decision cannot be checked
      // against, so the correction is left for the summary to decide (live: "memory correction pending").
      return JSON.stringify({ reply: `Changed ${STALE} -> the kettle is on shelf ${shelf}.`,
        memory: [{ mode: 'update', source: 'telegram:12345678:update:6230414', quote: STALE,
          replacement: `the kettle is on shelf ${shelf}.` }], dated: [] });
    },
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { sent.push(value.expectedText); return sent.length; } };
  const path = join(root, 'journal.encrypted');
  const journal = first ? openPreviewJournal(path, key, genesis) : openPreviewJournal(path, key);
  return { journal, worker: createJournalWorker(journal, ports), contexts, sent };
};
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-correction-faith-${name}-`)));

it('answers every turn after a memory correction whose record can never be completed', async () => {
  const root = tmp('wedge');
  try {
    const w = world(root);
    for (let n = 1; n <= 9; n++) { w.worker.intake([update(6230413 + n, note(n))]); await w.worker.drain(); }
    // Drains past the last message: the live room sat like this for 22 minutes and never recovered.
    for (let again = 0; again < 4; again++) await w.worker.drain();

    // The recorded shape really is the one under test, not a fixture that stopped reproducing it.
    expect(w.journal.view.order.some(turn => turn.packetDropped?.some(drop => drop.kind === 'candidate'))).toBe(true);
    expect(w.journal.view.memory.map(change => change.quote)).toContain(STALE);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe(REASON);
    expect(w.journal.view.order.some(turn => turn.memoryPending === true)).toBe(true);
    // No summary was ever accepted, so "an accepted summary releases the hold" could never fire.
    expect(w.journal.view.summaries).toEqual([]);
    expect(w.journal.view.summarySpanFailures.some(through => summarySpanFailures(w.journal.view, through) >= 2)).toBe(true);

    // The point: every accepted operator turn has its one reply, and nothing is left owed.
    for (const turn of w.journal.view.order) expect([turn.update, turn.sent !== undefined]).toEqual([turn.update, true]);
    const health = loopHealth(w.journal.view, start + 60 * 60_000);
    expect(health.unansweredTurns).toBe(0);
    expect(health.inhibition).toBeNull();
    // Nothing withheld still carries a hold that withholds it.
    expect(w.journal.view.order.filter(turn => turn.held !== undefined && turn.sent === undefined)).toEqual([]);

    // The correction's own safeguard is intact: the refused summary is not committed, and every packet built after
    // the correction landed withholds the corrected clause instead of restating it.
    const after = w.contexts.slice(w.contexts.findIndex(call => call.context.includes('[withheld:')));
    expect(after.length).toBeGreaterThan(0);
    for (const call of after) expect(call.context).not.toContain(STALE);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('keeps the frontier turn held while the summary can still be retried', async () => {
  const root = tmp('retryable');
  try {
    // A roomy envelope: these turns answer on the ordinary path, so the only hold under test is the refusal's.
    const path = join(root, 'journal.encrypted');
    const journal = openPreviewJournal(path, key, { ...genesis, maxBytes: 32768 });
    const worker = createJournalWorker(journal, { now: () => start + 60 * 60_000, stopped: () => false,
      model: async (input: Input) => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: `The operator reported ${STALE}`, people: [], memory: [] })
        : JSON.stringify({ reply: `Noted: ${input.question}`, memory: [], dated: [] }),
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(6230414, note(1)), update(6230415, note(2))]);
    await worker.drain();
    expect(journal.view.order.filter(turn => turn.sent === undefined)).toEqual([]);
    // One refusal at a fresh frontier still holds its turn: a single failure is a wait, not a latch, because the
    // next attempt at the same frontier can still be accepted and release it.
    const frontier = journal.view.order.find(turn => turn.update === 6230415)!;
    journal.append({ kind: 'summary-reserve', through: 6230415, at: start });
    journal.append({ kind: 'summary-failed', through: 6230415, state: 'complete', failureClass: 'malformed',
      reason: REASON, at: start });
    journal.append({ kind: 'hold', id: frontier.id, reason: REASON, at: start });
    expect(summarySpanFailures(journal.view, 6230415)).toBe(1);
    expect(frontier.held).toBe(REASON);
    // The second refusal uses the frontier's last retry, so waiting for an accepted summary there is waiting for
    // something that can never happen; the turn is released to the ordinary answer path instead.
    journal.append({ kind: 'summary-reserve', through: 6230415, at: start });
    journal.append({ kind: 'summary-failed', through: 6230415, state: 'complete', failureClass: 'malformed',
      reason: REASON, at: start });
    expect(summarySpanFailures(journal.view, 6230415)).toBe(2);
    expect(frontier.held).toBeUndefined();
    expect(journal.view.heldTurns.has(frontier)).toBe(false);
    // The refused candidates are still refused: no summary was accepted, so none of them carries the stale clause.
    expect(journal.view.summaries).toEqual([]);
    journal.close();

    // The release is a projection of the durable rows, not a live-only effect.
    const replay = openPreviewJournal(path, key);
    expect(replay.view.order.find(turn => turn.update === 6230415)?.held).toBeUndefined();
    replay.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);

it('recovers a journal the live build already wedged, and replays the release from its own rows', async () => {
  const root = tmp('recover');
  try {
    let w = world(root);
    for (let n = 1; n <= 3; n++) { w.worker.intake([update(6230413 + n, note(n))]); await w.worker.drain(); }
    // The durable state the live build left on the proof room: the correction intaken, both recorded hold reasons
    // in the order status-wedged.json lists them, and later turns intaken behind it.
    w.worker.intake([update(6230417, note(4)), update(6230418, note(5)), update(6230419, note(6))]);
    const correction = w.journal.view.order.find(turn => turn.update === 6230417)!;
    w.journal.append({ kind: 'hold', id: correction.id, reason: 'memory correction pending', at: start });
    w.journal.append({ kind: 'hold', id: correction.id, reason: REASON, at: start });
    expect(correction.held).toBe(REASON);
    for (let again = 0; again < 6; again++) await w.worker.drain();
    expect(w.journal.view.order.filter(turn => turn.sent === undefined)).toEqual([]);
    const held = w.journal.view.order.map(turn => [turn.update, turn.held ?? null]);
    w.journal.close();

    // Replay only: no drain, no hand edit. The projection rebuilt from the durable rows releases the same turns.
    w = world(root, false);
    expect(w.journal.view.order.map(turn => [turn.update, turn.held ?? null])).toEqual(held);
    expect(w.journal.view.order.filter(turn => turn.held !== undefined && turn.sent === undefined)).toEqual([]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000);
