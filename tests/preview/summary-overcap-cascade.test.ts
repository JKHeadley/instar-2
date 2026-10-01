import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, SUMMARY_OVER_CAP_REASON, type CallOutcome } from './journal.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { JEV_MODEL, parseJevResponse, REPLY_RULES } from './reply-check.js';

// Live proof room on cint-L9, 2026-09-30: no summary was ever accepted. Every summary-writer call after 03:03 ran
// past the 2048-token output cap (#483 2312, #487 3662, #491 2625, #493 4832). The provider called each result
// "uncertain", so it was kept as an UNKNOWN charge that floors every later span; with no summary accepted, each later
// span started at the beginning and only grew. Jev and the stronger review were never reached (summaryChecks all 0).
// Every writer output, physical outcome row and Jev verdict below is replayed verbatim from that journal.
type ModelUsage = { inputTokens: number | null; outputTokens: number | null; charge: null; inputComplete?: true };
type Recorded = { id: string; through: number; outcome: CallOutcome; modelCall: { outcome: string; usage: ModelUsage };
  raw: string | null; uncertainUsage?: ModelUsage };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-overcap-2026-09-30.json', import.meta.url), 'utf8')) as {
  turns: { update: number; text: string; answer: string }[]; writer: Recorded[];
  jevFaithfulness: { id: string; raw: string }[]; noResultFrame: { outcome: CallOutcome } };
const recorded = (id: string, localLimit: 'output-cap' | null, index = 0) =>
  fixture.writer.filter(item => item.id === id && item.outcome.localLimit === localLimit)[index]!;
// Complete writer outputs (both #482 outputs, and the #483 {"reply": …} envelope whose inner memoryDisposition is
// "unresolved") and the four over-cap results.
const WRITER_482 = recorded('summary:715672482', null), WRITER_482B = recorded('summary:715672482', null, 1);
const WRITER_483 = recorded('summary:715672483', null);
const OVER_CAP = ['summary:715672483', 'summary:715672487', 'summary:715672491', 'summary:715672493'].map(id => recorded(id, 'output-cap'));
// The three live Jev faithfulness replies: 0.22, 0.16 and 0.30, all in the undecided band.
const JEV = fixture.jevFaithfulness.map(item => item.raw);

const key = new Uint8Array(32).fill(43);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 262144, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const ANSWERS = new Map(fixture.turns.map(turn => [turn.update, turn.answer]));

/** Exactly what the live summary port hands the worker for a complete writer result (journal-agent invokeSubscription). */
function livePort(raw: string, usage: ModelUsage) {
  const extracted = parseModelJson(raw), decision = extracted.ok ? extracted.value as { type?: unknown; floor?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return value === null ? { state: 'complete' as const, failureClass: 'malformed' as const, usage } : { state: 'complete' as const, text: value, usage };
}

type Step = { kind: 'result'; recorded: Recorded } | { kind: 'no-outcome' } | { kind: 'no-result-frame' };
function world(writer: Step[], jev: string[], review: () => 'pass' | 'violation' = () => 'pass') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-overcap-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  const log: string[] = [], throughs: number[] = [], settled: number[] = [];
  const append = journal.append.bind(journal);
  journal.append = row => {
    if (row.kind === 'summary-failed' && row.reason === SUMMARY_OVER_CAP_REASON) settled.push(row.through);
    return append(row);
  };
  let clock = 0, calls = 0, jevCalls = 0;
  const worker = createJournalWorker(journal, { now: () => 1790700000000 + clock, elapsed: () => clock, stopped: () => false,
    model: async input => {
      if (!input.id.startsWith('summary:')) return ANSWERS.get(Number(input.id.split(':').at(-1))) ?? 'Noted.';
      log.push('summary'); throughs.push(Number(input.id.slice(8)));
      // After the scripted calls the writer keeps producing the largest recorded over-cap result.
      const step = writer[calls++] ?? { kind: 'result', recorded: OVER_CAP[3]! };
      // The live observed IO appends the physical outcome row before the adapter classifies the result.
      if (step.kind === 'no-result-frame') journal.append({ kind: 'call-outcome', id: input.id, role: 'summary', outcome: fixture.noResultFrame.outcome, at: 1790700000000 + clock });
      if (step.kind !== 'result') return { state: 'uncertain' as const };
      journal.append({ kind: 'call-outcome', id: input.id, role: 'summary', outcome: step.recorded.outcome, at: 1790700000000 + clock });
      return step.recorded.raw === null ? { state: 'uncertain' as const, usage: step.recorded.uncertainUsage! }
        : livePort(step.recorded.raw, step.recorded.modelCall.usage);
    },
    summaryCheck: async () => { log.push('jev-faithfulness'); return parseJevResponse(jev[jevCalls++ % jev.length]!); },
    replyCheck: {
      jev: async (_state, question) => {
        const integrity = question !== undefined && 'summary_integrity' in question;
        log.push(integrity ? 'jev-integrity' : 'jev-reply');
        return { value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(question ?? REPLY_RULES)
          .map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 1 };
      },
      // No summary review ever ran live (the gap this replay closes), so its verdict is the one stub here.
      summaryReview: async () => { log.push('review'); return { verdict: review(), reason: 'fixture review of the full packet', latencyMs: 1 }; },
      escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 1 }),
      elapsedMs: () => clock },
    send: async input => input.update, checkOutbound: () => {} });
  let open = true;
  return { path, journal, worker, log, throughs, settled, now: () => 1790700000000 + clock, tick: (ms: number) => { clock += ms; },
    closeJournal: () => { if (open) journal.close(); open = false; },
    close: () => { if (open) journal.close(); open = false; rmSync(root, { recursive: true, force: true }); } };
}

