import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createJournalWorker, openPreviewJournal, LEGACY_UNKNOWN_ANSWER_NOTICE, unknownAnswerNotice,
  continuityDisclosure, continuitySpoken, type ReplyGrounding } from './journal-test-worker.js';
import { HOLDING_REPLY, parseJevResponse, parseReplyReviewVerdict } from './reply-check.js';
import { readAnswer } from './answer-reading.js';

const captured = JSON.parse(readFileSync(new URL('./fixtures/plain-task-stop-2184-2026-11-06.json', import.meta.url), 'utf8'));
const reviews = JSON.parse(readFileSync(new URL('./fixtures/unknown-answer-notice-969390396.json', import.meta.url), 'utf8'));
const reviewAnswer = readAnswer(reviews.freshReviewOutput);
if (!reviewAnswer.ok) throw Error('recorded review is malformed');
const review = parseReplyReviewVerdict(reviewAnswer.value, reviews.reviewRules);
const key = new Uint8Array(32).fill(42);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '-7654321', operator: '7654321', forum: true as const,
  grant: 'grant:offline', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 131072, cursor: 0 };
const id = (n: number) => `telegram:12345678:update:${n}`;
const update = (n: number, text: string) => ({ update_id: n, message: {
  chat: { id: -7654321, type: 'supergroup', is_forum: true }, from: { id: 7654321 }, text } });
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

for (const basis of ['summary', 'set-aside'] as const) for (const receipt of [1, null]) it(`recorded task and uncertain outcome produce a plain notice; ${basis}, receipt=${receipt} never replays`, async () => {
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
      ...(basis === 'summary' ? { compactedThrough: captured.summaryThrough } : { setAsideThrough: captured.summaryThrough }), history: [], recalled: [], people: [], commitments: [], channelItems: [],
      corrections: [], memoryChanges: [], memoryCandidates: [] };
    journal.append({ kind: 'reserve', id: current, grounding, prompt: JSON.stringify({ messages: [
      { role: 'user', content: captured.request },
      { role: 'context', content: JSON.stringify({ packet: { audience: { surface: 'telegram-group-topic', operatorOnlyVerified: true }, history: [] } }) }] }), at: 1000 });
    journal.append({ kind: 'model-uncertain', id: current, state: captured.hostOutcome, at: 1000 });
    await worker.drain(); await worker.drain();
    expect(sent).toHaveLength(1); assertPlainStop(sent[0]!);
    expect(sent[0]).toContain(captured.request);
    expect(sent[0]).toContain(basis === 'summary' ? 'Note: the earlier part of our conversation is now summarized for me'
      : 'Earlier conversation no longer fits in my view; it is saved and searchable, but not summarized.');
    expect(sent[0]).toContain(basis === 'summary' ? 'your last request before that is still open: no finished answer to it was confirmed.'
      : 'Your previous request is still open; no finished answer is confirmed.');
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

// Literal bytes of the writer at e57d3ed79: changing the current notice must not change these.
const parentNotice = (request: string, toolChecks?: number) => 'Work on your request stopped before a finished answer was available. '
  + 'The reason is unknown. Your request and this incomplete attempt are saved. This attempt will not be repeated automatically.'
  + ` Your request: “${request}”`
  + (toolChecks === undefined ? '' : ` ${toolChecks} tool checks returned results, but those results were not verified into an answer. The requested result remains unverified; no tool work was automatically repeated.`);
const longRequest = 'a'.repeat(900);
const parentCases = [
  { name: 'quoted request', text: captured.request as string, quote: captured.request as string },
  { name: 'request at the old 800 bound', text: longRequest, quote: `${'a'.repeat(799)}…` },
  { name: 'request between the two bounds', text: 'b'.repeat(750), quote: 'b'.repeat(750) },
];
for (const { name, text, quote } of parentCases) for (const toolChecks of [undefined, 6])
for (const receipt of [true, false]) for (const disclosed of [false, true])
it(`keeps the train parent notice classified: ${name}, toolChecks=${toolChecks}, receipt=${receipt}, disclosed=${disclosed}`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'plain-stop-parent-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), context = '';
  const sha = (value: string) => createHash('sha256').update(value).digest('hex');
  const disclosure = 'Earlier conversation is now summarized for me. Your previous request is still open; no finished answer is confirmed.';
  const historical = parentNotice(quote, toolChecks);
  const intent = disclosed ? `${disclosure} ${historical}` : historical;
  try {
    const ports = { now: () => 1000, stopped: () => false, model: async (input: { context: string }) => {
      context = input.context; return 'A complete answer.'; }, checkOutbound: () => {}, send: async () => 2 };
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'An earlier request'), update(2, text)]);
    journal.append({ kind: 'reserve', id: id(1), at: 1000 });
    journal.append({ kind: 'answer', id: id(1), text: 'An earlier answer.', state: 'complete', at: 1000 });
    journal.append({ kind: 'intent', id: id(1), text: 'An earlier answer.', chat: genesis.chat, update: 1, grant: genesis.grant, at: 1000 });
    journal.append({ kind: 'sent', id: id(1), message: 1, at: 1000 });
    journal.append({ kind: 'reserve', id: id(2), ...(disclosed ? { grounding: { packetSha256: 'p', summaryThrough: 1,
      compactedThrough: 1, history: [], recalled: [], people: [], commitments: [], channelItems: [],
      corrections: [], memoryChanges: [], memoryCandidates: [] } } : {}), at: 1000 });
    journal.append({ kind: 'model-uncertain', id: id(2), state: 'uncertain', ...(toolChecks ? { toolChecks } : {}), at: 1000 });
    journal.append({ kind: 'notice', id: id(2), noticeClass: 'unknown-answer', at: 1000 });
    journal.append({ kind: 'intent', id: id(2), text: intent, chat: genesis.chat, update: 2, grant: genesis.grant, at: 1000,
      ...(disclosed ? { continuity: { prePauseInbound: id(1), capture: sha(journal.view.order[0]!.raw), summarizedThrough: 1,
        grounding: 'p', disposition: 'pending' as const, reference: 'no reply from me yet', disclosure, replyDigest: sha(intent) } } : {}) });
    if (receipt) journal.append({ kind: 'sent', id: id(2), message: 2, at: 1000 });
    journal.close(); journal = openPreviewJournal(path, key);
    const next = createJournalWorker(journal, ports); next.intake([update(3, 'Next request')]); await next.drain();
    expect(journal.view.order[1]?.intent).toBe(intent);
    const row = JSON.parse(context).history.find((item: { notice?: string }) => item.notice?.includes(historical));
    expect(row).toMatchObject({ answer: null,
      outcome: receipt ? 'loss notice delivered; model UNKNOWN' : 'loss notice delivery UNKNOWN; model UNKNOWN' });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

