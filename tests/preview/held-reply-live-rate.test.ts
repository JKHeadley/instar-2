import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MODEL_FAILURE_REPLY, openPreviewJournal, UNKNOWN_ANSWER_NOTICE } from './journal-test-worker.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { REPLY_RULES } from './reply-check.js';

interface CapturedTurn { update: number; text: string; cause: string; workerShape: string;
  reviewOutcome?: { role: string; localLimit: string; exitCode: number; outputTokens: number; promptBytes: number } }
const captured = JSON.parse(readFileSync(new URL('./fixtures/held-reply-live-2026-09-27.json', import.meta.url), 'utf8')) as {
  limits: { maxCalls: number; maxReplies: number; maxTurns: number; maxBytes: number };
  held: CapturedTurn[]; unknownReviewCount: number; unknownSendCount: number };
const key = new Uint8Array(32).fill(27);
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-live-hold-')));
const genesis = () => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:offline', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
  ...captured.limits, cursor: 0 });
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, date: 1_790_500_000, text } });
const scores = (uncertain: boolean) => ({ model: 'jev-1.13.0', answers: Object.fromEntries(
  Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: uncertain && id === 'parks_on_user' ? 0.55 : 0.01 }])) });

for (const fixture of captured.held) {
  it(`replays held live update ${fixture.update} with its observed cause and one paid review`, async () => {
    const dir = root(), path = join(dir, 'journal.encrypted');
    try {
      const journal = openPreviewJournal(path, key, genesis());
      let models = 0, answerCalls = 0, reviews = 0, sends = 0;
      const worker = createJournalWorker(journal, { now: () => 1_790_510_000_000, stopped: () => false,
        prepareModel: input => prepareJournalEnvelope(input, 'offline-model', 'grant:offline', 1_790_510_000_000,
          captured.limits.maxBytes),
        model: async input => { models++; if (!input.id.startsWith('summary:')) answerCalls++;
          return fixture.workerShape.startsWith('ended uncertain')
          ? { state: 'uncertain' as const }
          : { state: 'rejected' as const, failureClass: 'rejected' as const }; },
        replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: scores(true), latencyMs: 15 }),
          escalate: async (_candidate, _id, prompt) => { reviews++;
            expect(prompt).toContain(fixture.text);
            throw Error(fixture.reviewOutcome ? 'review output-cap' : 'review result unknown'); } },
        checkOutbound: () => {}, send: async () => { sends++; return 1; } });
      worker.intake([update(fixture.update, fixture.text)]);
      await worker.drain();
      const turn = journal.view.order[0]!;
      expect(turn.raw).toContain(fixture.text);
      expect(turn.held).toBe(fixture.cause);
      expect(turn.answer).toBe(fixture.workerShape.startsWith('ended uncertain') ? undefined : MODEL_FAILURE_REPLY);
      expect(turn.noticeClass).toBe(fixture.workerShape.startsWith('ended uncertain') ? 'unknown-answer' : undefined);
      expect(turn.replyChecks?.at(-1)).toMatchObject({ verdict: 'unavailable', path: 'subscription' });
      if (fixture.reviewOutcome) {
        expect(fixture.reviewOutcome).toMatchObject({ role: 'reply-review', localLimit: 'output-cap',
          exitCode: 0, outputTokens: 3617, promptBytes: 79561 });
      }
      expect({ answerCalls, reviews, sends, replies: journal.view.replies })
        .toEqual({ answerCalls: 1, reviews: 1, sends: 0, replies: 0 });
      const callsBeforeReplay = journal.view.calls, modelsBeforeReplay = models;
      journal.close();
      const reopened = openPreviewJournal(path, key);
      const resumed = createJournalWorker(reopened, { now: () => 1_790_510_000_001, stopped: () => false,
        model: async () => { models++; return 'duplicate'; },
        replyCheck: { elapsedMs: () => 101, jev: async () => { throw Error('duplicate Jev'); },
          escalate: async () => { reviews++; throw Error('duplicate review'); } },
        checkOutbound: () => {}, send: async () => { sends++; return 2; } });
      await resumed.drain();
      expect({ held: reopened.view.order[0]?.held, models, reviews, sends, calls: reopened.view.calls })
        .toEqual({ held: fixture.cause, models: modelsBeforeReplay, reviews: 1, sends: 0,
          calls: callsBeforeReplay });
      reopened.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

it('keeps the saved four-hold and three-unknown-review denominator explicit', () => {
  expect(captured.held.map(turn => turn.update)).toEqual([969389576, 969389578, 969389581, 969389583]);
  expect(captured.unknownReviewCount).toBe(3);
  expect(captured.held.filter(turn => turn.workerShape.startsWith('ended uncertain'))).toHaveLength(3);
  expect(captured.held.filter(turn => turn.reviewOutcome?.localLimit === 'output-cap')).toHaveLength(1);
});

it('releases a loss notice after completed full-context PASS and keeps the answer UNKNOWN', async () => {
  const dir = root();
  try {
    const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis());
    let sent = '';
    const worker = createJournalWorker(journal, { now: () => 1_790_510_000_000, stopped: () => false,
      prepareModel: input => prepareJournalEnvelope(input, 'offline-model', 'grant:offline', 1_790_510_000_000,
        captured.limits.maxBytes),
      model: async () => ({ state: 'uncertain' as const }),
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: scores(true), latencyMs: 15 }),
        escalate: async () => ({ verdict: 'pass' as const, ruleIds: [], confidence: null, latencyMs: 20 }) },
      checkOutbound: () => {}, send: async input => { sent = input.expectedText; return 7; } });
    worker.intake([update(969389576, captured.held[0]!.text)]);
    await worker.drain();
    expect(journal.view.order[0]).toMatchObject({ modelState: 'uncertain', sent: 7 });
    expect(journal.view.order[0]?.held).toBeUndefined();
    expect(sent).toBe(`PREVIEW — ${UNKNOWN_ANSWER_NOTICE}`);
    journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('keeps the captured one uncertain send fenced after journal replay', async () => {
  const dir = root(), path = join(dir, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis());
    let sends = 0;
    const worker = createJournalWorker(journal, { now: () => 1_790_510_000_000, stopped: () => false,
      model: async () => 'safe ordinary reply', checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: scores(false), latencyMs: 15 }),
        escalate: async () => { throw Error('unexpected review'); } },
      send: async () => { sends++; return null; } });
    // The status capture counts one UNKNOWN send but does not attribute it to an update.
    worker.intake([update(969389590, 'offline ordinary turn for unattributed send')]);
    await worker.drain(); journal.close();
    const reopened = openPreviewJournal(path, key);
    const resumed = createJournalWorker(reopened, { now: () => 1_790_510_000_001, stopped: () => false,
      model: async () => { throw Error('duplicate model'); }, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 101, jev: async () => { throw Error('duplicate Jev'); },
        escalate: async () => { throw Error('duplicate review'); } },
      send: async () => { sends++; return 8; } });
    await resumed.drain();
    expect(captured.unknownSendCount).toBe(1);
    expect({ sends, replies: reopened.view.replies, intent: reopened.view.order[0]?.intent,
      sent: reopened.view.order[0]?.sent }).toEqual({ sends: 1, replies: 1,
        intent: 'PREVIEW — safe ordinary reply', sent: undefined });
    reopened.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
