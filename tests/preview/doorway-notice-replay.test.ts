import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import type { ReplyNotice } from './credential-reminders.js';
import { HOLDING_REPLY, parseReplyReviewVerdict, type ReplyRule } from './reply-check.js';
import { readAnswer } from './answer-reading.js';

// The retained answer-check copy is never run. This replays update 715675469's exact
// answer/review shapes through a fresh offline journal, with the notice it recorded. The runner no longer
// offers a doorway notice (Rules 56, 87, 88: status only), so the recorded one stands in for any reply notice.
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}-2026-10-11.json`, import.meta.url), 'utf8'));
const captured = read('doorway-notice-held');
const repaired = read('doorway-notice-repaired-review');
const offload = read('doorway-notice-offload-review');
// The line in its last shipped wording (the recorded one also said 'send "status" for detail'), under the recorded key.
const notice = (): ReplyNotice[] => [{ key: captured.answerNotices[0].key,
  line: 'Model route check: typesafe-jev/jev-1.13.0 is unverified.' }];

it('replays the recorded held notice shape', () => {
  expect(captured.answerNotices[0].line.startsWith(notice()[0]!.line.slice(0, -1))).toBe(true);
  expect(captured.replyChecks[0]).toMatchObject({ verdict: 'unsure', scores: { parks_on_user: 0.69, defers_work: 0.57 } });
  expect(captured.replyChecks[1].ruleIds).toEqual(['parks_on_user', 'defers_work']);
  expect(captured.revisionReview.verdict).toBe('unavailable');
  expect(captured.delivered).toBe(HOLDING_REPLY);
});

it.each(['original', 'repaired', 'offload'] as const)('replays the real %s review through the send checkpoint and restart', async mode => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'notice-replay-'))), key = new Uint8Array(32).fill(48);
  const path = join(root, 'journal.encrypted');
  const raw = mode === 'original' ? null : mode === 'repaired' ? repaired : offload;
  const reading = raw && readAnswer(raw.raw);
  if (reading) expect(reading.ok).toBe(true);
  const review = reading?.ok ? parseReplyReviewVerdict(reading.value, raw.rules as ReplyRule[])
    : captured.replyChecks[1];
  const candidate = mode === 'original' ? captured.answer : raw.candidate;
  const sends: string[] = [], reviews: string[] = [];
  const ports = {
    now: () => captured.at, stopped: () => false,
    prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) =>
      prepareJournalEnvelope(input, 'claude-sonnet-5', 'grant:replay', captured.at),
    model: async () => mode === 'repaired' ? captured.revision.text : candidate,
    ...(mode === 'repaired' ? { replyNotices: notice } : {}),
    checkOutbound: () => {},
    replyCheck: { elapsedMs: () => 0,
      // Keep the ORIGINAL unsure scores even on the repaired wording, so the stronger
      // review must still run; a favorable Jev score cannot explain a passing replay.
      jev: async () => ({ value: { model: 'jev-1.13.0', answers: Object.fromEntries(
        Object.entries(captured.replyChecks[0].scores).map(([rule, noul]) => [rule, { type: 'noul', noul }])) }, latencyMs: 226 }),
      ...(mode === 'original' ? { revise: async () => captured.revision } : {}),
      escalate: async (text: string, _id: string, _prompt?: string, _rules?: readonly ReplyRule[], _deadline?: number,
        operation?: 'revision') => {
        if (operation === 'revision') throw Error('recorded revision review unavailable');
        reviews.push(text);
        return { verdict: review.verdict, ruleIds: review.ruleIds, findings: review.findings,
          reason: review.reason, confidence: null, latencyMs: 1 };
      } },
    send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; },
  };
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '-1001234', forum: true,
    operator: '7654321', grant: 'grant:replay', configurationDigest: 'sha256:offline', expires: captured.at + 100000,
    maxCalls: 12, maxReplies: 3, maxTurns: 3, maxBytes: 32768, cursor: 0 });
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: captured.update, message: { chat: { id: -1001234, type: 'supergroup', is_forum: true },
      from: { id: 7654321 }, text: captured.operatorText } }]);
    await worker.drain();
    expect(reviews).toEqual([candidate]);
    expect(sends).toEqual([mode === 'original' ? HOLDING_REPLY : candidate]);
    expect(journal.view.order[0]!.replyChecks?.at(-1)?.verdict).toBe(mode === 'repaired' ? 'pass' : 'violation');
    expect(journal.view.order[0]!.replyChecks?.map(check => check.path)).toEqual(['jev', 'subscription']);
    if (mode === 'repaired') expect(journal.view.order[0]!.answerNotices).toEqual(notice());
    journal.close();
    journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain();
    expect(sends).toHaveLength(1);
    expect(reviews).toHaveLength(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
