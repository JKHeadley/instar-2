import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer, taskFields } from './answer-reading.js';
import { GROUP_REVIEW_FINAL_NOTICE, REPLY_RULES, REVIEW_FORMAT_REMINDER, interpretJev,
  parseReplyReviewVerdict, replyReviewContext, replyReviewQuestion, type ReplyRule } from './reply-check.js';
import { interpretSummaryReview } from './summary-check.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/reply-review-budget-2026-10-10.json', import.meta.url), 'utf8'));
const rules: ReplyRule[] = fixture.rules;
// Keep the captured bytes historical. Train-6 already replaced two rule descriptions;
// act-first.test.ts requires exact current real reviewer captures, including those rules.
const historicalRules = JSON.parse(fixture.replay.question.split('on its own: ')[1].split('}. For raw_path')[0] + '}');
const retainedQuestion = fixture.replay.question
  .replace(JSON.stringify(historicalRules.parks_on_user), JSON.stringify(REPLY_RULES.parks_on_user))
  .replace(JSON.stringify(historicalRules.sensitive_disclosure), JSON.stringify(REPLY_RULES.sensitive_disclosure))
  .replace('with each reason under 300 characters; keep reasoning concise within its separate budget.',
    'with each reason under 160 characters. Keep reasoning under 400 characters and the entire JSON response under 4000 characters so every verdict fits the existing output allowance. Allocate the response to the verdicts, without repeating the rules or context.')
  .replace(taskFields('{rule_id: its verdict, one field for each listed rule, named by that rule id}', 400),
    taskFields('{rule_id: its verdict, one field for each listed rule, named by that rule id}'));

const readReview = (raw: string, selected: readonly ReplyRule[]) => {
  const answer = readAnswer(raw);
  if (!answer.ok) throw Error(answer.defect);
  return parseReplyReviewVerdict(answer.value, selected);
};

it('the other recorded forum review retains every question under the train-6 budget and parses within the provider cap', () => {
  expect(fixture.update).toBe(715675404);
  expect(fixture.originalReviewOutcome).toBe('uncertain');
  expect(fixture.originalReviewOutput).toBeNull(); // the over-cap adapter discarded the body, not a parser failure
  expect(fixture.originalPhysical).toMatchObject({ localLimit: 'output-cap', outputTokens: 2421 });
  expect(replyReviewQuestion(rules)).toBe(retainedQuestion);
  expect(replyReviewQuestion(rules)).toContain(taskFields(
    '{rule_id: its verdict, one field for each listed rule, named by that rule id}'));
  expect(REVIEW_FORMAT_REMINDER).toContain('entire response under 4000 characters');
  expect(fixture.replay.physical).toMatchObject({ localLimit: null, outputTokens: 282, subtype: 'success', isError: false });
  const verdict = readReview(fixture.replay.raw, rules);
  expect(verdict.verdict).toBe('pass');
  expect(verdict.findings?.map(finding => finding.rule)).toEqual(rules);
  expect(interpretJev(fixture.jev, 146)).toMatchObject({ verdict: 'unsure', ruleIds: ['parks_on_user', 'defers_work'] });
  // A bounded prompt grants no permission to omit a question, even after a format re-ask.
  const missing = JSON.parse(fixture.replay.raw); delete missing.sensitive_disclosure;
  expect(() => readReview(JSON.stringify(missing), rules)).toThrow();
});

it.each(['original-uncertain', 'bounded-replay'] as const)('forum worker sends once across restart with %s review', async mode => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reply-review-budget-'))), path = join(root, 'journal.encrypted');
  const key = new Uint8Array(32).fill(91), sent: string[] = [];
  const now = 1791674962885;
  let reviews = 0;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '-1001234', operator: '7654321',
    forum: true, grant: 'grant:forum', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 });
  const worker = () => createJournalWorker(journal, {
    now: () => now, stopped: () => false,
    prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:forum', now),
    model: async () => JSON.stringify({ reply: fixture.candidateReply, memory: [] }),
    checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return sent.length; },
    replyCheck: { elapsedMs: () => 0, jev: async () => ({ value: fixture.jev, latencyMs: 146 }),
      escalate: async (_text, _id, _prompt, selected) => {
        reviews++;
        expect(replyReviewQuestion(selected ?? [])).toBe(retainedQuestion);
        if (mode === 'original-uncertain') throw Error('preview: reply review unavailable');
        return { ...readReview(fixture.replay.raw, selected ?? []), confidence: null, latencyMs: 5022 };
      } },
  });
  try {
    const first = worker();
    first.intake([{ update_id: fixture.update, message: { chat: { id: -1001234, type: 'supergroup', is_forum: true },
      from: { id: 7654321 }, text: fixture.operatorMessage } }]);
    await first.drain(); await first.drain();
    expect(sent).toEqual([mode === 'original-uncertain' ? GROUP_REVIEW_FINAL_NOTICE : fixture.candidateReply]);
    expect(reviews).toBe(1);
    expect(Boolean(journal.view.order[0]?.heldReview)).toBe(mode === 'original-uncertain');
    journal.close(); journal = openPreviewJournal(path, key);
    await worker().drain();
    expect(sent).toHaveLength(1); expect(reviews).toBe(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('replays recorded summary, uncertain, Jev, review, delivered and empty shapes as data through the budgeted review context', () => {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8'));
  expect(corpus.otherShapes.map((row: { kind: string }) => row.kind)).toEqual(['summary-writer', 'summary-uncertain',
    'jev-undecided', 'jev-unsure', 'reply-review', 'delivered-reply', 'empty-reply-in-recorded-context']);
  for (const row of corpus.otherShapes as { kind: string; id: string; raw: string; source: string }[]) {
    const original = JSON.stringify({ messages: [{ role: 'user', content: fixture.operatorMessage },
      { role: 'context', content: JSON.stringify({ packet: { audience: fixture.audience,
        history: [{ id: row.id, source: row.source, answer: row.raw }] } }) }] });
    const context = JSON.parse(replyReviewContext(original, fixture.candidateReply, rules));
    expect(context.history[0].answer, row.id).toBe(row.raw);
    expect(replyReviewQuestion(rules)).toBe(retainedQuestion);
    expect(readReview(fixture.replay.raw, rules).verdict).toBe('pass');
    if (row.kind === 'summary-writer') expect(readAnswer(row.raw).ok).toBe(true);
    if (row.kind === 'summary-uncertain') expect(interpretSummaryReview(JSON.parse(row.raw), 0).verdict).toBe('unavailable');
    if (row.kind === 'jev-undecided') expect(JSON.parse(row.raw).verdict).toBe('undecided');
    if (row.kind === 'jev-unsure') expect(JSON.parse(row.raw).verdict).toBe('unsure');
    if (row.kind === 'reply-review') expect(readReview(row.raw, ['defers_work', 'self_state_claim', 'breaks_preference']).verdict).toBe('violation');
    if (row.kind === 'empty-reply-in-recorded-context') expect(readAnswer(row.raw).ok).toBe(false);
  }
  // Existing real privacy violation remains a violation; a prompt budget never changes its meaning or parsing.
  const sensitivity = JSON.parse(readFileSync(new URL('./fixtures/sensitivity-live-2026-10-03.json', import.meta.url), 'utf8'));
  const privateReview = sensitivity.samples.find((row: { scenario: string }) => row.scenario === 'group-review');
  expect(privateReview).toBeDefined();
  expect(readReview(privateReview.raw, privateReview.rules).ruleIds).toContain('sensitive_disclosure');
});
