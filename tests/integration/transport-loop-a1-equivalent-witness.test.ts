import { afterEach, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore, decodeHistoricalBody, factId, signEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { createLoopA1Authority, createLoopA1Spine, decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy } from '../../src/transport/loop-a1/index.js';
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
    id: 'equivalent-witness-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('equivalent-witness-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'equivalent-witness-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'one', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  }));
  const reference = () => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
  const admitInput = (attempt: string) => ({
    command: `equivalent-witness-admit:${attempt}`, fence, episode: reference(), attempt,
  });
  const admit = (attempt: string) => {
    loop = value(fixture.api.admitLoopAttempt(admitInput(attempt)));
  };
  const finish = (attempt: string, kind: 'accepted' | 'failed', restoration: readonly {
    owner: 'part-nine'; name: 'VerificationAssessment'; id: string;
  }[] = []) => {
    loop = value(fixture.api.recordLoopOutcome({
      command: `equivalent-witness-finish:${attempt}`,
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
  const restart = () => createLoopA1Authority(fixture.host,
    createLoopA1Spine(fixture.host, { context: fixture.ctx, privateKey },
      createFactStore(fixture.ctx, fixture.storage)), fixture.c);
  return {
    fixture, policy, admitInput, admit, finish, open, restart,
    get loop() { return loop; },
  };
}

function appendCopy(state: ReturnType<typeof setup>, original: FactEnvelope,
  body: FactEnvelope['body'] = original.body) {
  state.fixture.time(121);
  const history = [...state.fixture.ctx.facts, ...value(state.fixture.store.read())];
  const head = history.filter(fact => fact.machine === original.machine).at(-1)!;
  const segment = { ...head.segment, position: head.segment.position + 1 };
  const wire = signEnvelope({
    ...original,
    id: factId(segment),
    segment,
    prevInSegment: head.contentHash,
    at: state.fixture.clock(121),
    predecessors: { ...original.predecessors, inSegment: head.id },
    body,
  }, privateKey);
  return state.fixture.store.append(wire, { peer: original.machine });
}

it.each(['policy', 'assessment'] as const)(
  'SLB-A1-EQUIVALENT-WITNESSES-133 identical signed %s copies preserve old replay and a valid later attempt', kind => {
    const state = setup();
    if (kind === 'assessment') {
      state.open();
      state.admit('trial');
      state.finish('trial', 'accepted', [state.fixture.restorationReference('assessment:witnessed-review')]);
    }
    const prior = value(state.fixture.api.inspect()).at(-1)!.fact;
    const original = kind === 'assessment'
      ? state.fixture.assessmentFact('assessment:witnessed-review')!
      : value(state.fixture.store.read()).find(fact => fact.kind === 'transport-SharedBreakerLoopPolicy'
        && (fact.body as { policy?: { id?: unknown } }).policy?.id === state.policy.id)!;
    expect(detail(appendCopy(state, original))).toBe('');

    const history = value(state.fixture.store.read());
    const context = { ...state.fixture.ctx, facts: [...state.fixture.ctx.facts, ...history] };
    expect(detail(decodeHistoricalBody(prior, context, context.decode))).toBe('');
    expect(detail(state.restart().inspect())).toBe('');
    expect(detail(state.restart().admitLoopAttempt(state.admitInput('after-equivalent-copy')))).toBe('');
  },
);

it.each(['policy', 'assessment'] as const)(
  'SLB-A1-EQUIVALENT-WITNESSES-133 conflicting signed %s copies still refuse without append', kind => {
    const state = setup();
    if (kind === 'assessment') {
      state.open();
      state.admit('trial');
      state.finish('trial', 'accepted', [state.fixture.restorationReference('assessment:witnessed-review')]);
    }
    const original = kind === 'assessment'
      ? state.fixture.assessmentFact('assessment:witnessed-review')!
      : value(state.fixture.store.read()).find(fact => fact.kind === 'transport-SharedBreakerLoopPolicy'
        && (fact.body as { policy?: { id?: unknown } }).policy?.id === state.policy.id)!;
    const body = structuredClone(original.body);
    if (kind === 'assessment') {
      const record = (body as { record: Record<string, unknown> }).record;
      record.validUntil = Number(record.validUntil) + 1;
    } else {
      const storedPolicy = (body as { policy: Record<string, unknown> }).policy;
      storedPolicy.failureThreshold = Number(storedPolicy.failureThreshold) + 1;
    }
    expect(detail(appendCopy(state, original, body))).toBe('');

    const before = bytes(state.fixture.storage.read());
    expect(detail(state.restart().admitLoopAttempt(state.admitInput('after-conflicting-copy')))).toContain('conflict');
    expect(bytes(state.fixture.storage.read())).toBe(before);
  },
);
