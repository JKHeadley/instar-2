// Plan #593: about a third of subscription-path reply checks ended "unavailable" on 2026-10-05. Every failed
// review call in those runs was a local 'timeout' kill at the shared reply-check deadline (one 'output-cap'),
// never a provider error: the slowest reviews ran past 30 s, and a malformed first verdict left too little time
// for its one format re-ask. These replays use the recorded latencies (update ids below) against a stub that is
// killed at the requested deadline exactly as the installed route is, and prove both sides of the budget:
// a review that fits the budget now yields a verdict; one that does not stays an honest "unavailable".
import { expect, it } from 'vitest';
import { checkReply, REPLY_CHECK_BUDGET_MS, REPLY_CHECK_BUDGET_REASON, REPLY_RULES, REVIEW_MALFORMED,
  type ReplyCheckResult } from './reply-check.js';

const scores = (overrides: Record<string, number> = {}) => ({ model: 'jev-1.13.0', answers: Object.fromEntries(
  Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: overrides[id] ?? 0.01 }])) });

/** One reply check on a fake clock. Each review call takes its recorded latency, but is killed at the deadline it
 * was given (the subscription route's local timeout), which surfaces as a thrown error. */
async function replay(latencies: { jevMs: number; reviews: { ms: number; outcome: 'pass' | 'malformed' }[] },
  budgetMs = REPLY_CHECK_BUDGET_MS) {
  let now = 1_790_000_000_000;
  const records: ReplyCheckResult[] = [];
  let calls = 0, retries = 0;
  const deadlineAt = now + budgetMs;
  const decision = await checkReply('PREVIEW — candidate', 'turn:1', {
    now: () => now, elapsedMs: () => now, deadlineAt,
    jev: async () => { now += latencies.jevMs; return { value: scores({ parks_on_user: 0.55 }), latencyMs: latencies.jevMs }; },
    reserveEscalation: () => true,
    reserveFormatRetry: () => { retries++; return true; },
    escalate: async (_text, _id, _prompt, _rules, deadline) => {
      const review = latencies.reviews[calls++];
      if (!review) throw Error('unexpected review');
      const limit = (deadline ?? Infinity) - now;
      if (review.ms > limit) { now += Math.max(0, limit); throw Error('preview: reply review unavailable'); }
      now += review.ms;
      if (review.outcome === 'malformed') throw Error(REVIEW_MALFORMED);
      return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: review.ms };
    },
    record: row => records.push(row),
  });
  return { decision, last: records.at(-1), calls, retries };
}

// telegram:8994258214:update:715674330 (rc-1 d03ac9f2, proof room 1): Jev 227 ms unsure, review 26170 ms returned a
// prose-wrapped verdict, its re-ask was dispatched with under 3 s left and killed at 92 ms. The re-ask latency is
// unrecorded (killed); 20 s is inside the measured range of completed reviews (9.4-26.8 s).
const malformedThenReask = { jevMs: 227, reviews: [{ ms: 26170, outcome: 'malformed' as const }, { ms: 20000, outcome: 'pass' as const }] };

it('lets the one format re-ask of a slow malformed review finish inside the budget (update 715674330)', async () => {
  const { decision, last, calls, retries } = await replay(malformedThenReask);
  expect(calls).toBe(2);
  expect(retries).toBe(1);
  expect(decision).toEqual({ outcome: 'pass', path: 'subscription' });
  expect(last).toMatchObject({ verdict: 'pass', path: 'subscription' });
});

it('the same recorded shape under the former 30 s budget ends unavailable (the measured failure)', async () => {
  const { decision, last } = await replay(malformedThenReask, 30_000);
  expect(decision).toEqual({ outcome: 'unavailable', path: 'subscription' });
  expect(last).toMatchObject({ verdict: 'unavailable', path: 'subscription' });
});

// telegram:8989505249:update:6232462 / 6232451 / 6232488: the first review was killed by the deadline after 28.4-28.7 s
// of process time. A review needing 35 s now completes; one needing longer than the whole budget stays unavailable,
// recorded with the budget reason, and is never treated as a pass.
it.each([
  ['completes when it fits the budget', 35_000, 'pass', undefined],
  ['stays unavailable, with the budget reason, when it exceeds the budget', REPLY_CHECK_BUDGET_MS, 'unavailable', REPLY_CHECK_BUDGET_REASON],
] as const)('a slow first review %s', async (_label, ms, outcome, reason) => {
  const { decision, last } = await replay({ jevMs: 191, reviews: [{ ms, outcome: 'pass' }] });
  expect(decision.outcome).toBe(outcome);
  expect(last?.verdict).toBe(outcome);
  expect(last?.reason).toBe(reason);
});

it('a malformed review whose re-ask cannot fit stays unavailable rather than passing unchecked', async () => {
  const { decision, last } = await replay({ jevMs: 200, reviews: [{ ms: 26808, outcome: 'malformed' }, { ms: 40_000, outcome: 'pass' }] });
  expect(decision).toEqual({ outcome: 'unavailable', path: 'subscription' });
  expect(last).toMatchObject({ verdict: 'unavailable', path: 'subscription', reason: REPLY_CHECK_BUDGET_REASON });
});

it('the budget holds the slowest measured review plus its re-ask', () => {
  // Slowest completed first review on 2026-10-05: 26808 ms (update 6232450); slowest Jev reply check: 261 ms.
  expect(REPLY_CHECK_BUDGET_MS).toBeGreaterThan(261 + 2 * 26808);
});
