import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, SUMMARY_OVER_CAP_REASON, type CallOutcome, type JournalRecord } from './journal.js';
import { decisionWithinFloor } from './model-call-boundary.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { JEV_MODEL, parseJevResponse, REPLY_RULES } from './reply-check.js';
import { interpretSummaryReview } from './summary-check.js';

// Live proof room, 2026-09-30. On cint-L11 the cascade settled the over-cap attempts and accepted summaries through
// #480, #481 and #484 (14:20-14:25 PDT). From base #484 it then tried #491, #490, #489, #488, all over the output
// cap, and stopped. #485-#487 each still carried two failures from base #481 (and one from base #480), and #488 was
// the over-cap ceiling, so no frontier was left to offer. The summary never advanced again and every later turn
// was held "the conversation is too large". The runner that took over at 14:29 (cint-L9) left #492, #496 and
// #497 UNKNOWN (output-cap 3261, 8192, 4048). Every row of updates #479-#500 and every summary row is replayed from
// that journal in its order (the fixture's source names the only fields left out), and so are the writer outputs,
// Jev verdicts and stronger-review outputs.
type ModelUsage = { inputTokens: number | null; outputTokens: number | null; charge: null; inputComplete?: true };
type Output = { id: string; raw: string; usage: ModelUsage };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-cascade-stall-2026-09-30.json', import.meta.url), 'utf8')) as {
  genesis: { bot: string; chat: string; operator: string; grant: string; configurationDigest: string;
    maxCalls: number; maxReplies: number; maxTurns: number; maxBytes: number };
  rows: (JournalRecord & { at: number })[];
  writer: Output[]; review: Output[]; jevFaithfulness: Output[] };
const outcomeOf = (id: string) => (fixture.rows.filter(row => row.kind === 'call-outcome' && row.id === id).at(-1) as { outcome: CallOutcome }).outcome;
const uncertainUsageOf = (through: number) =>
  (fixture.rows.filter(row => row.kind === 'summary-uncertain' && row.through === through).at(-1) as { usage: ModelUsage }).usage;
// The last three live writer results, each over the 2048-token cap.
const OVER_CAP = [715672492, 715672496, 715672497].map(through => ({ outcome: outcomeOf(`summary:${String(through)}`), usage: uncertainUsageOf(through) }));
const WRITER_484 = fixture.writer.find(item => item.id === 'summary:715672484')!;
const JEV_038 = fixture.jevFaithfulness.at(-1)!.raw; // 0.38: undecided, so the stronger review decides.
const REVIEW_484 = fixture.review.find(item => item.id === 'summary:715672484:review')!;

const key = new Uint8Array(32).fill(47);
const START = 1790700000000;
const genesis = { kind: 'genesis' as const, ...fixture.genesis, expires: 9999999999999, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: Number(fixture.genesis.chat), type: 'private' }, from: { id: Number(fixture.genesis.operator) }, text } });

/** What the live subscription port hands the worker for a complete result (journal-agent invokeSubscription). */
function livePort(raw: string, usage: ModelUsage) {
  const extracted = parseModelJson(raw), decision = extracted.ok ? extracted.value as { type?: unknown; floor?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return value === null ? { state: 'complete' as const, failureClass: 'malformed' as const, usage } : { state: 'complete' as const, value, text: value, usage };
}

type Step = { kind: 'over-cap'; index: number } | { kind: 'complete'; output: Output };
function world(writer: Step[]) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-stall-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis);
  const throughs: number[] = [], log: string[] = [];
  let clock = 0, calls = 0;
  const worker = createJournalWorker(journal, { now: () => START + clock, elapsed: () => clock, stopped: () => false,
    model: async input => {
      if (!input.id.startsWith('summary:')) return 'Noted.';
      throughs.push(Number(input.id.slice(8))); log.push('summary');
      // After the scripted steps the writer keeps returning the live room's recorded over-cap results.
      const step = writer[calls] ?? { kind: 'over-cap', index: calls % OVER_CAP.length }; calls++;
      if (step.kind === 'complete') {
        journal.append({ kind: 'call-outcome', id: input.id, role: 'summary', outcome: outcomeOf('summary:715672484'), at: START + clock });
        return livePort(step.output.raw, step.output.usage);
      }
      // The live observed IO appends the physical outcome row before the adapter classifies the result.
      journal.append({ kind: 'call-outcome', id: input.id, role: 'summary', outcome: OVER_CAP[step.index]!.outcome, at: START + clock });
      return { state: 'uncertain' as const, usage: OVER_CAP[step.index]!.usage };
    },
    summaryCheck: async () => { log.push('jev-faithfulness'); return parseJevResponse(JEV_038); },
    replyCheck: {
      jev: async (_state, question) => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(question ?? REPLY_RULES)
        .map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 1 }),
      // The room's own recorded stronger-review output, through the live port and interpreter.
      summaryReview: async () => {
        log.push('review');
        const result = interpretSummaryReview(livePort(REVIEW_484.raw, REVIEW_484.usage), 1);
        if (result.verdict === 'unsure') throw Error('a subscription review never answers unsure');
        return { ...result, verdict: result.verdict };
      },
      escalate: async () => ({ verdict: 'pass', ruleIds: [], confidence: 1, latencyMs: 1 }),
      elapsedMs: () => clock },
    send: async input => input.update, checkOutbound: () => {} });
  let open = true;
  return { path, journal, worker, throughs, log,
    /** The room's recorded rows in their journal order, then half an hour later (past the UNKNOWN recovery delay). */
    replayLiveRoom: () => {
      for (const row of fixture.rows) journal.append(row);
      clock = fixture.rows.at(-1)!.at - START + 30 * 60_000;
    },
    closeJournal: () => { if (open) journal.close(); open = false; },
    close: () => { if (open) journal.close(); open = false; rmSync(root, { recursive: true, force: true }); } };
}

