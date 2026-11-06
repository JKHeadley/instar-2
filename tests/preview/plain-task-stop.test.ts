import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, LEGACY_UNKNOWN_ANSWER_NOTICE, unknownAnswerNotice,
  continuityDisclosure, type ReplyGrounding } from './journal-test-worker.js';
import { HOLDING_REPLY, parseJevResponse, parseReplyReviewVerdict } from './reply-check.js';
import { readAnswer } from './answer-reading.js';

const captured = JSON.parse(readFileSync(new URL('./fixtures/plain-task-stop-2184-2026-11-06.json', import.meta.url), 'utf8'));
const reviews = JSON.parse(readFileSync(new URL('./fixtures/unknown-answer-notice-969390396.json', import.meta.url), 'utf8'));
const reviewAnswer = readAnswer(reviews.freshReviewOutput);
if (!reviewAnswer.ok) throw Error('recorded review is malformed');
const review = parseReplyReviewVerdict(reviewAnswer.value, reviews.reviewRules);
const key = new Uint8Array(32).fill(42);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 131072, cursor: 0 };
const id = (n: number) => `telegram:12345678:update:${n}`;
const update = (n: number, text: string) => ({ update_id: n, message: {
  chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
function assertPlainStop(text: string) {
  expect(text).toContain('Issue 2184');
  expect(text).toContain('Work on your request stopped');
  expect(text).toContain('The reason is unknown.');
  expect(text).toContain('will not be repeated automatically');
  expect(text).not.toMatch(/96939067[89]|Telegram message|model UNKNOWN|answer-writing step|holding reply/);
  expect(text).not.toMatch(/workspace.*full|full.*workspace|will retry|will follow up/i);
}
it('the observer excerpt and old source composition fail the same plain-stop contract', () => {
  const old = `${continuityDisclosure('#969390679, date', captured.summaryThrough, 'pending',
    'holding reply delivered in place of the loss notice; model UNKNOWN as Telegram message 756, not an answer')} ${LEGACY_UNKNOWN_ANSWER_NOTICE}`;
  for (const text of [captured.observerExcerpt, old]) expect(() => assertPlainStop(text)).toThrow();
  expect(captured.hostDetail).toBe('turn ended without a complete reply');
  expect(captured.workerFinding).toContain('workspace full');
});

for (const receipt of [1, null]) it(`recorded task and uncertain outcome produce a plain notice; receipt=${receipt} never replays`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'plain-task-stop-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), calls = 0;
  const sent: string[] = [];
  const ports = { now: () => 1000, stopped: () => false, model: async () => { calls++; throw Error('no repeat'); },
    replyCheck: { elapsedMs: () => 0,
      jev: async () => ({ value: parseJevResponse(reviews.recordedJevOutput), latencyMs: 1 }),
      escalate: async (text: string) => { assertPlainStop(text); return { ...review, confidence: null, latencyMs: 1 }; } },
    checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return receipt; } };
  try {
    // Reconstruct only the recorded/observer-supplied shapes. This is not an exact journal replay.
    const before = id(captured.previousUpdate), current = id(captured.update);
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(captured.previousUpdate, captured.previousRequest)]);
    journal.append({ kind: 'reserve', id: before, at: 1000 });
    journal.append({ kind: 'model-uncertain', id: before, state: 'uncertain', at: 1000 });
    journal.append({ kind: 'notice', id: before, noticeClass: 'unknown-answer', at: 1000 });
    journal.append({ kind: 'intent', id: before, text: HOLDING_REPLY, chat: genesis.chat,
      update: captured.previousUpdate, grant: genesis.grant, at: 1000 });
    journal.append({ kind: 'sent', id: before, message: 756, at: 1000 });
    worker.intake([update(captured.update, captured.request)]);
    const grounding: ReplyGrounding = { packetSha256: 'recorded-shape-offline', summaryThrough: captured.summaryThrough,
      compactedThrough: captured.summaryThrough, history: [], recalled: [], people: [], commitments: [], channelItems: [],
      corrections: [], memoryChanges: [], memoryCandidates: [] };
    journal.append({ kind: 'reserve', id: current, grounding, prompt: JSON.stringify({ messages: [
      { role: 'user', content: captured.request },
      { role: 'context', content: JSON.stringify({ packet: { audience: { surface: 'telegram-private' }, history: [] } }) }] }), at: 1000 });
    journal.append({ kind: 'model-uncertain', id: current, state: captured.hostOutcome, at: 1000 });
    await worker.drain(); await worker.drain();
    expect(sent).toHaveLength(1); assertPlainStop(sent[0]!);
    expect(sent[0]).toContain(captured.request);
    expect(sent[0]).toContain('Earlier conversation is now summarized for me.');
    expect(sent[0]).toContain('Your previous request is still open; no finished answer is confirmed.');
    const turn = journal.view.turns.get(current)!;
    expect(turn.answer).toBeUndefined();
    expect(turn.continuity).toMatchObject({ prePauseInbound: before, summarizedThrough: captured.summaryThrough,
      disposition: 'pending', reference: 'holding reply delivered in place of the loss notice; model UNKNOWN as Telegram message 756, not an answer' });
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain();
    expect(calls).toBe(0); expect(sent).toHaveLength(1);
    expect(journal.view.turns.get(current)?.sent).toBe(receipt ?? undefined);
    expect(journal.view.turns.get(current)?.modelState).toBe('uncertain');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('uses a recorded safety limit as the cause, but never infers a cause from request text', () => {
  const known = unknownAnswerNotice({ text: captured.request, safetyCeiling: 'deadline' });
  expect(known).toContain('safety limit was reached'); expect(known).toContain('Issue 2184');
  expect(known).not.toContain('reason is unknown');
  expect(unknownAnswerNotice({ text: 'Check whether the workspace is full.' })).toContain('The reason is unknown.');
});

it('bounds and redacts the request quotation before it reaches the normal outbound checks', () => {
  const text = unknownAnswerNotice({ text: `Find this token ghp_${'a'.repeat(36)}. ${'long request '.repeat(1000)}` });
  expect(text).not.toContain(`ghp_${'a'.repeat(36)}`);
  expect(text.length).toBeLessThan(1200); expect(text).toContain('…');
});

for (const toolChecks of [undefined, 6]) it(`keeps historical notice bytes and classification with toolChecks=${toolChecks}`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'plain-stop-history-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), context = '';
  const historical = LEGACY_UNKNOWN_ANSWER_NOTICE + (toolChecks === undefined ? ''
    : ' 6 tool checks returned results, but those results were not verified into an answer. The requested result remains unverified; no tool work was automatically repeated.');
  try {
    const ports = { now: () => 1000, stopped: () => false, model: async (input: { context: string }) => {
      context = input.context; return 'A complete answer.'; }, checkOutbound: () => {}, send: async () => 2 };
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'An earlier request')]);
    journal.append({ kind: 'reserve', id: id(1), at: 1000 });
    journal.append({ kind: 'model-uncertain', id: id(1), state: 'uncertain', ...(toolChecks ? { toolChecks } : {}), at: 1000 });
    journal.append({ kind: 'notice', id: id(1), noticeClass: 'unknown-answer', at: 1000 });
    journal.append({ kind: 'intent', id: id(1), text: historical, chat: genesis.chat, update: 1, grant: genesis.grant, at: 1000 });
    journal.append({ kind: 'sent', id: id(1), message: 1, at: 1000 });
    journal.close(); journal = openPreviewJournal(path, key);
    const next = createJournalWorker(journal, ports); next.intake([update(2, 'Next request')]); await next.drain();
    expect(journal.view.order[0]?.intent).toBe(historical);
    expect(JSON.parse(context).history[0]).toMatchObject({ answer: null, notice: historical,
      outcome: 'loss notice delivered; model UNKNOWN' });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
