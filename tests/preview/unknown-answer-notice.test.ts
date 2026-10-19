import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, MODEL_FAILURE_REPLY, openPreviewJournal, UNKNOWN_ANSWER_NOTICE } from './journal-test-worker.js';
import { readAnswer } from './answer-reading.js';
import { interpretJev, parseJevResponse, parseReplyReviewVerdict } from './reply-check.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/unknown-answer-notice-969390396.json', import.meta.url), 'utf8'));
const reviewAnswer = readAnswer(capture.freshReviewOutput);
if (!reviewAnswer.ok) throw Error('recorded notice review is malformed');
const review = parseReplyReviewVerdict(reviewAnswer.value, capture.reviewRules);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:notice-replay', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 131072, cursor: 0 };
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text: 'What time is sunset in Denver?' } });
const key = new Uint8Array(32).fill(42);

it('pins the new notice to actual unchanged Jev questions and candidate-only full-context review', () => {
  expect(UNKNOWN_ANSWER_NOTICE).toBe(capture.notice);
  expect(capture.provenance.update).toBe(969390396);
  expect(interpretJev(parseJevResponse(capture.recordedJevOutput), 193)).toMatchObject({ verdict: 'unsure', ruleIds: ['parks_on_user'] });
  expect(interpretJev(parseJevResponse(capture.freshJevOutput), 201).verdict).toBe('pass');
  expect(review.verdict).toBe('pass');
  expect(review.findings?.map(finding => finding.rule)).toEqual(capture.reviewRules);
});

for (const mode of ['recorded', 'fresh'] as const) {
  it(`replays ${mode} Jev scores after the recorded uncertain answer: no revision and no duplicate on reopen`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'unknown-notice-')), path = join(root, 'journal');
    let journal = openPreviewJournal(path, key, genesis), models = 0, reviews = 0, revisions = 0;
    const sent: string[] = [];
    // The exact private full-context input is replayed separately in the desk evidence.
    // This portable worker fixture keeps its audience shape and actual recorded verdict bytes.
    const prepared = JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: {
      audience: { surface: 'telegram-group-topic', operatorOnlyVerified: true }, history: [] } }) },
    { role: 'user', content: update(1).message.text }] });
    const ports = { now: () => 1000, stopped: () => false, prepareModel: () => prepared,
      model: async () => { models++; return { state: capture.modelState as 'uncertain' }; },
      checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return 1; },
      replyCheck: { elapsedMs: () => 0,
        jev: async () => ({ value: parseJevResponse(mode === 'recorded' ? capture.recordedJevOutput : capture.freshJevOutput), latencyMs: 201 }),
        escalate: async (text: string) => { reviews++; expect(text).toBe(capture.notice); return { ...review, confidence: null, latencyMs: 1 }; },
        revise: async () => { revisions++; throw Error('unexpected revision'); } } };
    try {
      const worker = createJournalWorker(journal, ports);
      worker.intake([update(capture.provenance.update)]);
      await worker.drain(); await worker.drain();
      expect({ models, reviews, revisions }).toEqual({ models: 1, reviews: 0, revisions: 0 });
      expect(sent).toEqual([capture.notice]);
      expect(journal.view.order[0]).toMatchObject({ modelState: 'uncertain', noticeClass: 'unknown-answer', sent: 1 });
      expect(journal.view.order[0]?.answer).toBeUndefined();
      journal.close(); journal = openPreviewJournal(path, key);
      await createJournalWorker(journal, ports).drain();
      expect(sent).toEqual([capture.notice]); expect(models).toBe(1); expect(revisions).toBe(0);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  });
}

