import { afterEach, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore, factId, signEnvelope } from '../../src/facts/index.js';
import { createLoopA1Authority, createLoopA1Spine, decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type {
  LoopOutcomeInput,
  SharedBreakerLoopPolicy,
  SharedLoopRecord,
} from '../../src/transport/loop-a1/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));

const pressureScope = {
  target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders',
} as const;
const reference = (record: SharedLoopRecord) => ({
  owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode,
});
const bytes = (input: unknown) => value(canonical(input)).bytes;
const detail = (result: unknown) => consumeResult(result as never, {
  Success: () => '', Refused: refusal => refusal.detail,
});

function setup(overrides: Partial<SharedBreakerLoopPolicy> = {}) {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair21-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
    ...overrides,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair21-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'repair21-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'only', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  }));
  const completions = new Map<string, LoopOutcomeInput['completion']>();
  const admitInput = (attempt: string) => ({
    command: `repair21-admit:${attempt}`, fence, episode: reference(loop), attempt,
  });
  const admit = (attempt: string) => {
    loop = value(fixture.api.admitLoopAttempt(admitInput(attempt)));
  };
  const outcomeInput = (attempt: string, kind: 'accepted' | 'failed' = 'accepted',
    restoration: LoopOutcomeInput['restoration'] = []): LoopOutcomeInput => ({
    command: `repair21-finish:${attempt}`,
    fence,
    episode: reference(loop),
    attempt,
    kind,
    failureClass: kind === 'failed' ? 'transport' : '',
    completion: completions.get(attempt) ?? (() => {
      const completion = fixture.appendOutcome(kind, attempt);
      completions.set(attempt, completion);
      return completion;
    })(),
    jitterPermille: 1000,
    restoration,
  });
  const finish = (attempt: string, kind: 'accepted' | 'failed' = 'accepted',
    restoration: LoopOutcomeInput['restoration'] = []) => {
    const input = outcomeInput(attempt, kind, restoration);
    loop = value(fixture.api.recordLoopOutcome(input));
    return input;
  };
  fixture.time(101);
  admit('failure');
  finish('failure', 'failed');
  fixture.time(121);
  const restart = () => createLoopA1Authority(fixture.host,
    createLoopA1Spine(fixture.host, { context: fixture.ctx, privateKey },
      createFactStore(fixture.ctx, fixture.storage)), fixture.c);
  return {
    fixture, admitInput, admit, outcomeInput, finish, restart,
    get loop() { return loop; },
  };
}

function expectRefusedWithoutWrite(state: ReturnType<typeof setup>, run: () => unknown,
  expectedDetail?: string) {
  const before = bytes(state.fixture.storage.read());
  const refusal = detail(run());
  expect(refusal).not.toBe('');
  if (expectedDetail) expect(refusal).toContain(expectedDetail);
  expect(bytes(state.fixture.storage.read())).toBe(before);
}

it('SLB-A1-FACT-REFERENCE-CONTINUITY-129 V20 keeps a complete fact-addressed proof current for the remaining trial', () => {
  const state = setup({ halfOpenTrials: 2 });
  state.admit('trial-1');
  const assessment = state.fixture.assessmentFact('assessment:witnessed-review')!;
  const proof = { ...state.fixture.restorationReference('assessment:witnessed-review'), id: assessment.id };
  expect(detail(state.fixture.api.recordLoopOutcome(
    state.outcomeInput('trial-1', 'accepted', [proof])))).toBe('');

  const before = bytes(state.fixture.storage.read());
  const admitted = state.restart().admitLoopAttempt(state.admitInput('trial-2'));
  expect(detail(admitted)).toBe('');
  expect(value(admitted)).toMatchObject({ state: 'half-open', pendingAttempts: ['trial-2'] });
  expect(bytes(state.fixture.storage.read())).not.toBe(before);
});

it('SLB-A1-REPEATED-REFERENCE-SHAPE-130 V21 refuses an undeclared field before the outcome retry fast path', () => {
  const state = setup();
  state.admit('trial');
  const proof = state.fixture.restorationReference('assessment:witnessed-review');
  const input = state.finish('trial', 'accepted', [proof]);
  expect(state.loop.state).toBe('closed');
  expectRefusedWithoutWrite(state, () => state.fixture.api.recordLoopOutcome({
    ...input,
    command: 'repair21-malformed-repeat',
    restoration: [{ ...proof, extra: true }],
  } as never), 'closed restoration reference');
});

it('SLB-A1-FACT-REFERENCE-CONFLICT-131 V23 refuses conflicting signed assessments through a physical fact reference', () => {
  const state = setup();
  state.admit('trial');
  const original = state.fixture.assessmentFact('assessment:witnessed-review')!;
  const record = structuredClone((original.body as { record: Record<string, unknown> }).record);
  record.validUntil = Number(record.validUntil) + 1;
  const history = [...state.fixture.ctx.facts, ...value(state.fixture.store.read())];
  const head = history.filter(fact => fact.machine === state.fixture.host.machine).at(-1)!;
  const segment = { ...head.segment, position: head.segment.position + 1 };
  const wire = signEnvelope({
    ...original,
    id: factId(segment),
    segment,
    prevInSegment: head.contentHash,
    at: state.fixture.clock(121),
    predecessors: { ...original.predecessors, inSegment: head.id },
    body: { record },
  }, privateKey);
  expect(detail(state.fixture.store.append(wire, { peer: state.fixture.host.machine }))).toBe('');

  const proof = { ...state.fixture.restorationReference('assessment:witnessed-review'), id: original.id };
  const input = state.outcomeInput('trial', 'accepted', [proof]);
  expectRefusedWithoutWrite(state, () => state.fixture.api.recordLoopOutcome(input), 'conflicted');
});
