// Repair round 2b (observer note 54): about 1 in 9 real answers wrote prose instead of the required Decision and
// was refused, so the operator read "I couldn't produce an answer". The worker now re-asks the same turn ONCE with a
// runner-authored format reminder, reserved under the same call cap and only while not stopped; a second miss is
// refused exactly as before. The reply-review verdict gets the same single re-ask. Rules 42, 75, 116; floors:
// spend cap, stop, no duplicate sends.
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { ANSWER_FORMAT_REMINDER, MODEL_FAILURE_REPLY } from './journal.js';
import { conclusionText, parseModelJson } from './model-json.js';
import { REPLY_RULES, REVIEW_MALFORMED, reviewReply, type ReplyCheckResult } from './reply-check.js';

const key = new Uint8Array(32).fill(54);
const usage = { inputTokens: 10, outputTokens: 5, charge: null };
const malformed = { state: 'complete' as const, failureClass: 'malformed' as const, usage };
const scores = (overrides: Record<string, number> = {}) => ({ model: 'jev-1.13.0', answers: Object.fromEntries(
  Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: overrides[id] ?? 0.01 }])) });
type Answer = typeof malformed | string;
type Escalation = 'malformed' | 'pass' | 'unavailable';

async function run(options: { maxCalls: number; answers: Answer[]; reviews?: Escalation[]; stopAfterModel?: number;
  stopInReview?: boolean }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-format-retry-')));
  const path = join(root, 'journal.encrypted');
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: options.maxCalls,
    maxReplies: 4, maxTurns: 4, maxBytes: 32768, cursor: 0 });
  const inputs: { question: string; context: Record<string, unknown> }[] = [], sent: string[] = [];
  const retryFlags: (boolean | undefined)[] = [];
  let stopped = false, reviewCalls = 0;
  const reviews = options.reviews;
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => stopped,
    model: async input => {
      inputs.push({ question: input.question, context: JSON.parse(input.context) as Record<string, unknown> });
      if (inputs.length === options.stopAfterModel) stopped = true;
      const answer = options.answers[inputs.length - 1];
      if (answer === undefined) throw Error('model called beyond the test script');
      return typeof answer === 'string' ? { state: 'complete' as const, text: answer, usage } : answer;
    },
    send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {},
    ...(reviews ? { replyCheck: { elapsedMs: () => 100,
      jev: async () => ({ value: scores({ credential: 0.57 }), latencyMs: 150 }),
      escalate: async (_text: string, _id: string, _prompt?: string, _rules?: unknown, _deadline?: number, _operation?: 'revision', formatRetry?: boolean) => {
        retryFlags.push(formatRetry);
        const outcome = reviews[reviewCalls++];
        if (options.stopInReview) stopped = true;
        if (outcome === 'malformed') throw Error(REVIEW_MALFORMED);
        if (outcome !== 'pass') throw Error('preview: reply review unavailable');
        return { verdict: 'pass' as const, ruleIds: [] as [], confidence: null, latencyMs: 400 };
      } } } : {}) });
  worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
    text: 'What should I pack for the trip?' } }]);
  let drainError: unknown;
  await worker.drain().catch((error: unknown) => { drainError = error; });
  return { journal, path, inputs, sent, retryFlags, drainError, turn: journal.view.order[0]!,
    close: () => { journal.close(); rmSync(root, { recursive: true, force: true }); } };
}

it('re-asks a format-missed answer once, with the reminder in the packet, and sends the corrected reply', async () => {
  const r = await run({ maxCalls: 4, answers: [malformed, 'Pack light layers and a rain jacket.'] });
  try {
    expect(r.drainError).toBeUndefined();
    expect(r.inputs).toHaveLength(2);
    expect(r.inputs[1]!.question).toBe(r.inputs[0]!.question);             // the operator's message is never altered
    expect(r.inputs[0]!.context).not.toHaveProperty('formatReminder');
    expect(r.inputs[1]!.context.formatReminder).toBe(ANSWER_FORMAT_REMINDER);
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).toContain('Pack light layers');
    expect(r.sent.some(text => text.includes(MODEL_FAILURE_REPLY))).toBe(false);
    expect(r.journal.view.calls).toBe(2);                                 // the re-ask is a counted call
    expect(r.turn.answerRetried).toBe(true);
    expect(r.journal.view.failureClasses.get('malformed')).toBe(1);      // the refused first call stays visible
    expect(r.journal.view.tokenTotals.answer.calls).toBe(2);
    r.journal.close();
    const replay = openPreviewJournal(r.path, key);
    expect(replay.view.calls).toBe(2);
    expect(replay.view.order[0]!.sent).toBe(1);
    replay.close();
  } finally { rmSync(join(r.path, '..'), { recursive: true, force: true }); }
});

it('refuses with the honest failure reply when the re-ask misses the format too', async () => {
  const r = await run({ maxCalls: 4, answers: [malformed, malformed] });
  try {
    expect(r.inputs).toHaveLength(2);
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).toContain(MODEL_FAILURE_REPLY.slice(0, 30));
    expect(r.turn.failureClass).toBe('malformed');
    expect(r.journal.view.calls).toBe(2);
    expect(r.journal.view.failureClasses.get('malformed')).toBe(2);
  } finally { r.close(); }
});

it('makes no re-ask when the call cap is exhausted, and refuses as before', async () => {
  const r = await run({ maxCalls: 1, answers: [malformed] });
  try {
    expect(r.inputs).toHaveLength(1);
    expect(r.journal.view.calls).toBe(1);
    expect(r.turn.answerRetried).toBeUndefined();
    expect(r.turn.answer).toBe(MODEL_FAILURE_REPLY);
  } finally { r.close(); }
});

