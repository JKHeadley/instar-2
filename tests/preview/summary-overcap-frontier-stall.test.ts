import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, reachedJournalCap, SUMMARY_OVER_CAP_REASON,
  type CallOutcome } from './journal.js';
import { auditPacket } from './journal-audit.mjs';

// Live proof room, 2026-09-30/10-01 (group A's long-chat run, 23:16-01:16 PDT, builds cint-L15 then cint-L16).
// `summaryThrough` stuck at #715672790 with `lastSummaryFailure` {through: 715672791, reason: "summary output over
// the cap"}: the span was already the shortest one (a single turn, the very next update), it used both its attempts,
// and it was also the over-cap ceiling. Every later frontier was above the ceiling and the only turn allowed past it
// was the oldest pending one -- that same exhausted span -- so nothing could be offered and no summary committed
// across the next 210 updates. The context grew until the packet reached 398189 of 409600 bytes, update #715673001
// came back held "the conversation is too large to process right now", and the room answered nothing after that.
//
// Replayed here from real recorded shapes: the four physical `call-outcome` rows the proof room's own observed IO
// wrote for its over-cap writer calls (output-cap at 2312, 3662, 2625 and 4832 output tokens against the 2048-token
// reservation), with the provider's recorded `uncertain` results and their reported usage.
type ModelUsage = { inputTokens: number | null; outputTokens: number | null; charge: null; inputComplete?: true };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/proofroom-summary-overcap-2026-09-30.json', import.meta.url), 'utf8')) as {
  turns: { update: number; text: string; answer: string }[];
  writer: { id: string; outcome: CallOutcome; uncertainUsage?: ModelUsage }[] };
/** A real recorded operator turn carrying a durable fact, used to prove a set-aside turn is still reachable. */
const MARKER_TURN = fixture.turns.find(item => item.text.includes('probe-5f1ba73c'))!;
const OVER_CAP = fixture.writer.filter(item => item.outcome.localLimit === 'output-cap')
  .map(item => ({ outcome: item.outcome, usage: item.uncertainUsage! }));

const key = new Uint8Array(32).fill(29);
const START = 1790000000000;
const genesis = (maxBytes: number) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 300, maxBytes, cursor: 0 });
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 } , text } });
const filler = (id: number) => `Filler note ${String(id)}: ${'the garden shed holds rakes, twine and seed trays. '.repeat(12)}`;

/** `overCap(through)` decides, per span, whether the writer runs past the output cap on that attempt. */
function world(overCap: (through: number, attempt: number) => boolean, maxBytes = 9000) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-overcap-stall-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis(maxBytes));
  const throughs: number[] = [], attempts = new Map<number, number>();
  /** Every answer-call packet, so the floor's own disclosure and what recall still reached can be read back. */
  const answers: { id: string; packet: Record<string, unknown> }[] = [];
  let clock = 0;
  const worker = createJournalWorker(journal, { now: () => START + clock, elapsed: () => clock, stopped: () => false,
    // The real envelope adds framing: a packet that fits can still overflow once prepared (live: "prompt overflow").
    prepareModel: input => { if (Buffer.byteLength(input.context) > maxBytes * 0.8) throw Error('preview: envelope over its byte bound');
      return JSON.stringify(input); },
    model: async input => {
      if (!input.id.startsWith('summary:')) {
        answers.push({ id: input.id, packet: JSON.parse(input.context) as Record<string, unknown> });
        return 'Noted.';
      }
      const through = Number(input.id.slice(8));
      const attempt = (attempts.get(through) ?? 0) + 1; attempts.set(through, attempt); throughs.push(through);
      if (!overCap(through, attempt))
        return JSON.stringify({ summary: `Earlier the operator kept filler notes about a garden shed (through ${String(through)}).`, people: [] });
      // The live observed IO appends the physical outcome row before the adapter classifies the result.
      const recorded = OVER_CAP[(attempt - 1) % OVER_CAP.length]!;
      journal.append({ kind: 'call-outcome', id: input.id, role: 'summary', outcome: recorded.outcome, at: START + clock });
      return { state: 'uncertain' as const, usage: recorded.usage };
    },
    summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
    send: async () => 1, checkOutbound: () => {} });
  let open = true;
  return { path, journal, worker, throughs, answers, update, now: () => START + clock,
    drain: async () => { await worker.drain(); clock += 60_000; },
    frontier: () => journal.view.summaries.at(-1)?.through ?? null,
    heldForSummary: () => journal.view.order.filter(turn => turn.held?.startsWith('summary unavailable:')
      || turn.held === 'prompt overflow' || turn.held === 'context overflow'),
    fill: async (from: number, to: number) => {
      for (let id = from; id <= to; id++) { worker.intake([update(id, filler(id))]); await worker.drain(); clock += 60_000; }
    },
    /** Fill one turn at a time until a summary is accepted and the very next turn is answered too: the live shape,
     * where the span one turn past the frontier is the shortest one the selection can offer. Returns the next id. */
    fillUntilFrontierHasNextTurn: async (from: number, limit: number) => {
      for (let id = from; id <= limit; id++) {
        worker.intake([update(id, filler(id))]); await worker.drain(); clock += 60_000;
        const frontier = journal.view.summaries.at(-1)?.through;
        if (frontier !== undefined && journal.view.order.some(turn => turn.update === frontier + 1 && turn.sent !== undefined))
          return id + 1;
      }
      throw Error('fixture never reached a frontier with an answered turn above it');
    },
    closeJournal: () => { if (open) journal.close(); open = false; },
    close: () => { if (open) journal.close(); open = false; rmSync(root, { recursive: true, force: true }); } };
}

