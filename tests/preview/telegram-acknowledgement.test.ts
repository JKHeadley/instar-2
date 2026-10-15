import { afterEach, expect, it, vi } from 'vitest';
import { createReplyTyping, reactionAcknowledgement } from './telegram-acknowledgement.mjs';
const response = (result: unknown, status = 200, ok = true) => ({ kind: 'response', status, bytes: JSON.stringify({ ok, result }) });
afterEach(() => vi.useRealTimers());
it('reacts to exactly the admitted inbound message with a bounded transport call', () => {
  const invoke = vi.fn(() => response(true));
  expect(reactionAcknowledgement(invoke, '-42', 91)).toEqual({ kind: 'accepted', message: 91, acknowledgementPath: 'reaction' });
  expect(invoke).toHaveBeenCalledExactlyOnceWith('setMessageReaction', { chat_id: '-42', message_id: 91,
    reaction: [{ type: 'emoji', emoji: '👀' }] }, 10000);
});
it.each([response(null, 400, false), response(null, 403, false), response(null, 500, false),
  { kind: 'uncertain', sent: false }])('only definite non-delivery permits text fallback (%j)', reply => {
  expect(reactionAcknowledgement(() => reply, '42', 91)).toBeNull();
});
it.each([response(false), response(true, 500), { kind: 'uncertain' }, { kind: 'response', status: 200, bytes: '{' }])(
  'ambiguous reaction stays UNKNOWN, never permits a second acknowledgement (%j)', reply => {
    expect(reactionAcknowledgement(() => reply, '42', 91)?.kind).toBe('unknown');
  });
it('a thrown transport is UNKNOWN too', () => {
  expect(reactionAcknowledgement(() => { throw Error('lost response'); }, '42', 91)?.kind).toBe('unknown');
});
function typing() {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const invoke = vi.fn(() => response(true)), allowed = vi.fn(async () => true);
  const indicator = createReplyTyping({ invoke, allowed, now: () => Date.now(),
    after: (ms, run) => { const t = setTimeout(run, ms); return () => clearTimeout(t); } });
  return { ...indicator, invoke, allowed };
}
it('refreshes typing every four seconds, scopes the topic, stops on the answer/progress send', async () => {
  const t = typing(); t.start('-42', 7, () => true);
  await vi.advanceTimersByTimeAsync(8000);
  expect(t.invoke).toHaveBeenCalledTimes(3);
  expect(t.invoke).toHaveBeenLastCalledWith('sendChatAction', { chat_id: '-42', message_thread_id: 7, action: 'typing' }, 1000);
  t.stop('-42', 7); await vi.advanceTimersByTimeAsync(120000); expect(t.invoke).toHaveBeenCalledTimes(3);
});
it.each(['current', 'authority', 'failure', 'ceiling'] as const)('typing stops at %s', async reason => {
  const t = typing(); let current = true; t.start('42', undefined, () => current);
  await vi.advanceTimersByTimeAsync(0);
  if (reason === 'current') current = false;
  if (reason === 'authority') t.allowed.mockResolvedValue(false);
  if (reason === 'failure') t.invoke.mockReturnValue(response(false));
  await vi.advanceTimersByTimeAsync(240000);
  expect(t.invoke).toHaveBeenCalledTimes(reason === 'ceiling' ? 30 : reason === 'failure' ? 2 : 1);
  const count = t.invoke.mock.calls.length;
  await vi.advanceTimersByTimeAsync(240000); expect(t.invoke).toHaveBeenCalledTimes(count);
});
it('a pending authority read cannot restart typing after final dispatch', async () => {
  const t = typing(); let release!: (allowed: boolean) => void;
  t.allowed.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  t.start('42', undefined, () => true); await vi.advanceTimersByTimeAsync(0);
  t.stop('42', undefined); release(true);
  await vi.advanceTimersByTimeAsync(8000); expect(t.invoke).not.toHaveBeenCalled();
});
