import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { judgmentFixture, value, refused } from './fixture.js';
import { createJudgmentDoorway } from '../../src/judgment/index.js';
import type { EffectDispatchPort } from '../../src/judgment/index.js';
import { canonical } from '../../src/index.js';
import type { AdmissionReservation } from '../../src/transport/index.js';
import type { OperationObservation } from '../../src/effects/index.js';

// REPAIR1 acceptance shapes for astra-review-seven-adopt-3998531 R1/R2/R3.

const reservationStates = (f: ReturnType<typeof judgmentFixture>) =>
  value(f.six.inspect()).filter(v => v.record.type === 'AdmissionReservation').map(v => (v.record as AdmissionReservation).state);

// ---------------------------------------------------------------- R1: deadline
it('R1: time reaching the deadline AFTER six reserve (before adopt) refuses with ZERO invocations and a still-prepared reservation', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const late: EffectDispatchPort = { ...f.effects!, adopt: input => { f.time(400); return f.effects!.adopt(input); } };
  refused(await createJudgmentDoorway({ ...f.ports, effects: late }).judge(f.input, fence), 'judgment deadline exhausted');
  expect(f.effectCalls()).toBe(0);
  expect(reservationStates(f)).toEqual(['prepared']);
}, 30000);

it('R1: time reaching the deadline AFTER adoption refuses before eight claims — zero invocations at 400 and 401; 399 still invokes once', async () => {
  for (const [at, calls] of [[400, 0], [401, 0], [399, 1]] as const) {
    const f = judgmentFixture({ effects: true });
    const fence = f.start();
    const late: EffectDispatchPort = { ...f.effects!, adopt: input => { const r = f.effects!.adopt(input); f.time(at); return r; } };
    const result = await createJudgmentDoorway({ ...f.ports, effects: late }).judge(f.input, fence);
    if (calls === 0) { refused(result, 'judgment deadline exhausted'); expect(reservationStates(f)).toEqual(['prepared']); }
    else expect(value(result).decision.floor?.chosen).toBe('work');
    expect(f.effectCalls()).toBe(calls);
  }
}, 60000);

it('R1: even when seven-side gating is bypassed (time advances inside dispatch), the registered adapter refuses at the provider boundary — zero invocations', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const inside: EffectDispatchPort = { ...f.effects!, dispatch: (adopted, fence2) => { f.time(400); return f.effects!.dispatch(adopted, fence2); } };
  refused(await createJudgmentDoorway({ ...f.ports, effects: inside }).judge(f.input, fence));
  // The provider was NEVER called. The digest-bound deadline rode the dispatch
  // message; eight durably recorded the refused invocation as an 'unknown'
  // terminal observation, and seven recorded a terminal REFUSED resolution.
  expect(f.effectCalls()).toBe(0);
  const stages = value(f.effectDoorway!.inspect()).filter(v => v.record.type === 'OperationObservation')
    .map(v => (v.record as OperationObservation).stage);
  expect(stages).toContain('unknown');
  const resolution = value(f.door.inspect()).find(v => v.record.type === 'JudgmentResolution');
  expect(resolution && (resolution.record as { disposition?: string }).disposition).toBe('refused');
}, 30000);

// --------------------------------------------------------------- R2: capacity
it('R2: with exactly one receipt budget of headroom, recovery after every cut reuses the question-bound commitment instead of demanding a second budget', async () => {
  for (const cut of ['adopt', 'dispatch'] as const) {
    const f = judgmentFixture({ effects: true, capacity: 120000 });
    const fence = f.start();
    const wrapper: EffectDispatchPort = cut === 'adopt'
      ? { ...f.effects!, dispatch: () => { throw new Error('injected crash before dispatch'); } }
      : { ...f.effects!, dispatch: (a, fe) => { void f.effects!.dispatch(a, fe); throw new Error('injected crash after dispatch'); } };
    refused(await createJudgmentDoorway({ ...f.ports, effects: wrapper }).judge(f.input, fence), 'injected crash');
    // A fresh composition completes within the SAME committed budget.
    const answer = value(await createJudgmentDoorway(f.ports).judge(f.input, fence));
    expect(answer.decision.floor?.chosen).toBe('work');
    expect(f.effectCalls()).toBe(1);
    // Exactly ONE durable capacity commitment exists, bound to the question.
    const slots = readdirSync(join(f.directory, 'captures', 'capacity')).filter(n => n.endsWith('.json') && n !== 'policy.json');
    expect(slots).toHaveLength(1);
    expect(slots[0]!.startsWith('receipt-')).toBe(true);
  }
}, 60000);

