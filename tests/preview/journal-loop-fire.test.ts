// Plan row #422 (live D run 2026-10-03, room two, 15-minute root): the open loop's scheduled step DID start on
// its revisit with no inbound, twice per commitment, and every attempt settled `uncertain`, so no result ever waited
// for the operator's next message. The model answered each time (11-12 s); what failed was the launcher's durable
// call-outcome row, which the journal refused for an `obligation:` id (and for `summary:index:N`). The row is
// appended inside the physical IO (call-diagnostics.mjs `observedSubscriptionIO`), so the refusal threw out of the
// command and the subscription doorway's catch turned a completed call into UNKNOWN. These tests drive every model
// call through that same seam, with the ids and outcome shape the live journal recorded.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, dueObligationWork, obligationSchedule, openPreviewJournal } from './journal-test-worker.js';
import { loopHealth } from './obligations.js';
// @ts-expect-error The physical IO seam is a JS host module.
import { observedSubscriptionIO } from './call-diagnostics.mjs';

const key = new Uint8Array(32).fill(71);
const T0 = 1791059512000, MINUTE = 60_000, REVISIT = 15 * MINUTE;
/** The live D1 message (update 6231951), verbatim. */
const D1 = 'Please do not answer this one now. Keep it as an open item: think over which three of the things I have told you matter most for planning my week, and give me that answer in a later message, not in this reply. For now just confirm you have it as an open item.';
const HOLD = 'Got it — holding this as an open item. I won\'t answer it now; in a later message I\'ll give you the three things from what you\'ve told me that matter most for planning your week.';
const RESULT = 'The three that matter most for your week: the Thursday dentist visit, the invoice due Friday, and your sister\'s visit.';
const POLICY = { args: ['--print', '--output-format', 'json'], maxTokens: 2048, maxOutputBytes: 16384 };
/** The live journal's successful result frame shape (call-outcome rows of 2026-10-03 20:30-20:59). */
const frame = (text: string) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text,
  session_id: 'session-1', usage: { input_tokens: 17000, output_tokens: 600 } });

function world(root: string, first = JSON.stringify({ reply: HOLD, memory: [], openLoops: [{ kind: 'deferral', quote: HOLD, waitsOn: 'nothing' }] })) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8989505249', chat: '7812716706',
    operator: '7812716706', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 1000, maxReplies: 1000, maxTurns: 1000, maxBytes: 409600, cursor: 0, loopRevisitMs: REVISIT });
  const clock = { now: T0 }, sent: string[] = [], launched: string[] = [];
  let answers = 0;
  /** The launcher's model port: one physical command per call, observed exactly as journal-agent.mjs observes it, and
   * any throw out of the command mapped to UNKNOWN as the subscription doorway's catch maps it. */
  const physical = async (id: string, text: string) => {
    const io = observedSubscriptionIO({ execute: async () => ({ code: 0, limited: false, localLimit: null, stdout: frame(text) }) },
      POLICY, id, (row: never) => journal.append(row), { elapsed: () => 11_559, at: () => clock.now });
    try { await io.execute({ args: POLICY.args, stdin: `prompt for ${id}`, timeout: 120_000 }); launched.push(id); return text; }
    catch { return { state: 'uncertain' as const }; }
  };
  const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    prepareModel: input => input.context,
    model: async input => {
      if (input.id.startsWith('obligation:')) return physical(input.id, JSON.stringify({ outcome: 'report', report: RESULT }));
      if (input.id.startsWith('summary:')) return physical(input.id, JSON.stringify({ summary: 'Earlier turns.', people: [], commitments: [], closed: [], memory: [] }) /* no memory change: settles the ask's preference cue, as the live summary did */);
      // The first answer is the live deferral; every later one is the live reply to "hi".
      return physical(input.id, answers++ === 0 ? first
        : JSON.stringify({ reply: 'Hi! What can I help you with?', memory: [] }));
    },
    send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
  let update = 6231951;
  const say = async (text: string) => {
    worker.intake([{ update_id: update++, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text,
      date: Math.floor(clock.now / 1000) } }]);
    await worker.drain();
  };
  return { journal, worker, clock, say, sent, launched };
}

