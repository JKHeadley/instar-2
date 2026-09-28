import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps, MINIMAL_RESERVE, MINIMAL_POLL_LIMIT, UNLINKED_EDIT_FLAG,
  UNREADABLE_OPERATOR_MESSAGE, limitedAnswerText, PREVIEW_LIVE_GATES, admittedDependencies, MINIMAL_WORKER_WAIT_MS,
  independentSurface, STOP_PAGE_BUTTON, STOP_CHALLENGE_MS, MINIMAL_WAITING_UPDATES } from './journal-test-worker.js';
import { STOP_CONFIRM_TEXT } from './status-command.js';

const key = new Uint8Array(32).fill(71);
const genesis = (limits: Partial<{ maxCalls: number; maxReplies: number; maxTurns: number; expires: number }> = {}) => ({ kind: 'genesis' as const,
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
  // The over-reserve messages are preserved in order in the waiting store before the cursor passes them.
  expect(journal.view.waiting.map(item => item.update)).toEqual([3 + MINIMAL_RESERVE.turns, 4 + MINIMAL_RESERVE.turns]);
  expect(journal.view.cursor).toBe(5 + MINIMAL_RESERVE.turns);
  expect(worker.intakeHeld()).toBe(true);
  // Reading never stops: the next poll still sees presses and a stop behind the waiting message.
  expect(worker.pollLimit()).toBe(MINIMAL_POLL_LIMIT);
  expect(() => worker.pollGate()).not.toThrow();
  clock += MINIMAL_RESERVE.windowMs;
  worker.intake(burst.slice(MINIMAL_RESERVE.turns));
  expect(journal.view.order).toHaveLength(3 + MINIMAL_RESERVE.turns);
  expect(journal.view.waiting).toEqual([]);
  expect(worker.intakeHeld()).toBe(false);
  journal.close();
}), 60_000);

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
type Marked = { text: string; markup?: { inline_keyboard: { text?: string; callback_data?: string; url?: string }[][] } };
const marked = (sends: Marked[]) => async (input: { expectedText: string; replyMarkup?: unknown }) => {
  const item: Marked = { text: input.expectedText };
  if (input.replyMarkup) item.markup = input.replyMarkup as NonNullable<Marked['markup']>;
  sends.push(item);
  return sends.length; };

it('past 60 ordinary and every reserve message, a stop press and a /stop behind a waiting message are still read', () => withRoot(async path => {
  // The review's counterexample: every conversation bound spent. Reading continues; the waiting message
  // is preserved in order in the waiting store before the cursor passes it, and the brake behind it still works.
  const sends: Marked[] = [], calls: string[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 60, maxCalls: 60, maxReplies: 60 }));
  const worker = createJournalWorker(journal, { ...ports(() => 1000, sends, calls), send: marked(sends) });
  worker.intake(Array.from({ length: 60 }, (_, index) => message(index + 1, `m${index}`)));
  await worker.drain();
  const last = 60 + MINIMAL_RESERVE.turns;
  worker.intake([...Array.from({ length: MINIMAL_RESERVE.turns - 1 }, (_, index) => message(61 + index, `r${index}`)), message(last, '/stop')]);
  await worker.minimal();
  const confirm = sends.at(-1)!;
  expect(confirm.text).toBe(`PREVIEW — ${STOP_CONFIRM_TEXT}`);
  expect(journal.view.order).toHaveLength(last);
  const cursor = journal.view.cursor;
  expect(worker.pollLimit()).toBe(MINIMAL_POLL_LIMIT);
  // The next poll returns an over-bound message first, then the operator's press on the stop confirmation.
  worker.intake([message(last + 1, 'waiting'), press(last + 2, confirm.markup!.inline_keyboard[0]![0]!.callback_data!)]);
  expect(journal.view.stop).toBe('operator');
  expect(journal.view.waiting.map(item => item.update)).toEqual([last + 1]);
  expect(journal.view.cursor).toBe(cursor + 1);
  expect(journal.view.order).toHaveLength(last);
  journal.close();
  // Same bounds, no confirmation pending: an exact /stop behind the waiting message latches at once.
  const second = openPreviewJournal(path.replace('journal.encrypted', 'second.encrypted'), key, genesis({ maxTurns: 1 }));
  const other = createJournalWorker(second, ports(() => 1000, [], []));
  other.intake([message(1, 'one'), ...Array.from({ length: MINIMAL_RESERVE.turns }, (_, index) => message(2 + index, `r${index}`))]);
  const held = second.view.cursor;
  other.intake([message(2 + MINIMAL_RESERVE.turns, 'waiting'), message(3 + MINIMAL_RESERVE.turns, '/stop')]);
  expect(second.view.stop).toBe('operator');
  expect(second.view.waiting.map(item => item.update)).toEqual([2 + MINIMAL_RESERVE.turns]);
  expect(second.view.cursor).toBe(held + 1);
  second.close();
}), 60_000);

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

