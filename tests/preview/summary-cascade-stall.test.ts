import { expect, it } from 'vitest';
import { selfStateBrief, selfStateSource } from './self-state.js';
import { SOURCE_PINS, sourcePacket } from './briefing.js';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, summaryStoppedAt, SUMMARY_FORMAT, SUMMARY_OVER_CAP_REASON, type CallOutcome, type JournalRecord } from './journal.js';
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
  // The answer side (an answer, a reply revision, the summary writer) discards text around one object; a gate does not.
  const extracted = parseModelJson(raw, { wrapped: 'accept' }), decision = extracted.ok ? extracted.value as { type?: unknown; floor?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  return value === null ? { state: 'complete' as const, failureClass: 'malformed' as const, usage } : { state: 'complete' as const, value, text: value, usage };
}

type Step = { kind: 'over-cap'; index: number } | { kind: 'complete'; output: Output };
function world(writer: Step[], forum = false) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-stall-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, forum ? { ...genesis, chat: '-1001234', forum: true } : genesis);
  const throughs: number[] = [], log: string[] = [];
  let clock = 0, calls = 0;
  const worker = createJournalWorker(journal, { now: () => START + clock, elapsed: () => clock, stopped: () => false,
    sources: () => [...sourcePacket(path => readFileSync(path, 'utf8'), SOURCE_PINS,
      { providerAttempts: genesis.maxCalls, expiresAt: genesis.expires }).sources,
      selfStateSource(selfStateBrief(journal.view, { launches: [], unreadable: 0 }, START + clock, 'UTC'))],
    model: async input => {
      // Replay the captured writers/uncertain outcomes through the trimmed briefing,
      // not just an empty fixture context. Both governed excerpts still reach the call.
      const sources = (JSON.parse(input.context) as { sources: { id: string; text: string }[] }).sources;
      expect(sources.map(source => source.id)).toEqual(['purpose:purpose', 'purpose:coherency', 'capability-note', 'self-state']);
      expect(sources.find(source => source.id === 'capability-note')!.text).toContain('I am an Instar 2.0 agent');
      expect(sources.at(-1)!.text).toContain('Activation: your activation; ends');
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
    intake: (id: number, text: string) => {
      const message = update(id, text);
      worker.intake([forum ? { ...message, message: { ...message.message, chat: { id: -1001234, type: 'supergroup', is_forum: true }, message_thread_id: 7 } } : message]);
    },
    /** The room's recorded rows in their journal order, then half an hour later (past the UNKNOWN recovery delay).
     * Its failures are stamped with the current summary format, as this build writes them: an older build's failures
     * would not spend this build's attempts (SUMMARY_FORMAT), and this file proves the selection under one format. */
    replayLiveRoom: () => {
      for (const original of fixture.rows) {
        // Recorded model outputs and decisions stay verbatim. Only the transport
        // envelope is mapped into the offline forum, never a live destination.
        let row = original;
        if (forum && row.kind === 'intake') {
          const raw = JSON.parse(row.raw);
          raw.message.chat = { id: -1001234, type: 'supergroup', is_forum: true };
          raw.message.message_thread_id = 7;
          row = { ...row, raw: JSON.stringify(raw), ...(row.accepted ? { thread: 7 } : {}) };
        }
        if (forum && 'chat' in row) row = { ...row, chat: '-1001234', thread: 7 } as typeof row;
        journal.append(row.kind === 'summary-failed' ? { ...row, format: SUMMARY_FORMAT } : row);
      }
      clock = fixture.rows.at(-1)!.at - START + 30 * 60_000;
    },
    closeJournal: () => { if (open) journal.close(); open = false; },
    close: () => { if (open) journal.close(); open = false; rmSync(root, { recursive: true, force: true }); } };
}

it.each([false, true])('the recorded stall (forum=%s): from base #484 a frontier is offered again and a summary is accepted', async forum => {
  // First the real over-cap result, then the real #484 writer output, which Jev's real 0.38 leaves undecided.
  const w = world([{ kind: 'over-cap', index: 0 }, { kind: 'complete', output: WRITER_484 }], forum);
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
    w.intake(715672501, 'What is my test marker?'); await w.worker.drain();
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

it('a one-turn span keeps its second attempt under the over-cap ceiling, and a spent ceiling stops the base', async () => {
  const w = world([]); // every writer call returns one of the room's recorded over-cap results
  try {
    w.replayLiveRoom();
    await w.worker.summarizeIfNeeded(true);
    // Before the fix: [] (nothing offered). Now each shorter span is tried once and the one-turn span twice.
    expect(w.throughs).toEqual([715672487, 715672486, 715672485, 715672485]);
    expect(w.journal.view.summaryReservations.size).toBe(0);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe(SUMMARY_OVER_CAP_REASON);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(715672484);
    // The spent one-turn span is contained in every later span from base #484, so nothing more is offered from it
    // (Rule 55; w3-summarybound). Releasing the ceiling here walked forward two calls per frontier for as long as turns
    // arrived (live 2026-10-02, Justin's preview: 77 calls from one base). Replies are answered by the history floor.
    expect(summaryStoppedAt(w.journal.view)).toBe(715672485);
    await w.worker.summarizeIfNeeded(true);
    expect(w.throughs).toHaveLength(4);
    // The other side of the budget: a span that used its two attempts is not offered again, and the journal refuses
    // a third reservation of it.
    expect(w.throughs.filter(through => through === 715672485)).toHaveLength(2);
    expect(() => w.journal.append({ kind: 'summary-reserve', through: 715672485, maxOutputTokens: 2048, at: START + 1e9 }))
      .toThrow('repeated summary reservation');
  } finally { w.close(); }
});
