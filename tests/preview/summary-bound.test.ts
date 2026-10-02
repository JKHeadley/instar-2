import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUBSCRIPTION_MAX_OUTPUT_TOKENS } from '../../src/assembly/production-provider.js';
import { createJournalWorker, openPreviewJournal, summaryStoppedAt, SUMMARY_BYTES_PER_TOKEN, SUMMARY_ENVELOPE_BYTES,
  SUMMARY_FORMAT, SUMMARY_OUTPUT_BYTES, SUMMARY_OVER_BOUND_REASON, SUMMARY_OVER_CAP_REASON, SUMMARY_REASON_BYTES,
  SUMMARY_TEXT_MAX_BYTES, type CallOutcome } from './journal.js';
import { conclusionText, parseModelJson } from './model-json.js';

// Plan row #282 (w3-summarybound). Live on Justin's preview (build cint-L27 d12bbf55), 2026-10-02 04:56-05:51 PDT: 69
// summary calls from one base (frontier 969389761), none accepted; 13.6M input tokens spent on summaries in total.
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
type Writer = 'measured' | 'always-over' | 'ignores-bound' | { real: string[] };
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
      // Under the cap, but prose past the bound: the shape an unchanged old answer would have.
      if (writer === 'ignores-bound') return JSON.stringify({ summary: 'Shed notes, kept at length. '.repeat(80), people: [],
        commitments: [], memory: [], questions: [], memoryItems: [], concepts: [] });
      if (typeof writer === 'object') return answerOf(writer.real.shift() ?? '');
      const carried = (JSON.parse(input.context) as { summary?: { text?: string } }).summary?.text ?? '';
      const bound = /Keep the summary prose within (\d+) characters/u.exec(input.question)?.[1];
      const prose = `${carried} Then more notes about the shed.`;
      const summary = bound ? prose.slice(-Number(bound)) : prose;
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

it('prose over its bound is refused as asking too much: a shorter span next, then the brake', async () => {
  const w = world('ignores-bound');
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
