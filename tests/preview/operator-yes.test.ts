import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, previewTestContext, limitedAnswerText } from './journal-test-worker.js';
import { CHAT_YES_UNAVAILABLE, OPERATOR_ACTION_UNREAD, projectionDigest, raiseJournalCaps } from './journal.js';
import { chatBinding, explicitYesStatus, operatorActionSurface, operatorRefusalText, operatorRequestText, operatorYesAuthority, parseOperatorAction,
  proposeOperatorRequest, wellFormedRequest, OPERATOR_REQUEST_MS, type ChatCandidate, type ProposalState } from './operator-yes.js';
import { produceExplicitYes } from '../../src/operator/explicit-yes.js';
import type { ExplicitYesInstallation } from '../../src/operator/explicit-yes.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY } from '../../src/assembly/production-provider.js';
import { redact } from '../../src/recall/redact.js';

// Rules 28, 29, 79, 82, 98 and plan #91: the trial's two declared operator actions complete from the phone with the
// operator's explicit yes. The agent proposes ONE exact request inside the governed bounds; only the verified
// operator's plain yes, as the answer to that request, completes it, once. Every other answer changes nothing.
const key = new Uint8Array(32).fill(73);
const OPERATOR = 7654321;
const installation = (over: Partial<ExplicitYesInstallation> = {}): ExplicitYesInstallation => ({ adapter: 'telegram-bot-api', machine: 'laptop',
  chat: { method: 'telegram-sender', boundChatId: String(OPERATOR), operatorAccountId: String(OPERATOR), agentHoldsNoAccess: true },
  github: null, agentSpeaksAsOperatorInChat: false, ...over });
const ACTIVATION = `sha256:${'a'.repeat(64)}`;
const genesis = (over: object = {}) => ({ kind: 'genesis' as const, bot: '12345678', chat: String(OPERATOR), operator: String(OPERATOR),
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 6, maxReplies: 8, maxTurns: 8,
  maxBytes: 32768, cursor: 0, ...over });
/** Operator message ids follow the bot's in one private chat, as Telegram numbers them. */
const message = (update: number, messageId: number, text: string, over: object = {}) => ({ update_id: update,
  message: { message_id: messageId, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR }, text, ...over } });

type Answer = { reply: string; operatorAction?: unknown };
const harness = (path: string, options: { genesis?: object; install?: ExplicitYesInstallation | null; activation?: string | null;
  answer?: (question: string) => Answer | string; clock?: number } = {}) => {
  const sent: { text: string; id: number }[] = [], questions: string[] = [], contexts: string[] = [];
  let clock = options.clock ?? 1000, next = 100;
  const journal = openPreviewJournal(path, key, genesis(options.genesis));
  const ports = { now: () => clock, stopped: () => false, checkOutbound: () => {},
    model: async (input: { question: string; context: string }) => { questions.push(input.question); contexts.push(input.context);
      const answer = options.answer?.(input.question) ?? { reply: 'ordinary answer' };
      return typeof answer === 'string' ? answer : JSON.stringify({ memory: [], ...answer }); },
    ...(options.install === null ? {} : { explicitYes: { context: previewTestContext, installation: options.install ?? installation(),
      renewalActivation: () => options.activation === undefined ? ACTIVATION : options.activation } }),
    send: async (input: { expectedText: string }) => { next += 1; sent.push({ text: input.expectedText, id: next }); return next; } };
  return { journal, worker: createJournalWorker(journal, ports), sent, questions, contexts, ports, tick: (ms: number) => { clock += ms; } };
};
const withRoot = async (run: (path: string) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-operator-yes-')));
  try { await run(join(root, 'journal.encrypted')); } finally { rmSync(root, { recursive: true, force: true }); }
};
const raise = { reply: 'I can ask for that.', operatorAction: { action: 'raise-caps', limits: { maxCalls: 10 } } };
const asking = (question: string) => question.includes('more calls') ? raise : { reply: 'ordinary answer' };
const latest = (journal: ReturnType<typeof openPreviewJournal>) => journal.view.operatorRequests.at(-1);