async function converse(w: ReturnType<typeof world>) {
  for (const turn of fixture.turns) { w.worker.intake([update(turn.update, turn.text)]); await w.worker.drain(); w.tick(60_000); }
}
const overCapSettled = (w: ReturnType<typeof world>) => w.settled;

it('settles a writer result proven over the output cap and accepts a shorter span through the cascade', async () => {
  // First call: the #483 retry's real over-cap result. Second: the real #482 writer output, which Jev (0.22) leaves undecided.
  const w = world([{ kind: 'result', recorded: OVER_CAP[0]! }, { kind: 'result', recorded: WRITER_482 }], JEV);
  try {
    await converse(w);
    await w.worker.summarizeIfNeeded(true);
    const [first] = w.journal.view.summaries;
    // Before: the over-cap result stayed UNKNOWN and nothing was accepted. Now it is a recorded failure,
    // the next span is shorter, and Jev's undecided verdict reaches the stronger review, which accepts it.
    expect(w.throughs.slice(0, 2)).toEqual([715672482, 715672481]);
    expect(first?.through).toBe(715672481);
    expect(first?.faithfulness).toEqual({ path: 'subscription', verdict: 'pass', score: null });
    expect(first?.text).toContain('probe-5f1ba73c');
    expect(w.log.filter(item => item !== 'jev-reply').slice(0, 4)).toEqual(['summary', 'summary', 'jev-faithfulness', 'review']);
    // Every later over-cap attempt is recorded with its reason and no reservation is left UNKNOWN. The spans below
    // the ceiling are walked downward (#485 to #482, the one-turn span, which keeps its second attempt because there
    // is no shorter one); then each span that still has an attempt takes it, asking for strictly less; and once no
    // over-cap span has budget left the ceiling is gone, so the next window (#489 down to #486) is offered. Before
    // this change the walk stopped at the spent one-turn span and no span was ever offered again.
    expect(w.journal.view.summaryReservations.size).toBe(0);
    expect(w.throughs.slice(2)).toEqual([715672485, 715672484, 715672483, 715672482, 715672482,
      715672483, 715672484, 715672485, 715672489, 715672488, 715672487, 715672486]);
    // No budget is widened: from this base every span still has at most its two attempts.
    expect([...new Set(w.journal.view.summarySpanFailures)]
      .every(through => w.journal.view.summarySpanFailures.filter(item => item === through).length <= 2)).toBe(true);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe(SUMMARY_OVER_CAP_REASON);
    // The room still answers.
    w.worker.intake([update(715672494, 'Remind me today at 2:55 pm to refill the bird feeder')]); await w.worker.drain();
    expect(w.journal.view.order.at(-1)?.sent).toBeDefined();
    // The settlement rows replay to the same view.
    w.closeJournal();
    const reopened = openPreviewJournal(w.path, key);
    expect(reopened.view.summaries.map(item => item.through)).toEqual([715672481]);
    expect(reopened.view.summaryReservations.size).toBe(0);
    expect(reopened.view.summaryOverCapFrontiers).toEqual([715672485, 715672484, 715672483, 715672482, 715672482,
      715672483, 715672484, 715672485, 715672489, 715672488, 715672487, 715672486]);
    reopened.close();
  } finally { w.close(); }
});