it('R2: the uninterrupted compose succeeds at one-budget capacity, and a capacity below one budget refuses before any invocation', async () => {
  const ok = judgmentFixture({ effects: true, capacity: 120000 });
  const okFence = ok.start();
  expect(value(await ok.door.judge(ok.input, okFence)).decision.floor?.chosen).toBe('work');
  expect(ok.effectCalls()).toBe(1);
  const small = judgmentFixture({ effects: true, capacity: 100000 });
  const smallFence = small.start();
  refused(await small.door.judge(small.input, smallFence), 'capture capacity exhausted');
  expect(small.effectCalls()).toBe(0);
  expect(reservationStates(small)).toEqual([]);
}, 60000);

// --------------------------------------------------- R3: evidence must be eight's
it('R3: a conforming-but-fake port that consumes a genuine six claim WITHOUT eight cannot mint provider evidence — refused by name, no resolution', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const fake: EffectDispatchPort = { ...f.effects!,
    adopted: () => f.result(() => { throw new Error('no adopted effect request'); }),
    adopt: input => f.success({ request: f.derivedRequest, digest: value(canonical(input.message)).hash }),
    dispatch: (_adopted, fence2) => {
      const prepared = value(f.six.inspect()).find(v => v.record.type === 'AdmissionReservation')!;
      const operation = (prepared.record as AdmissionReservation).operation;
      const claim = value(f.six.claim('fake-claim', fence2 as Parameters<typeof f.six.claim>[1], operation));
      value(f.six.consume(claim, fence2 as Parameters<typeof f.six.claim>[1]));
      return f.success({ operation });
    } };
  refused(await createJudgmentDoorway({ ...f.ports, effects: fake }).judge(f.input, fence),
    'unresolved dispatch claim: missing receipt cannot trigger another invocation');
  expect(f.effectCalls()).toBe(0);
  expect(value(f.effectDoorway!.inspect()).some(v => v.record.type === 'EffectRequest')).toBe(false);
  expect(value(f.door.inspect()).some(v => v.record.type === 'JudgmentResolution')).toBe(false);
}, 30000);

it('R3: a substituting/lying port return is inert — the recorded decision is the one in eight\'s DURABLE capture bytes', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  // The port lies about the dispatched operation; the real dispatch still runs.
  const lying: EffectDispatchPort = { ...f.effects!, dispatch: (adopted, fence2) => {
    void value(f.effects!.dispatch(adopted, fence2)); return f.success({ operation: 'operation:fake' }); } };
  const answer = value(await createJudgmentDoorway({ ...f.ports, effects: lying }).judge(f.input, fence));
  // The evidence came from the shared verified history, not the port's return:
  // the decision is exactly the one eight durably captured.
  expect(answer.decision.id).toBe('decision:1');
  expect(answer.decision.floor?.chosen).toBe('work');
  expect(f.effectCalls()).toBe(1);
}, 30000);

it('R3: a port with a foreign owner tag refuses before any effect', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const foreign = { ...f.effects!, owner: 'part-five' } as unknown as EffectDispatchPort;
  refused(await createJudgmentDoorway({ ...f.ports, effects: foreign }).judge(f.input, fence), 'effect dispatch port owner mismatch');
  expect(f.effectCalls()).toBe(0);
}, 30000);

it('R3: tampered capture custody bytes for eight\'s observation refuse instead of becoming evidence', async () => {
  const f = judgmentFixture({ effects: true });
  const fence = f.start();
  const cut: EffectDispatchPort = { ...f.effects!, dispatch: (a, fe) => { void f.effects!.dispatch(a, fe); throw new Error('injected crash after dispatch'); } };
  refused(await createJudgmentDoorway({ ...f.ports, effects: cut }).judge(f.input, fence), 'injected crash after dispatch');
  const response = value(f.effectDoorway!.inspect()).find(v => v.record.type === 'OperationObservation'
    && (v.record as OperationObservation).stage === 'response')!.record as OperationObservation;
  const file = join(f.directory, 'captures', response.capture.hash.slice(7));
  expect(readFileSync(file, 'utf8').length).toBeGreaterThan(0);
  writeFileSync(file, JSON.stringify({ state: 'complete', bytes: JSON.stringify({ id: 'tampered-decision' }) }));
  refused(await createJudgmentDoorway(f.ports).judge(f.input, fence), 'local capture hash mismatch');
  expect(f.effectCalls()).toBe(1);
  expect(value(f.door.inspect()).some(v => v.record.type === 'JudgmentResolution')).toBe(false);
}, 30000);