// The other side of the decision: review really did replace the notice, and a near miss is not a parent notice.
for (const [name, replacement] of [['holding reply', HOLDING_REPLY],
  ['parent notice quoting another request', parentNotice('A different request')]] as const)
it(`still reports a replaced notice as a holding reply: ${name}`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'plain-stop-holding-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), context = '';
  try {
    const ports = { now: () => 1000, stopped: () => false, model: async (input: { context: string }) => {
      context = input.context; return 'A complete answer.'; }, checkOutbound: () => {}, send: async () => 2 };
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'An earlier request')]);
    journal.append({ kind: 'reserve', id: id(1), at: 1000 });
    journal.append({ kind: 'model-uncertain', id: id(1), state: 'uncertain', at: 1000 });
    journal.append({ kind: 'notice', id: id(1), noticeClass: 'unknown-answer', at: 1000 });
    journal.append({ kind: 'intent', id: id(1), text: replacement, chat: genesis.chat, update: 1, grant: genesis.grant, at: 1000 });
    journal.append({ kind: 'sent', id: id(1), message: 1, at: 1000 });
    journal.close(); journal = openPreviewJournal(path, key);
    const next = createJournalWorker(journal, ports); next.intake([update(2, 'Next request')]); await next.drain();
    expect(JSON.parse(context).history[0]).toMatchObject({ answer: null,
      outcome: 'holding reply delivered in place of the loss notice; model UNKNOWN' });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

