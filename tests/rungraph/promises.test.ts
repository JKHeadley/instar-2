import { expect, it } from 'vitest';
import { createPromiseStore, recordCommitments, recordReplyLoop, closeCommitment, schedulePromise,
  type PromiseScheduleInput, type PromiseWork } from '../../src/rungraph/promises.js';

const input: PromiseScheduleInput = { id: 3, openedAt: 1000, dueAt: 21001, deliveryRequested: false, nextOperatorAt: null,
  waitsOn: 'date', work: undefined };
const work: PromiseWork = { last: 22000, lastSlot: 21001, outcome: 'continue' };
const schedule = (changes: Partial<PromiseScheduleInput> = {}) => schedulePromise({ ...input, ...changes }, 10000);
it('keeps stable promise identities, declaration joins and terminal evidence in the owner projection', () => {
  const store = createPromiseStore<number>();
  recordCommitments(store, [{ in: 'reply', source: 'turn:1', quote: 'I will check.', agentPromise: {
    quote: 'I will check.', owner: 'agent', action: 'promised', waitsOn: 'next-relevant-reply' } }]);
  recordReplyLoop(store, 'turn:1', { kind: 'promise', quote: 'I will check.', waitsOn: 'nothing', deliveryRequest: 'Send the result.' });
  expect(store.commitments).toHaveLength(1);
  expect(store.commitments[0]).toMatchObject({ owner: 'agent', waitsOn: 'nothing', deliveryRequest: 'Send the result.' });
  recordReplyLoop(store, 'turn:2', { kind: 'promise', quote: 'Another task.', waitsOn: 'external' });
  closeCommitment(store, { id: 0, source: 'receipt:1', quote: 'The result.' });
  expect(store.commitments).toHaveLength(2); expect(store.closed.get(0)?.source).toBe('receipt:1');
  const replay = createPromiseStore<number>();
  recordCommitments(replay, JSON.parse(JSON.stringify(store.commitments)));
  for (const close of store.closed.values()) closeCommitment(replay, close);
  expect(replay).toEqual(store);
});
it('preserves a dated promise while joining a loop and adds a separate source as a distinct promise', () => {
  const store = createPromiseStore<number>();
  recordCommitments(store, [{ in: 'reply', source: 'turn:1', quote: 'At noon.', agentPromise: {
    quote: 'At noon.', owner: 'agent', action: 'promised', waitsOn: 'next-relevant-reply', due: 12000 } }]);
  recordReplyLoop(store, 'turn:1', { kind: 'promise', quote: 'At noon.', waitsOn: 'nothing' });
  expect(store.commitments[0]?.waitsOn).toBeUndefined();
  recordReplyLoop(store, 'turn:2', { kind: 'promise', quote: 'At noon.', waitsOn: 'date' });
  expect(store.commitments).toHaveLength(2);
});
it('retains the exact due instant and uses durable cadence anchors for continuation', () => {
  expect(schedule()?.slot).toBe(21001);
  expect(schedule({ work })?.slot).toBe(32000);
  expect(schedule({ dueAt: null, waitsOn: 'nothing', deliveryRequested: true, sentAt: 1500 })?.slot).toBe(1500);
  expect(schedule({ dueAt: null, waitsOn: 'external' })?.slot).toBe(11000);
  expect(schedulePromise({ id: 0, openedAt: 1, dueAt: null, deliveryRequested: false, nextOperatorAt: null, work: undefined }, 10000)).toBeNull();
});
it('separates operator dependency, external reassessment, started work and held recovery', () => {
  expect(schedule({ work: { ...work, waitsOn: 'operator' } })?.slot).toBe(Infinity);
  expect(schedule({ work: { ...work, waitsOn: 'operator' }, nextOperatorAt: 23000 })?.slot).toBe(23000);
  expect(schedule({ work: { ...work, waitsOn: 'operator', outcome: 'uncertain' }, nextOperatorAt: 23000 })?.slot).toBe(32000);
  expect(schedule({ work: { ...work, waitsOn: 'external' } })?.slot).toBe(32000);
  expect(schedule({ work: { ...work, inFlight: 23000 } })).toMatchObject({ slot: 23000, inFlight: true });
  expect(schedule({ work: { ...work, recoveryHeld: true } })?.slot).toBe(Infinity);
});
it('keeps delivered, pending and unknown reports distinct; a held result reopens only its work', () => {
  expect(schedule({ work: { ...work, report: {} } })).toMatchObject({ awaitingDelivery: true, deliveryUnknown: false });
  expect(schedule({ work: { ...work, report: { boundTo: 'send:1' } } })).toMatchObject({ awaitingDelivery: false, deliveryUnknown: true });
  expect(schedule({ work: { ...work, report: { boundTo: 'send:1', delivered: 'receipt:1' } } })).toMatchObject({ awaitingDelivery: false, deliveryUnknown: false });
  expect(schedule({ work: { ...work, withheld: { at: 23000 } } })?.slot).toBe(23000);
  expect(schedule({ work: { ...work, withheld: { at: 23000 }, outcome: 'failed' } })?.slot).toBe(32000);
  expect(schedulePromise({ ...input, work: { ...work, failureClass: 'malformed', formatFailures: 2 } }, 900000)?.slot).toBe(142000);
  expect(schedulePromise({ ...input, work: { ...work, failureClass: 'malformed', formatFailures: 3 } }, 900000)?.slot).toBe(922000);
});
