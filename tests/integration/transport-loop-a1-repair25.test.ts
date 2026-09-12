import { afterEach, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore, decodeHistoricalBody, factId, signEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope, SegmentStoragePort } from '../../src/facts/index.js';
import { createLoopA1Authority, createLoopA1Spine, decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));

const bytes = (input: unknown) => value(canonical(input)).bytes;
const detail = (result: unknown): string => consumeResult(result as never, {
  Success: () => '', Refused: refusal => refusal.detail,
});
const pressureScope = {
  target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders',
} as const;

function setup() {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair25-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair25-lease', '', 1000));
  const scheduleInput = {
    command: 'repair25-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'one', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  } as const;
  let loop = value(fixture.api.scheduleEpisode(scheduleInput));
  const reference = () => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
  const admitInput = (attempt: string) => ({
    command: `repair25-admit:${attempt}`, fence, episode: reference(), attempt,
  });
  const admit = (attempt: string) => {
    loop = value(fixture.api.admitLoopAttempt(admitInput(attempt)));
  };
  const finish = (attempt: string, kind: 'accepted' | 'failed', restoration: readonly {
    owner: 'part-nine'; name: 'VerificationAssessment'; id: string;
  }[] = []) => {
    loop = value(fixture.api.recordLoopOutcome({
      command: `repair25-finish:${attempt}`,
      fence,
      episode: reference(),
      attempt,
      kind,
      failureClass: kind === 'failed' ? 'transport' : '',
      completion: fixture.appendOutcome(kind, attempt),
      jitterPermille: 1000,
      restoration,
    }));
  };
  const open = () => {
    fixture.time(101);
    admit('failure');
    finish('failure', 'failed');
    fixture.time(121);
  };
  const restart = (storage: SegmentStoragePort = fixture.storage) => createLoopA1Authority(fixture.host,
    createLoopA1Spine(fixture.host, { context: fixture.ctx, privateKey },
      createFactStore(fixture.ctx, storage)), fixture.c);
  return {
    fixture, policy, fence, scheduleInput, admitInput, admit, finish, open, restart,
    get loop() { return loop; },
  };
}

function duplicateWire(original: FactEnvelope, head: FactEnvelope, body: FactEnvelope['body']) {
  const first = signEnvelope({ ...original, body }, privateKey) as FactEnvelope;
  const segment = { ...head.segment, position: head.segment.position + 1 };
  const second = signEnvelope({
    ...first,
    id: factId(segment),
    segment,
    prevInSegment: first.contentHash,
    predecessors: { ...first.predecessors, inSegment: first.id },
  }, privateKey) as FactEnvelope;
  return [first, second] as const;
}

it.each(['unwitnessed-close', 'early-trial', 'counter-reset', 'source-advancement'] as const)(
  'SLB-A1-DUPLICATE-VALIDATION-136 V2 V25 refuses %s before collapsing identical signed copies', mode => {
    const state = setup();
    if (mode !== 'unwitnessed-close') state.open();
    if (mode === 'early-trial') state.admit('trial');
    const wires = state.fixture.storage.read() as FactEnvelope[];
    const original = wires.at(-1)!;
    const body = structuredClone(original.body) as { record: Record<string, any> };
    if (mode === 'unwitnessed-close') {
      body.record.state = 'closed';
      body.record.transition = 'closed';
    } else if (mode === 'early-trial') {
      body.record.tick = 102;
      body.record.transitionAt = state.fixture.clock(102);
      body.record.nextEligible = state.fixture.clock(102);
      body.record.nextWake = 102;
      body.record.attemptLog.at(-1).admittedAt = state.fixture.clock(102);
    } else if (mode === 'counter-reset') {
      body.record.totalFailures = 0;
      body.record.failureCount = 0;
    } else {
      body.record.sourceVector = { ...body.record.sourceVector, id: 'repair25-advanced-source' };
    }
    const [first, second] = duplicateWire(original, original, body);
    const raw = [...wires.slice(0, -1), first, second];
    const storage: SegmentStoragePort = {
      owner: 'part-ten',
      read: () => raw,
      append: () => { throw new Error('read-only repair25 duplicate history'); },
    };
    expect(detail(state.restart(storage).inspect())).not.toBe('');
  },
  120_000,
);

it('SLB-A1-DUPLICATE-VALIDATION-136 V23 preserves one deterministic history for valid identical copies', () => {
  const state = setup();
  const wires = state.fixture.storage.read() as FactEnvelope[];
  const original = wires.at(-1)!;
  const [first, second] = duplicateWire(original, original, original.body);
  const raw = [...wires.slice(0, -1), first, second];
  const storage: SegmentStoragePort = {
    owner: 'part-ten',
    read: () => raw,
    append: () => { throw new Error('read-only repair25 valid duplicate history'); },
  };
  const result = state.restart(storage).inspect();
  expect(detail(result)).toBe('');
  expect(value(result).at(-1)!.record).toEqual(state.loop);
});

it.each(['missing', 'wrong-kind', 'different-subject'] as const)(
  'SLB-A1-EXACT-BINDING-137 V3 refuses a %s exact binding without substituting another matching fact', mode => {
    const fixture = transportLoopFixture();
    const originalPort = fixture.host.loopScopeBinding!;
    const reference = mode === 'missing'
      ? 'fact:missing'
      : mode === 'wrong-kind'
        ? fixture.vector.id
        : fixture.ctx.facts.find(fact => fact.kind === 'loop-pressure-binding'
          && (fact.body as { operationFamily?: unknown }).operationFamily === 'holder-recovery')!.id;
    (fixture.host as { loopScopeBinding: typeof originalPort }).loopScopeBinding = {
      owner: 'part-three', resolve: (input: Parameters<typeof originalPort.resolve>[0]) => {
      const binding = value(originalPort.resolve(input));
      return fixture.success({ ...binding, witness: { ...binding.witness, id: reference } });
      },
    };
    const fence = value(fixture.api.acquire(`repair25-binding-lease:${mode}`, '', 1000));
    const before = bytes(fixture.storage.read());
    const result = fixture.api.scheduleEpisode({
      command: `repair25-binding:${mode}`, fence, currentOwnerRun: fixture.run,
      policy: fixture.sharedPolicy, episodeKey: 'one', operationFamily: 'recovery',
      pressureScope, sourceVector: fixture.vector,
    });
    expect(detail(result)).toContain('pressure binding reference is absent, wrong-kind, or mismatched');
    expect(bytes(fixture.storage.read())).toBe(before);
  },
);

it('SLB-A1-EXACT-BINDING-137 V1 retains the exact well-formed binding on a valid schedule', () => {
  const state = setup();
  expect(state.loop.pressureBinding.id).not.toBe('');
  expect(state.fixture.ctx.facts.some(fact => fact.id === state.loop.pressureBinding.id
    && fact.kind === 'loop-pressure-binding')).toBe(true);
});

it('SLB-A1-EQUIVALENT-BINDING-138 V30 preserves the recorded witness when the port selects an equivalent valid copy', () => {
  const state = setup();
  const recorded = state.fixture.ctx.facts.find(fact => fact.id === state.loop.pressureBinding.id)!;
  const history = [...state.fixture.ctx.facts, ...value(state.fixture.store.read())];
  const head = history.filter(fact => fact.machine === recorded.machine).at(-1)!;
  const segment = { ...head.segment, position: head.segment.position + 1 };
  const wire = signEnvelope({
    ...recorded,
    id: factId(segment),
    segment,
    prevInSegment: head.contentHash,
    predecessors: { ...recorded.predecessors, inSegment: head.id },
  }, privateKey);
  const copy = value(state.fixture.store.append(wire, { peer: recorded.machine })).fact;
  expect(bytes(copy.body)).toBe(bytes(recorded.body));
  expect(bytes(copy.principal)).toBe(bytes(recorded.principal));
  expect(bytes(copy.predecessors.required)).toBe(bytes(recorded.predecessors.required));

  const originalPort = state.fixture.host.loopScopeBinding!;
  (state.fixture.host as { loopScopeBinding: typeof originalPort }).loopScopeBinding = {
    owner: 'part-three', resolve: (input: Parameters<typeof originalPort.resolve>[0]) => {
    const binding = value(originalPort.resolve(input));
    return state.fixture.success({ ...binding, witness: { ...binding.witness, id: copy.id } });
    },
  };
  const before = bytes(state.fixture.storage.read());
  const result = state.restart().inspect();
  expect(detail(result)).toBe('');
  expect((value(result).at(-1)!.record as SharedLoopRecord).pressureBinding).toEqual(state.loop.pressureBinding);
  expect(bytes(state.fixture.storage.read())).toBe(before);

  const context = { ...state.fixture.ctx,
    facts: [...state.fixture.ctx.facts, ...value(state.fixture.store.read())] };
  const origin = value(state.fixture.api.inspect()).at(-1)!.fact;
  expect(detail(decodeHistoricalBody(origin, context, context.decode))).toBe('');
});