it('the recorded stall: a one-turn span past the output cap twice does not stop every later summary', async () => {
  // The writer here always answers; the wedge is planted as rows, exactly as the live journal holds it.
  const w = world(() => false, 30000);
  try {
    const next = await w.fillUntilFrontierHasNextTurn(1, 60);
    const settled = w.frontier();
    expect(settled).not.toBeNull();
    // The live wedge, row for row: the span one turn past the settled frontier -- the shortest span there is -- used
    // both of its attempts, each proven past the output cap by its own physical outcome row.
    const spanEnd = settled! + 1;
    for (const recorded of OVER_CAP.slice(0, 2)) {
      w.journal.append({ kind: 'summary-reserve', through: spanEnd, maxInputTokens: 30000, maxOutputTokens: 2048, at: w.now() });
      w.journal.append({ kind: 'call-outcome', id: `summary:${String(spanEnd)}`, role: 'summary', outcome: recorded.outcome, at: w.now() });
      w.journal.append({ kind: 'summary-uncertain', through: spanEnd, state: 'uncertain', usage: recorded.usage, at: w.now() });
      w.journal.append({ kind: 'summary-failed', through: spanEnd, state: 'rejected', failureClass: 'rejected',
        reason: SUMMARY_OVER_CAP_REASON, usage: recorded.usage, at: w.now() });
    }
    expect(w.journal.view.summaryFailures.get(spanEnd)).toBe(2);
    expect(w.journal.view.lastSummaryFailure?.through).toBe(spanEnd);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe(SUMMARY_OVER_CAP_REASON);
    expect(w.journal.view.summaryOverCapFrontiers).toContain(spanEnd);
    expect(w.frontier()).toBe(settled);

    // Before the fix this pass offered nothing: every later frontier sat above the over-cap ceiling and the one turn
    // allowed past it was the oldest pending span -- this same exhausted one. The frontier never moved again.
    const spent = w.throughs.length;
    await w.fill(next, next + 35);
    expect(w.throughs.length).toBeGreaterThan(spent);
    // A LATER span carries the spent one: a span is (previous, through], so those turns are covered, never skipped.
    expect(w.frontier()!).toBeGreaterThan(spanEnd);
    expect(w.journal.view.summaries.some(summary => summary.through === spanEnd)).toBe(false);
    // ... and the room keeps answering as the conversation grows: no reply held for want of a summary, nothing latched.
    expect(w.heldForSummary()).toEqual([]);
    expect(w.journal.view.order.filter(turn => turn.accepted && turn.sent === undefined)).toEqual([]);
    expect(reachedJournalCap(w.journal.view)).toBeNull();
    expect(w.frontier()!).toBeGreaterThan(spanEnd + 10);
    // The rows replay to the same frontier.
    const summaries = w.journal.view.summaries.map(item => item.through);
    w.closeJournal();
    const reopened = openPreviewJournal(w.path, key);
    expect(reopened.view.summaries.map(item => item.through)).toEqual(summaries);
    expect(reopened.view.summaryReservations.size).toBe(0);
    reopened.close();
  } finally { w.close(); }
});