it('keeps the historical notice classified as a notice after restart', async () => {
  const root = mkdtempSync(join(tmpdir(), 'old-unknown-notice-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis);
  try {
    const id = 'telegram:12345678:update:1';
    journal.append({ kind: 'intake', id, update: 1, text: 'old request', raw: JSON.stringify(update(1)), accepted: true, cursor: 2, at: 1000 });
    journal.append({ kind: 'reserve', id, at: 1000 });
    journal.append({ kind: 'model-uncertain', id, state: 'uncertain', at: 1000 });
    journal.append({ kind: 'notice', id, noticeClass: 'unknown-answer', at: 1000 });
    journal.append({ kind: 'intent', id, text: capture.oldNotice, chat: genesis.chat, update: 1, grant: genesis.grant, at: 1000 });
    journal.append({ kind: 'sent', id, message: 1, at: 1000 });
    journal.close(); journal = openPreviewJournal(path, key);
    let context = '';
    const worker = createJournalWorker(journal, { now: () => 2000, stopped: () => false,
      model: async input => { context = input.context; return 'next answer'; }, checkOutbound: () => {}, send: async () => 2 });
    worker.intake([update(2)]); await worker.drain();
    expect(JSON.parse(context).history[0]).toMatchObject({ answer: null, notice: capture.oldNotice,
      outcome: 'loss notice delivered; model UNKNOWN' });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('replays the captured uncertain state and delivered/empty-context bytes on distinct worker paths', async () => {
  const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')).otherShapes;
  for (const kind of ['summary-uncertain', 'delivered-reply', 'empty-reply-in-recorded-context']) {
    const shape = shapes.find((row: { kind: string }) => row.kind === kind);
    const root = mkdtempSync(join(tmpdir(), 'notice-recorded-shape-'));
    const journal = openPreviewJournal(join(root, 'journal'), key, genesis);
    const sent: string[] = []; let calls = 0;
    try {
      const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
        model: async () => { calls++; return kind === 'summary-uncertain' ? JSON.parse(shape.raw) : shape.raw; },
        checkOutbound: () => {}, send: async input => { sent.push(input.expectedText); return 1; } });
      worker.intake([update(1)]); await worker.drain(); await worker.drain();
      expect(calls, shape.id).toBe(1); expect(sent, shape.id).toHaveLength(1);
      expect(sent[0]?.trim().length, shape.id).toBeGreaterThan(0);
      if (kind === 'summary-uncertain') expect(sent).toEqual([UNKNOWN_ANSWER_NOTICE]);
      else if (kind === 'empty-reply-in-recorded-context') {
        // Captured empty context is not evidence Telegram delivered an empty bubble.
        // Feeding those bytes to the answer port is a synthetic empty-output control.
        expect(shape.raw).toBe(''); expect(sent).toEqual([MODEL_FAILURE_REPLY]);
      } else expect(sent[0]).not.toBe(UNKNOWN_ANSWER_NOTICE);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
});

it('retains the real exhausted socket-turn notice despite memory acknowledgement and recorded revision', async () => {
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/socket-drop-worker-1016101-2026-10-16.json', import.meta.url), 'utf8')).failedSurface;
  const review = recorded.journal.find((row: { kind: string; result?: { path: string } }) => row.kind === 'reply-check' && row.result?.path === 'subscription').result;
  const revision = recorded.journal.find((row: { kind: string }) => row.kind === 'reply-revision');
  const root = mkdtempSync(join(tmpdir(), 'socket-notice-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), reviews = 0, revisions = 0;
  const sent: string[] = [];
  const ports = { now: () => 1000, stopped: () => false,
    prepareModel: () => JSON.stringify({ messages: [{ role: 'context', content: JSON.stringify({ packet: {
      audience: { surface: 'telegram-private' }, history: [] } }) },
    { role: 'user', content: 'I prefer tea to coffee. Tell me which drink I prefer in one short sentence.' }] }),
    model: async () => ({ state: 'uncertain' as const }), checkOutbound: () => {},
    send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return 1; },
    replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('recorded Jev unavailable'); },
      escalate: async () => { reviews++; return review; }, revise: async () => { revisions++; return revision; } } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ ...update(recorded.update), message: { ...update(recorded.update).message,
      text: 'I prefer tea to coffee. Tell me which drink I prefer in one short sentence.' } }]);
    await worker.drain(); await worker.drain();
    expect(sent).toEqual([UNKNOWN_ANSWER_NOTICE]);
    expect({ reviews, revisions }).toEqual({ reviews: 0, revisions: 0 });
    expect(journal.view.order[0]).toMatchObject({ modelState: 'uncertain', noticeClass: 'unknown-answer', sent: 1 });
    journal.close(); journal = openPreviewJournal(path, key); await createJournalWorker(journal, ports).drain();
    expect(sent).toHaveLength(1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('still reviews model-written text equal to the notice when no unknown outcome was recorded', async () => {
  const root = mkdtempSync(join(tmpdir(), 'model-notice-text-'));
  const journal = openPreviewJournal(join(root, 'journal'), key, genesis);
  let reviews = 0;
  try {
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => UNKNOWN_ANSWER_NOTICE, checkOutbound: () => {}, send: async () => 1,
      replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('unavailable'); },
        escalate: async () => { reviews++; return { verdict: 'pass', ruleIds: [], confidence: null, latencyMs: 0 }; } } });
    worker.intake([update(1)]); await worker.drain();
    expect(reviews).toBe(1); expect(journal.view.order[0]?.noticeClass).toBeUndefined();
    expect(journal.view.order[0]?.modelState).toBe('complete');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