const state = (over: Partial<ProposalState> = {}): ProposalState => ({ limits: { maxCalls: 6, maxReplies: 8, maxTurns: 8 },
  used: { maxCalls: 5, maxReplies: 2, maxTurns: 3 }, step: { maxCalls: 6, maxReplies: 8, maxTurns: 8 }, expires: 2000_000,
  governedExpiry: 3000_000, renewalActivation: ACTIVATION, unknownCalls: 0, stopped: false, grant: 'grant:preview', base: 'b'.repeat(16), ...over });

it('reads only the exact proposal shape, and bounds every request by the governed step on both sides', () => {
  expect(parseOperatorAction({ action: 'raise-caps' })).toEqual({ action: 'raise-caps' });
  expect(parseOperatorAction({ action: 'raise-caps', limits: { maxCalls: 9 } })).toEqual({ action: 'raise-caps', limits: { maxCalls: 9 } });
  expect(parseOperatorAction({ action: 'raise-caps', limits: { maxReplies: 'step' } })).toEqual({ action: 'raise-caps', limits: { maxReplies: 'step' } });
  expect(parseOperatorAction({ action: 'renew-expiry' })).toEqual({ action: 'renew-expiry' });
  for (const bad of [null, 'raise', { action: 'raise-caps', limits: { maxBytes: 9 } }, { action: 'raise-caps', limits: { maxCalls: 1.5 } },
    { action: 'raise-caps', limits: { maxCalls: -1 } }, { action: 'delete' }, { action: 'renew-expiry', limits: {} },
    { action: 'raise-caps', extra: true }, { action: 'renew-expiry', expiresAt: 'tomorrow' }, { action: 'raise-caps', limits: {} },
    { action: 'raise-caps', limits: { maxCalls: 'more' } }])
    expect(parseOperatorAction(bad), JSON.stringify(bad)).toBeUndefined();
  // Inside the bound: the exact values, a fresh id and digest, an hour's lifetime.
  const inside = proposeOperatorRequest(state(), { action: 'raise-caps', limits: { maxCalls: 12 } }, 'turn-1', 500);
  expect(inside.kind).toBe('request');
  if (inside.kind !== 'request') return;
  expect(inside.request.limits).toEqual({ maxCalls: 12, maxReplies: 8, maxTurns: 8 });
  // A request never outlives the trial: here the trial ends first; with a later end it lapses after the window (plan #373).
  expect(inside.request.expiresAt).toBe(2000_000);
  const window = proposeOperatorRequest(state({ expires: 900_000_000 }), { action: 'raise-caps' }, 'turn-1', 500);
  expect(window.kind === 'request' && window.request.expiresAt).toBe(500 + OPERATOR_REQUEST_MS);
  expect(wellFormedRequest(inside.request, 'turn-1', 'grant:preview')).toBe(true);
  expect(wellFormedRequest({ ...inside.request, limits: { ...inside.request.limits!, maxCalls: 13 } }, 'turn-1', 'grant:preview')).toBe(false);
  expect(wellFormedRequest(inside.request, 'turn-2', 'grant:preview')).toBe(false);
  // One past the bound is refused and says what the most is.
  const outside = proposeOperatorRequest(state(), { action: 'raise-caps', limits: { maxCalls: 13 } }, 'turn-1', 500);
  expect(outside).toEqual({ kind: 'refused', reason: expect.stringContaining('the most is 12') });
  expect(proposeOperatorRequest(state(), { action: 'raise-caps', limits: { maxReplies: 7 } }, 't', 500))
    .toEqual({ kind: 'refused', reason: expect.stringContaining('cannot be lowered') });
  expect(proposeOperatorRequest(state(), { action: 'raise-caps', limits: { maxCalls: 6 } }, 't', 500))
    .toEqual({ kind: 'refused', reason: expect.stringContaining('nothing would change') });
  // "step" grows the named allowance by its governed step; without limits the allowance nearest its limit does (calls: 5 of 6 used).
  const stepped = proposeOperatorRequest(state(), { action: 'raise-caps', limits: { maxReplies: 'step', maxCalls: 7 } }, 't', 500);
  expect(stepped.kind === 'request' && stepped.request.limits).toEqual({ maxCalls: 7, maxReplies: 16, maxTurns: 8 });
  const nearest = proposeOperatorRequest(state(), { action: 'raise-caps' }, 't', 500);
  expect(nearest.kind === 'request' && nearest.request.limits).toEqual({ maxCalls: 12, maxReplies: 8, maxTurns: 8 });
  expect(proposeOperatorRequest(state({ unknownCalls: 1 }), { action: 'raise-caps' }, 't', 500))
    .toEqual({ kind: 'refused', reason: expect.stringContaining('still unknown') });
  expect(proposeOperatorRequest(state({ stopped: true }), { action: 'raise-caps' }, 't', 500).kind).toBe('refused');
  // A renewal names only the reviewed trial end, and only with its reviewed activation installed.
  const renew = proposeOperatorRequest(state(), { action: 'renew-expiry' }, 't', 500);
  expect(renew.kind === 'request' && renew.request.expires).toBe(3000_000);
  expect(proposeOperatorRequest(state(), { action: 'renew-expiry', expiresAt: 3500_000 }, 't', 500))
    .toEqual({ kind: 'refused', reason: expect.stringContaining('only renewal available') });
  expect(proposeOperatorRequest(state({ renewalActivation: null }), { action: 'renew-expiry' }, 't', 500))
    .toEqual({ kind: 'refused', reason: expect.stringContaining('not installed') });
  expect(proposeOperatorRequest(state({ governedExpiry: 2000_000 }), { action: 'renew-expiry' }, 't', 500))
    .toEqual({ kind: 'refused', reason: expect.stringContaining('nothing to renew to') });
});

