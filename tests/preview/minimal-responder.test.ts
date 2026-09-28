import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps, MINIMAL_RESERVE, MINIMAL_POLL_LIMIT, UNLINKED_EDIT_FLAG,
  UNREADABLE_OPERATOR_MESSAGE, limitedAnswerText, PREVIEW_LIVE_GATES, admittedDependencies } from './journal-test-worker.js';
import { STOP_CONFIRM_TEXT } from './status-command.js';

const key = new Uint8Array(32).fill(71);
const genesis = (limits: Partial<{ maxCalls: number; maxReplies: number; maxTurns: number }> = {}) => ({ kind: 'genesis' as const,
  bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
  expires: 9999999999999, maxCalls: 8, maxReplies: 8, maxTurns: 2, maxBytes: 32768, cursor: 0, ...limits });
const message = (id: number, text: string, extra: Record<string, unknown> = {}, from = 7654321) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: from }, text, ...extra } });
const withRoot = async (run: (path: string) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-minimal-')));
  try { await run(join(root, 'journal.encrypted')); } finally { rmSync(root, { recursive: true, force: true }); }
};
const ports = (now: () => number, sends: { text: string; thread?: number }[], calls: string[]) => ({ now, stopped: () => false,
  model: async (input: { id: string }) => { calls.push(input.id); return 'ordinary answer'; }, checkOutbound: () => {},
  send: async (input: { expectedText: string; thread?: number }) => {
    sends.push({ text: input.expectedText, ...(input.thread === undefined ? {} : { thread: input.thread }) }); return sends.length; } });

it('keeps reading past the turn allowance and gives a burst one limited answer, with no model call and no repeat', () => withRoot(async path => {
  let clock = 1000;
  const sends: { text: string }[] = [], calls: string[] = [];
  const journal = openPreviewJournal(path, key, genesis());
  const worker = createJournalWorker(journal, ports(() => clock, sends, calls));
  worker.intake([message(1, 'one'), message(2, 'two')]); await worker.drain();
  expect(sends).toHaveLength(2);
  // Before this build the poll gate threw here and the runner stopped reading (Rule 15).
  expect(worker.pollLimit()).toBe(MINIMAL_POLL_LIMIT);
  expect(() => worker.pollGate()).not.toThrow();
  worker.intake([message(3, 'three'), message(4, 'four')]); await worker.drain();
  expect(calls).toHaveLength(2);
  expect(journal.view.order.slice(2).map(turn => turn.reserve)).toEqual([true, true]);
  expect(sends).toHaveLength(3);
  expect(sends[2]!.text.startsWith(limitedAnswerText(journal.view, 'turns', 2))).toBe(true);
  expect(journal.view.replies).toBe(2);
  await worker.drain();
  expect(sends).toHaveLength(3);
  journal.close();
  const replay = openPreviewJournal(path, key);
  const resumed = createJournalWorker(replay, ports(() => clock, sends, calls));
  await resumed.drain();
  expect(sends).toHaveLength(3);
  expect(replay.view.order[2]?.limitedSent).toBe(3);
  // After an authorized raise the preserved messages get their ordinary answers, once.
  clock = 2000;
  raiseJournalCaps(replay, { maxCalls: 8, maxReplies: 8, maxTurns: 4, authority: 'test raise', at: clock });
  await resumed.drain();
  expect(calls).toHaveLength(4);
  expect(sends.slice(3).map(item => item.text)).toEqual(['PREVIEW — ordinary answer', 'PREVIEW — ordinary answer']);
  replay.close();
}));

