import { expect, it } from 'vitest';
import { buildConversationContext, createConversationStepper, turns } from '../../src/assembly/production-conversation-driver.js';
import type { ConversationFact, ConversationDriverOperations, SequentialServingAdmission } from '../../src/assembly/production-conversation-driver.js';

// Offline R6 interface fake. This checks driver ordering; genuine Six admission
// and installed owner behavior are exercised in the sequential-serving suites.
const fact = (id: string, kind: string, body: Record<string, unknown>): ConversationFact => ({ id, kind, body });
const record = (id: string, kind: string, value: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  fact(id, kind, { ...extra, record: value });

function serving(capacity = 20) {
  const facts: ConversationFact[] = [];
  const captures = new Map<string, string>();
  const calls: string[] = [];
  const admitted = new Set<number>();
  let used = 0, current = true, generation = 'g1', lease = 'l1', stopped = false;
  const admission: SequentialServingAdmission = {
    owner: 'part-six',
    admitTurn: ({ updateId, generation: expected, lease: expectedLease }) => {
      if (!current || expectedLease !== lease) return 'revoked';
      if (expected !== generation) return 'generation-changed';
      if (admitted.has(updateId)) return 'already-admitted';
      if (used >= capacity) return 'exhausted';
      admitted.add(updateId); return 'admitted';
    },
    current: ({ generation: expected, lease: expectedLease }) =>
      current && expected === generation && expectedLease === lease && used < capacity,
  };
  const receive = (updateId: number, text: string) => {
    if (facts.some(row => row.kind === 'intake-admitted' && row.body.eventId === String(updateId))) return;
    captures.set(`in:${updateId}`, text);
    facts.push(fact(`receipt:${updateId}`, 'intake-receipt', { capture: { reference: `in:${updateId}` } }),
      fact(`opening:${updateId}`, 'intake-admitted',
        { eventId: String(updateId), receipt: `receipt:${updateId}`, binding: 'bound' }));
  };
  const operations: ConversationDriverOperations = {
    facts: () => facts, pollOnce: () => {}, capture: reference => captures.get(reference) ?? '',
    apiAccepted: () => true, admission, generation: 'g1', lease: 'l1', expiresAt: 100,
    maxContextTurns: 3, maxContextBytes: 1000, replyLimit: 4, errorLimit: 3, totalErrorLimit: 5,
    now: () => 1, stopped: () => stopped,
    ground: (turn, context) => {
      calls.push(`ground:${turn.updateId}:${context.map(item => item.inboundCapture).join(',')}`);
      facts.push(record(`runfact:${turn.updateId}`, 'run-opening',
        { id: `run:${turn.updateId}`, opening: { id: turn.opening } }, { run: `run:${turn.updateId}` }),
      record(`ground:${turn.updateId}`, 'session-grounding', { run: `run:${turn.updateId}` }),
      record(`requestfact:${turn.updateId}`, 'judgment-provider-ProviderJudgmentRequest',
        { id: `request:${turn.updateId}`, run: `run:${turn.updateId}` }));
    },
    dispatchProvider: (turn, guard) => {
      guard(); calls.push(`provider:${turn.updateId}`);
      facts.push(record(`claim:${turn.updateId}`, 'transport-AdmissionReservation',
        { run: `run:${turn.updateId}`, state: 'dispatch-claimed' }));
      if (turn.updateId === 1) { used += 12; return; } // honest UNKNOWN, retained maximum
      used += 3;
      facts.push(record(`response:${turn.updateId}`, 'judgment-provider-ProviderJudgmentAttemptRecord',
        { phase: 'response-observed', request: `request:${turn.updateId}` }));
    },
    acceptAndPrepareReply: turn => {
      const n = turn.updateId;
      calls.push(`accept:${n}`);
      if (!facts.some(row => row.id === `acceptance:${n}`)) {
        captures.set(`answer:${n}`, `answer ${n}`);
        facts.push(record(`acceptance:${n}`, 'judgment-provider-ProviderAnswerAcceptance',
          { request: `request:${n}`, capture: { reference: `answer:${n}` } }));
      }
      if (!facts.some(row => row.id === `replyrun:${n}`)) facts.push(
        record(`replyrun:${n}`, 'run-opening', { id: `reply:${n}`, opening: { id: `acceptance:${n}` } },
          { run: `reply:${n}` }),
        record(`replyrequest:${n}`, 'effect-EffectRequest', { id: `replyrequest:${n}`, run: `reply:${n}` }));
    },
    dispatchReply: (turn, guard) => {
      guard(); const n = turn.updateId; calls.push(`sendMessage:${n}`);
      facts.push(record(`replyclaim:${n}`, 'transport-AdmissionReservation',
        { run: `reply:${n}`, state: 'dispatch-claimed' }),
      record(`replyobservation:${n}`, 'effect-OperationObservation',
        { stage: 'response', request: `replyrequest:${n}` }));
    },
  };
  return { facts, captures, calls, operations, receive, admitted, exposure: () => used,
    stop: () => { stopped = true; }, revoke: () => { current = false; },
    changeGeneration: () => { generation = 'g2'; } };
}

it('serves two distinct turns, retaining the first UNKNOWN exposure and grounding the second on the first inbound', async () => {
  const h = serving();
  h.receive(1, 'first'); h.receive(2, 'second');
  const stepper = createConversationStepper(h.operations);
  for (let i = 0; i < 8; i++) if (await stepper.step() === 'idle') break;
  expect(turns(h.facts, () => true).map(turn => turn.phase))
    .toEqual(['provider-dispatched-unknown', 'api-accepted']);
  expect(h.calls).toEqual(['ground:1:in:1', 'provider:1', 'ground:2:in:1,in:2',
    'provider:2', 'accept:2', 'sendMessage:2']);
  expect(h.exposure()).toBe(15);
  expect(h.admitted.size).toBe(2);
  const context = buildConversationContext(turns(h.facts), turns(h.facts)[1]!,
    h.operations.capture, 3, 1000);
  expect(context[0]).toMatchObject({ inboundCapture: 'in:1', pending: true });
});

it('runs a bounded provider-only installation with zero reply allowance', async () => {
  const h = serving(); h.receive(1, 'first');
  const stepper = createConversationStepper({ ...h.operations, replyLimit: 0 });
  expect(await stepper.step()).toBe('advanced');
  expect(await stepper.step()).toBe('advanced');
  expect(await stepper.step()).toBe('idle');
  expect(h.calls).toEqual(['ground:1:in:1', 'provider:1']);
});

it('does not re-admit a duplicate update, even when caller labels change', async () => {
  const h = serving(); h.receive(1, 'first');
  const stepper = createConversationStepper(h.operations);
  await stepper.step(); await stepper.step();
  h.receive(1, 'other run/domain/credential');
  expect(await stepper.step()).toBe('idle');
  expect(h.admitted.size).toBe(1);
  expect(h.calls.filter(call => call === 'provider:1')).toHaveLength(1);
});

it('does not treat an old provider and reply pair relabelled with a new run as a new inbound turn', async () => {
  const h = serving(); h.receive(1, 'first');
  const stepper = createConversationStepper(h.operations);
  await stepper.step(); await stepper.step();
  h.facts.push(record('foreign-run', 'run-opening',
    { id: 'run:foreign', opening: { id: 'opening:foreign' } }, { run: 'run:foreign' }),
  record('foreign-claim', 'transport-AdmissionReservation',
    { run: 'run:foreign', state: 'dispatch-claimed' }),
  record('foreign-acceptance', 'judgment-provider-ProviderAnswerAcceptance',
    { request: 'request:foreign', capture: { reference: 'answer:old' } }));
  expect(turns(h.facts)).toHaveLength(1);
  expect(await stepper.step()).toBe('idle');
  expect(h.admitted.size).toBe(1);
});

it('refuses exhausted capacity, revoked lease, and changed generation', async () => {
  for (const mutate of ['exhausted', 'revoked', 'generation'] as const) {
    const h = serving(mutate === 'exhausted' ? 0 : 20); h.receive(1, 'first');
    if (mutate === 'revoked') h.revoke();
    if (mutate === 'generation') h.changeGeneration();
    expect(await createConversationStepper(h.operations).step()).toBe('bound');
    expect(h.admitted.size).toBe(0);
    expect(h.calls).toEqual([]);
  }
});

it('refuses concurrent execution and an authenticated stop before the next call', async () => {
  const h = serving(); h.receive(1, 'first');
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const ground = h.operations.ground;
  h.operations.ground = async (turn, context) => { await pending; await ground(turn, context); };
  const stepper = createConversationStepper(h.operations);
  const first = stepper.step();
  expect(await stepper.step()).toBe('bound');
  release(); await first;
  h.stop();
  expect(await stepper.step()).toBe('stopped');
  expect(h.calls.filter(call => call.startsWith('provider:'))).toEqual([]);
});