it('a blocked ordinary model below every cap cannot strand a stop: the minimal path takes it, exactly once', () => withRoot(async path => {
  // Review round 2 (MF1): with ordinary allowance left, the stop used to wait behind the hung model.
  const sends: Marked[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 60, maxCalls: 60, maxReplies: 60 }));
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: () => new Promise<string>(() => {}), send: marked(sends) });
  worker.intake([message(1, 'hello')]);
  void worker.drain();
  await new Promise(done => setImmediate(done));
  worker.intake([message(2, '/stop')]);
  await worker.minimal(); await worker.minimal();
  expect(sends.map(item => item.text)).toEqual([`PREVIEW — ${STOP_CONFIRM_TEXT}`]);
  expect(journal.view.order[1]?.limited?.reason).toBe('worker');
  worker.intake([press(3, sends[0]!.markup!.inline_keyboard[0]![0]!.callback_data!)]);
  expect(journal.view.stop).toBe('operator');
  journal.close();
  // Not admitted (a required dependency missing): the brake needs no reply and latches at once.
  const second = openPreviewJournal(path.replace('journal.encrypted', 'second.encrypted'), key, genesis({ maxTurns: 60 }));
  const other = createJournalWorker(second, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: () => new Promise<string>(() => {}), send: marked([]),
    minimal: { context: (await import('./journal-test-worker.js')).previewTestContext,
      dependencies: () => ({ ...admittedDependencies(), lease: false }) } });
  other.intake([message(1, 'hello')]);
  void other.drain();
  await new Promise(done => setImmediate(done));
  other.intake([message(2, '/stop')]);
  await other.minimal();
  expect(second.view.stop).toBe('operator');
  second.close();
}));

it('a below-cap message waiting on a blocked worker gets one limited answer after the wait bound, never before', () => withRoot(async path => {
  let clock = 1000;
  const sends: Marked[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 60, maxCalls: 60, maxReplies: 60 }));
  const worker = createJournalWorker(journal, { now: () => clock, stopped: () => false, checkOutbound: () => {},
    model: () => new Promise<string>(() => {}), send: marked(sends) });
  worker.intake([message(1, 'hello')]);
  void worker.drain();
  await new Promise(done => setImmediate(done));
  worker.intake([message(2, 'are you there?')]);
  clock += MINIMAL_WORKER_WAIT_MS - 1;
  await worker.minimal();
  expect(sends).toHaveLength(0);
  clock += 1;
  await worker.minimal(); await worker.minimal();
  expect(sends).toHaveLength(1);
  expect(sends[0]!.text).toBe(limitedAnswerText(journal.view, 'worker', 2));
  // No raise is offered: the ordinary worker, not an allowance, is what is missing.
  expect(sends[0]!.markup).toBeUndefined();
  expect(journal.view.order.some(turn => turn.approval)).toBe(false);
  journal.close();
}));

it('a stop behind a full page of waiting messages is preserved and read, never stranded (MF1 held page)', () => withRoot(async path => {
  // Review round 2: 1 ordinary + 12 reserve, then 100 waiting messages and /stop, polled as the runner does.
  const sends: Marked[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1, maxCalls: 60, maxReplies: 60 }));
  const worker = createJournalWorker(journal, { ...ports(() => 1000, [], []), send: marked(sends) });
  worker.intake(Array.from({ length: 13 }, (_, i) => message(i + 1, 'admitted')));
  const queue = [...Array.from({ length: MINIMAL_POLL_LIMIT }, (_, i) => message(i + 14, 'waiting')), message(114, '/stop')];
  for (let i = 0; i < 3 && sends.at(-1)?.text !== `PREVIEW — ${STOP_CONFIRM_TEXT}`; i++) {
    const page = queue.filter(update => update.update_id >= journal.view.cursor).slice(0, worker.pollLimit());
    worker.intake(page); await worker.minimal();
  }
  worker.intake([press(115, sends.at(-1)!.markup!.inline_keyboard[0]![0]!.callback_data!)]);
  expect(journal.view.stop).toBe('operator');
  // Every message the cursor passed is preserved in the journal first (durable intake).
  expect(journal.view.order.map(turn => turn.update)).toEqual(Array.from({ length: 114 }, (_, i) => i + 1));
  journal.close();
}));

