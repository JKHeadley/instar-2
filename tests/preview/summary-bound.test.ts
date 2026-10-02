import { expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUBSCRIPTION_MAX_OUTPUT_TOKENS } from '../../src/assembly/production-provider.js';
import { createJournalWorker, openPreviewJournal, summaryStoppedAt, SUMMARY_BYTES_PER_TOKEN, SUMMARY_ENVELOPE_BYTES,
  SUMMARY_FORMAT, SUMMARY_OUTPUT_BYTES, SUMMARY_OVER_BOUND_REASON, SUMMARY_OVER_CAP_REASON, SUMMARY_REASON_BYTES,
  SUMMARY_TEXT_CEILING_BYTES, SUMMARY_TEXT_MAX_BYTES, type CallOutcome } from './journal.js';
import { conclusionText, parseModelJson } from './model-json.js';

// Plan row #282 (w3-summarybound). Live on Justin's preview (build cint-L27 d12bbf55), 2026-10-02 04:56-05:51 PDT: 77
// summary calls from one base (frontier 969389761), 69 of them over the cap, none accepted; 13.6M input tokens spent on summaries in total.
// Read from a copy of his root:
// - the carried summary was 2166 bytes, far under its old 8192-byte bound; the output ran past the 2048-token cap
//   because the Decision's reasoning (median 1888 bytes, up to 3626) and the answer together fill about 5 KB at 2.44 to
//   3.08 bytes per token, and because each exhausted frontier made the next span longer (up to seven turns, 79-112K
//   input tokens, up to 8192 output tokens);
// - the over-cap ceiling released once the ceiling span was spent, so the pass walked forward through ever longer
//   spans from the same base, two calls each.
// Fixture: the 69 recorded over-cap outcome rows (content-free), the measured bytes per token and envelope of all 88
// recorded summary outputs, and three verbatim outputs of the real summary model (claude-sonnet-5, 2048-token cap,
// thinking off) on the real prepared prompts this build sends for that root.
type ModelUsage = { inputTokens: number | null; outputTokens: number | null; charge: null; inputComplete?: true };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/justin-summary-bound-2026-10-02.json', import.meta.url), 'utf8')) as {
  overCap: { id: string; outcome: CallOutcome; uncertainUsage?: ModelUsage }[];
  recordedOutputBytesPerToken: number[]; recordedEnvelopeBytes: number[]; recordedReasonBytes: number[];
  realOutputs: { id: string; numTurns: number; outputTokens: number; maxOutputTokens: number; result: string }[] };
const OVER_CAP = fixture.overCap.filter(item => item.uncertainUsage).map(item => ({ outcome: item.outcome, usage: item.uncertainUsage! }));
const floorBytesPerToken = Math.min(...fixture.recordedOutputBytesPerToken,
  ...fixture.realOutputs.map(item => Buffer.byteLength(item.result) / item.outputTokens));
const decision = (result: string) => JSON.parse(result.trim().replace(/^```(?:json)?\s*|\s*```$/gu, '')) as
  { reason: { value: string }; conclusion: { value: unknown } };
const answerOf = (result: string) => {
  const parsed = parseModelJson(result);
  return conclusionText(parsed.ok ? (parsed.value as { conclusion: { value: unknown } }).conclusion.value : null) ?? '';
};

const key = new Uint8Array(32).fill(43);
const START = 1790950000000;
const genesis = (maxBytes: number) => ({ kind: 'genesis' as const, bot: '8820318295', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 1500, maxReplies: 1500, maxTurns: 1500, maxBytes, cursor: 0 });
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const filler = (id: number) => `Note ${String(id)}: ${'the shed holds rakes, twine and seed trays. '.repeat(10)}`;

/** The measured writer: it re-emits the carried prose, condensed only when the question names a prose bound, and
 * reasons at the recorded median length unless asked for one sentence (then at the longest length measured with
 * that wording). An answer whose output would pass the cap at the floor bytes per token ends like the recorded
 * over-cap calls: their outcome row first, then an uncertain result. */