it('a writer always past the output cap stays bounded per pass, and no attempt is left an UNKNOWN charge', async () => {
  // The other side: nothing can be summarized at all. The frontier cannot move -- that is the writer, not the
  // selection -- so what matters is that spend stays bounded and no proven over-cap attempt is left uncharged.
  const w = world(() => true);
  try {
    await w.fill(1, 14);
    // Four over-cap attempts end a pass (the most one pass spent before this change), so per-pass summary spend is
    // unchanged. Live, the pass offered 1-4, then their second attempts, then the one-turn span twice. Spans 5 and 6
    // only exist here because the reachability floor keeps answering past the point the old build held: a held turn
    // is unsettled, and an unsettled turn is never a pending span.
    expect(w.throughs).toEqual([4, 3, 2, 1, 1, 2, 3, 4, 6, 5, 5, 6]);
    // Each span keeps exactly its two attempts, over-cap included: no budget is widened.
    expect([...w.journal.view.summaryFailures.values()].every(count => count === 2)).toBe(true);
    // Every one is settled from its own outcome row: none is left as an UNKNOWN charge that would floor later spans.
    expect(w.journal.view.summaryReservations.size).toBe(0);
    expect(w.journal.view.summaryOverCap).toEqual([]);
    expect(w.journal.view.summaryOverCapFrontiers).toHaveLength(12);
    // The property: no summary is possible at all, and still not one reply is held for size (Rules 15, 95).
    expect(w.heldForSummary()).toEqual([]);
    expect(w.journal.view.order.filter(turn => turn.accepted && turn.sent === undefined)).toEqual([]);
    expect(reachedJournalCap(w.journal.view)).toBeNull();
  } finally { w.close(); }
});