it('binds only a reply to the request or the operator\'s very next message in that conversation', () => {
  const request = { message: 200, thread: null };
  const candidate = (over: Partial<ChatCandidate> = {}): ChatCandidate => ({ chatId: '1', messageId: 201, replyTo: null, senderId: '1',
    thread: null, edited: false, text: 'yes', at: 1, ...over });
  expect(chatBinding(request, candidate(), [])).toBe('next');
  expect(chatBinding(request, candidate({ messageId: 250, replyTo: 200 }), [{ messageId: 230, thread: null }])).toBe('reply');
  // A later message, with another operator message between it and the request, does not answer it.
  expect(chatBinding(request, candidate({ messageId: 250 }), [{ messageId: 230, thread: null }])).toBeNull();
  // ...unless that other message is in a different conversation.
  expect(chatBinding(request, candidate({ messageId: 250 }), [{ messageId: 230, thread: 9 }])).toBe('next');
  expect(chatBinding(request, candidate({ messageId: 199 }), [])).toBeNull();
  expect(chatBinding(request, candidate({ edited: true }), [])).toBeNull();
  expect(chatBinding(request, candidate({ thread: 4 }), [])).toBeNull();
  expect(chatBinding(request, candidate({ replyTo: 150 }), [])).toBeNull();
});

it('says which source is admissible and why not, and keeps the P-05 chat refusal in the single admission', () => {
  const bound = { chat: String(OPERATOR), operator: String(OPERATOR) };
  expect(explicitYesStatus(undefined, bound)).toMatchObject({ connected: false, chat: { admissible: false } });
  expect(explicitYesStatus(installation(), bound)).toMatchObject({ connected: true, chat: { admissible: true },
    review: { admissible: false, reason: 'no pinned operator GitHub account is installed' } });
  expect(explicitYesStatus(installation({ agentSpeaksAsOperatorInChat: true }), bound).chat)
    .toEqual({ admissible: false, reason: expect.stringContaining('P-05') });
  expect(explicitYesStatus(installation({ chat: { ...installation().chat, agentHoldsNoAccess: false } }), bound).chat.reason).toContain('P-02');
  expect(explicitYesStatus(installation(), { ...bound, chat: '99' }).chat.reason).toContain('different chat');
  expect(explicitYesStatus(installation({ github: { method: 'github-review', repository: 'o/r', operatorLogin: 'Op', agentHoldsNoAccess: false } }), bound)
    .review.reason).toContain('P-02');
  // The admission itself refuses a chat yes under P-05 (the source this deployment must not use).
  const request = { requestId: 'r', requestDigest: `sha256:${'c'.repeat(64)}` as const, authorizationId: 'a', approver: { kind: 'person', id: 'op' },
    requestedBy: { kind: 'system', id: 'runner' }, under: 'g', action: 'raise-caps', scope: {}, artifact: `sha256:${'c'.repeat(64)}` as const,
    base: 'b', kind: { kind: 'approval' }, chatMessageId: '5', head: null, issuedAt: 0, expiresAt: 10 } as never;
  const observation = { kind: 'chat-reply' as const, chatId: String(OPERATOR), messageId: '6', replyToMessageId: '5', senderAccountId: String(OPERATOR),
    text: 'yes', at: { value: 5 } as never };
  const verdict = produceExplicitYes(request, installation({ agentSpeaksAsOperatorInChat: true }), observation, [], previewTestContext);
  expect(verdict.kind).toBe('Refused');
  expect(verdict.kind === 'Refused' && verdict.detail).toContain('P-05');
});