it('recovers the live journal state: four UNKNOWN over-cap reservations settle and a summary is accepted', async () => {
  // The #483 envelope output (malformed: refused before any judge), then the second #482 output, which the room's
  // last recorded Jev verdict (0.30) leaves undecided.
  const w = world([{ kind: 'result', recorded: WRITER_483 }, { kind: 'result', recorded: WRITER_482B }], [JEV[2]!, JEV[1]!]);
  try {
    const [early, late] = [fixture.turns.slice(0, 4), fixture.turns.slice(4)];
    for (const turn of early) { w.worker.intake([update(turn.update, turn.text)]); await w.worker.drain(); w.tick(60_000); }
    expect(w.throughs).toEqual([]);
    // The proof room's own summary rows, in its order: #482 refused twice as undecided and #483 once (before the
    // cascade existed), then the four attempts the provider called uncertain, each with its recorded outcome row.
    const reserve = (through: number) => w.journal.append({ kind: 'summary-reserve', through, supervised: true,
      maxInputTokens: 409600, maxOutputTokens: 2048, at: w.now() });
    for (const through of [715672482, 715672482, 715672483]) {
      reserve(through);
      w.journal.append({ kind: 'summary-failed', through, reason: 'summary faithfulness: undecided', state: 'complete', at: w.now() });
    }
    for (const item of OVER_CAP) {
      reserve(item.through);
      w.journal.append({ kind: 'call-outcome', id: item.id, role: 'summary', outcome: item.outcome, at: w.now() });
      w.journal.append({ kind: 'summary-uncertain', through: item.through, state: 'uncertain', usage: item.uncertainUsage!, at: w.now() });
    }
    expect([...w.journal.view.summaryReservations.keys()]).toEqual([715672483, 715672487, 715672491, 715672493]);
    expect(w.journal.view.summaryOverCap.map(item => item.through)).toEqual([715672483, 715672487, 715672491, 715672493]);
    // Each carries the provider's reported usage, so settling meters it instead of leaving it unknown.
    expect(w.journal.view.summaryOverCap.map(item => item.usage?.outputTokens)).toEqual([2312, 3662, 2625, 4832]);

    for (const turn of late) { w.worker.intake([update(turn.update, turn.text)]); await w.worker.drain(); w.tick(60_000); }
    await w.worker.summarizeIfNeeded(true);
    // Each proven over-cap attempt is settled with its reason. #482 and #483 are spent, and #483 -- spent -- no longer
    // sets the ceiling: the lowest over-cap span with an attempt left is #487, so the largest untried prefix below it
    // (#484) is offered. Before this change the dead #483 held the ceiling and the span could only end at #481.
    // The envelope is refused as malformed without a judge; the retry's summary is left undecided by Jev (0.30)
    // and reaches the stronger review, which accepts it.
    expect(overCapSettled(w).slice(0, 4)).toEqual([715672483, 715672487, 715672491, 715672493]);
    expect(w.throughs.slice(0, 2)).toEqual([715672484, 715672484]);
    expect(w.journal.view.summaries[0]?.through).toBe(715672484);
    expect(w.journal.view.summaries[0]?.faithfulness).toEqual({ path: 'subscription', verdict: 'pass', score: null });
    expect(w.log.filter(item => item !== 'jev-reply').slice(0, 4)).toEqual(['summary', 'summary', 'jev-faithfulness', 'review']);
    expect(w.journal.view.summaryReservations.size).toBe(0);
    for (const through of [715672487, 715672491, 715672493]) expect(w.journal.view.tokenCurrent.has(`summary:${String(through)}`)).toBe(false);
    expect(w.journal.view.order.filter(turn => turn.accepted && turn.sent === undefined)).toEqual([]);
  } finally { w.close(); }
});

it('keeps an UNKNOWN that has no proof: no outcome row, or the recorded no-result-frame outcome', async () => {
  for (const step of [{ kind: 'no-outcome' as const }, { kind: 'no-result-frame' as const }]) {
    const w = world([step], JEV);
    try {
      await converse(w);
      await w.worker.summarizeIfNeeded(true);
      // Its reservation is kept (charge UNKNOWN), it is never settled or re-dispatched, and no later span reaches back.
      expect(w.throughs[0]).toBe(715672482);
      expect(w.journal.view.summaryReservations.has(715672482)).toBe(true);
      expect(overCapSettled(w)).not.toContain(715672482);
      expect(w.throughs.slice(1).every(through => through > 715672482)).toBe(true);
      expect(w.journal.view.summaries.every(summary => summary.through > 715672482)).toBe(true);
    } finally { w.close(); }
  }
});

it('refuses an over-cap settlement that has no outcome row behind it, and a stronger-model violation still refuses', async () => {
  const w = world([{ kind: 'result', recorded: WRITER_482 }], JEV, () => 'violation');
  try {
    await converse(w);
    // #479, the one-turn span, used both its attempts during the conversation; #480 has one left.
    w.journal.append({ kind: 'summary-reserve', through: 715672480, maxOutputTokens: 2048, at: w.now() });
    expect(() => w.journal.append({ kind: 'summary-failed', through: 715672480, state: 'rejected', failureClass: 'rejected',
      reason: SUMMARY_OVER_CAP_REASON, at: w.now() })).toThrow('over-cap summary without its outcome');
    w.journal.append({ kind: 'summary-failed', through: 715672480, reason: 'summary faithfulness: undecided', state: 'complete', at: w.now() });
    await w.worker.summarizeIfNeeded(true);
    expect(w.log.filter(item => item !== 'jev-reply').slice(0, 3)).toEqual(['summary', 'jev-faithfulness', 'review']);
    expect(w.journal.view.summaries).toHaveLength(0);
    expect(w.journal.view.summaryCheckCounts.violation).toBeGreaterThan(0);
  } finally { w.close(); }
});