it('makes no re-ask once the stop latch holds, and sends nothing', async () => {
  const r = await run({ maxCalls: 4, answers: [malformed], stopAfterModel: 1 });
  try {
    expect(r.inputs).toHaveLength(1);
    expect(r.journal.view.calls).toBe(1);
    expect(r.turn.answerRetried).toBeUndefined();
    expect(r.sent).toEqual([]);
    expect(String(r.drainError)).toContain('preview stopped');
  } finally { r.close(); }
});

it('re-asks a malformed review verdict once under the same cap, then releases the reviewed reply', async () => {
  const r = await run({ maxCalls: 4, answers: ['Pack light layers.'], reviews: ['malformed', 'pass'] });
  try {
    expect(r.retryFlags).toEqual([undefined, true]);
    expect(r.turn.reviewRetried).toBe(true);
    expect(r.journal.view.calls).toBe(3);
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).toContain('Pack light layers.');
    expect(r.turn.replyChecks?.at(-1)).toMatchObject({ path: 'subscription', verdict: 'pass' });
  } finally { r.close(); }
});

// Plan #102: Jev's 0.57 credential score is its unsure band, so a review that misses its format twice leaves no
// verdict and no confident secret finding: the reply is answered with the flag recorded, never held.
it('answers with the flag recorded when the review misses its format twice on an unsure credential score', async () => {
  const r = await run({ maxCalls: 4, answers: ['Pack light layers.'], reviews: ['malformed', 'malformed'] });
  try {
    expect(r.retryFlags).toEqual([undefined, true]);
    expect(r.journal.view.calls).toBe(3);
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).toContain('Pack light layers.');
    expect(r.turn.held).toBeUndefined();
    expect(r.turn.release).toMatchObject({ review: 'unavailable', objections: ['credential'] });
  } finally { r.close(); }
});

it('makes no review re-ask when the call cap is exhausted', async () => {
  const r = await run({ maxCalls: 2, answers: ['Pack light layers.'], reviews: ['malformed'] });
  try {
    expect(r.retryFlags).toEqual([undefined]);
    expect(r.journal.view.calls).toBe(2);
    expect(r.turn.reviewRetried).toBeUndefined();
    expect(r.sent).toHaveLength(1);
    expect(r.turn.release).toMatchObject({ review: 'unavailable', objections: ['credential'] });
  } finally { r.close(); }
});

it('makes no review re-ask once the stop latch holds', async () => {
  const r = await run({ maxCalls: 4, answers: ['Pack light layers.'], reviews: ['malformed'], stopInReview: true });
  try {
    expect(r.retryFlags).toEqual([undefined]);
    expect(r.journal.view.calls).toBe(2);
    expect(r.turn.reviewRetried).toBeUndefined();
    expect(r.sent).toEqual([]);
  } finally { r.close(); }
});

it('re-asks only a format miss: a reviewer outage is not retried', async () => {
  const records: ReplyCheckResult[] = [];
  let reserved = 0, calls = 0;
  const decision = await reviewReply('candidate', 'turn:1', { elapsedMs: () => 0, jev: async () => ({ value: null, latencyMs: 0 }),
    reserveEscalation: () => true, reserveFormatRetry: () => { reserved++; return true; },
    escalate: async () => { calls++; throw Error('preview: reply review unavailable'); }, record: row => records.push(row) }, []);
  expect(decision.outcome).toBe('unavailable');
  expect([calls, reserved]).toEqual([1, 0]);
});

it('refuses a format-retry record that no reserved, unanswered turn can carry', async () => {
  const r = await run({ maxCalls: 4, answers: ['Pack light layers.'] });
  try {
    expect(() => r.journal.append({ kind: 'format-retry', id: r.turn.id, role: 'answer', state: 'complete',
      failureClass: 'malformed', at: 1000 })).toThrow('format retry order or cap');
  } finally { r.close(); }
});

it('re-asks a format miss and sends the model\'s real bare answer, while the real prose residual needs no re-ask', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/live-declarations-2026-09-28.json', import.meta.url), 'utf8')) as {
    fixed: { answers: string[] }; fixedResidualProse: string };
  const runnerText = (raw: string, wrapped: 'accept' | 'refuse' = 'accept'): string | null => {
    const parsed = parseModelJson(raw, { wrapped });
    const decision = parsed.ok ? parsed.value as { type?: unknown; conclusion?: { subject?: unknown; value?: unknown } } : null;
    return decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
      ? conclusionText(decision.conclusion.value) : null;
  };
  // This real residual was refused for its leading prose. The answer side now reads it (Rules 15, 77), so this
  // shape costs no re-ask; a gate still refuses it. The retry below is driven by a shape still malformed either way.
  expect(runnerText(fixture.fixedResidualProse)).not.toBeNull();
  expect(runnerText(fixture.fixedResidualProse, 'refuse')).toBeNull();
  const retried = runnerText(fixture.fixed.answers[3]!)!;
  const r = await run({ maxCalls: 4, answers: [malformed, retried] });
  try {
    expect(r.inputs).toHaveLength(2);
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).toContain((JSON.parse(retried) as { reply: string }).reply.replace(/^PREVIEW:\s*/u, '').slice(0, 40));
    expect(r.turn.answerRetried).toBe(true);
  } finally { r.close(); }
});