type Writer = 'measured' | 'always-over' | 'past-ceiling' | 'over-target' | 'non-ascii' | { real: string[] };
function world(writer: Writer, maxBytes = 9000) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-bound-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, genesis(maxBytes));
  const throughs: number[] = [];
  let clock = 0, overCapIndex = 0;
  const overCap = (id: string) => {
    const recorded = OVER_CAP[overCapIndex++ % OVER_CAP.length]!;
    journal.append({ kind: 'call-outcome', id, role: 'summary', outcome: recorded.outcome, at: START + clock });
    return { state: 'uncertain' as const, usage: recorded.usage };
  };
  const worker = createJournalWorker(journal, { now: () => START + clock, elapsed: () => clock, stopped: () => false,
    prepareModel: input => JSON.stringify(input),
    model: async input => {
      if (!input.id.startsWith('summary:')) return 'Noted.';
      throughs.push(Number(input.id.slice(8)));
      if (writer === 'always-over') return overCap(input.id);
      // Under the cap, but prose past the ceiling every answer packet is sized for.
      if (writer === 'past-ceiling') return JSON.stringify({ summary: 'x'.repeat(Math.min(SUMMARY_TEXT_CEILING_BYTES, maxBytes >> 2) + 1),
        people: [], commitments: [], memory: [], questions: [], memoryItems: [], concepts: [] });
      // The live writer of 2026-10-02: prose a little past the stated target (1418 bytes against 1326), the whole answer
      // well inside the cap.
      if (writer === 'over-target') return JSON.stringify({ summary: 's'.repeat(SUMMARY_TEXT_MAX_BYTES + 92),
        people: [], commitments: [], memory: [], questions: [], memoryItems: [], concepts: [] });
      if (typeof writer === 'object') return answerOf(writer.real.shift() ?? '');
      const carried = (JSON.parse(input.context) as { summary?: { text?: string } }).summary?.text ?? '';
      const bound = /Keep the summary prose within (\d+) bytes of UTF-8/u.exec(input.question)?.[1];
      if (writer === 'non-ascii' && Number(bound) !== SUMMARY_TEXT_MAX_BYTES) throw new Error(`stated prose bound ${String(bound)} is not the enforced ${String(SUMMARY_TEXT_MAX_BYTES)} bytes`);
      // The non-ASCII writer fills the stated bound exactly in the stated unit: two-byte letters, one ASCII byte if odd.
      const summary = writer === 'non-ascii' ? 'é'.repeat(Number(bound) >> 1) + 'x'.repeat(Number(bound) & 1)
        : bound ? Buffer.from(`${carried} Then more notes about the shed.`).subarray(-Number(bound)).toString('utf8').replace(/^\uFFFD+/u, '')
        : `${carried} Then more notes about the shed.`;
      const answer = JSON.stringify({ summary, people: [], commitments: [], memory: [], questions: [], memoryItems: [], concepts: [] });
      const reasoning = /Write reason\.value as one sentence/u.test(input.question)
        ? Math.max(...fixture.realOutputs.map(item => Buffer.byteLength(decision(item.result).reason.value)))
        : [...fixture.recordedReasonBytes].sort((a, b) => a - b)[fixture.recordedReasonBytes.length >> 1]!;
      const output = Math.max(...fixture.recordedEnvelopeBytes) + reasoning + Buffer.byteLength(JSON.stringify(answer));
      return output / floorBytesPerToken > SUBSCRIPTION_MAX_OUTPUT_TOKENS ? overCap(input.id) : answer;
    },
    summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
    send: async () => journal.view.replies + 1, checkOutbound: () => {} });
  return { journal, worker, throughs, path, tick: (ms: number) => { clock += ms; },
    fill: async (from: number, to: number) => {
      for (let id = from; id <= to; id++) { worker.intake([update(id, filler(id))]); await worker.drain(); clock += 60_000; }
    },
    /** An accepted summary with prose of the given size, as an older build accepted it (its bound was 8192 bytes). */
    carry: (through: number, bytes: number) => {
      journal.append({ kind: 'summary-reserve', through, maxInputTokens: maxBytes, maxOutputTokens: 2048, at: START + clock });
      journal.append({ kind: 'summary', through, text: 'Earlier the operator logged shed notes. '.repeat(400).slice(0, bytes),
        faithfulness: { path: 'exact', verdict: 'pass', score: null }, state: 'complete', at: START + clock });
    },
    frontier: () => journal.view.summaries.at(-1)?.through ?? null,
    unanswered: () => journal.view.order.filter(turn => turn.accepted && turn.sent === undefined),
    close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it('the bound is derived from the cap: prose at the bound plus a real four-turn span stays a fifth under it', () => {
  // Measured, not assumed: the floor bytes per token of every recorded summary output and every real output.
  expect(floorBytesPerToken).toBeGreaterThanOrEqual(SUMMARY_BYTES_PER_TOKEN);
  expect(SUMMARY_OUTPUT_BYTES).toBe(Math.floor(SUBSCRIPTION_MAX_OUTPUT_TOKENS * SUMMARY_BYTES_PER_TOKEN));
  expect(Math.max(...fixture.recordedEnvelopeBytes)).toBeLessThanOrEqual(SUMMARY_ENVELOPE_BYTES);
  // The part every call re-emits whatever its span, with the envelope and the reasoning allowance: 59% of the cap.
  const fixed = SUMMARY_ENVELOPE_BYTES + SUMMARY_REASON_BYTES + SUMMARY_TEXT_MAX_BYTES;
  expect(fixed / SUMMARY_BYTES_PER_TOKEN / SUBSCRIPTION_MAX_OUTPUT_TOKENS).toBeLessThan(0.6);
  for (const real of fixture.realOutputs) {
    // The real model, on the real prepared prompts of Justin's root under this wording: one turn, under the cap.
    expect(real.maxOutputTokens).toBe(SUBSCRIPTION_MAX_OUTPUT_TOKENS);
    expect(real.numTurns).toBe(1);
    expect(real.outputTokens).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS * 0.8);
    const made = decision(real.result);
    expect(Buffer.byteLength(made.reason.value)).toBeLessThanOrEqual(SUMMARY_REASON_BYTES);
    // The largest acceptable answer for that span: its prose padded to the bound, its real lists and four concept
    // entries unchanged, written back the way the model wrote it (string-encoded or not).
    const value = typeof made.conclusion.value === 'string' ? JSON.parse(made.conclusion.value) as Record<string, unknown>
      : made.conclusion.value as Record<string, unknown>;
    expect(Buffer.byteLength(String(value.summary))).toBeLessThanOrEqual(SUMMARY_TEXT_MAX_BYTES);
    const atBound = { ...value, summary: 'x'.repeat(SUMMARY_TEXT_MAX_BYTES) };
    const largest = JSON.stringify({ ...made, conclusion: { ...made.conclusion,
      value: typeof made.conclusion.value === 'string' ? JSON.stringify(atBound) : atBound } });
    // Stated margin: at least 20% of the cap stays unused at the floor bytes per token.
    expect(Buffer.byteLength(largest) / floorBytesPerToken).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS * 0.8);
  }
});

