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
    id: 'support-witness-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('support-witness-lease', '', 1000));
  const scheduleInput = {
    command: 'support-witness-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'one', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  } as const;
  let loop = value(fixture.api.scheduleEpisode(scheduleInput));
  const outcomeInputs = new Map<string, Parameters<typeof fixture.api.recordLoopOutcome>[0]>();
  const reference = () => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
  const admitInput = (attempt: string) => ({
    command: `support-witness-admit:${attempt}`, fence, episode: reference(), attempt,
  });
  const admit = (attempt: string) => {
    loop = value(fixture.api.admitLoopAttempt(admitInput(attempt)));
  };
  const finish = (attempt: string, kind: 'accepted' | 'failed', restoration: readonly {
    owner: 'part-nine'; name: 'VerificationAssessment'; id: string;
  }[] = []) => {
    const input = {
      command: `support-witness-finish:${attempt}`,
      fence,
      episode: reference(),
      attempt,
      kind,
      failureClass: kind === 'failed' ? 'transport' : '',
      completion: fixture.appendOutcome(kind, attempt),
      jitterPermille: 1000,
      restoration,
    } as const;
    outcomeInputs.set(attempt, input);
    loop = value(fixture.api.recordLoopOutcome(input));
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
    fixture, policy, scheduleInput, admitInput, outcomeInput: (attempt: string) => outcomeInputs.get(attempt)!,
    admit, finish, open, restart,
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

it.each(['Run', 'VerificationPlan', 'VerificationRequest', 'Evidence'] as const)(
  'SLB-A1-SUPPORT-WITNESSES-134 equivalent signed %s support preserves history and later admission', kind => {
    const state = setup();
    state.open();
    state.admit('trial');
    state.finish('trial', 'accepted', [state.fixture.restorationReference('assessment:witnessed-review')]);
    expect(state.loop.state).toBe('closed');
    const prior = value(state.fixture.api.inspect()).at(-1)!.fact;
    const assessment = state.fixture.assessmentFact('assessment:witnessed-review')!;
    const assessmentRecord = (assessment.body as { record: { request: string; evidence: string[] } }).record;
    const facts = [...state.fixture.ctx.facts, ...value(state.fixture.store.read())];
    const request = facts.find(fact => (fact.body as { record?: { id?: string } }).record?.id
      === assessmentRecord.request)!;
    const planId = (request.body as { record: { plan: string } }).record.plan;
    const original = facts.find(fact => kind === 'Evidence'
      ? (fact.body as { evidence?: { id?: string } }).evidence?.id === assessmentRecord.evidence[0]
      : (fact.body as { record?: { type?: string; id?: string } }).record?.type === kind
        && (kind === 'Run'
          ? (fact.body as { record: { id?: string } }).record.id === state.fixture.run.id
          : (fact.body as { record: { id?: string } }).record.id
            === (kind === 'VerificationPlan' ? planId : assessmentRecord.request)))!;
    expect(original, kind).toBeDefined();
    expect(detail(appendCopy(state, original))).toBe('');
    const context = { ...state.fixture.ctx,
      facts: [...state.fixture.ctx.facts, ...value(state.fixture.store.read())] };
    expect(detail(decodeHistoricalBody(prior, context, context.decode))).toBe('');
    expect(detail(state.restart().inspect())).toBe('');
    expect(detail(state.restart().admitLoopAttempt(state.admitInput('after-copy')))).toBe('');
  },
  120_000,
);

type ReadSignedKind = 'SharedBreakerLoopPolicy' | 'Run' | 'PressureBinding' | 'SharedLoopRecord'
  | 'Outcome' | 'VerificationAssessment' | 'VerificationRequest' | 'VerificationPlan' | 'Evidence';

const readSignedKinds: readonly ReadSignedKind[] = [
  'SharedBreakerLoopPolicy', 'Run', 'PressureBinding', 'SharedLoopRecord', 'Outcome',
  'VerificationAssessment', 'VerificationRequest', 'VerificationPlan', 'Evidence',
];

function closedState() {
  const state = setup();
  state.open();
  state.admit('trial');
  state.finish('trial', 'accepted', [state.fixture.restorationReference('assessment:witnessed-review')]);
  expect(state.loop.state).toBe('closed');
  return state;
}

function signedFact(state: ReturnType<typeof setup>, kind: ReadSignedKind): FactEnvelope {
  const facts = [...state.fixture.ctx.facts, ...value(state.fixture.store.read())];
  const assessment = state.fixture.assessmentFact('assessment:witnessed-review')!;
  const assessmentRecord = (assessment.body as { record: { request: string; evidence: string[] } }).record;
  const request = facts.find(fact => (fact.body as { record?: { id?: string } }).record?.id
    === assessmentRecord.request)!;
  const plan = (request.body as { record: { plan: string } }).record.plan;
  const completion = state.loop.outcomeLog.find(outcome => outcome.attempt === 'trial')!.completion.fact.id;
  const found = facts.find(fact => {
    const record = (fact.body as { record?: { type?: string; id?: string; command?: string } }).record;
    if (kind === 'SharedBreakerLoopPolicy') return fact.kind === 'transport-SharedBreakerLoopPolicy'
      && (fact.body as { policy?: { id?: string } }).policy?.id === state.policy.id;
    if (kind === 'Run') return record?.type === 'Run' && record.id === state.fixture.run.id;
    if (kind === 'PressureBinding') return fact.id === state.loop.pressureBinding.id;
    if (kind === 'SharedLoopRecord') return fact.kind === 'transport-SharedLoopRecord'
      && record?.command === 'support-witness-admit:trial';
    if (kind === 'Outcome') return fact.id === completion;
    if (kind === 'VerificationAssessment') return fact.id === assessment.id;
    if (kind === 'VerificationRequest') return record?.type === kind && record.id === assessmentRecord.request;
    if (kind === 'VerificationPlan') return record?.type === kind && record.id === plan;
    return (fact.body as { evidence?: { id?: string } }).evidence?.id === assessmentRecord.evidence[0];
  });
  expect(found, kind).toBeDefined();
  return found!;
}

function operationResults(state: ReturnType<typeof setup>): readonly string[] {
  return [
    state.restart().inspect(),
    state.restart().scheduleEpisode(state.scheduleInput),
    state.restart().admitLoopAttempt(state.admitInput('trial')),
    state.restart().recordLoopOutcome(state.outcomeInput('trial')),
  ].map(result => bytes(result));
}

function reverseObjectKeys(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(reverseObjectKeys);
  if (!input || typeof input !== 'object') return input;
  return Object.fromEntries(Object.entries(input as Record<string, unknown>).reverse()
    .map(([key, value]) => [key, reverseObjectKeys(value)]));
}

function canonicalReencodings(input: FactEnvelope['body']): readonly FactEnvelope['body'][] {
  return [
    JSON.parse(bytes(input)) as FactEnvelope['body'],
    reverseObjectKeys(input) as FactEnvelope['body'],
  ];
}

function selectPressureBinding(state: ReturnType<typeof setup>, port: NonNullable<
  ReturnType<typeof setup>['fixture']['host']['loopScopeBinding']>, id: string): void {
  (state.fixture.host as { loopScopeBinding: typeof port }).loopScopeBinding = {
    owner: 'part-three',
    resolve: input => {
      const resolved = value(port.resolve(input));
      return state.fixture.success({ ...resolved, witness: { ...resolved.witness, id } });
    },
  };
}

function mutatedBody(kind: ReadSignedKind, original: FactEnvelope): FactEnvelope['body'] {
  const body = structuredClone(original.body) as Record<string, any>;
  if (kind === 'SharedBreakerLoopPolicy') body.policy.failureThreshold += 1;
  else if (kind === 'Run') body.record.cadence.milliseconds += 1;
  else if (kind === 'PressureBinding') body.copyConflict = true;
  else if (kind === 'SharedLoopRecord') body.record.tick += 1;
  else if (kind === 'Outcome') body.loopFailureClass = 'copy-conflict';
  else if (kind === 'VerificationAssessment') body.record.validUntil += 1;
  else if (kind === 'VerificationRequest') body.record.createdAt += 1;
  else if (kind === 'VerificationPlan') body.record.bar.freshness += 1;
  else body.evidence.freshFor += 1;
  return body as FactEnvelope['body'];
}

it.each(readSignedKinds)(
  'SLB-A1-COPY-INVARIANCE-135 SLB-A1-EQUIVALENT-SCHEDULE-140 duplicate signed %s leaves every A1 operation Result unchanged; canonical re-encodings never conflict and mutation refuses', kind => {
    const identical = closedState();
    const before = operationResults(identical);
    const original = signedFact(identical, kind);
    const copies = canonicalReencodings(original.body).map(body => {
      expect(bytes(body)).toBe(bytes(original.body));
      const appended = appendCopy(identical, original, body);
      expect(detail(appended)).toBe('');
      return value(appended).fact;
    });
    const originalPort = identical.fixture.host.loopScopeBinding!;
    if (kind === 'PressureBinding') selectPressureBinding(identical, originalPort, copies.at(-1)!.id);
    expect(operationResults(identical)).toEqual(before);
    if (kind === 'PressureBinding') {
      const storedBefore = bytes(identical.fixture.storage.read());
      expect(value(identical.restart().scheduleEpisode(identical.scheduleInput))).toEqual(identical.loop);
      expect(bytes(identical.fixture.storage.read())).toBe(storedBefore);
      selectPressureBinding(identical, originalPort, 'absent-binding');
      expect(detail(identical.restart().scheduleEpisode(identical.scheduleInput))).not.toBe('');
      expect(bytes(identical.fixture.storage.read())).toBe(storedBefore);
    }

    const conflicting = closedState();
    const conflictingOriginal = signedFact(conflicting, kind);
    const storedBefore = bytes(conflicting.fixture.storage.read());
    const appendDetail = detail(appendCopy(conflicting, conflictingOriginal,
      mutatedBody(kind, conflictingOriginal)));
    if (appendDetail) {
      expect(bytes(conflicting.fixture.storage.read())).toBe(storedBefore);
    } else {
      const afterConflict = bytes(conflicting.fixture.storage.read());
      expect(detail(conflicting.restart().recordLoopOutcome(conflicting.outcomeInput('trial')))).not.toBe('');
      expect(bytes(conflicting.fixture.storage.read())).toBe(afterConflict);
    }
  },
  120_000,
);