it('when the blocked model recovers, the ordinary answer goes and the stop is never confirmed twice', () => withRoot(async path => {
  const sends: Marked[] = [];
  let release: (value: string) => void = () => {};
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 60, maxCalls: 60, maxReplies: 60 }));
  const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: () => new Promise<string>(done => { release = done; }), send: marked(sends) });
  worker.intake([message(1, 'hello')]);
  const pass = worker.drain();
  await new Promise(done => setImmediate(done));
  worker.intake([message(2, '/stop')]);
  await worker.minimal();
  release('ordinary answer');
  await pass; await worker.drain(); await worker.minimal();
  expect(sends.map(item => item.text)).toEqual([`PREVIEW — ${STOP_CONFIRM_TEXT}`, 'PREVIEW — ordinary answer']);
  expect(journal.view.stop).toBeNull();
  journal.close();
}));

it('past the reserve the waiting page is preserved in order; the independent stop page still latches without the queue', () => withRoot(async path => {
  // Review round 3 (MF1): 1 ordinary + every reserve message, then 100 waiting messages, polled as the runner
  // does. The page is preserved before the cursor passes it; the brake also arrives through the independent
  // surface (its own verifier), not the queue.
  let clock = 1000;
  const sends: Marked[] = [];
  const surface = independentSurface(() => clock);
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1, maxCalls: 60, maxReplies: 60 }));
  const worker = createJournalWorker(journal, { ...ports(() => clock, [], []), send: marked(sends), approvalSurface: surface.port });
  worker.intake(Array.from({ length: 1 + MINIMAL_RESERVE.turns }, (_, i) => message(i + 1, 'admitted')));
  await worker.minimal();
  // The standing stop challenge binds the exact stop subject; the limited answer carries its one-tap page.
  const [stop] = journal.view.stopChallenges;
  expect(stop?.audience).toBe('independent-emergency-stop');
  expect(stop?.requestedBy).toBe(stop?.operator);
  expect(stop?.expiresAt).toBe(clock + STOP_CHALLENGE_MS);
  const page = sends.at(-1)!.markup!.inline_keyboard.at(-1)![0]!;
  expect(page).toEqual({ text: STOP_PAGE_BUTTON, url: `https://approve.example.org/c/${stop!.id.replace(':', '-')}` });
  expect(worker.stopPage()).toBe(page.url);
  const first = 2 + MINIMAL_RESERVE.turns, sent = sends.length;
  const queue = Array.from({ length: MINIMAL_POLL_LIMIT }, (_, i) => message(first + i, 'waiting'));
  const cursors: number[] = [];
  for (let i = 0; i < 3; i++) {
    const polled = queue.filter(update => update.update_id >= journal.view.cursor).slice(0, worker.pollLimit());
    worker.intake(polled); await worker.minimal(); cursors.push(journal.view.cursor);
  }
  // Every waiting message is preserved, in order, before the cursor passes it; none is taken as a turn.
  expect(cursors).toEqual([first + MINIMAL_POLL_LIMIT, first + MINIMAL_POLL_LIMIT, first + MINIMAL_POLL_LIMIT]);
  expect(journal.view.waiting.map(item => item.update)).toEqual(queue.map(update => update.update_id));
  expect(journal.view.stop).toBeNull();
  // Wrong decisions and forged proofs decide nothing (Rule 98); the one-use proof stays unspent.
  surface.acts.push({ challenge: stop!.id, proof: surface.sign(stop!.id, 'decline'), decision: 'decline' });
  surface.acts.push({ challenge: stop!.id, proof: 'forged', decision: 'approve' });
  await worker.minimal();
  expect(journal.view.stop).toBeNull();
  // The operator taps Stop on the independent page: the next minimal step latches it, before any poll.
  surface.operatorActs(stop!.id, 'approve');
  await worker.minimal();
  expect(journal.view.stop).toBe('operator');
  expect(sends).toHaveLength(sent);
  expect(journal.view.order).toHaveLength(1 + MINIMAL_RESERVE.turns);
  expect(() => worker.gate()).toThrow('preview stopped');
  journal.close();
  const replay = openPreviewJournal(path, key);
  expect(replay.view.stop).toBe('operator');
  expect(replay.view.stopChallenges.map(item => item.id)).toEqual([stop!.id]);
  replay.close();
}), 60_000);

