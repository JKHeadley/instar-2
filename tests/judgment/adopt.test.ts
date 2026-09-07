import { expect, it } from 'vitest';
import { judgmentFixture, value, refused } from './fixture.js';
import { createJudgmentDoorway } from '../../src/judgment/index.js';
import type { EffectDispatchPort } from '../../src/judgment/index.js';
import type { AdmissionReservation } from '../../src/transport/index.js';

// docs/11 step 6 adopted: seven prepares the bounded call and reserves via six
// exactly as before (shaped for eight's adopt contract), then hands the admitted
// dispatch to eight — adopt -> dispatch through the registered model adapter —
// and consumes eight's durable observation into its unchanged recording path.
// Eight owns settlement, so the operation becomes RESOLVABLE: six's settle()
// consumes eight's authentic EffectSettlement and the run can admit a second
// operation (the slice-six-seven-resolution-gap unlock).

const secondReserve = (f: ReturnType<typeof judgmentFixture>, fence: Parameters<typeof f.six.reserve>[0]['fence'], command = 'outbound-after-judgment') =>
  f.six.reserve({ command, fence, request: { owner: 'part-eight', name: 'EffectRequest', id: 'outbound-request:1' },
    attempt: 'outbound-attempt:1', payloadDigest: `sha256:${'b'.repeat(64)}`, charge: 20, run: f.run,
    semanticMessage: 'five-owned:outbound-reply:1', durability: 'local-durable', replicas: 0 });

const consumedOperation = (f: ReturnType<typeof judgmentFixture>): string => {
  const consumed = value(f.six.inspect()).find(v => v.record.type === 'AdmissionReservation' && v.record.state === 'consumed');
  expect(consumed).toBeDefined(); return (consumed!.record as AdmissionReservation).operation;
};

it('judgment through eight: judge -> resolution -> eight settlement -> six application -> a SECOND six operation for the same run ADMITS', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const answer = value(await f.door.judge(f.input, fence));
  expect(answer.decision.floor?.chosen).toBe('work');
  // The provider ran ONCE, through eight's registered adapter; the direct model
  // exchange path was never used.
  expect(f.effectCalls()).toBe(1);
  expect(f.calls).toHaveLength(0);
  // Seven's recorded semantics are unchanged: request, all five attempt phases,
  // resolution — and eight holds the request + observations for the SAME operation.
  const judgmentRows = value(f.door.inspect());
  expect(judgmentRows.some(v => v.record.type === 'JudgmentResolution')).toBe(true);
  const operation = consumedOperation(f);
  const effectRows = value(f.effectDoorway!.inspect());
  expect(effectRows.some(v => v.record.type === 'EffectRequest' && v.record.id === f.derivedRequest)).toBe(true);
  expect(effectRows.filter(v => v.record.type === 'OperationObservation').length).toBeGreaterThan(0);
  // Exactly ONE six reservation exists for the model operation (adopt minted no second).
  const distinct = new Set(value(f.six.inspect()).filter(v => v.record.type === 'AdmissionReservation')
    .map(v => (v.record as AdmissionReservation).operation));
  expect(distinct.size).toBe(1);
  // Rule (b) BEFORE resolution-by-settlement: the unresolved model operation
  // blocks a second operation for the same run — by name.
  refused(secondReserve(f, fence, 'outbound-before-settlement'), 'unresolved');
  // Eight settles from its own evidence-checked path; six consumes the authentic
  // live issuance and resolves the operation's accounting.
  f.assess('happened', 3);
  const settlement = value(f.effectDoorway!.settle(operation));
  const applied = value(f.six.settle(fence, settlement));
  expect(applied.unresolved).toBe(0); expect(applied.exposure).toBe(3); expect(applied.released).toBe(17);
  // THE UNLOCK: the same run now admits its second operation.
  const admitted = value(secondReserve(f, fence));
  expect(admitted.state).toBe('prepared');
  expect(admitted.run).toBe(f.run.id);
}, 30000);

it('a question whose effect-request identity is not the admitted-dispatch derivation refuses by name', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const wrong = { ...f.input, effectRequest: { ...f.input.effectRequest, id: 'eight-owned:model-effect:1' } };
  refused(await f.door.judge(wrong, fence), 'question effect-request identity is not the admitted-dispatch derivation');
  expect(f.effectCalls()).toBe(0);
}, 30000);

