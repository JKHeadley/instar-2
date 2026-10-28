// Replay of candidate-20261027-T1, update 969390645. The answer and quoted
// objection are excerpts from that copy; the review and timeout durations are
// its recorded model-call outcomes. No Telegram or provider is used here.
import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { HOLDING_REPLY, REPLY_CHECK_BUDGET_MS, REPLY_RULES, type ReplyRule } from './reply-check.js';

const key = new Uint8Array(32).fill(71);
const start = 1793170450553; // T1's reply-Jev reserve, the shared deadline origin.
const unsupported = 'My recursive workspace scan found no files, so I could not inspect the installation code or journal.';
const answer = `Justin, the evidence does not establish that Instar is better than these alternatives. Its strongest proposed reason to choose it is continuity: keeping your corrections, instructions and unfinished commitments usable over time. That is worth testing, but I cannot honestly promise it never loses coherence.\n\nI checked current capabilities first:\n• Working in this turn: shell commands, workspace inspection, live web search and page reads. ${unsupported}\n\nTwo practical tasks to try tonight:\n1. Compare three options for a purchase using current official specifications and prices.\n2. Give me a short project brief, correct it, then ask for the current brief in a fresh conversation.`;
const finding = { rule: 'unrecorded_blocker' as const, verdict: 'violation' as const,
  reason: '"I could not inspect the installation code or journal" declares a limit with no blocker or settled investigation record.' };

async function replay(coherent: boolean) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 't1-review-budget-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: '8993213212',
      chat: '7812716706', operator: '7812716706', grant: 'grant:preview', configurationDigest: 'sha256:offline',
      expires: 9999999999999, maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 409600, cursor: 46040736 });
    const clock = { now: start }, sent: string[] = [], reviews: { text: string; deadline?: number }[] = [], revisionDeadlines: number[] = [];
    const scores = { model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(REPLY_RULES)
      .filter(rule => rule !== 'incoherent_remainder').map(rule => [rule, { type: 'noul', noul: rule === 'unrecorded_blocker' ? 0.95 : 0.01 }])) };
    const worker = createJournalWorker(journal, { now: () => clock.now, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:preview', clock.now),
      model: async () => JSON.stringify({ reply: answer, memory: [] }), checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 0, jev: async () => { clock.now = start; return { value: scores, latencyMs: 516 }; },
        escalate: async (text: string, _id: string, _prompt?: string, _rules?: readonly ReplyRule[], deadline?: number) => {
          reviews.push({ text, ...(deadline === undefined ? {} : { deadline }) });
          if (reviews.length === 1) {
            clock.now += 17_507; // recorded first review latency
            return { verdict: 'violation' as const, ruleIds: ['unrecorded_blocker'] as ReplyRule[], confidence: null,
              latencyMs: 17_507, reason: `unrecorded_blocker: ${finding.reason}`, findings: [finding] };
          }
          expect(deadline).toBe(start + REPLY_CHECK_BUDGET_MS);
          expect(text).not.toContain(unsupported);
          clock.now += 15_000;
          return coherent
            ? { verdict: 'pass' as const, ruleIds: [] as ReplyRule[], confidence: null, latencyMs: 15_000 }
            : { verdict: 'violation' as const, ruleIds: ['incoherent_remainder'] as ReplyRule[], confidence: null,
              latencyMs: 15_000, reason: 'Removing the claim leaves an incoherent answer.' };
        },
        revise: async ({ deadlineAt }: { deadlineAt?: number }) => {
          // The real revision ran 41,671 ms and ended uncertain. This provider
          // honors the tighter deadline while reproducing that uncertain result.
          revisionDeadlines.push(deadlineAt!);
          clock.now = deadlineAt! + 443;
          return { state: 'uncertain' as const };
        } },
      send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; } });
    worker.intake([{ update_id: 46040737, message: { chat: { id: 7812716706, type: 'private' },
      from: { id: 7812716706 }, text: 'Compare Instar with alternatives and end with two practical tasks.',
      date: Math.floor((start - 1000) / 1000) } }]);
    await worker.drain();
    const turn = journal.view.order.at(-1)!;
    const result = { sent, reviews, revisionDeadlines, heldReview: turn.heldReview, release: turn.release,
      revision: turn.revision, revisionReview: turn.revisionReview };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

it('delivers T1’s coherent comparison after the named unsupported claim is removed', async () => {
  const result = await replay(true);
  expect(result.revision?.state).toBe('uncertain');
  expect(result.revisionDeadlines).toEqual([start + REPLY_CHECK_BUDGET_MS - 25_000]);
  expect(result.reviews).toHaveLength(2);
  expect(result.sent).toHaveLength(1);
  expect(result.sent[0]).toContain('Two practical tasks to try tonight');
  expect(result.sent[0]).not.toContain(unsupported);
  expect(result.heldReview).toBeUndefined();
  expect(result.release?.withheld?.removed).toEqual([unsupported]);
});

it('still holds T1’s answer if the scoped remainder is incoherent', async () => {
  const result = await replay(false);
  expect(result.reviews).toHaveLength(2);
  expect(result.sent).toEqual([HOLDING_REPLY.replace(/^PREVIEW — /u, '')]);
  expect(result.heldReview?.withheld?.removed).toEqual([unsupported]);
});