it('a stop challenge for another subject or principal is refused at the journal, and never latches', () => withRoot(async path => {
  let clock = 1000;
  const surface = independentSurface(() => clock);
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1 }));
  const worker = createJournalWorker(journal, { ...ports(() => clock, [], []), approvalSurface: surface.port });
  await worker.minimal();
  const genuine = journal.view.stopChallenges[0]!;
  // A substituted row (agent-writable) cannot enter: another operator, or a moved subject.
  expect(() => journal.append({ kind: 'stop-challenge', challenge: { ...genuine, id: 'challenge:x', operator: 'telegram:1', requestedBy: 'telegram:1' }, at: clock }))
    .toThrow('stop challenge refused');
  expect(() => journal.append({ kind: 'stop-challenge', challenge: { ...genuine, id: 'challenge:y', requestDigest: `sha256:${'0'.repeat(64)}` as never }, at: clock }))
    .toThrow('stop challenge refused');
  // A verified stop naming a challenge this journal never recorded is refused.
  expect(() => journal.append({ kind: 'stop', reason: 'operator', verified: { challenge: 'challenge:unknown', principal: genuine.operator, receipt: 'sha256:x' }, at: clock }))
    .toThrow('verified stop refused');
  // An expired standing challenge is reissued; an act on the lapsed one decides nothing.
  clock += STOP_CHALLENGE_MS + 1;
  surface.operatorActs(genuine.id, 'approve');
  await worker.minimal();
  expect(journal.view.stop).toBeNull();
  expect(journal.view.stopChallenges.map(item => item.id)).not.toContain(genuine.id);
  expect(journal.view.stopChallenges).toHaveLength(1);
  journal.close();
}));

it('a failed ordinary worker leaves the minimal path answering at once, and a later ordinary pass recovers (ordinary-worker cut)', () => withRoot(async path => {
  // Eleven §5's first fault class: the ordinary conversation worker fails outright while every minimal
  // prerequisite holds. The minimal path answers below every cap without waiting, and a stop still latches.
  const sends: Marked[] = [];
  let lost = true;
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 60, maxCalls: 60, maxReplies: 60 }));
  const worker = createJournalWorker(journal, { ...ports(() => 1000, [], []), send: marked(sends),
    sources: () => { if (lost) throw Error('ordinary worker lost'); return []; } });
  worker.intake([message(1, 'hello')]);
  await expect(worker.drain()).rejects.toThrow('ordinary worker lost');
  await worker.minimal();
  expect(sends.map(item => item.text)).toEqual([limitedAnswerText(journal.view, 'worker', 1)]);
  // The ordinary answer still follows once the ordinary worker recovers; the limited answer is not repeated.
  lost = false;
  await worker.drain(); await worker.minimal();
  expect(sends.map(item => item.text)).toEqual([limitedAnswerText(journal.view, 'worker', 1), 'PREVIEW — ordinary answer']);
  lost = true;
  worker.intake([message(2, 'still there?'), message(3, '/stop')]);
  await expect(worker.drain()).rejects.toThrow('ordinary worker lost');
  await worker.minimal();
  expect(sends.slice(2).map(item => item.text)).toEqual([limitedAnswerText(journal.view, 'worker', 1), `PREVIEW — ${STOP_CONFIRM_TEXT}`]);
  worker.intake([press(4, sends.at(-1)!.markup!.inline_keyboard[0]![0]!.callback_data!)]);
  expect(journal.view.stop).toBe('operator');
  journal.close();
}));

/** One runner poll cycle: a held full page that moved the cursor is followed at once by the next page. */
const pollCycle = (worker: ReturnType<typeof createJournalWorker>, journal: ReturnType<typeof openPreviewJournal>,
  queue: ReturnType<typeof message>[]) => {
  let pages = 0, page: ReturnType<typeof message>[];
  do {
    page = queue.filter(update => update.update_id >= journal.view.cursor).slice(0, worker.pollLimit());
    worker.intake(page); pages++;
  } while (journal.view.stop === null && worker.readAhead() && page.length >= worker.pollLimit());
  return pages;
};