it('a carried summary at the old bound: the pass condenses it in one call and advances, instead of spending', async () => {
  // Justin's limit: at 409600 bytes the summary prompt holds the old 8192-byte prose beside the span.
  const w = world('measured', 409600);
  try {
    await w.fill(1, 3);
    w.carry(3, 8192);
    await w.fill(4, 10);
    await w.worker.summarizeIfNeeded(true);
    // Accepted under the derived bound, from the first call: the prose was rewritten within it.
    expect(w.frontier()!).toBeGreaterThan(3);
    expect(Buffer.byteLength(w.journal.view.summaries.at(-1)!.text)).toBeLessThanOrEqual(SUMMARY_TEXT_MAX_BYTES);
    expect(w.journal.view.summaries.filter(summary => summary.through > 3).length).toBeGreaterThan(0);
    expect(w.journal.view.callOutcomes.filter(row => row.outcome.localLimit === 'output-cap')).toEqual([]);
    expect(summaryStoppedAt(w.journal.view)).toBeNull();
    expect(w.unanswered()).toEqual([]);
  } finally { w.close(); }
});

it('the brake: once the shortest span and its reduced retry ran over the cap, no call is spent from that base', async () => {
  const w = world('always-over');
  try {
    await w.fill(1, 14);
    // The four-turn cascade, then the one-turn span's reduced retry, each settled from its own recorded outcome row.
    expect(w.throughs).toEqual([4, 3, 2, 1, 1]);
    expect(summaryStoppedAt(w.journal.view)).toBe(1);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe(SUMMARY_OVER_CAP_REASON);
    expect(w.journal.view.lastSummaryFailure?.format).toBe(SUMMARY_FORMAT);
    // Every later span from this base contains span 1, so turns arriving change nothing: zero calls, every reply sent.
    await w.fill(15, 40);
    expect(w.throughs).toHaveLength(5);
    await w.worker.summarizeIfNeeded(true);
    expect(w.throughs).toHaveLength(5);
    expect(w.journal.view.summaryReservations.size).toBe(0);
    expect(w.unanswered()).toEqual([]);
    // Restart: the brake is in the journal, not in memory.
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    expect(summaryStoppedAt(reopened.view)).toBe(1);
    reopened.close();
  } finally { rmSync(join(w.path, '..'), { recursive: true, force: true }); }
});