it('the recorded stall: from base #484 a frontier is offered again and a summary is accepted', async () => {
  // First the real over-cap result, then the real #484 writer output, which Jev's real 0.38 leaves undecided.
  const w = world([{ kind: 'over-cap', index: 0 }, { kind: 'complete', output: WRITER_484 }]);
  try {
    w.replayLiveRoom();
    const view = w.journal.view;
    expect(view.summaries.map(item => item.through)).toEqual([715672480, 715672481, 715672484]);
    expect([...view.summaryReservations.keys()]).toEqual([715672492, 715672496, 715672497]);
    // Two failures each at #485-#487, recorded while the base was #480 and #481.
    for (const through of [715672485, 715672486, 715672487]) expect(view.summaryFailures.get(through)).toBe(2);

    await w.worker.summarizeIfNeeded(true);
    // Before the fix no writer call was made here (throughs []): nothing was offered.
    // The three UNKNOWN attempts are settled from their outcome rows; the span from #484 is tried below the
    // #488 ceiling, the real over-cap result shortens it, and the next one passes the cascade.
    expect(w.throughs.slice(0, 2)).toEqual([715672487, 715672486]);
    expect(w.log.slice(0, 4)).toEqual(['summary', 'summary', 'jev-faithfulness', 'review']);
    expect(view.summaries.find(item => item.through === 715672486)?.faithfulness).toEqual({ path: 'subscription', verdict: 'pass', score: null });
    expect(view.summaryReservations.size).toBe(0);
    for (const through of [715672492, 715672496, 715672497]) expect(view.tokenCurrent.has(`summary:${String(through)}`)).toBe(false);
    // The room still answers.
    w.worker.intake([update(715672501, 'What is my test marker?')]); await w.worker.drain();
    expect(view.order.at(-1)?.sent).toBeDefined();
    // The rows replay to the same summary state.
    const summaries = view.summaries.map(item => item.through), failures = [...view.summarySpanFailures];
    w.closeJournal();
    const reopened = openPreviewJournal(w.path, key);
    expect(reopened.view.summaries.map(item => item.through)).toEqual(summaries);
    expect(reopened.view.summarySpanFailures).toEqual(failures);
    reopened.close();
  } finally { w.close(); }
});

it('a one-turn span keeps its second attempt under the over-cap ceiling, and a spent ceiling stops nothing', async () => {
  const w = world([]); // every writer call returns one of the room's recorded over-cap results
  try {
    w.replayLiveRoom();
    await w.worker.summarizeIfNeeded(true);
    // Before the fix: [] (nothing offered). Now each shorter span is tried once and the one-turn span twice.
    expect(w.throughs).toEqual([715672487, 715672486, 715672485, 715672485]);
    expect(w.journal.view.summaryReservations.size).toBe(0);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe(SUMMARY_OVER_CAP_REASON);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(715672484);
    // The spent one-turn span no longer ends every later summary (live 2026-09-30/10-01 proof room, where that state
    // at #715672791 stopped the frontier for 210 updates). The next pass gives each span that still has an attempt
    // its remaining one, shortest first (#486, #487), then the next ones up (#488, #489).
    await w.worker.summarizeIfNeeded(true);
    expect(w.throughs.slice(4)).toEqual([715672486, 715672487, 715672488, 715672489]);
    // The other side of the budget: a span that used its two attempts is not offered again, and the journal refuses
    // a third reservation of it.
    expect(w.throughs.filter(through => through === 715672485)).toHaveLength(2);
    expect(() => w.journal.append({ kind: 'summary-reserve', through: 715672485, maxOutputTokens: 2048, at: START + 1e9 }))
      .toThrow('repeated summary reservation');
  } finally { w.close(); }
});
