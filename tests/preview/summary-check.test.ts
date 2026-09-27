import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { JEV_MODEL, REPLY_RULES } from './reply-check.js';
import { interpretSummaryJev, SUMMARY_QUESTION } from './summary-check.js';

const key = new Uint8Array(32).fill(31);
const genesis = (maxCalls = 12) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls, maxReplies: 12, maxTurns: 12, maxBytes: 32768, cursor: 0 });
const replyScores = () => Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: 0 }]));
const jevAnswer = (score: number) => ({ model: JEV_MODEL, answers: { summary_integrity: { type: 'noul', noul: score } } });

async function caseRun(score: number | 'unavailable', review: 'pass' | 'violation' | 'unavailable' | 'definite-unavailable' = 'pass', maxCalls = 12) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-check-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis(maxCalls));
  let summaryChecks = 0, reviews = 0, observed = '';
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
    model: async input => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'On 26 September, Justin asked us to remember the launch.', people: [], commitments: [], memory: [] })
      : 'I will remember the launch.',
    send: async () => 1, checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 100,
      jev: async (state, questions) => {
        if (!questions) return { value: { model: JEV_MODEL, answers: replyScores() }, latencyMs: 10 };
        expect(questions).toEqual(SUMMARY_QUESTION);
        observed = state; summaryChecks++;
        if (score === 'unavailable') throw Error('TypeSafe unavailable');
        return { value: jevAnswer(score), latencyMs: 20 };
      },
      escalate: async () => { throw Error('reply escalation not expected'); },
      summaryReview: async state => {
        reviews++; expect(state).toContain('Justin asked us to remember the launch');
        if (review === 'unavailable') throw Error('review outcome unknown');
        if (review === 'definite-unavailable') return { verdict: 'unavailable' as const, retryable: true as const, latencyMs: 30 };
        return { verdict: review, latencyMs: 30 };
      } } });
  worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text: 'On 26 September, remember the launch.' } }]);
  await worker.drain(); await worker.summarizeIfNeeded(true);
  return { root, journal, worker, get summaryChecks() { return summaryChecks; }, get reviews() { return reviews; }, get observed() { return observed; } };
}

it('classifies Jev pass, violation, uncertainty and malformed output', () => {
  expect(interpretSummaryJev(jevAnswer(0.1), 1).verdict).toBe('pass');
  expect(interpretSummaryJev(jevAnswer(0.9), 1).verdict).toBe('violation');
  expect(interpretSummaryJev(jevAnswer(0.5), 1).verdict).toBe('unsure');
  expect(() => interpretSummaryJev(jevAnswer(Number.NaN), 1)).toThrow();
});

it.each([0.05, 0.9, 0.5])('accepts only a passing Jev or full-context review (%s)', async score => {
  const run = await caseRun(score);
  try {
    expect(run.journal.view.summaries).toHaveLength(1);
    expect(run.summaryChecks).toBe(1);
    expect(run.reviews).toBe(score === 0.05 ? 0 : 1);
    expect(run.observed).toContain('On 26 September, remember the launch.');
    expect(run.journal.view.summaryCheckCounts.pass).toBe(1);
    run.journal.close();
    const replay = openPreviewJournal(join(run.root, 'journal.encrypted'), key);
    expect(replay.view.summaries).toHaveLength(1);
    expect(replay.view.summaryCheckCounts.pass).toBe(1);
    replay.close();
  } finally { rmSync(run.root, { recursive: true, force: true }); }
});

it.each([[0.9, 'violation'], ['unavailable', 'pass']])('keeps the prior frontier on %s / %s', async (score, review) => {
  const run = await caseRun(score as number | 'unavailable', review as 'pass' | 'violation');
  try {
    expect(run.journal.view.summaries).toHaveLength(0);
    expect(run.journal.view.summaryFailures.get(1)).toBe(1);
    expect(run.journal.view.order[0]?.text).toContain('remember the launch');
    expect(run.journal.view.summaryCheckCounts[score === 'unavailable' ? 'unavailable' : 'violation']).toBeGreaterThan(0);
    run.journal.close();
    const replay = openPreviewJournal(join(run.root, 'journal.encrypted'), key);
    expect(replay.view.summaries).toHaveLength(0);
    expect(replay.view.order).toHaveLength(1);
    replay.close();
  } finally { rmSync(run.root, { recursive: true, force: true }); }
});

it('reserves a review under the shared cap and leaves an unknown review pending', async () => {
  const run = await caseRun(0.9, 'unavailable');
  try {
    expect(run.journal.view.calls).toBe(3);
    expect(run.journal.view.summaryReservations.has(1)).toBe(true);
    expect(run.journal.view.summaries).toHaveLength(0);
    run.journal.close();
    const replay = openPreviewJournal(join(run.root, 'journal.encrypted'), key);
    expect(replay.view.summaryReservations.has(1)).toBe(true);
    replay.close();
  } finally { rmSync(run.root, { recursive: true, force: true }); }
});

it('retries a definite subscription failure without accepting the candidate', async () => {
  const run = await caseRun(0.9, 'definite-unavailable');
  try {
    expect(run.journal.view.summaries).toHaveLength(0);
    expect(run.journal.view.summaryFailures.get(1)).toBe(1);
    expect(run.journal.view.summaryReservations.size).toBe(0);
    expect(run.journal.view.summaryCheckCounts.unavailable).toBe(1);
    run.journal.close();
  } finally { rmSync(run.root, { recursive: true, force: true }); }
});

it('retries an unavailable Jev result only within the existing two-attempt frontier bound', async () => {
  const run = await caseRun('unavailable');
  try {
    await run.worker.summarizeIfNeeded(true);
    await run.worker.summarizeIfNeeded(true);
    expect(run.summaryChecks).toBe(2);
    expect(run.journal.view.summaryFailures.get(1)).toBe(2);
    expect(run.journal.view.summaries).toHaveLength(0);
    expect(run.journal.view.calls).toBe(3);
    expect(run.journal.view.order[0]?.text).toContain('remember the launch');
    run.journal.close();
  } finally { rmSync(run.root, { recursive: true, force: true }); }
});

it('does not reserve a paid review or accept a summary after stop during Jev', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-summary-stop-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    let stopped = false, reviews = 0;
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
      model: async input => input.id.startsWith('summary:') ? 'A proposed summary.' : 'ok',
      send: async () => 1, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100,
        jev: async (_state, questions) => {
          if (questions) { stopped = true; return { value: jevAnswer(0.9), latencyMs: 20 }; }
          return { value: { model: JEV_MODEL, answers: replyScores() }, latencyMs: 10 };
        },
        escalate: async () => { throw Error('unexpected reply review'); },
        summaryReview: async () => { reviews++; return { verdict: 'pass', latencyMs: 20 }; } } });
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text: 'Remember Maya on Tuesday.' } }]);
    await worker.drain();
    await expect(worker.summarizeIfNeeded(true)).rejects.toThrow('preview stopped');
    expect(reviews).toBe(0);
    expect(journal.view.calls).toBe(2);
    expect(journal.view.summaries).toHaveLength(0);
    expect(journal.view.order).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