it('a changed summary format is a changed input: spans an older build exhausted are tried again, then braked', async () => {
  const w = world('always-over');
  try {
    await w.fill(1, 6);
    expect(w.throughs).toEqual([]);
    // The identical sequence as an older build wrote it: no format on its failures (Justin's root today).
    for (const through of [4, 3, 2, 1, 1]) {
      w.journal.append({ kind: 'summary-reserve', through, maxInputTokens: 9000, maxOutputTokens: 2048, at: START });
      w.journal.append({ kind: 'call-outcome', id: `summary:${String(through)}`, role: 'summary', outcome: OVER_CAP[0]!.outcome, at: START });
      w.journal.append({ kind: 'summary-uncertain', through, state: 'uncertain', usage: OVER_CAP[0]!.usage, at: START });
      w.journal.append({ kind: 'summary-failed', through, state: 'rejected', failureClass: 'rejected', reason: SUMMARY_OVER_CAP_REASON,
        usage: OVER_CAP[0]!.usage, at: START });
      if (through === 1) break;
    }
    expect(summaryStoppedAt(w.journal.view)).toBeNull();
    const before = w.throughs.length;
    await w.fill(7, 20);
    // This build asks differently, so it tries once more under its own format and brakes on its own evidence.
    expect(w.throughs.length).toBeGreaterThan(before);
    expect(summaryStoppedAt(w.journal.view)).not.toBeNull();
    const spent = w.throughs.length;
    await w.fill(21, 30);
    expect(w.throughs).toHaveLength(spent);
  } finally { w.close(); }
});

it('prose past the packet ceiling is refused as asking too much: a shorter span next, then the brake', async () => {
  const w = world('past-ceiling');
  try {
    await w.fill(1, 14);
    expect(w.journal.view.summaries).toEqual([]);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe(SUMMARY_OVER_BOUND_REASON);
    // The same cascade as over the cap: shorter spans inside the pass, the shortest span's second attempt, then stop.
    expect(w.throughs).toEqual([4, 3, 2, 1, 1]);
    expect(summaryStoppedAt(w.journal.view)).toBe(1);
    await w.fill(15, 30);
    expect(w.throughs).toHaveLength(5);
    expect(w.unanswered()).toEqual([]);
  } finally { w.close(); }
});