it('the floor: no reply is held for size, and the turns it set aside stay recallable', async () => {
  // The whole long-chat failure class in one shape, from the live one: a writer whose summaries never land (over the
  // output cap on every attempt, replayed from the proof room's own outcome rows), then many more turns. Before the
  // floor, verbatim history grew behind the stuck frontier until no prompt could be built and every later turn came
  // back held "the conversation is too large to process right now".
  // 32768 bytes is the proof room's own launched `--max-context-bytes`.
  const w = world(() => true, 32768);
  try {
    // A fact stated early, taken verbatim from the proof room's recorded turns.
    w.worker.intake([w.update(1, MARKER_TURN.text)]);
    await w.drain();
    expect(w.journal.view.order.find(turn => turn.update === 1)?.sent).toBeDefined();
    // ... then a long conversation on top of it, far past the point the packet can hold verbatim.
    await w.fill(2, 60);
    // No summary ever committed -- the writer is the reason, and the floor does not pretend otherwise.
    expect(w.frontier()).toBeNull();
    // Yet every turn was answered, and not one was held for size.
    expect(w.heldForSummary()).toEqual([]);
    expect(w.journal.view.order.filter(turn => turn.accepted && turn.sent === undefined)).toEqual([]);
    // The floor did engage, and it said so in the packet rather than quietly shrinking history (Rule 2).
    const floored = w.answers.filter(item => item.packet.historySetAside !== undefined);
    expect(floored.length).toBeGreaterThan(0);
    const disclosure = floored.at(-1)!.packet.historySetAside as { count: number; through: number; note: string };
    expect(disclosure.count).toBeGreaterThan(0);
    expect(disclosure.note).toMatch(/kept and still searchable/u);
    // The disclosed count is exactly what is missing from that packet: nothing is lost silently.
    const shown = (floored.at(-1)!.packet.history as { id: string }[]).length;
    expect(disclosure.count + shown)
      .toBe(w.journal.view.order.filter(turn => turn.accepted && turn.update < Number(floored.at(-1)!.id.split(':').at(-1))).length);
    // Rule 26: a floored packet never claims complete history, and the packet audit accepts exactly what it shows.
    for (const item of floored) {
      expect(item.packet.historyMode).toBe('recent-only');
      expect(auditPacket(w.journal.view, w.journal.view.turns.get(item.id)!, item.packet).findings).toEqual([]);
    }
    // Rule 110: the first floored reply accounts for the set-aside like a summary frontier, in truthful words: the
    // grounding names the frontier, the model is told, and the reply actually SENT opens with the disclosure and
    // the real disposition of the last inbound before it.
    const first = w.journal.view.turns.get(floored[0]!.id)!;
    const firstAside = floored[0]!.packet.historySetAside as { through: number };
    expect(first.grounding?.setAsideThrough).toBe(firstAside.through);
    expect(first.grounding?.compactedThrough).toBeUndefined();
    expect(floored[0]!.packet.continuity).toMatchObject({ through: firstAside.through, basis: 'set-aside', state: 'addressed' });
    expect(first.continuity).toMatchObject({ summarizedThrough: firstAside.through, basis: 'set-aside', disposition: 'addressed' });
    expect(first.intent!.startsWith(`PREVIEW — Earlier conversation up to #${String(firstAside.through)} no longer fits in my view; `
      + 'it is kept and I can search it, but it is not summarized; your previous message (')).toBe(true);
    expect(first.intent).not.toMatch(/is now summarized/u);
    const firstContinuity = first.continuity;
    // And the reply's own durable record names the floor, so a restart can still answer how it was prepared.
    const reserved = w.journal.view.order.filter(turn => turn.packetDropped?.some(drop => drop.kind === 'history'));
    expect(reserved.length).toBeGreaterThan(0);
    expect(reserved.at(-1)!.packetDropped!.find(drop => drop.kind === 'history')!.reason)
      .toMatch(/the journal keeps these turns and recall reaches them/u);

    // Nothing was deleted: the set-aside turn is still in the journal verbatim ...
    expect(w.journal.view.turns.get('telegram:12345678:update:1')?.text).toBe(MARKER_TURN.text);
    // ... and it is still reachable. Asking about it brings it back into the packet by recall or memory search,
    // even though it is far below the floor and no summary covers it.
    w.worker.intake([w.update(61, 'What is my test marker? Reply with the marker.')]);
    await w.drain();
    const asked = w.answers.at(-1)!.packet as { history?: { id: string; user: string }[];
      recalled?: { id: string; user: string }[]; memorySearch?: { items: { quote: string }[] } };
    expect(asked.history?.some(item => item.id === 'telegram:12345678:update:1')).not.toBe(true);
    const reached = [...asked.recalled ?? [], ...(asked.memorySearch?.items ?? []).map(item => ({ user: item.quote }))];
    expect(reached.some(item => item.user.includes('probe-5f1ba73c'))).toBe(true);
    expect(w.heldForSummary()).toEqual([]);

    // The rows replay: the floor is a preparation decision, so it adds no state a reopen could disagree with.
    const sent = w.journal.view.order.filter(turn => turn.sent !== undefined).map(turn => turn.update);
    w.closeJournal();
    const reopened = openPreviewJournal(w.path, key);
    expect(reopened.view.order.filter(turn => turn.sent !== undefined).map(turn => turn.update)).toEqual(sent);
    expect(reopened.view.turns.get('telegram:12345678:update:1')?.text).toBe(MARKER_TURN.text);
    expect(reopened.view.turns.get(first.id)?.continuity).toEqual(firstContinuity);
    reopened.close();
  } finally { w.close(); }
});