it('bounds the reserve per rolling hour, then frees it; a stranger never spends it', () => withRoot(async path => {
  let clock = 1000;
  const sends: { text: string }[] = [], calls: string[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1 }));
  const worker = createJournalWorker(journal, ports(() => clock, sends, calls));
  worker.intake([message(1, 'ordinary')]); await worker.drain();
  worker.intake([message(2, 'stranger', {}, 999)]);
  expect(journal.view.order).toHaveLength(1);
  expect(journal.view.cursor).toBe(3);
  expect(worker.pollLimit()).toBe(MINIMAL_POLL_LIMIT);
  const burst = Array.from({ length: MINIMAL_RESERVE.turns + 2 }, (_, index) => message(3 + index, `m${index}`));
  worker.intake(burst);
  expect(journal.view.order).toHaveLength(1 + MINIMAL_RESERVE.turns);
  // The cursor stays before the first unread operator message: it waits at Telegram, not lost.
  expect(journal.view.cursor).toBe(3 + MINIMAL_RESERVE.turns);
  expect(worker.intakeHeld()).toBe(true);
  // Reading never stops: the next poll still sees presses and a stop behind the waiting message.
  expect(worker.pollLimit()).toBe(MINIMAL_POLL_LIMIT);
  expect(() => worker.pollGate()).not.toThrow();
  clock += MINIMAL_RESERVE.windowMs;
  worker.intake(burst.slice(MINIMAL_RESERVE.turns));
  expect(journal.view.order).toHaveLength(3 + MINIMAL_RESERVE.turns);
  expect(worker.intakeHeld()).toBe(false);
  journal.close();
}));

it('answers a reply-cap hold from the reserve without spending an ordinary reply slot', () => withRoot(async path => {
  const sends: { text: string }[] = [], calls: string[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxReplies: 1, maxTurns: 4 }));
  const worker = createJournalWorker(journal, ports(() => 1000, sends, calls));
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, 'two')]); await worker.drain();
  expect(journal.view.order[1]?.held).toBe('reply cap');
  expect(sends).toHaveLength(2);
  expect(sends[1]!.text.startsWith(limitedAnswerText(journal.view, 'replies', 1))).toBe(true);
  expect(journal.view.replies).toBe(1);
  journal.close();
}));

it('answers a call-cap hold at once from the reserve, instead of a ten-minute held notice', () => withRoot(async path => {
  let clock = 1000;
  const sends: { text: string }[] = [], calls: string[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxCalls: 1, maxTurns: 4 }));
  const worker = createJournalWorker(journal, ports(() => clock, sends, calls));
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, 'two')]); await worker.drain();
  expect(journal.view.order[1]?.held).toBe('call cap');
  expect(sends.at(-1)?.text.startsWith(limitedAnswerText(journal.view, 'calls', 1))).toBe(true);
  clock += 2 * 3_600_000; await worker.drain();
  expect(sends).toHaveLength(2);
  journal.close();
}));

it('refuses the limited answer after the operator stop; the message stays preserved', () => withRoot(async path => {
  const sends: { text: string }[] = [], calls: string[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1 }));
  const worker = createJournalWorker(journal, ports(() => 1000, sends, calls));
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, 'two')]);
  worker.stop('operator');
  await expect(worker.drain()).rejects.toThrow('preview stopped');
  expect(sends).toHaveLength(1);
  expect(journal.view.order[1]?.text).toBe('two');
  journal.close();
}));

it('delivers an operator photo and an unlinked edit to the mind with flags; service and foreign updates take no turn', () => withRoot(async path => {
  const sends: { text: string }[] = [], questions: string[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 8 }));
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async (input: { question: string }) => { questions.push(input.question); return 'seen'; },
    send: async (input: { expectedText: string }) => { sends.push({ text: input.expectedText }); return sends.length; } });
  worker.intake([
    { update_id: 1, message: { message_id: 1, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, photo: [{}], caption: 'my desk' } },
    { update_id: 2, message: { message_id: 2, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, voice: {} } },
    { update_id: 3, message: { message_id: 3, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, pinned_message: {} } },
    { update_id: 4, edited_message: { message_id: 77, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'fixed typo' } },
    { update_id: 5, edited_message: { message_id: 78, chat: { id: 7654321, type: 'private' }, from: { id: 999 }, text: 'stranger edit' } },
  ] as never);
  expect(journal.view.order.filter(turn => turn.accepted).map(turn => turn.text)).toEqual([
    `my desk\n${UNREADABLE_OPERATOR_MESSAGE}`, UNREADABLE_OPERATOR_MESSAGE, `${UNLINKED_EDIT_FLAG}\nfixed typo`]);
  expect(journal.view.order.filter(turn => !turn.accepted)).toHaveLength(2);
  await worker.drain();
  expect(questions.some(question => question.includes(UNREADABLE_OPERATOR_MESSAGE))).toBe(true);
  expect(sends).toHaveLength(3);
  journal.close();
}));