it('works a deferred loop on its revisit with no inbound, holds the result for the next message, and says so', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-loop-fire-')));
  try {
    const w = world(root);
    await w.say(D1);
    // D1a: the reply deferred and an agent-owned loop that waits on nothing is recorded.
    expect(w.sent.at(-1)).toContain('holding this as an open item');
    const id = w.journal.view.commitments.findIndex(note => note.quote === HOLD);
    expect(w.journal.view.commitments[id]).toMatchObject({ owner: 'agent', waitsOn: 'nothing' });
    const source = w.journal.view.turns.get(w.journal.view.commitments[id]!.source)!;
    const sends = w.sent.length;
    // The live quiet window: revisit plus ten minutes with no inbound. The tick consumes the due step.
    w.clock.now = source.at + REVISIT + 10 * MINUTE;
    expect(dueObligationWork(w.journal.view, w.clock.now).map(item => item.key)).toContain(`commitment:${String(id)}`);
    for (let i = 0; i < 4 && await w.worker.workObligations(); i++) { /* one bounded step per tick */ }
    // D1b: the step's model call completed, and its call-outcome row (the live refusal) is durable beside it.
    const work = w.journal.view.obligationWork[`commitment:${String(id)}`]!;
    expect(work.outcome).toBe('report');
    expect(w.launched.some(launch => launch.startsWith(`obligation:commitment:${String(id)}:`))).toBe(true);
    expect(w.journal.view.callOutcomes.some(row => row.id.startsWith(`obligation:commitment:${String(id)}:`))).toBe(true);
    const health = loopHealth(w.journal.view, w.clock.now);
    expect(health.awaitingDelivery).toBeGreaterThanOrEqual(1);
    // D2: no unsolicited send, and status says why the result waits.
    expect(w.sent.length).toBe(sends);
    expect(health.deliveryInhibition).toMatch(/^no grant for unsolicited sends; \d+ finished results? waits? for your next message$/u);
    expect(obligationSchedule(w.journal.view).find(item => item.key === `commitment:${String(id)}`)).toMatchObject({ awaitingDelivery: true });
    // D1c: the operator's next message carries the result, and nothing waits after its receipt.
    w.clock.now += MINUTE;
    await w.say('hi');
    expect(w.sent.at(-1)).toContain(`Follow-up on "`);
    expect(w.sent.at(-1)).toContain(RESULT);
    expect(loopHealth(w.journal.view, w.clock.now).awaitingDelivery).toBe(0);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('admits a background call-outcome row only for the launch it belongs to', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-loop-fire-rows-')));
  try {
    const w = world(root), { journal } = w;
    const outcome = { exitCode: 0, localLimit: null, elapsedMs: 11559, type: 'result', subtype: 'success', isError: false,
      outputTokens: 600, promptBytes: 40000 };
    const row = (id: string, role: string) => ({ kind: 'call-outcome', id, role, outcome, at: w.clock.now }) as never;
    // No step started and no index pass reserved: the exact live ids are refused, as before.
    expect(() => journal.append(row('obligation:commitment:1:1791060412961', 'model'))).toThrow('call outcome malformed');
    expect(() => journal.append(row('summary:index:4', 'summary'))).toThrow('call outcome malformed');
    await w.say(D1);
    const id = journal.view.commitments.findIndex(note => note.quote === HOLD);
    const slot = obligationSchedule(journal.view).find(item => item.key === `commitment:${String(id)}`)!.slot;
    w.clock.now = slot + MINUTE;
    journal.append({ kind: 'obligation-start', obligation: `commitment:${String(id)}`, slot, maxInputTokens: 409600,
      maxOutputTokens: 2048, at: w.clock.now });
    // Started at this slot: only that slot, only as a model call, and only a canonical id.
    expect(() => journal.append(row(`obligation:commitment:${String(id)}:${String(slot + 1)}`, 'model'))).toThrow('call outcome malformed');
    expect(() => journal.append(row(`obligation:commitment:${String(id)}:${String(slot)}`, 'summary'))).toThrow('call outcome malformed');
    expect(() => journal.append(row(`obligation:commitment:0${String(id)}:${String(slot)}`, 'model'))).toThrow('call outcome malformed');
    expect(() => journal.append(row(`obligation:blocker:${String(id)}:${String(slot)}`, 'model'))).toThrow('call outcome malformed');
    journal.append(row(`obligation:commitment:${String(id)}:${String(slot)}`, 'model'));
    // An index pass: its open reservation only.
    const n = journal.view.indexOffered.length;
    journal.append({ kind: 'index-reserve', sources: [journal.view.order[0]!.id], maxInputTokens: 409600, maxOutputTokens: 2048,
      at: w.clock.now } as never);
    expect(() => journal.append(row(`summary:index:${String(n + 1)}`, 'summary'))).toThrow('call outcome malformed');
    expect(() => journal.append(row(`summary:index:${String(n)}`, 'model'))).toThrow('call outcome malformed');
    journal.append(row(`summary:index:${String(n)}`, 'summary'));
    expect(journal.view.callOutcomes.map(item => item.id).slice(-2))
      .toEqual([`obligation:commitment:${String(id)}:${String(slot)}`, `summary:index:${String(n)}`]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

// Plan row #461 (cint-L44 live D run 2026-10-03 21:50, room two, 15-minute root proofroom2-dshort15-20261003-214951):
// the answer to update 6232039 declared its one deferral sentence BOTH as a promise and as a loop that waits on
// nothing (journal rows 286 and 295, recorded verbatim below). The promise note was written first, and the loop was
// then skipped as a duplicate of that same sentence, so the only reply commitment carried the promise's
// `next-relevant-reply` wait, which schedules no work: nothing ran in the quiet window. On w3-loopfire's passing run
// (room two, 15:20 root) the answer declared the loop alone, so its commitment waited on nothing and was worked.
const L44_REPLY = 'Got it, Luna — I\'m holding this as an open item and won\'t answer it in this reply. I\'ll think over which three of the things you\'ve told me matter most for planning your week, and I\'ll bring you that ranked answer in a later message.';
const L44_SENTENCE = 'I\'ll bring you that ranked answer in a later message.';
const L44_ANSWER = JSON.stringify({ reply: L44_REPLY, memory: [], promises: [{ quote: L44_SENTENCE }],
  openLoops: [{ kind: 'promise', quote: L44_SENTENCE, waitsOn: 'nothing' }] });

it('works a loop the answer also declared as a promise, and an inbound never postpones the due step', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-loop-fire-l44-')));
  try {
    const w = world(root, L44_ANSWER);
    await w.say(D1);
    expect(w.sent.at(-1)).toContain('holding this as an open item');
    // One commitment for the sentence, not two: the promise note now carries the loop's declared wait.
    const notes = w.journal.view.commitments.filter(note => note.quote === L44_SENTENCE);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ in: 'reply', owner: 'agent', waitsOn: 'nothing', loop: 'promise',
      agentPromise: { owner: 'agent', waitsOn: 'next-relevant-reply' } });
    const id = w.journal.view.commitments.indexOf(notes[0]!), key = `commitment:${String(id)}`;
    const source = w.journal.view.turns.get(notes[0]!.source)!;
    // Due one revisit after the source; with no inbound the step is due in the quiet window.
    const slot = obligationSchedule(w.journal.view).find(item => item.key === key)!.slot;
    expect(slot).toBe(source.at + REVISIT);
    w.clock.now = slot + 10 * MINUTE;
    expect(dueObligationWork(w.journal.view, w.clock.now).map(item => item.key)).toContain(key);
    // An operator message arriving while the step is due leaves it due at the same slot (the live "hi").
    w.worker.intake([{ update_id: 6232040, message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 },
      text: 'hi', date: Math.floor(w.clock.now / 1000) } }]);
    expect(obligationSchedule(w.journal.view).find(item => item.key === key)!.slot).toBe(slot);
    expect(dueObligationWork(w.journal.view, w.clock.now).map(item => item.key)).toContain(key);
    await w.worker.drain();
    for (let i = 0; i < 4 && await w.worker.workObligations(); i++) { /* one bounded step per tick */ }
    expect(w.journal.view.obligationWork[key]!.outcome).toBe('report');
    expect(w.launched.some(launch => launch.startsWith(`obligation:${key}:`))).toBe(true);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('keeps a promise with no declared loop on its next-relevant-reply wait, scheduling no work', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-loop-fire-l44-promise-')));
  try {
    const w = world(root, JSON.stringify({ reply: L44_REPLY, memory: [], promises: [{ quote: L44_SENTENCE }] }));
    await w.say(D1);
    const notes = w.journal.view.commitments.filter(note => note.quote === L44_SENTENCE);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.waitsOn).toBeUndefined();
    const key = `commitment:${String(w.journal.view.commitments.indexOf(notes[0]!))}`;
    expect(obligationSchedule(w.journal.view).some(item => item.key === key)).toBe(false);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('keeps a dated promise on its own date when the answer also declared it as a loop', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-loop-fire-l44-dated-')));
  try {
    const sentence = 'I\'ll bring you that ranked answer on Friday.';
    const w = world(root, JSON.stringify({ reply: `Got it, holding this open. ${sentence}`, memory: [],
      promises: [{ quote: sentence, when: 'on Friday' }], openLoops: [{ kind: 'promise', quote: sentence, waitsOn: 'nothing' }] }));
    await w.say(D1);
    const notes = w.journal.view.commitments.filter(note => note.quote === sentence);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.agentPromise?.due).toBeDefined();
    expect(notes[0]!.waitsOn).toBeUndefined();
    const source = w.journal.view.turns.get(notes[0]!.source)!;
    const item = obligationSchedule(w.journal.view).find(entry => entry.key === `commitment:${String(w.journal.view.commitments.indexOf(notes[0]!))}`);
    expect(item?.slot).not.toBe(source.at + REVISIT);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);