it('proposes the exact raise in the reply; the operator\'s next plain yes applies it once, and it survives replay', () => withRoot(async path => {
  const { journal, worker, sent, contexts } = harness(path, { answer: asking });
  worker.intake([message(1, 50, 'can I have more calls please')]); await worker.drain();
  // Far from every limit, the proposal guidance is in the packet: an admissible source makes an ask answerable at any
  // time (plan row #349; live 2026-10-02 update 969390016 answered a false cannot-do without it).
  expect(contexts[0]).toContain('operatorAction');
  const proposed = latest(journal)!;
  expect(proposed.request.limits).toEqual({ maxCalls: 10, maxReplies: 8, maxTurns: 8 });
  expect(sent.at(-1)!.text).toContain(operatorRequestText(proposed.request, { limits: { maxCalls: 6, maxReplies: 8, maxTurns: 8 }, expires: 9999999999999 }));
  expect(proposed.message).toBe(sent.at(-1)!.id);
  expect(journal.view.limits.maxCalls).toBe(6);
  // Silence is never consent (Rule 98).
  await worker.drain();
  expect(journal.view.limits.maxCalls).toBe(6);
  worker.intake([message(2, proposed.message! + 1, 'Yes')]);
  expect(journal.view.limits.maxCalls).toBe(10);
  const decided = latest(journal)!;
  expect(decided.approved).toMatchObject({ reference: `telegram:chat:${OPERATOR}:message:${proposed.message! + 1}` });
  expect(decided.applied).toBe(true);
  expect(journal.view.capAuthority).toBe(operatorYesAuthority(proposed.request.id, decided.approved!.reference));
  await worker.drain();
  // The approved request is reported to the mind as applied, with its guidance, and the reply goes out.
  expect(sent).toHaveLength(2);
  const told = JSON.parse(contexts.at(-1)!) as { operatorRequest?: { state: string }; capability: string };
  expect(told.operatorRequest?.state).toBe('approved by the operator and applied');
  expect(told.capability).toContain('Only the runner applies it');
  // A second yes changes nothing: the request is spent.
  worker.intake([message(3, sent.at(-1)!.id + 1, 'yes')]);
  expect(journal.view.limits.maxCalls).toBe(10);
  journal.close();
  const replay = openPreviewJournal(path, key);
  expect(replay.view.limits.maxCalls).toBe(10);
  expect(replay.view.operatorRequests.at(-1)?.applied).toBe(true);
  // Reusing the consumed yes for another row is refused by the journal itself.
  expect(() => replay.append({ kind: 'operator-yes', id: replay.view.order.at(-1)!.id, request: proposed.request.id, binding: 'next',
    outcome: 'approved', reference: decided.approved!.reference, hash: decided.approved!.hash, at: 2000 })).toThrow('operator yes order');
  replay.close();
}));