it('MF1 round 4: a /stop behind the reserve and a full waiting page latches on the first poll, every other update preserved in order', () => withRoot(async path => {
  // The reviewer's counterexample, in the live runner's configuration (no independent surface): 1 ordinary +
  // 240 reserve + 100 waiting updates, /stop at 342.
  const sends: Marked[] = [], calls: string[] = [];
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1, maxCalls: 60, maxReplies: 60 }));
  const worker = createJournalWorker(journal, { ...ports(() => 1000, sends, calls), send: marked(sends) });
  worker.intake(Array.from({ length: 1 + MINIMAL_RESERVE.turns }, (_, i) => message(i + 1, 'admitted')));
  await worker.minimal();
  const sent = sends.length, first = 2 + MINIMAL_RESERVE.turns;
  expect(first).toBe(242);
  const queue = [...Array.from({ length: MINIMAL_POLL_LIMIT }, (_, i) => message(first + i, 'waiting')), message(342, '/stop')];
  expect(pollCycle(worker, journal, queue)).toBe(2);
  expect(journal.view.stop).toBe('operator');
  // Nothing skipped or dropped: 241 turns, then the 100 waiting updates in order; the stop update is kept on its row.
  expect(journal.view.order.map(turn => turn.update)).toEqual(Array.from({ length: 241 }, (_, i) => i + 1));
  expect(journal.view.waiting.map(item => item.update)).toEqual(Array.from({ length: 100 }, (_, i) => first + i));
  // No model call and no send after the stop.
  expect(() => worker.gate()).toThrow('preview stopped');
  await expect(worker.drain()).rejects.toThrow('preview stopped');
  expect(calls).toEqual([]);
  expect(sends).toHaveLength(sent);
  journal.close();
  const replay = openPreviewJournal(path, key);
  expect(replay.view.stop).toBe('operator');
  expect(replay.view.waiting.map(item => item.update)).toEqual(Array.from({ length: 100 }, (_, i) => first + i));
  replay.close();
}), 60_000);

it('waiting updates are taken as turns in order once the reserve frees; the store is finite', () => withRoot(async path => {
  let clock = 1000;
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1, maxCalls: 60, maxReplies: 60 }));
  const worker = createJournalWorker(journal, ports(() => clock, [], []));
  worker.intake(Array.from({ length: 1 + MINIMAL_RESERVE.turns }, (_, i) => message(i + 1, 'admitted')));
  worker.intake([message(242, 'a'), message(243, 'b')]);
  expect(journal.view.waiting.map(item => item.update)).toEqual([242, 243]);
  expect(worker.intakeHeld()).toBe(true);
  // A row past the store, or one that would skip past the cursor, is refused at the journal.
  expect(() => journal.append({ kind: 'waiting', update: 100, raw: JSON.stringify(message(100, 'x')), cursor: 101, at: clock }))
    .toThrow('waiting update refused');
  clock += MINIMAL_RESERVE.windowMs + 1;
  worker.intake([message(244, 'c')]);
  expect(journal.view.waiting).toEqual([]);
  expect(journal.view.order.slice(-3).map(turn => [turn.update, turn.text])).toEqual([[242, 'a'], [243, 'b'], [244, 'c']]);
  expect(MINIMAL_WAITING_UPDATES).toBeGreaterThan(MINIMAL_POLL_LIMIT);
  journal.close();
}), 60_000);

it('MF9: a displayed Stop page stays valid through repeated minimal steps, and its genuine approval latches', () => withRoot(async path => {
  // The reviewer's probe: a one-hour trial, the page for challenge 1 displayed, eight extra minimal steps with
  // no clock movement or new input, then the operator's genuine approval for challenge 1.
  const clock = 1000;
  const sends: Marked[] = [];
  const surface = independentSurface(() => clock);
  const journal = openPreviewJournal(path, key, genesis({ maxTurns: 1, maxCalls: 60, maxReplies: 60, expires: clock + 3_600_000 }));
  const worker = createJournalWorker(journal, { ...ports(() => clock, [], []), send: marked(sends), approvalSurface: surface.port });
  worker.intake([message(1, 'one'), message(2, 'two')]);
  await worker.minimal();
  const displayed = sends.at(-1)!.markup!.inline_keyboard.at(-1)![0]!;
  expect(displayed.url).toBe('https://approve.example.org/c/challenge-1');
  for (let i = 0; i < 8; i++) await worker.minimal();
  // No churn: the unexpired challenge is reused and never evicted.
  expect([...surface.issued.values()].filter(item => item.audience === 'independent-emergency-stop')).toHaveLength(1);
  expect(journal.view.stopChallenges.map(item => item.id)).toEqual(['challenge:1']);
  surface.operatorActs('challenge:1', 'approve');
  await worker.minimal();
  expect(journal.view.stop).toBe('operator');
  journal.close();
}), 60_000);