it('declares a fail direction for every live gate, with only exact floors failing closed (Rules 4, 95)', () => {
  const closed = PREVIEW_LIVE_GATES.filter(gate => gate.fails === 'closed').map(gate => gate.gate);
  expect(closed).toEqual(['operator identity and binding', 'credential shape before send', 'operator stop and trial expiry',
    'model call cap', 'minimal reserve bound', 'minimal-path admission (Part Eleven verdict)', 'operator approval request',
    'UNKNOWN call or send']);
  expect(PREVIEW_LIVE_GATES.every(gate => gate.preserves && gate.basis)).toBe(true);
  expect(PREVIEW_LIVE_GATES.find(gate => gate.gate.startsWith('pre-send reply review'))?.fails).toBe('open');
});

it('exposes no conversation-creating method at the one Telegram boundary (Rule 53)', () => {
  const bridge = readFileSync(join(process.cwd(), 'src/assembly/telegram-bot-api-bridge.mjs'), 'utf8');
  const line = /const validMethod = ([^;]+);/u.exec(bridge)?.[1] ?? '';
  expect([...line.matchAll(/request\?\.method === '([A-Za-z]+)'/gu)].map(match => match[1]).sort())
    .toEqual(['answerCallbackQuery', 'getMe', 'getUpdates', 'sendMessage']);
  expect(bridge).not.toMatch(/createForumTopic|createChatInviteLink|sendMessage.*chat_id:\s*['"]@/u);
});

const press = (id: number, data: string) => ({ update_id: id,
  callback_query: { id: `cb-${id}`, from: { id: 7654321 }, data, message: { message_id: 900, chat: { id: 7654321, type: 'private' } } } });
type Marked = { text: string; markup?: { inline_keyboard: { callback_data?: string }[][] } };
const marked = (sends: Marked[]) => async (input: { expectedText: string; replyMarkup?: unknown }) => {
  const item: Marked = { text: input.expectedText };
  if (input.replyMarkup) item.markup = input.replyMarkup as NonNullable<Marked['markup']>;
  sends.push(item);
  return sends.length; };

it('past 60 ordinary and 12 reserve messages, a stop press and a /stop behind a waiting message are still read', () => withRoot(async path => {
  // The review's counterexample: every conversation bound spent. Reading continues; the waiting message
  // stays at Telegram with the cursor before it, and the brake behind it still works.
  const sends: Marked[] = [], calls: string[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 60, maxCalls: 60, maxReplies: 60 }));
  const worker = createJournalWorker(journal, { ...ports(() => 1000, sends, calls), send: marked(sends) });
  worker.intake(Array.from({ length: 60 }, (_, index) => message(index + 1, `m${index}`)));
  await worker.drain();
  worker.intake([...Array.from({ length: 11 }, (_, index) => message(61 + index, `r${index}`)), message(72, '/stop')]);
  await worker.minimal();
  const confirm = sends.at(-1)!;
  expect(confirm.text).toBe(`PREVIEW — ${STOP_CONFIRM_TEXT}`);
  expect(journal.view.order).toHaveLength(72);
  const cursor = journal.view.cursor;
  expect(worker.pollLimit()).toBe(MINIMAL_POLL_LIMIT);
  // The next poll returns an over-bound message first, then the operator's press on the stop confirmation.
  worker.intake([message(73, 'waiting'), press(74, confirm.markup!.inline_keyboard[0]![0]!.callback_data!)]);
  expect(journal.view.stop).toBe('operator');
  expect(journal.view.cursor).toBe(cursor);
  expect(journal.view.order).toHaveLength(72);
  journal.close();
  // Same bounds, no confirmation pending: an exact /stop behind the waiting message latches at once.
  const second = openPreviewJournal(path.replace('journal.encrypted', 'second.encrypted'), key, genesis({ maxTurns: 1 }));
  const other = createJournalWorker(second, ports(() => 1000, [], []));
  other.intake([message(1, 'one'), ...Array.from({ length: MINIMAL_RESERVE.turns }, (_, index) => message(2 + index, `r${index}`))]);
  const held = second.view.cursor;
  other.intake([message(20, 'waiting'), message(21, '/stop')]);
  expect(second.view.stop).toBe('operator');
  expect(second.view.cursor).toBe(held);
  second.close();
}));