// cint-L30 (cint-L26's validate-before-write path, cint-L29's snapshot handling): each new row kind -- the
// proposed request, a refused and an approved operator-yes, and the caps frame applied under it -- is written
// through the journal's own append, kept by a compaction snapshot, and read back from it on reopen.
it('keeps the request, its refused and approved verdicts and the applied raise through a compaction snapshot', () => withRoot(async path => {
  const { journal, worker } = harness(path, { answer: asking });
  worker.intake([message(1, 50, 'can I have more calls please')]); await worker.drain();
  const proposed = latest(journal)!;
  worker.intake([message(2, proposed.message! + 1, 'sure, go ahead I guess', { reply_to_message: { message_id: proposed.message } })]);
  worker.intake([message(3, proposed.message! + 2, 'yes', { reply_to_message: { message_id: proposed.message } })]);
  const decided = latest(journal)!;
  expect(decided.refusals).toHaveLength(1);
  expect(decided.applied).toBe(true);
  expect(journal.view.limits.maxCalls).toBe(10);
  const before = projectionDigest(journal.view), requests = JSON.stringify(journal.view.operatorRequests);
  journal.compact(); journal.close();
  const reopened = openPreviewJournal(path, key);
  expect(projectionDigest(reopened.view)).toBe(before);
  expect(JSON.stringify(reopened.view.operatorRequests)).toBe(requests);
  expect(reopened.view.limits.maxCalls).toBe(10);
  expect(reopened.view.capAuthority).toBe(operatorYesAuthority(proposed.request.id, decided.approved!.reference));
  // The consumed yes is still spent after the snapshot: its reuse is refused by the journal itself.
  expect(() => reopened.append({ kind: 'operator-yes', id: reopened.view.order.at(-1)!.id, request: proposed.request.id, binding: 'next',
    outcome: 'approved', reference: decided.approved!.reference, hash: decided.approved!.hash, at: 2000 })).toThrow('operator yes order');
  reopened.close();
}));

it('takes nothing else as the yes: an ambiguous answer, a later message, an expired or superseded request, another sender', () => withRoot(async path => {
  const { journal, worker, sent, tick } = harness(path, { answer: asking });
  worker.intake([message(1, 50, 'can I have more calls')]); await worker.drain();
  const first = latest(journal)!;
  // An ambiguous answer is judged and refused; nothing changes and the request stays open for a reply-to.
  worker.intake([message(2, first.message! + 1, 'sure, go ahead I guess')]);
  expect(journal.view.limits.maxCalls).toBe(6);
  expect(latest(journal)!.refusals).toEqual([{ turn: expect.any(String), detail: expect.stringContaining('not exactly "yes"') }]);
  await worker.drain();
  // A plain yes now is a LATER message, not the next one after the request: not judged at all.
  worker.intake([message(3, sent.at(-1)!.id + 1, 'yes')]);
  expect(journal.view.limits.maxCalls).toBe(6);
  expect(latest(journal)!.refusals).toHaveLength(1);
  // A message from someone else in the chat is not the operator's: not even a turn.
  worker.intake([{ update_id: 4, message: { message_id: sent.at(-1)!.id + 2, chat: { id: OPERATOR, type: 'private' }, from: { id: 999 }, text: 'yes',
    reply_to_message: { message_id: first.message! } } }]);
  expect(journal.view.limits.maxCalls).toBe(6);
  // A fresh proposal supersedes the open one: a reply-to "yes" to the old request approves nothing.
  await worker.drain();
  worker.intake([message(5, sent.at(-1)!.id + 3, 'more calls again please')]); await worker.drain();
  const second = latest(journal)!;
  expect(second.request.id).not.toBe(first.request.id);
  expect(journal.view.operatorRequests.find(item => item.request.id === first.request.id)?.superseded).toBe(true);
  worker.intake([message(6, second.message! + 1, 'yes', { reply_to_message: { message_id: first.message } })]);
  expect(journal.view.limits.maxCalls).toBe(6);
  // The yes after its lapse is refused as lapsed (reply-to the current request).
  tick(OPERATOR_REQUEST_MS + 1);
  worker.intake([message(7, second.message! + 2, 'yes', { reply_to_message: { message_id: second.message } })]);
  expect(journal.view.limits.maxCalls).toBe(6);
  expect(latest(journal)!.refusals.at(-1)?.detail).toBe('this request has lapsed');
  journal.close();
}));

it('accepts a Telegram reply to the request as its answer, and refuses an edit', () => withRoot(async path => {
  const { journal, worker, sent } = harness(path, { answer: asking });
  worker.intake([message(1, 50, 'more calls please')]); await worker.drain();
  const open = latest(journal)!;
  worker.intake([{ update_id: 2, edited_message: { message_id: 50, chat: { id: OPERATOR, type: 'private' }, from: { id: OPERATOR }, text: 'yes' } }]);
  expect(journal.view.limits.maxCalls).toBe(6);
  worker.intake([message(3, open.message! + 1, 'what does that cost?')]); await worker.drain();
  worker.intake([message(4, sent.at(-1)!.id + 1, 'yes', { reply_to_message: { message_id: open.message } })]);
  expect(journal.view.limits.maxCalls).toBe(10);
  expect(latest(journal)!.approved?.reference).toBe(`telegram:chat:${OPERATOR}:message:${sent.at(-1)!.id + 1}`);
  journal.close();
}));