it('the prose bound is stated in the unit it is enforced in: non-ASCII prose at the stated bound is accepted', async () => {
  const w = world('non-ascii');
  try {
    await w.fill(1, 40);
    // At the bound exactly, 663 two-byte letters: accepted, and the frontier reaches the head without a brake.
    expect(Buffer.byteLength(w.journal.view.summaries.at(-1)!.text)).toBe(SUMMARY_TEXT_MAX_BYTES);
    expect(w.journal.view.summaries.at(-1)!.text.length).toBeLessThan(SUMMARY_TEXT_MAX_BYTES);
    expect(summaryStoppedAt(w.journal.view)).toBeNull();
    expect(w.frontier()).toBeGreaterThanOrEqual(36);
    expect(w.journal.view.lastSummaryFailure).toBeNull();
    expect(w.unanswered()).toEqual([]);
  } finally { w.close(); }
});

it('the real model outputs replay through the acceptance path: one accepted and advancing, two refused for content', async () => {
  // Justin's update ids, synthetic text: his message text is not copied here. The span (969389761, 969389765] and then
  // (969389765, 969389772] are the ones this build prepares first on his root; the outputs are the real answers.
  const ids = [969389760, 969389761, 969389762, 969389763, 969389764, 969389765, 969389766, 969389767, 969389768, 969389772];
  const w = world({ real: fixture.realOutputs.map(item => item.result) }, 409600);
  try {
    for (const id of ids) { w.worker.intake([update(id, filler(id))]); await w.worker.drain(); }
    w.carry(969389761, 2166); // his carried summary's recorded size
    await w.worker.summarizeIfNeeded(true);
    expect(w.throughs.slice(0, 2)).toEqual([969389765, 969389772]);
    // The first real answer is accepted, condensed within the bound, and the frontier advances.
    expect(w.journal.view.summaries.map(item => item.through)).toContain(969389765);
    expect(Buffer.byteLength(w.journal.view.summaries.find(item => item.through === 969389765)!.text)).toBeLessThanOrEqual(SUMMARY_TEXT_MAX_BYTES);
    // The other two came back under the cap and within the prose bound, and were refused by the existing content rule
    // (memoryDisposition "unresolved"), never for size.
    const failed = w.journal.view.summaryFormatFailures.filter(item => item.through === 969389772);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every(item => !item.overCap)).toBe(true);
    for (const real of fixture.realOutputs.slice(1))
      expect((JSON.parse(answerOf(real.result)) as { memoryDisposition?: string }).memoryDisposition).toBe('unresolved');
  } finally { w.close(); }
});

it('a memory request below an UNKNOWN frontier is still summarized once the recovery pause has passed', async () => {
  // Justin's root holds UNKNOWN reservations at 969389788 and 969389812; a canary turn below them (969389772) was left
  // memory-pending by a refused answer. Returning whenever the pass target sat at or below an UNKNOWN stopped every pass.
  const w = world('measured', 409600);
  try {
    await w.fill(1, 10);
    expect(w.throughs).toEqual([]);
    w.journal.append({ kind: 'summary-reserve', through: 9, maxInputTokens: 409600, maxOutputTokens: 2048, at: START });
    const turn5 = w.journal.view.order.find(turn => turn.update === 5)!;
    w.journal.append({ kind: 'summary-reserve', through: 5, maxInputTokens: 409600, maxOutputTokens: 2048, at: START });
    w.journal.append({ kind: 'summary-failed', format: SUMMARY_FORMAT, through: 5, state: 'complete', failureClass: 'malformed',
      memoryPendingFor: turn5.id, at: START });
    expect(turn5.memoryPending).toBe(true);
    await w.worker.summarizeIfNeeded(false); // the recovery pause starts with the process
    expect(w.throughs).toEqual([]);
    w.tick(61_000);
    await w.worker.summarizeIfNeeded(false);
    expect(w.throughs.length).toBeGreaterThan(0);
    expect(w.throughs.every(through => through <= 5)).toBe(true);
    expect(w.journal.view.summaries.at(-1)?.through).toBe(5);
    // The UNKNOWN itself is never dispatched again and keeps its reservation.
    expect(w.throughs).not.toContain(9);
    expect(w.journal.view.summaryReservations.has(9)).toBe(true);
  } finally { w.close(); }
});

