import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, raiseJournalCaps, approvalRequestText, limitedAnswerText } from './journal-test-worker.js';
import { STOP_CONFIRM_TEXT } from './status-command.js';

// Rules 79/82/98: operator-only actions complete from the phone as prefilled Approve/Decline
// requests bound to the journal base; silence, text and a stale base never approve.
const key = new Uint8Array(32).fill(91);
const genesis = (limits: Partial<{ maxCalls: number; maxReplies: number; maxTurns: number }> = {}) => ({ kind: 'genesis' as const,
  bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
  expires: 9999999999999, maxCalls: 1, maxReplies: 8, maxTurns: 8, maxBytes: 32768, cursor: 0, ...limits });
const message = (id: number, text: string) => ({ update_id: id,
  message: { message_id: id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
const press = (id: number, data: string, from = 7654321) => ({ update_id: id,
  callback_query: { id: `cb-${id}`, from: { id: from }, data, message: { message_id: 900, chat: { id: 7654321, type: 'private' } } } });
type Sent = { text: string; markup?: { inline_keyboard: { text: string; callback_data: string }[][] }; kind?: string; disposition?: string };
const harness = (path: string, boundary?: (stage: string) => void, limits = {}) => {
  const sent: Sent[] = [], toasts: string[] = [], calls: string[] = [];
  const journal = openPreviewJournal(path, key, genesis(limits), boundary);
  const ports = { now: () => 1000, stopped: () => false, checkOutbound: () => {},
    model: async (input: { id: string }) => { calls.push(input.id); return 'ordinary answer'; },
    acknowledge: (_id: string, text: string) => { toasts.push(text); },
    send: async (input: { expectedText: string; replyMarkup?: unknown; kind?: string; disposition?: string }) => {
      const item: Sent = { text: input.expectedText };
      if (input.replyMarkup) item.markup = input.replyMarkup as NonNullable<Sent['markup']>;
      if (input.kind) item.kind = input.kind;
      if (input.disposition) item.disposition = input.disposition;
      sent.push(item);
      return sent.length; } };
  return { journal, worker: createJournalWorker(journal, ports), sent, toasts, calls, ports };
};
const withRoot = async (run: (path: string) => Promise<void>) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-approvals-')));
  try { await run(join(root, 'journal.encrypted')); } finally { rmSync(root, { recursive: true, force: true }); }
};
const buttons = (item: Sent | undefined) => item?.markup?.inline_keyboard[0]!.map(button => button.callback_data) ?? [];

it('offers a prefilled raise with the limited answer and applies it only on the operator press', () => withRoot(async path => {
  const { journal, worker, sent, toasts, calls } = harness(path);
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, 'two')]); await worker.drain();
  const offer = sent.at(-1)!;
  expect(offer.text).toContain(limitedAnswerText(journal.view, 'calls', 1));
  expect(offer.text).toContain(approvalRequestText(journal.view, 'calls'));
  expect(offer.text).toContain('from 1 to 2');
  expect(offer.disposition).toBe('action-needed');
  const [approve, decline] = buttons(offer);
  expect(approve).toMatch(/^ap:[0-9a-f]{16}$/u);
  expect(decline).toBe(approve!.replace('ap:', 'dc:'));
  // Silence is never consent: time passes and nothing changes (Rule 98).
  await worker.drain(); await worker.drain();
  expect(journal.view.limits.maxCalls).toBe(1);
  // A stranger's press is preserved as data and decides nothing.
  worker.intake([press(3, approve!, 999)]);
  expect(journal.view.limits.maxCalls).toBe(1);
  worker.intake([press(4, approve!)]);
  expect(journal.view.limits.maxCalls).toBe(2);
  expect(journal.view.capAuthority).toMatch(/^telegram-approval:[0-9a-f]{16}:update:4$/u);
  expect(toasts).toEqual(['Approved. Answering your saved messages now.']);
  await worker.drain();
  expect(calls).toHaveLength(2);
  expect(sent.at(-1)?.text).toBe('PREVIEW — ordinary answer');
  // A second press of the same request is recorded as a duplicate and raises nothing.
  worker.intake([press(5, approve!)]);
  expect(journal.view.limits.maxCalls).toBe(2);
  expect(toasts.at(-1)).toBe('Already decided.');
  journal.close();
}));