it('an ordinary worker blocked on its model does not silence the minimal path: limited answer and stop stay prompt', () => withRoot(async path => {
  const sends: Marked[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1 }));
  let started = false;
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    // The ordinary model never answers (a hung or failed worker dependency).
    model: () => { started = true; return new Promise<string>(() => {}); }, send: marked(sends) });
  worker.intake([message(1, 'one')]);
  void worker.drain();
  await new Promise(done => setImmediate(done));
  expect(started).toBe(true);
  const began = performance.now();
  worker.intake([message(2, 'two'), message(3, 'three')]);
  await worker.minimal();
  expect(sends).toHaveLength(1);
  expect(sends[0]!.text.startsWith(limitedAnswerText(journal.view, 'turns', 2))).toBe(true);
  worker.intake([message(4, '/stop')]);
  await worker.minimal();
  expect(sends.at(-1)?.text).toBe(`PREVIEW — ${STOP_CONFIRM_TEXT}`);
  worker.intake([press(5, sends.at(-1)!.markup!.inline_keyboard[0]![0]!.callback_data!)]);
  expect(journal.view.stop).toBe('operator');
  // Receipt-to-response and stop-to-halt, measured on this host while the model is still blocked.
  expect(performance.now() - began).toBeLessThan(2000);
  journal.close();
}));

it('a missing required dependency leaves the message preserved with an owned outage, and recovery answers once', () => withRoot(async path => {
  const sends: Marked[] = [], calls: string[] = [];
  let route = false;
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1 }));
  const worker = createJournalWorker(journal, { ...ports(() => 1000, sends, calls), send: marked(sends),
    minimal: { context: (await import('./journal-test-worker.js')).previewTestContext,
      dependencies: () => ({ ...admittedDependencies(), route }) } });
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, 'two')]);
  await worker.minimal(); await worker.minimal();
  // Part Eleven's verdict refuses: nothing is sent, the input stays, and the outage names the dependency once.
  expect(sends).toHaveLength(1);
  expect(journal.view.order[1]?.text).toBe('two');
  expect(journal.view.order[1]?.minimalOutage?.missing).toEqual(['route']);
  journal.close();
  const replay = openPreviewJournal(path, key);
  expect(replay.view.order[1]?.minimalOutage?.missing).toEqual(['route']);
  const resumed = createJournalWorker(replay, { ...ports(() => 1000, sends, calls), send: marked(sends),
    minimal: { context: (await import('./journal-test-worker.js')).previewTestContext,
      dependencies: () => ({ ...admittedDependencies(), route }) } });
  route = true;
  await resumed.minimal(); await resumed.minimal();
  expect(sends).toHaveLength(2);
  expect(sends[1]!.text.startsWith(limitedAnswerText(replay.view, 'turns', 1))).toBe(true);
  // During an outage the brake needs no reply: an exact /stop latches at once.
  route = false;
  resumed.intake([message(3, '/stop')]);
  await resumed.minimal();
  expect(replay.view.stop).toBe('operator');
  expect(sends).toHaveLength(2);
  replay.close();
}));

it('with no minimal-path owner installed nothing is admitted: the real worker never speaks from the reserve', () => withRoot(async path => {
  const { createJournalWorker: realWorker } = await import('./journal.js');
  const sends: Marked[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1 }));
  const worker = realWorker(journal, { ...ports(() => 1000, sends, []), send: marked(sends),
    summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }) });
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, 'two')]); await worker.minimal();
  expect(sends).toHaveLength(1);
  expect(journal.view.order[1]?.minimalOutage?.missing).toEqual(['minimal-path-owner']);
  journal.close();
}));