// Follow-up (plan row #287). Live on Justin's root on cint-L28, 2026-10-02 08:30-08:33 PDT: seven summary calls from the
// base 969389761, none accepted, and the brake stopped his summary at 969389763 for good. Six ended within the output cap
// (855-1705 tokens); three were refused as "summary answer over its bound". Verbatim, from his root's model-call rows.
type LiveAttempt = { id: string; through: number; outcome: CallOutcome & { outputTokens: number; promptBytes: number };
  recordedFailure: { format: number; failureClass: string; reason?: string; memoryPending: boolean }; output: string | null };
const live = (JSON.parse(readFileSync(new URL('./fixtures/justin-summary-bound-L28-2026-10-02.json', import.meta.url), 'utf8')) as
  { attempts: LiveAttempt[] }).attempts;
const liveValue = (attempt: LiveAttempt) => decision(attempt.output!).conclusion.value as Record<string, unknown>;
const liveProse = (attempt: LiveAttempt) => {
  const value = liveValue(attempt);
  return String(typeof value.summary === 'string' ? value.summary : value.reply);
};

it('the live cint-L28 attempts: within the cap, prose a little past the target, and the old measure was wrong', () => {
  expect(live.map(item => item.through)).toEqual([969389765, 969389765, 969389764, 969389763, 969389762, 969389762, 969389763]);
  const overBound = live.filter(item => item.recordedFailure.reason === SUMMARY_OVER_BOUND_REASON);
  expect(overBound.map(item => item.id)).toEqual(['summary:969389764', 'summary:969389762', 'summary:969389763']);
  // The one over the cap left no output; every other ended within it, at 42% to 83% of it.
  const ended = live.filter(item => item.output !== null);
  expect(live.filter(item => item.output === null).map(item => item.outcome.localLimit)).toEqual(['output-cap']);
  for (const item of ended) expect(item.outcome.outputTokens).toBeLessThan(SUBSCRIPTION_MAX_OUTPUT_TOKENS * 0.85);
  // The real prose: 1293 to 1418 bytes where the writer wrote at length, against a stated target of 1326.
  expect(ended.map(item => Buffer.byteLength(liveProse(item)))).toEqual([1338, 1293, 1418, 956, 1386, 1132]);
  expect(Math.max(...ended.map(item => Buffer.byteLength(liveProse(item))))).toBeLessThan(SUMMARY_TEXT_CEILING_BYTES);
  // Two of the three refusals wrote the prose in `reply` beside the other fields: the old reader measured the whole
  // answer (3469 and 2037 bytes) as the prose, and never read their memoryDisposition.
  const inReply = overBound.filter(item => typeof liveValue(item).summary !== 'string');
  expect(inReply.map(item => Buffer.byteLength(JSON.stringify(liveValue(item))))).toEqual([3469, 2037]);
  expect(inReply.map(item => Buffer.byteLength(liveProse(item)))).toEqual([1418, 1132]);
});

it('the live cint-L28 answers through this build: none refused for prose length; the one without a content fault is accepted', async () => {
  // Justin's update ids, synthetic text; each real answer offered as the first answer from his base, as on his root.
  const ids = [969389760, 969389761, 969389762, 969389763, 969389764, 969389765];
  const outcomes: string[] = [];
  for (const attempt of live.filter(item => item.output !== null)) {
    const w = world({ real: [attempt.output!] }, 409600);
    try {
      for (const id of ids) { w.worker.intake([update(id, filler(id))]); await w.worker.drain(); }
      w.carry(969389761, 2166);
      await w.worker.summarizeIfNeeded(true);
      const first = w.throughs[0]!;
      const accepted = w.journal.view.summaries.find(item => item.through === first);
      const failure = w.journal.view.summaryFormatFailures.find(item => item.through === first);
      expect(w.journal.view.lastSummaryFailure?.reason).not.toBe(SUMMARY_OVER_BOUND_REASON);
      if (liveValue(attempt).memoryDisposition === 'unresolved') {
        // Refused by the existing content rule, now read from the `reply` shape too: not the asked-too-much class.
        expect(accepted).toBeUndefined();
        expect(failure?.overCap).toBe(false);
        outcomes.push('content');
      } else {
        // summary:969389762's second answer (1386 bytes, 1366 tokens) and the plain `reply`-only answer: accepted as
        // written, the frontier advances, and the prose kept is the prose, never the whole answer.
        expect(accepted?.text).toBe(liveProse(attempt));
        expect(w.frontier()).toBe(first);
        expect(summaryStoppedAt(w.journal.view)).toBeNull();
        outcomes.push('accepted');
      }
    } finally { w.close(); }
  }
  expect(outcomes).toEqual(['content', 'accepted', 'content', 'content', 'accepted', 'content']);
});