for (const fault of ['none', 'ordinary-answer', 'wording', 'basis', 'digest', 'capture'] as const)
it(`plain continuity retains exact journal checks: ${fault}`, () => {
  const root = mkdtempSync(join(tmpdir(), 'plain-stop-account-')), path = join(root, 'journal');
  const journal = openPreviewJournal(path, key, genesis);
  const sha = (text: string) => createHash('sha256').update(text).digest('hex');
  try {
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => 'unused', checkOutbound: () => {}, send: async () => 1 });
    worker.intake([update(1, 'An earlier request'), update(2, 'The current request')]);
    journal.append({ kind: 'reserve', id: id(2), grounding: { packetSha256: 'p', summaryThrough: 1,
      compactedThrough: 1, history: [], recalled: [], people: [], commitments: [], channelItems: [],
      corrections: [], memoryChanges: [], memoryCandidates: [] }, at: 1000 });
    if (fault === 'ordinary-answer') journal.append({ kind: 'answer', id: id(2), text: 'An answer.', state: 'complete', at: 1000 });
    else {
      journal.append({ kind: 'model-uncertain', id: id(2), state: 'uncertain', at: 1000 });
      journal.append({ kind: 'notice', id: id(2), noticeClass: 'unknown-answer', at: 1000 });
    }
    const disclosure = fault === 'wording' ? 'Everything has been completed.'
      : 'Earlier conversation is now summarized for me. Your previous request is still open; no finished answer is confirmed.';
    const text = `${disclosure} ${fault === 'ordinary-answer' ? 'An answer.' : unknownAnswerNotice({ text: 'The current request' })}`;
    const append = () => journal.append({ kind: 'intent', id: id(2), text, chat: genesis.chat, update: 2,
      grant: genesis.grant, at: 1000, continuity: { prePauseInbound: id(1),
        capture: fault === 'capture' ? 'wrong' : sha(journal.view.order[0]!.raw), summarizedThrough: 1,
        grounding: 'p', disposition: 'pending', reference: 'no reply from me yet', disclosure,
        ...(fault === 'basis' ? { basis: 'set-aside' as const } : {}),
        replyDigest: fault === 'digest' ? 'wrong' : sha(text) } });
    if (fault === 'none' || fault === 'ordinary-answer') expect(append).not.toThrow();
    else expect(append).toThrow('continuity account refused');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

for (const basis of ['summary', 'set-aside'] as const)
it(`discloses different pending requests with identical stopped-task prose in one worker: ${basis}`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'plain-stop-distinct-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis);
  const sent: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => { throw Error('no repeat'); }, checkOutbound: () => {},
      send: async ({ expectedText }) => { sent.push(expectedText); return sent.length; } });
    worker.intake([update(1, captured.previousRequest)]);
    journal.append({ kind: 'reserve', id: id(1), at: 1000 });
    journal.append({ kind: 'model-uncertain', id: id(1), state: 'uncertain', at: 1000 });
    await worker.drain();
    for (const n of [2, 3]) {
      worker.intake([update(n, captured.request)]);
      journal.append({ kind: 'reserve', id: id(n), grounding: { packetSha256: `packet-${n}`,
        summaryThrough: n - 1, ...(basis === 'summary' ? { compactedThrough: n - 1 } : { setAsideThrough: n - 1 }),
        history: [], recalled: [], people: [], commitments: [], channelItems: [], corrections: [],
        memoryChanges: [], memoryCandidates: [] }, at: 1000 });
      journal.append({ kind: 'model-uncertain', id: id(n), state: captured.hostOutcome, at: 1000 });
      await worker.drain();
      const account = journal.view.turns.get(id(n))!.continuity!;
      expect(account).toMatchObject({ prePauseInbound: id(n - 1), summarizedThrough: n - 1, disposition: 'pending' });
      expect(account.spoken).not.toBe(false);
      expect(sent.at(-1)).toContain(account.disclosure);
      expect(sent.at(-1)).toContain(basis === 'summary' ? 'your last request before that is still open: no finished answer to it was confirmed.'
        : 'Your previous request is still open; no finished answer is confirmed.');
      // The same delivered account has nothing new to say, despite its request remaining open.
      expect(continuitySpoken(account, { ...account, basis }, false)).toBe(false);
    }
    expect(journal.view.turns.get(id(2))!.continuity!.disclosure)
      .toBe(journal.view.turns.get(id(3))!.continuity!.disclosure);
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.turns.get(id(3))!.continuity!.spoken).not.toBe(false);
    expect(sent).toHaveLength(3);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('equal prose is quiet only for the same pending evidence, while answered episodes stay quiet', () => {
  const pending = { prePauseInbound: id(1), capture: 'capture:1', disposition: 'pending' as const,
    reference: 'no reply from me yet', disclosure: 'The same plain sentence.', basis: 'summary' as const };
  const { basis, ...last } = pending;
  expect(continuitySpoken(last, { ...last, basis }, false)).toBe(false);
  for (const change of [{ prePauseInbound: id(2) }, { capture: 'capture:2' },
    { reference: 'my reply to it was prepared but its delivery is unconfirmed' },
    { disposition: 'superseded' as const }, { basis: 'set-aside' as const }])
    expect(continuitySpoken(last, { ...pending, ...change }, false)).toBe(true);
  expect(continuitySpoken(last, { ...pending, prePauseInbound: id(2), disposition: 'addressed' }, false)).toBe(false);
});
