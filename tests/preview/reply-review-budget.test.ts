import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fixture from './fixtures/forum-review-budget-2026-10-10.json' with { type: 'json' };
import { subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { readAnswer } from './answer-reading.js';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { GROUP_REVIEW_FINAL_NOTICE, HOLDING_REPLY, parseReplyReviewVerdict, replyReviewQuestion } from './reply-check.js';

const rules = ['parks_on_user', 'defers_work', 'self_state_claim', 'breaks_preference', 'sensitive_disclosure'] as const;
const original = JSON.parse(fixture.original.input);
const packet = JSON.parse(original.messages.find((m: { role: string }) => m.role === 'context').content).packet;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it('replays the actual over-cap forum review and its real bounded-prompt replacement under the same provider allowance', () => {
  const limit = subscriptionConversationPolicy('claude-sonnet-5').maxTokens;
  expect(fixture.original).toMatchObject({ outcome: 'uncertain', output: null, usage: { outputTokens: 2136 } });
  expect(fixture.original.usage.outputTokens).toBeGreaterThan(limit);
  expect(fixture.recorded.intent.text).toBe(HOLDING_REPLY);
  const prepared = structuredClone(original);
  prepared.messages.find((m: { role: string }) => m.role === 'user').content = replyReviewQuestion(rules);
  expect(createHash('sha256').update(JSON.stringify(prepared)).digest('hex')).toBe(fixture.replay.inputSha256);
  expect(fixture.replay).toMatchObject({ code: 0, subtype: 'success', is_error: false });
  expect(fixture.replay.usage.output_tokens).toBeLessThanOrEqual(limit);
  const read = readAnswer(fixture.replay.output);
  expect(read.ok).toBe(true);
  if (!read.ok) throw Error(read.defect);
  const review = parseReplyReviewVerdict(read.value, rules);
  expect(review.verdict).toBe('pass');
  expect(review.findings?.map(f => f.rule)).toEqual(rules);
  // Requested brevity is not a new parser veto: this real model still wrote a reason over 160 characters.
  expect(review.findings?.some(f => f.reason.length > 160)).toBe(true);
});

it.each(['complete', 'uncertain'] as const)('the real forum candidate %s review sends one answer or final notice, including restart', async state => {
  const root = mkdtempSync(join(tmpdir(), 'review-budget-')); roots.push(root);
  const path = join(root, 'journal'), key = new Uint8Array(32).fill(41);
  const genesis = { kind: 'genesis' as const, bot: '8994258214', chat: packet.audience.chat,
    operator: packet.audience.operator, forum: true as const, grant: 'grant:offline', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
  const sent: string[] = [];
  let reviews = 0, answers = 0;
  const ports = { now: () => 1791658291593, stopped: () => false,
    prepareModel: () => JSON.stringify({ messages: [{ role: 'user', content: packet.operatorMessage },
      { role: 'context', content: JSON.stringify({ packet }) }] }),
    model: async () => { answers++; return packet.candidateReply as string; },
    checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return 23; },
    replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: JSON.parse(fixture.jev.output), latencyMs: 210 }),
      escalate: async () => {
        reviews++;
        if (state === 'uncertain') throw Error('preview: reply review unavailable');
        const read = readAnswer(fixture.replay.output); if (!read.ok) throw Error(read.defect);
        return { ...parseReplyReviewVerdict(read.value, rules), confidence: null, latencyMs: 1 };
      } },
  };
  const journal = openPreviewJournal(path, key, genesis);
  const worker = createJournalWorker(journal, ports);
  worker.intake([{ update_id: fixture.update, message: { message_id: 22,
    chat: { id: Number(genesis.chat), type: 'supergroup', is_forum: true },
    from: { id: Number(genesis.operator) }, text: packet.operatorMessage } }]);
  await worker.drain();
  expect(sent).toEqual([state === 'complete' ? packet.candidateReply : GROUP_REVIEW_FINAL_NOTICE]);
  expect(journal.view.order[0]?.answer).toBe(packet.candidateReply);
  expect(journal.view.calls).toBe(2);
  journal.close();
  const replay = openPreviewJournal(path, key);
  await createJournalWorker(replay, ports).drain();
  expect(sent).toHaveLength(1); expect(answers).toBe(1); expect(reviews).toBe(1);
  replay.close();
});

it('retains the recorded shared-audience refusal and coherent/fragment decisions with the shorter ask', () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/group-audience-live-2026-10-10.json', import.meta.url), 'utf8'));
  for (const sample of capture.samples) {
    const reading = readAnswer(sample.raw); if (!reading.ok) throw Error(reading.defect);
    const verdict = parseReplyReviewVerdict(reading.value, sample.rules);
    expect(verdict.verdict).toBe(['shared', 'fragment'].includes(sample.name) ? 'violation' : 'pass');
  }
});