it('declines without change, and refuses a request made stale by another raise', () => withRoot(async path => {
  const { journal, worker, sent, toasts } = harness(path);
  worker.intake([message(1, 'one'), message(2, 'two')]); await worker.drain();
  const [approve, decline] = buttons(sent.at(-1));
  worker.intake([press(3, decline!)]);
  expect(journal.view.limits.maxCalls).toBe(1);
  expect(toasts).toEqual(['Declined. Nothing changed.']);
  raiseJournalCaps(journal, { maxCalls: 3, maxReplies: 8, maxTurns: 8, authority: 'test: desk raise', at: 1000 });
  worker.intake([press(4, approve!)]);
  expect(journal.view.limits.maxCalls).toBe(3);
  expect(journal.view.order.find(turn => turn.approval)?.approval?.decision).toBe('declined');
  journal.close();
}));

it('marks a request stale when its base moved before the press, and the next capped answer offers a fresh one', () => withRoot(async path => {
  const { journal, worker, sent, toasts } = harness(path, undefined, { maxCalls: 1 });
  worker.intake([message(1, 'one'), message(2, 'two')]); await worker.drain();
  const [approve] = buttons(sent.at(-1));
  raiseJournalCaps(journal, { maxCalls: 1, maxReplies: 9, maxTurns: 8, authority: 'test: other raise', at: 1000 });
  worker.intake([press(3, approve!)]);
  expect(toasts).toEqual(['This request is out of date. Send any message for a fresh one.']);
  expect(journal.view.limits.maxCalls).toBe(1);
  worker.intake([message(4, 'three')]); await worker.drain();
  const [fresh] = buttons(sent.at(-1));
  expect(fresh).toMatch(/^ap:/u);
  expect(fresh).not.toBe(approve);
  journal.close();
}));

it('applies an approved raise exactly once after a crash between the decision and the raise', () => withRoot(async path => {
  let crash = true;
  const first = harness(path, stage => { if (crash && stage === 'after:approval-decision') { crash = false; throw Error('crash'); } });
  first.worker.intake([message(1, 'one'), message(2, 'two')]); await first.worker.drain();
  const [approve] = buttons(first.sent.at(-1));
  expect(() => first.worker.intake([press(3, approve!)])).toThrow('crash');
  first.journal.close();
  const reopened = openPreviewJournal(path, key);
  expect(reopened.view.limits.maxCalls).toBe(1);
  const worker = createJournalWorker(reopened, first.ports);
  await worker.drain();
  expect(reopened.view.limits.maxCalls).toBe(2);
  await worker.drain();
  expect(reopened.view.limits.maxCalls).toBe(2);
  reopened.close();
}));

it('confirms /stop with prefilled buttons and latches the stop only on the operator press', () => withRoot(async path => {
  const { journal, worker, sent, toasts, calls } = harness(path, undefined, { maxCalls: 4 });
  worker.intake([message(1, '/stop')]); await worker.drain();
  expect(calls).toHaveLength(0);
  expect(sent.at(-1)?.text).toBe(`PREVIEW — ${STOP_CONFIRM_TEXT}`);
  expect(sent.at(-1)?.kind).toBe('approval');
  const [approve] = buttons(sent.at(-1));
  expect(journal.view.stop).toBeNull();
  worker.intake([press(2, approve!)]);
  expect(journal.view.stop).toBe('operator');
  expect(toasts).toEqual(['Stopped. Nothing more will be sent or spent.']);
  expect(() => worker.gate()).toThrow('preview stopped');
  expect(() => worker.intake([message(3, 'hello?')])).toThrow('preview stopped');
  expect(sent).toHaveLength(1);
  journal.close();
}));

it('keeps the phone stop reachable past the ordinary turn allowance', () => withRoot(async path => {
  const { journal, worker, sent } = harness(path, undefined, { maxCalls: 4, maxTurns: 1 });
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, '/stop')]); await worker.drain();
  expect(journal.view.order[1]?.reserve).toBe(true);
  expect(sent.at(-1)?.text).toBe(`PREVIEW — ${STOP_CONFIRM_TEXT}`);
  worker.intake([press(3, buttons(sent.at(-1))[0]!)]);
  expect(journal.view.stop).toBe('operator');
  journal.close();
}));

it('raises the turn allowance to cover every reserve turn when the operator approves', () => withRoot(async path => {
  const { journal, worker, sent, calls } = harness(path, undefined, { maxCalls: 16, maxTurns: 1 });
  worker.intake([message(1, 'one')]); await worker.drain();
  worker.intake([message(2, 'a'), message(3, 'b'), message(4, 'c'), message(5, 'd')]); await worker.drain();
  const offer = sent.at(-1)!;
  expect(offer.text).toContain('from 1 to 6');
  worker.intake([press(6, buttons(offer)[0]!)]);
  expect(journal.view.limits.maxTurns).toBe(6);
  await worker.drain();
  expect(calls).toHaveLength(5);
  journal.close();
}));