it('crash between six-reserve and adopt: recovery re-enters through the public seams with ONE total invocation', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const cut: EffectDispatchPort = { ...f.effects!, adopt: () => { throw new Error('injected crash before adopt'); } };
  refused(await createJudgmentDoorway({ ...f.ports, effects: cut }).judge(f.input, fence), 'injected crash before adopt');
  // Durable state: the six reservation exists and is still prepared; eight holds no request.
  const rows = value(f.six.inspect()).filter(v => v.record.type === 'AdmissionReservation');
  expect(rows).toHaveLength(1); expect((rows[0]!.record as AdmissionReservation).state).toBe('prepared');
  expect(value(f.effectDoorway!.inspect()).some(v => v.record.type === 'EffectRequest')).toBe(false);
  expect(f.effectCalls()).toBe(0);
  // A fresh composition resumes: reserve is idempotent, adopt+dispatch complete, one call.
  const answer = value(await createJudgmentDoorway(f.ports).judge(f.input, fence));
  expect(answer.decision.floor?.chosen).toBe('work');
  expect(f.effectCalls()).toBe(1);
}, 30000);

it('crash between adopt and dispatch: recovery re-dispatches the persisted request, never re-adopts, ONE total invocation', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const cut: EffectDispatchPort = { ...f.effects!, dispatch: () => { throw new Error('injected crash before dispatch'); } };
  refused(await createJudgmentDoorway({ ...f.ports, effects: cut }).judge(f.input, fence), 'injected crash before dispatch');
  // Durable state: the adopted EffectRequest exists; nothing was invoked.
  expect(value(f.effectDoorway!.inspect()).some(v => v.record.type === 'EffectRequest' && v.record.id === f.derivedRequest)).toBe(true);
  expect(f.effectCalls()).toBe(0);
  const answer = value(await createJudgmentDoorway(f.ports).judge(f.input, fence));
  expect(answer.decision.floor?.chosen).toBe('work');
  expect(f.effectCalls()).toBe(1);
}, 30000);

it('crash between dispatch and resolution: recovery consumes the durable eight observation without a second invocation', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const cut: EffectDispatchPort = { ...f.effects!, dispatch: (adopted, fence2) => {
    void f.effects!.dispatch(adopted, fence2); throw new Error('injected crash after dispatch'); } };
  refused(await createJudgmentDoorway({ ...f.ports, effects: cut }).judge(f.input, fence), 'injected crash after dispatch');
  // The invocation HAPPENED and is durable on eight; seven recorded no phases yet.
  expect(f.effectCalls()).toBe(1);
  expect(value(f.door.inspect()).some(v => v.record.type === 'JudgmentResolution')).toBe(false);
  const answer = value(await createJudgmentDoorway(f.ports).judge(f.input, fence));
  expect(answer.decision.floor?.chosen).toBe('work');
  // docs/11 retries rule: recovery recorded the receipt from the durable
  // observation; the provider was NOT invoked again.
  expect(f.effectCalls()).toBe(1);
  expect(value(f.door.inspect()).some(v => v.record.type === 'JudgmentResolution')).toBe(true);
  // ...and the recovered operation is settleable end-to-end.
  f.assess('happened', 3);
  const applied = value(f.six.settle(fence, value(f.effectDoorway!.settle(consumedOperation(f)))));
  expect(applied.unresolved).toBe(0);
  expect(value(secondReserve(f, fence)).state).toBe('prepared');
}, 30000);

it('a dispatch-claimed operation with no terminal eight observation refuses by name and never re-invokes', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const cut: EffectDispatchPort = { ...f.effects!, adopt: () => { throw new Error('injected crash before adopt'); } };
  refused(await createJudgmentDoorway({ ...f.ports, effects: cut }).judge(f.input, fence), 'injected crash before adopt');
  const reservation = value(f.six.inspect()).find(v => v.record.type === 'AdmissionReservation')!;
  value(f.six.claim('stray-claim', fence, (reservation.record as AdmissionReservation).operation));
  refused(await createJudgmentDoorway(f.ports).judge(f.input, fence), 'unresolved dispatch claim: missing receipt cannot trigger another invocation');
  expect(f.effectCalls()).toBe(0);
}, 30000);