it('refuses out of bounds in plain words, and never proposes where the agent can speak as the operator (P-05)', () => withRoot(async path => {
  const greedy = harness(path, { answer: () => ({ reply: 'Let me ask.', operatorAction: { action: 'raise-caps', limits: { maxCalls: 500 } } }) });
  greedy.worker.intake([message(1, 50, 'give me 500 calls')]); await greedy.worker.drain();
  expect(greedy.sent.at(-1)!.text).toContain(operatorRefusalText('raise-caps', 'one raise may add at most 6 to the model-call allowance, so 500 is out of bounds (the most is 12)'));
  expect(greedy.journal.view.operatorRequests).toEqual([]);
  greedy.journal.close();
  const p05 = harness(path.replace('journal.encrypted', 'p05.encrypted'), { install: installation({ agentSpeaksAsOperatorInChat: true }), answer: asking });
  p05.worker.intake([message(1, 50, 'more calls please')]); await p05.worker.drain();
  expect(p05.sent.at(-1)!.text).toContain(operatorRefusalText('raise-caps', CHAT_YES_UNAVAILABLE));
  expect(p05.journal.view.operatorRequests).toEqual([]);
  p05.worker.intake([message(2, p05.sent.at(-1)!.id + 1, 'yes')]);
  expect(p05.journal.view.limits.maxCalls).toBe(6);
  p05.journal.close();
  // An unreadable proposal is said, not dropped.
  const garbled = harness(path.replace('journal.encrypted', 'garbled.encrypted'),
    { answer: () => ({ reply: 'Sure.', operatorAction: { action: 'raise-caps', limits: { maxBytes: 1 } } }) });
  garbled.worker.intake([message(1, 50, 'more bytes')]); await garbled.worker.drain();
  expect(garbled.sent.at(-1)!.text).toContain(OPERATOR_ACTION_UNREAD);
  garbled.journal.close();
}));

it('carries the raise in the capped limited answer; the yes raises it and the held message is answered', () => withRoot(async path => {
  const { journal, worker, sent, questions } = harness(path, { genesis: { maxCalls: 1 } });
  worker.intake([message(1, 50, 'one')]); await worker.drain();
  worker.intake([message(2, sent.at(-1)!.id + 1, 'two')]); await worker.drain();
  const limited = sent.at(-1)!, request = latest(journal)!;
  expect(limited.text).toContain(limitedAnswerText(journal.view, 'calls', 1));
  expect(request.via).toBe('limited');
  expect(request.request.limits).toEqual({ maxCalls: 2, maxReplies: 8, maxTurns: 8 });
  expect(limited.text).toContain(`Request ${request.request.id}`);
  worker.intake([message(3, limited.id + 1, 'yes')]);
  expect(journal.view.limits.maxCalls).toBe(2);
  await worker.drain();
  expect(questions).toHaveLength(2);
  // cint-L30: the limited answer's request row and its applied raise reopen from a compaction snapshot unchanged.
  const before = projectionDigest(journal.view), requests = JSON.stringify(journal.view.operatorRequests);
  journal.compact(); journal.close();
  const reopened = openPreviewJournal(path, key);
  expect(projectionDigest(reopened.view)).toBe(before);
  expect(JSON.stringify(reopened.view.operatorRequests)).toBe(requests);
  expect(latest(reopened)!.via).toBe('limited');
  expect(reopened.view.limits.maxCalls).toBe(2);
  reopened.close();
}));