it('prose past the stated target and inside the cap is accepted: the frontier reaches the head, no brake', async () => {
  const w = world('over-target');
  try {
    await w.fill(1, 40);
    expect(Buffer.byteLength(w.journal.view.summaries.at(-1)!.text)).toBe(SUMMARY_TEXT_MAX_BYTES + 92);
    expect(w.frontier()).toBeGreaterThanOrEqual(36);
    expect(w.journal.view.lastSummaryFailure).toBeNull();
    expect(summaryStoppedAt(w.journal.view)).toBeNull();
    expect(w.unanswered()).toEqual([]);
  } finally { w.close(); }
});

it('a root carrying the live format-2 failures advances on the next pass; the same rows under this format still brake', async () => {
  const failures = (w: ReturnType<typeof world>, format: number) => {
    // His rows from cint-L28, frontier 1 standing for 969389761: 5 twice for content, 4 over the bound, 3 over the cap
    // then over the bound, 2 for content then over the bound.
    for (const [through, reason] of [[5, null], [5, null], [4, SUMMARY_OVER_BOUND_REASON], [3, SUMMARY_OVER_CAP_REASON],
      [2, null], [2, SUMMARY_OVER_BOUND_REASON], [3, SUMMARY_OVER_BOUND_REASON]] as const) {
      w.journal.append({ kind: 'summary-reserve', through, maxInputTokens: 409600, maxOutputTokens: 2048, at: START });
      if (reason === SUMMARY_OVER_CAP_REASON) {
        w.journal.append({ kind: 'call-outcome', id: `summary:${String(through)}`, role: 'summary', outcome: OVER_CAP[0]!.outcome, at: START });
        w.journal.append({ kind: 'summary-uncertain', through, state: 'uncertain', usage: OVER_CAP[0]!.usage, at: START });
        w.journal.append({ kind: 'summary-failed', format, through, state: 'rejected', failureClass: 'rejected', reason, usage: OVER_CAP[0]!.usage, at: START });
      } else w.journal.append({ kind: 'summary-failed', format, through, state: 'complete', failureClass: 'malformed',
        ...(reason ? { reason } : {}), at: START });
    }
  };
  const current = world('measured', 409600);
  try {
    await current.fill(1, 6);
    current.carry(1, 2166);
    failures(current, SUMMARY_FORMAT);
    // Under one format these rows are his brake: both attempts at 3 asked too much.
    expect(summaryStoppedAt(current.journal.view)).toBe(3);
  } finally { current.close(); }
  const w = world('measured', 409600);
  try {
    await w.fill(1, 6);
    w.carry(1, 2166);
    failures(w, 2);
    expect(SUMMARY_FORMAT).toBe(3);
    expect(summaryStoppedAt(w.journal.view)).toBeNull();
    // No hand step: the next pass is offered the spans again under this format and the frontier advances.
    await w.worker.summarizeIfNeeded(true);
    expect(w.frontier()!).toBeGreaterThan(1);
    expect(w.journal.view.summaryFormatFailures).toEqual([]);
    expect(w.unanswered()).toEqual([]);
    // Restart: the old rows still do not brake this build.
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key);
    expect(summaryStoppedAt(reopened.view)).toBeNull();
    reopened.close();
  } finally { rmSync(join(w.path, '..'), { recursive: true, force: true }); }
});

