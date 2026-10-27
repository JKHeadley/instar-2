import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { subscriptionAnswerTokens } from '../../src/assembly/production-provider.js';
import { SUMMARY_OVER_CAP_REASON, summaryStoppedAt, type CallOutcome } from './journal.js';
import { summaryCapFixture as fixture, summaryCapReplay } from './summary-cap-replay.js';
import { readAnswer } from './answer-reading.js';
import { interpretSummaryReview } from './summary-check.js';

const live = (JSON.parse(readFileSync(new URL('./fixtures/summary-cap-2026-10-26.json', import.meta.url), 'utf8')) as {
  liveReplay: { writer: { frame: { result: string; usage: { output_tokens: number; output_tokens_details: unknown } };
    usage: { inputTokens: number; outputTokens: number; charge: null } };
    review: { frame: { result: string }; usage: { inputTokens: number; outputTokens: number; charge: null } };
    overCap: { outcome: CallOutcome; usage: { inputTokens: number; outputTokens: number; charge: null } } };
}).liveReplay;

it('measures every recorded refusal after subtracting thinking, without raising the cap', () => {
  const answers: number[] = [];
  for (const { outcome } of fixture.writers.filter(w => w.outcome.localLimit === 'output-cap')) {
    const thinking = Number(/"thinking_tokens":(\d+)/u.exec(outcome.diagnostic!.rawOutputExcerpt)![1]);
    answers.push(subscriptionAnswerTokens({ output_tokens: outcome.outputTokens!, output_tokens_details: { thinking_tokens: thinking } }));
  }
  expect(answers).toEqual([2352, 3543, 5351, 2678, 2584, 3357]);
  expect(answers.every(n => n > 2048)).toBe(true);
});

it('halves the recorded oversized prefix and reaches the durable single-span brake across restart', async () => {
  let i = 0;
  const w = summaryCapReplay({ model: async (input, journal) => {
    // Include the new real 2628-answer-token refusal as well as all six original failures.
    const recorded = i++ === 0 ? live.overCap : fixture.writers[(i - 2) % 6]!;
    journal.append({ kind: 'call-outcome', id: input.id, role: 'summary', outcome: recorded.outcome, at: 1793061000000 });
    return { state: 'uncertain', usage: recorded.usage! };
  } });
  try {
    await w.worker.summarizeIfNeeded();
    const counts = () => w.calls.map(c => (JSON.parse(c.context) as { history: unknown[] }).history.length);
    expect(counts()).toEqual([59, 29, 14, 7]);
    expect(w.journal.view.summaries).toHaveLength(0);
    expect(w.journal.view.summaryCheckCounts.pass).toBe(0);
    w.reopen(); w.advance();
    await w.worker.summarizeIfNeeded();
    expect(counts()).toEqual([59, 29, 14, 7, 4, 3, 2, 1]);
    w.reopen(); w.advance();
    await w.worker.summarizeIfNeeded();
    expect(counts()).toEqual([59, 29, 14, 7, 4, 3, 2, 1, 1]);
    expect(summaryStoppedAt(w.journal.view)).toBe(fixture.turns[0]!.update);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe(SUMMARY_OVER_CAP_REASON);
    w.reopen(); w.advance();
    await w.worker.summarizeIfNeeded();
    expect(w.calls).toHaveLength(9);
    expect(w.journal.view.summaries).toHaveLength(0);
    expect(w.journal.view.summaryReservations.size).toBe(0);
  } finally { w.close(); }
});

it.each(['stop', 'spend'] as const)('retains the %s floor before the smaller retry', async floor => {
  const w = summaryCapReplay({ model: async (input, journal) => {
    journal.append({ kind: 'call-outcome', id: input.id, role: 'summary', outcome: fixture.writers[0]!.outcome, at: 1793061000000 });
    if (floor === 'stop') w.stop(); else journal.view.limits.maxCalls = journal.view.calls;
    return { state: 'uncertain', usage: fixture.writers[0]!.usage! };
  } });
  try {
    await w.worker.summarizeIfNeeded().catch(() => {});
    expect(w.calls).toHaveLength(1);
    expect(w.journal.view.summaries).toHaveLength(0);
  } finally { w.close(); }
});

it('does not retry a recorded stopped writer as though it exceeded the cap', async () => {
  const w = summaryCapReplay({ model: async (input, journal) => {
    journal.append({ kind: 'call-outcome', id: input.id, role: 'summary', outcome: fixture.writers[6]!.outcome, at: 1793061000000 });
    return { state: 'uncertain' };
  } });
  try {
    await w.worker.summarizeIfNeeded();
    expect(w.calls).toHaveLength(1);
    expect(w.journal.view.summaryReservations.size).toBe(1);
    expect(w.journal.view.summaryFailures.size).toBe(0);
  } finally { w.close(); }
});

it.each([false, true])('replays the real smaller writer and requires a decided review before commit (unavailable=%s)', async unavailable => {
  const writer = readAnswer(live.writer.frame.result, { object: true, evidence: ['summary:367054864'] });
  const review = readAnswer(live.review.frame.result, { object: true, evidence: ['summary:367054864:review'] });
  if (!writer.ok || !review.ok) throw Error('recorded live answer did not parse');
  expect(subscriptionAnswerTokens(live.writer.frame.usage)).toBe(1867);
  const w = summaryCapReplay({ model: async () => ({ state: 'complete', text: writer.value, usage: live.writer.usage }),
    review: async state => {
      expect(JSON.parse(state).proposed.summary).toBe(JSON.parse(writer.value).summary);
      const result = interpretSummaryReview({ state: unavailable ? 'uncertain' : 'complete', value: review.value,
        usage: live.review.usage }, 1);
      if (result.verdict === 'unsure') throw Error('unexpected summary review shape');
      return { ...result, verdict: result.verdict };
    } });
  const append = w.journal.append.bind(w.journal);
  w.journal.append = row => { append(row); if (row.kind === 'summary') w.stop(); };
  try {
    w.journal.append({ kind: 'summary-reserve', through: 367054889, at: 1793059163600 });
    w.journal.append({ kind: 'call-outcome', id: 'summary:367054889', role: 'summary', outcome: fixture.writers[0]!.outcome, at: 1793059163653 });
    w.journal.append({ kind: 'summary-uncertain', through: 367054889, state: 'uncertain', usage: fixture.writers[0]!.usage!, at: 1793059163662 });
    w.advance();
    await w.worker.summarizeIfNeeded().catch(error => { if (unavailable) throw error; });
    expect(w.calls.map(c => c.id)).toEqual(['summary:367054864']);
    expect(w.journal.view.summaryCheckCounts.pass).toBe(unavailable ? 0 : 1);
    expect(w.journal.view.summaries).toHaveLength(unavailable ? 0 : 1);
    if (!unavailable) {
      expect(w.journal.view.summaries[0]?.through).toBe(367054864);
      expect(w.journal.view.summaries[0]?.faithfulness).toEqual({ path: 'subscription', verdict: 'pass', score: null });
    }
  } finally { w.close(); }
});