it('renews the trial end to the reviewed expiry on a yes, and refuses a renewal with no reviewed activation installed', () => withRoot(async path => {
  const now = SUBSCRIPTION_PREVIEW_EXPIRY - 30 * 86_400_000, end = SUBSCRIPTION_PREVIEW_EXPIRY - 86_400_000;
  const renew = () => ({ reply: 'I can ask.', operatorAction: { action: 'renew-expiry' } });
  const { journal, worker, sent } = harness(path, { clock: now, genesis: { expires: end }, answer: renew });
  worker.intake([message(1, 50, 'please extend the trial')]); await worker.drain();
  const request = latest(journal)!;
  expect(request.request.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
  expect(sent.at(-1)!.text).toContain('extend this installation\'s end');
  worker.intake([message(2, request.message! + 1, 'yes')]);
  expect(journal.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
  expect(journal.view.expiryAuthority).toBe(operatorYesAuthority(request.request.id, latest(journal)!.approved!.reference));
  // cint-L30: the renewal request, its approval and the applied expiry reopen from a compaction snapshot unchanged.
  const before = projectionDigest(journal.view), authority = journal.view.expiryAuthority;
  journal.compact(); journal.close();
  const reopened = openPreviewJournal(path, key);
  expect(projectionDigest(reopened.view)).toBe(before);
  expect(reopened.view.expires).toBe(SUBSCRIPTION_PREVIEW_EXPIRY);
  expect(reopened.view.expiryAuthority).toBe(authority);
  expect(latest(reopened)!.applied).toBe(true);
  reopened.close();
  const missing = harness(path.replace('journal.encrypted', 'missing.encrypted'), { clock: now, genesis: { expires: end }, activation: null, answer: renew });
  missing.worker.intake([message(1, 50, 'please extend the trial')]); await missing.worker.drain();
  expect(missing.sent.at(-1)!.text).toContain('not installed on this machine yet');
  expect(missing.journal.view.operatorRequests).toEqual([]);
  missing.journal.close();
}));

it('refuses a caps or expiry row that claims an explicit yes the journal never admitted', () => withRoot(async path => {
  const { journal, worker } = harness(path, { answer: asking });
  worker.intake([message(1, 50, 'more calls please')]); await worker.drain();
  const open = latest(journal)!;
  expect(() => raiseJournalCaps(journal, { maxCalls: 10, maxReplies: 8, maxTurns: 8, at: 1000,
    authority: operatorYesAuthority(open.request.id, `telegram:chat:${OPERATOR}:message:999`) })).toThrow('operator yes application refused');
  // Nor may an approval row name a message other than the operator's own answering message.
  worker.intake([message(2, open.message! + 1, 'hmm')]);
  const answering = journal.view.order.at(-1)!;
  expect(() => journal.append({ kind: 'operator-yes', id: answering.id, request: open.request.id, binding: 'next', outcome: 'approved',
    reference: `telegram:chat:${OPERATOR}:message:1`, hash: `sha256:${'d'.repeat(64)}`, at: 1000 })).toThrow();
  expect(journal.view.limits.maxCalls).toBe(6);
  journal.close();
}));

it('offers the proposal guidance whenever a source is admissible; configured but inadmissible, only near a limit or the end', () => withRoot(async path => {
  // An admissible source (the chat route here): the guidance rides on the first message, far from every limit.
  const open = harness(path.replace('journal.encrypted', 'open.encrypted'), { genesis: { maxCalls: 5 } });
  open.worker.intake([message(1, 50, 'hello')]); await open.worker.drain();
  expect(open.contexts[0]).toContain('operatorAction');
  open.journal.close();
  // Configured but no source admissible (P-05, no review source): only near a limit, so the answer carries the why-not.
  const near = harness(path, { genesis: { maxCalls: 5 }, install: installation({ agentSpeaksAsOperatorInChat: true }) });
  near.worker.intake([message(1, 50, 'hello')]); await near.worker.drain();
  expect(near.contexts[0]).not.toContain('operatorAction');
  for (let index = 2; index <= 4; index++) { near.worker.intake([message(index, near.sent.at(-1)!.id + 1, `message ${index}`)]); await near.worker.drain(); }
  // 4 of 5 calls are spent before the fifth answer: the cap report's "near" level.
  near.worker.intake([message(5, near.sent.at(-1)!.id + 1, 'and now?')]); await near.worker.drain();
  expect(near.contexts.at(-1)).toContain('operatorAction');
  near.journal.close();
  const none = harness(path.replace('journal.encrypted', 'none.encrypted'), { genesis: { maxCalls: 2 }, install: null,
    answer: () => ({ reply: 'Asking.', operatorAction: { action: 'raise-caps' } }) });
  none.worker.intake([message(1, 50, 'more calls please')]); await none.worker.drain();
  // With no explicit-yes source configured the guidance is never sent, and a proposal anyway is answered with why not.
  expect(none.contexts[0]).not.toContain('operatorAction');
  expect(none.sent.at(-1)!.text).toContain('still given at the host');
  none.journal.close();
}));

it('sends request and refusal lines the live outbound secret check passes unchanged', () => {
  // The live runner refuses any outbound text the redactor would change (journal-agent.mjs checkOutbound).
  for (const proposal of [{ action: 'raise-caps' as const, limits: { maxCalls: 12, maxReplies: 16 } }, { action: 'renew-expiry' as const }]) {
    const made = proposeOperatorRequest(state(), proposal, 'preview:12345678:715672853', 500);
    expect(made.kind).toBe('request');
    if (made.kind !== 'request') continue;
    const text = operatorRequestText(made.request, { limits: state().limits, expires: state().expires });
    expect(redact(text).count, text).toBe(0);
  }
  for (const line of [operatorRefusalText('raise-caps', CHAT_YES_UNAVAILABLE), OPERATOR_ACTION_UNREAD])
    expect(redact(line).count, line).toBe(0);
});

it('keeps an approval that a crash left unapplied visible to the mind, and never applies it from journal rows', () => withRoot(async path => {
  let crash = true;
  const journal0 = openPreviewJournal(path, key, genesis(), stage => { if (crash && stage === 'before:caps') { crash = false; throw Error('crash'); } });
  const contexts: string[] = [], sent: number[] = [];
  const ports = { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async (input: { question: string; context: string }) => { contexts.push(input.context);
      return JSON.stringify({ reply: 'ok', memory: [], ...(input.question.includes('more calls') ? { operatorAction: raise.operatorAction } : {}) }); },
    explicitYes: { context: previewTestContext, installation: installation(), renewalActivation: () => ACTIVATION },
    send: async () => { sent.push(200 + sent.length); return sent.at(-1)!; } };
  const worker = createJournalWorker(journal0, ports);
  worker.intake([message(1, 50, 'more calls please')]); await worker.drain();
  const open = journal0.view.operatorRequests.at(-1)!;
  // The approval frame lands; the caps frame does not (the apply swallows the crash, as a journal refusal).
  worker.intake([message(2, open.message! + 1, 'yes')]);
  expect(journal0.view.operatorRequests.at(-1)?.approved).toBeDefined();
  expect(journal0.view.limits.maxCalls).toBe(6);
  journal0.close();
  const reopened = openPreviewJournal(path, key);
  expect(reopened.view.operatorRequests.at(-1)?.applied).toBeUndefined();
  const resumed = createJournalWorker(reopened, ports);
  await resumed.drain();
  expect(reopened.view.limits.maxCalls).toBe(6);
  const told = JSON.parse(contexts.at(-1)!) as { operatorRequest?: { state: string } };
  expect(told.operatorRequest?.state).toBe('approved by the operator, not applied yet');
  reopened.close();
}));

// Rule 79: the renewal's live surface follows the installed renewal record. Only with a phone route AND a renewal record
// validated now is renewal a phone action with no host fallback; either missing keeps the declarations' wording.
it('names renewal as a phone action only when a phone route exists and the renewal record is installed', () => {
  const host = 'host command line on the trial machine (journal-agent.mjs)';
  const chat = { connected: true, chat: { admissible: true }, review: { admissible: false, reason: 'x' } };
  const route = 'phone: the operator replies "yes" to the exact request in the bound chat';
  expect(operatorActionSurface(chat, true)).toEqual({ raiseCaps: route, renewExpiry: route });
  expect(operatorActionSurface(chat, false).renewExpiry)
    .toBe(`${route}, once the reviewed activation for the new trial end is installed (--renewal-activation); until then ${host}`);
  expect(operatorActionSurface(chat).renewExpiry).toContain(`until then ${host}`);
  for (const installed of [true, false]) expect(operatorActionSurface(undefined, installed)).toEqual({ raiseCaps: host, renewExpiry: host });
});
