import { readFileSync } from 'node:fs';
// @ts-expect-error Host-only JavaScript reader.
import { createWorkingActivities } from './working-activity.mjs';
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
  return { ...indicator, start: (chat: string, thread: number | undefined, current: () => boolean, working = () => true) => indicator.start(chat, thread, current, working), invoke, allowed };
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

it('acknowledgement alone never implies typing; fresh work may arrive later', async () => {
  const t = typing(); let working = false;
  t.start('42', undefined, () => true, () => working);
  await vi.advanceTimersByTimeAsync(8000); expect(t.invoke).not.toHaveBeenCalled();
  working = true; await vi.advanceTimersByTimeAsync(4000); expect(t.invoke).toHaveBeenCalledTimes(1);
  working = false; await vi.advanceTimersByTimeAsync(8000); expect(t.invoke).toHaveBeenCalledTimes(1);
  working = true; await vi.advanceTimersByTimeAsync(120000);
  const count = t.invoke.mock.calls.length;
  await vi.advanceTimersByTimeAsync(120000); expect(t.invoke).toHaveBeenCalledTimes(count);
});
it('a pending audience check rechecks work before showing typing', async () => {
  const t = typing(); let working = true, release!: (allowed: boolean) => void;
  t.allowed.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  t.start('42', undefined, () => true, () => working); await vi.advanceTimersByTimeAsync(0);
  working = false; release(true); await vi.advanceTimersByTimeAsync(0);
  expect(t.invoke).not.toHaveBeenCalled();
});

it('replays live native admission: queued, running tool, completed tool and stale observation', async () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/native-loop/live-2026-10-03/task.json', import.meta.url), 'utf8'));
  const rows = capture.admission.trim().split('\n');
  const t = typing(); let bytes = '';
  const evidence = createWorkingActivities({ read: () => bytes, now: () => Date.now() });
  evidence.observe('turn', 'claim', 'start');
  t.start('42', undefined, () => true, () => evidence.current('turn')?.running === true);
  await vi.advanceTimersByTimeAsync(4000); expect(t.invoke).not.toHaveBeenCalled();
  bytes = rows[0] + '\n'; evidence.observe('turn', 'claim', 'working');
  await vi.advanceTimersByTimeAsync(4000); expect(t.invoke).toHaveBeenCalledTimes(1);
  bytes += rows[1] + '\n'; evidence.observe('turn', 'claim', 'working');
  await vi.advanceTimersByTimeAsync(4000); expect(t.invoke).toHaveBeenCalledTimes(1);
  bytes += rows[2] + '\n'; evidence.observe('turn', 'claim', 'working');
  await vi.advanceTimersByTimeAsync(4000); expect(t.invoke).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(8000); expect(t.invoke).toHaveBeenCalledTimes(3);
  evidence.observe('turn', null, 'end');
  await vi.advanceTimersByTimeAsync(8000); expect(t.invoke).toHaveBeenCalledTimes(3);
});
it('no work evidence supplied means no typing', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const invoke = vi.fn(() => response(true));
  const indicator = createReplyTyping({ invoke, allowed: async () => true, now: () => Date.now(),
    after: (ms, run) => { const timer = setTimeout(run, ms); return () => clearTimeout(timer); } });
  indicator.start('42', undefined, () => true);
  await vi.advanceTimersByTimeAsync(240000); expect(invoke).not.toHaveBeenCalled();
});
