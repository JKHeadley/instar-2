import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps, MINIMAL_RESERVE, UNLINKED_EDIT_FLAG,
  UNREADABLE_OPERATOR_MESSAGE, limitedAnswerText, PREVIEW_LIVE_GATES } from './journal-test-worker.js';

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
  expect(worker.pollLimit()).toBe(MINIMAL_RESERVE.turns);
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
  expect(worker.pollLimit()).toBe(MINIMAL_RESERVE.turns);
  const burst = Array.from({ length: MINIMAL_RESERVE.turns + 2 }, (_, index) => message(3 + index, `m${index}`));
  worker.intake(burst);
  expect(journal.view.order).toHaveLength(1 + MINIMAL_RESERVE.turns);
  // The cursor stays before the first unread operator message: it waits at Telegram, not lost.
  expect(journal.view.cursor).toBe(3 + MINIMAL_RESERVE.turns);
  expect(worker.pollLimit()).toBe(0);
  expect(() => worker.pollGate()).toThrow('reserve spent');
  clock += MINIMAL_RESERVE.windowMs;
  expect(worker.pollLimit()).toBe(MINIMAL_RESERVE.turns);
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
  expect(worker.nextHeldNoticeAt()).toBeNull();
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
    'model call cap', 'minimal reserve bound', 'operator approval request', 'UNKNOWN call or send']);
  expect(PREVIEW_LIVE_GATES.every(gate => gate.preserves && gate.basis)).toBe(true);
  expect(PREVIEW_LIVE_GATES.find(gate => gate.gate.startsWith('pre-send reply review'))?.fails).toBe('open');
});