/** The next forced summary pass over a journal file, as a restarted process runs it: how many summary calls it made,
 * the frontier it reached and where it is stopped. */
async function nextPass(path: string) {
  const journal = openPreviewJournal(path, key);
  let calls = 0;
  try {
    const worker = createJournalWorker(journal, { now: () => START + 60_000, elapsed: () => 60_000, stopped: () => false,
      prepareModel: input => JSON.stringify(input),
      model: async () => { calls++; return JSON.stringify({ summary: 'The operator sent six notes.', people: [], commitments: [],
        memory: [], questions: [], memoryItems: [], concepts: [] }); },
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      send: async () => { throw new Error('unexpected send'); }, checkOutbound: () => {} });
    await worker.summarizeIfNeeded(true);
    return { calls, frontier: journal.view.summaries.at(-1)?.through ?? null, stoppedAt: summaryStoppedAt(journal.view) };
  } finally { journal.close(); }
}

// cint-L29 review, MUST-FIX 1. The two fixtures are one history written by the real cint-L28 build (11eaaac5, format
// 2): six answered turns and two over-bound refusals at frontier 1, braked there. One is the raw rows; the other is
// the same journal after that build's own compaction, whose snapshot saved the two failures without a format.
it('a cint-L28 snapshot gives up its format-2 brake exactly as the raw rows do', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-format-')));
  try {
    const results: Record<string, unknown> = {};
    for (const shape of ['raw', 'compacted']) {
      const path = join(root, `${shape}.encrypted`);
      copyFileSync(new URL(`./fixtures/summary-format-L28-${shape}.encrypted`, import.meta.url), path);
      const bytes = readFileSync(path);
      const opened = openPreviewJournal(path, key, undefined, undefined, true, undefined, true);
      const before = { stoppedAt: summaryStoppedAt(opened.view), failures: opened.view.summaryFormatFailures,
        calls: opened.view.calls, replies: opened.view.replies, turns: opened.view.order.length };
      opened.close();
      expect(readFileSync(path).equals(bytes)).toBe(true);
      results[shape] = { before, next: await nextPass(path) };
    }
    expect(results.raw).toEqual({ before: { stoppedAt: null, failures: [], calls: 8, replies: 6, turns: 6 },
      next: { calls: 2, frontier: 6, stoppedAt: null } });
    expect(results.compacted).toEqual(results.raw);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('failures made under this format still brake after compaction and reopen', async () => {
  const w = world('measured', 409600);
  try {
    await w.fill(1, 6);
    for (let attempt = 0; attempt < 2; attempt++) {
      w.journal.append({ kind: 'summary-reserve', through: 1, maxInputTokens: 409600, maxOutputTokens: 2048, at: START });
      w.journal.append({ kind: 'summary-failed', format: SUMMARY_FORMAT, through: 1, state: 'complete', failureClass: 'malformed',
        reason: SUMMARY_OVER_BOUND_REASON, at: START });
    }
    const saved = [{ through: 1, overCap: true, format: SUMMARY_FORMAT }, { through: 1, overCap: true, format: SUMMARY_FORMAT }];
    expect(w.journal.view.summaryFormatFailures).toEqual(saved);
    expect(summaryStoppedAt(w.journal.view)).toBe(1);
    w.journal.compact();
    w.journal.close();
    const reopened = openPreviewJournal(w.path, key, undefined, undefined, true);
    expect(reopened.view.summaryFormatFailures).toEqual(saved);
    expect(summaryStoppedAt(reopened.view)).toBe(1);
    reopened.close();
    // Spent: the restarted pass makes no call at all.
    expect(await nextPass(w.path)).toEqual({ calls: 0, frontier: null, stoppedAt: 1 });
  } finally { rmSync(join(w.path, '..'), { recursive: true, force: true }); }
});
