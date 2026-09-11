import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore, decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import { decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import type { FenceToken } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const pressureScope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const reference = (record: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode });
const detail = (result: unknown) => consumeResult(result as never, { Success: () => '', Refused: refusal => refusal.detail });
const verdict = (result: unknown): { readonly kind: string; readonly value: unknown } => consumeResult(result as never, {
  Success: accepted => ({ kind: 'accepted', value: accepted }),
  Refused: refused => ({ kind: 'refused', value: refused }),
});

function setup(overrides: Partial<SharedBreakerLoopPolicy> = {}, sourceVector?: SharedLoopRecord['sourceVector']) {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({ ...fixture.sharedPolicy, id: 'a1-policy', ...overrides }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  let token = value(fixture.api.acquire('a1-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({ command: 'a1-schedule', fence: token,
    currentOwnerRun: fixture.run, policy, episodeKey: 'only', operationFamily: 'recovery',
    pressureScope, sourceVector: sourceVector ?? fixture.vector }));
  const admit = (attempt: string, extra: object = {}) => fixture.api.admitLoopAttempt({
    command: `a1-admit:${attempt}`, fence: token, episode: reference(loop), attempt, ...extra } as never);
  const finish = (attempt: string, kind: 'accepted' | 'failed', restoration: SharedLoopRecord['closureEvidence'] = [], extra: object = {}) =>
    fixture.api.recordLoopOutcome({ command: `a1-finish:${attempt}`, fence: token, episode: reference(loop), attempt,
      kind, failureClass: kind === 'failed' ? 'transport' : '', completion: fixture.appendOutcome(kind, attempt),
      jitterPermille: 1000, restoration, ...extra } as never);
  return { fixture, policy, get token() { return token; }, set token(value: FenceToken) { token = value; },
    get loop() { return loop; }, set loop(value: SharedLoopRecord) { loop = value; }, admit, finish };
}

it('SLB-A1-CYCLE-86 opens once, refuses cooldown contenders, reopens a failed trial, and closes only with independent restoration', () => {
  const state = setup({ failureThreshold: 1, halfOpenTrials: 1, halfOpenConcurrency: 1 });
  state.fixture.advance(1);
  state.loop = value(state.admit('failure'));
  state.loop = value(state.finish('failure', 'failed'));
  expect(state.loop.state).toBe('open-breaker');
  expect(detail(state.admit('cooldown'))).toContain('cooldown');

  state.fixture.advance(20);
  state.loop = value(state.admit('failed-trial'));
  expect(state.loop.state).toBe('half-open');
  state.loop = value(state.finish('failed-trial', 'failed'));
  expect(state.loop.state).toBe('open-breaker');

  state.fixture.advance(20);
  state.loop = value(state.admit('passing-trial'));
  const restoration = [state.fixture.restorationReference('assessment:witnessed-review')];
  state.loop = value(state.finish('passing-trial', 'accepted', restoration));
  expect(state.loop.state).toBe('closed');
  expect(state.loop.closureEvidence).toEqual(restoration);
  expect(state.loop.breakerOpenCount).toBe(2);
});

it('SLB-A1-REFUSALS-87 typed-refuses second episodes and every excluded transition extension without storing it', () => {
  const state = setup();
  const before = state.fixture.storage.read();
  expect(detail(state.fixture.api.scheduleEpisode({ command: 'a1-second', fence: state.token,
    currentOwnerRun: state.fixture.run, policy: state.policy, episodeKey: 'second', operationFamily: 'recovery',
    pressureScope, sourceVector: state.fixture.vector }))).toBe('unsupported-in-slice-a1');
  for (const extra of [{ sourceVector: [] },
    { holderFamily: 'sentinel' }, { worker: 'worker:a' }, { machine: 'machine-a' }, { resource: 1 }])
    expect(detail(state.admit(`excluded-${Object.keys(extra)[0]}`, extra))).toBe('unsupported-in-slice-a1');
  expect(state.fixture.storage.read()).toEqual(before);
});

it('SLB-A1-PARENT-95 refuses a second witnessed pressure or conflicting policy for the same parent', () => {
  const state = setup();
  let before = JSON.stringify(state.fixture.storage.read());
  const secondPressure = { ...pressureScope, target: 'other' };
  expect(detail(state.fixture.api.scheduleEpisode({
    command: 'a1-second-pressure', fence: state.token, currentOwnerRun: state.fixture.run,
    policy: state.policy, episodeKey: 'second', operationFamily: 'recovery',
    pressureScope: secondPressure, sourceVector: state.fixture.vector,
  } as never))).toBe('unsupported-in-slice-a1');
  expect(JSON.stringify(state.fixture.storage.read())).toBe(before);
  const conflict = value(decodeLoopPolicyA1({ ...state.policy, id: 'a1-conflict', failureThreshold: 1 },
    state.fixture.c)) as SharedBreakerLoopPolicy;
  state.fixture.registerPolicy(conflict);
  before = JSON.stringify(state.fixture.storage.read());
  expect(detail(state.fixture.api.scheduleEpisode({ command: 'a1-second-policy', fence: state.token,
    currentOwnerRun: state.fixture.run, policy: conflict, episodeKey: 'second', operationFamily: 'recovery',
    pressureScope: secondPressure, sourceVector: state.fixture.vector }))).toContain('conflicting');
  expect(JSON.stringify(state.fixture.storage.read())).toBe(before);
});

it('SLB-A1-EXCLUSIONS-96 typed-refuses every A2 budget/cursor field on schedule, admission, and outcome', () => {
  const state = setup();
  const excluded = ['parentAttemptBudget', 'resourceBudget', 'cursorKind', 'scanCursor'] as const;
  for (const field of excluded) {
    const before = JSON.stringify(state.fixture.storage.read());
    expect(detail(state.fixture.api.scheduleEpisode({ command: `a1-schedule-${field}`, fence: state.token,
      currentOwnerRun: state.fixture.run, policy: state.policy, episodeKey: 'only', operationFamily: 'recovery',
      pressureScope, sourceVector: state.fixture.vector, [field]: field === 'scanCursor'
        ? { owner: 'part-six', name: 'ScanCursor', id: 'x' } : 1 } as never))).toBe('unsupported-in-slice-a1');
    state.fixture.advance(1);
    expect(detail(state.admit(`a1-admit-${field}`, { [field]: 1 }))).toBe('unsupported-in-slice-a1');
    expect(JSON.stringify(state.fixture.storage.read())).toBe(before);
  }
  state.fixture.advance(1);
  state.loop = value(state.admit('a1-outcome-exclusions'));
  const completion = state.fixture.appendOutcome('accepted', 'a1-outcome-exclusions');
  for (const field of excluded) expect(detail(state.fixture.api.recordLoopOutcome({
    command: `a1-outcome-${field}`, fence: state.token, episode: reference(state.loop),
    attempt: 'a1-outcome-exclusions', kind: 'accepted', failureClass: '', completion,
    jitterPermille: 1000, restoration: [], [field]: 1,
  } as never))).toBe('unsupported-in-slice-a1');
});

it('SLB-A1-GENERATION-88 records the one checked generation live and refuses a signed replay mismatch', () => {
  const state = setup({ failureThreshold: 1, halfOpenTrials: 1, halfOpenConcurrency: 1 });
  value(state.fixture.api.release('a1-g1-release', state.token));
  state.fixture.generation('generation:2');
  state.token = value(state.fixture.api.acquire('a1-g2-lease', state.fixture.head(), 1000));
  state.fixture.registerPolicy(state.policy);
  state.fixture.advance(1);
  state.loop = value(state.admit('generation-two'));
  expect(state.loop.policyGeneration.id).toBe('generation:2');

  const records = value(state.fixture.store.read());
  const wires = state.fixture.storage.read() as any[];
  const wire = wires.at(-1)!;
  const changed = structuredClone(wire.body.record);
  changed.policyGeneration = { ...changed.policyGeneration, id: 'generation:1' };
  const g1 = records.find(fact => fact.kind === 'transport-SharedBreakerLoopPolicy'
    && (fact.body as { generation?: unknown }).generation === 'generation:1')!;
  const g2 = records.find(fact => fact.kind === 'transport-SharedBreakerLoopPolicy'
    && (fact.body as { generation?: unknown }).generation === 'generation:2')!;
  const altered = signEnvelope({ ...wire, predecessors: { ...wire.predecessors,
    required: wire.predecessors.required.map((id: string) => id === g2.id ? g1.id : id) },
  body: { record: changed } }, privateKey);
  const context = { ...state.fixture.ctx, facts: [...state.fixture.ctx.facts, ...records.slice(0, -1)] };
  expect(detail(decodeHistoricalBody(value(decodeEnvelope(altered, context, 'replication')), context, context.decode)))
    .toContain('generation differs');
  const prefix = wires.slice(0, -1);
  const store = createFactStore(state.fixture.ctx, { owner: 'part-ten', read: () => prefix,
    append: (bytes, expected) => state.fixture.result(() => {
      expect(prefix.at(-1)?.contentHash ?? null).toBe(expected); prefix.push(JSON.parse(bytes));
      return { kind: 'local-durable' as const };
    }) });
  expect(detail(store.append(altered, { peer: state.fixture.host.machine }))).toContain('generation differs');
});

it('SLB-A1-OPAQUE-VECTOR-89 carries the initial vector unchanged and typed-refuses transition advancement', () => {
  const state = setup();
  state.fixture.advance(1);
  const advanced: never[] = [];
  expect(detail(state.admit('advance', { sourceVector: advanced }))).toBe('unsupported-in-slice-a1');
  state.loop = value(state.admit('plain'));
  expect(state.loop.sourceVector).toEqual(state.fixture.vector);
  expect(detail(state.finish('plain', 'accepted', [], { sourceVector: advanced }))).toBe('unsupported-in-slice-a1');
});

it('SLB-A1-OPAQUE-SHAPE-97 accepts an opaque reference and typed-refuses materialized coordinates', () => {
  const opaque = { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: 'opaque:frontier' };
  const state = setup({}, opaque);
  expect(state.loop.sourceVector).toEqual(opaque);
  const before = JSON.stringify(state.fixture.storage.read());
  expect(detail(state.fixture.api.scheduleEpisode({ command: 'a1-changed-opaque-vector', fence: state.token,
    currentOwnerRun: state.fixture.run, policy: state.policy, episodeKey: 'only', operationFamily: 'recovery',
    pressureScope, sourceVector: { ...opaque, id: 'opaque:changed' } }))).toBe('unsupported-in-slice-a1');
  expect(detail(state.fixture.api.scheduleEpisode({ command: 'a1-materialized-vector', fence: state.token,
    currentOwnerRun: state.fixture.run, policy: state.policy, episodeKey: 'only', operationFamily: 'recovery',
    pressureScope, sourceVector: [{ machine: 'not-a-lineage', epoch: -7, position: -9 }] } as never)))
    .toBe('unsupported-in-slice-a1');
  expect(JSON.stringify(state.fixture.storage.read())).toBe(before);
});

it('SLB-A1-LATER-CYCLE-98 admits a later same-episode cycle with cumulative counters and fresh closure proof', () => {
  const state = setup({ failureThreshold: 1, halfOpenTrials: 1, halfOpenConcurrency: 1 });
  state.fixture.advance(1);
  state.loop = value(state.admit('cycle-one-failure'));
  state.loop = value(state.finish('cycle-one-failure', 'failed'));
  state.fixture.advance(20);
  state.loop = value(state.admit('cycle-one-trial'));
  state.loop = value(state.finish('cycle-one-trial', 'accepted',
    [state.fixture.restorationReference('assessment:witnessed-review')]));
  const firstOpenCount = state.loop.breakerOpenCount;
  const firstFailureTotal = state.loop.totalFailures;
  state.fixture.advance(1);
  state.loop = value(state.admit('cycle-two-failure'));
  expect(state.loop).toMatchObject({ state: 'running', closureEvidence: [],
    breakerOpenCount: firstOpenCount, totalFailures: firstFailureTotal });
  state.loop = value(state.finish('cycle-two-failure', 'failed'));
  state.fixture.advance(20);
  state.loop = value(state.admit('cycle-two-trial'));
  const completion = state.fixture.appendOutcome('accepted', 'cycle-two-trial');
  state.loop = value(state.fixture.api.recordLoopOutcome({ command: 'cycle-two-pass', fence: state.token,
    episode: reference(state.loop), attempt: 'cycle-two-trial', kind: 'accepted', failureClass: '',
    completion, jitterPermille: 1000, restoration: [] }));
  expect(state.loop).toMatchObject({ state: 'half-open', closureEvidence: [] });
  const fresh = state.fixture.restorationReference('assessment:witnessed-review-cycle-2');
  state.loop = value(state.fixture.api.recordLoopOutcome({ command: 'cycle-two-close', fence: state.token,
    episode: reference(state.loop), attempt: 'cycle-two-trial', kind: 'accepted', failureClass: '',
    completion, jitterPermille: 1000, restoration: [fresh] }));
  expect(state.loop).toMatchObject({ state: 'closed', closureEvidence: [fresh],
    breakerOpenCount: firstOpenCount + 1, totalFailures: firstFailureTotal + 1 });
}, 15_000);

it('SLB-A1-FRONTIER-99 is locale-independent and replay-order deterministic at an equal clock', () => {
  const state = setup({ failureThreshold: 1, halfOpenTrials: 1, halfOpenConcurrency: 1 });
  state.fixture.advance(1);
  state.loop = value(state.admit('failure'));
  state.loop = value(state.finish('failure', 'failed'));
  state.fixture.advance(20);
  state.loop = value(state.admit('é'));
  state.loop = value(state.finish('é', 'accepted',
    [state.fixture.restorationReference('assessment:witnessed-review')]));
  state.loop = value(state.admit('z'));
  const original = String.prototype.localeCompare;
  String.prototype.localeCompare = function forbiddenLocaleCompare() { throw new Error('locale-dependent compare'); };
  try {
    state.loop = value(state.finish('z', 'accepted'));
  } finally {
    String.prototype.localeCompare = original;
  }
  expect(state.loop.outcomeLog.filter(outcome => outcome.observedAt.value === state.loop.transitionAt.value)
    .map(outcome => outcome.attempt)).toEqual(['z', 'é']);
  expect(state.loop.outcomeWindowDigest).toBe((value(canonical(state.loop.outcomeLog)) as { hash: string }).hash);
  const wire = (state.fixture.storage.read() as any[]).at(-1)!;
  const facts = value(state.fixture.store.read());
  const past = [...state.fixture.ctx.facts, ...facts.slice(0, -1)];
  const outputs = [past, [...past].reverse()].map(history => {
    const context = { ...state.fixture.ctx, facts: history };
    return verdict(decodeHistoricalBody(value(decodeEnvelope(wire, context, 'replication')),
      context, context.decode));
  });
  expect(outputs[0]!.kind).toBe('accepted');
  expect(outputs[1]).toEqual(outputs[0]);
});

it('SLB-A1-RESTART-90 reconstructs breaker counters and state across a fresh Part Two-backed authority', () => {
  const state = setup({ failureThreshold: 1 });
  state.fixture.advance(1);
  state.loop = value(state.admit('failure'));
  state.loop = value(state.finish('failure', 'failed'));
  const restarted = transportLoopFixture(state.fixture.directory, 'worker:restart', 'authority:restart');
  restarted.time(101);
  const rebuilt = value(restarted.api.inspect()).filter(row => row.record.type === 'LoopRecord'
    && row.record.policy.breaker === 'shared-circuit-v1').at(-1)!.record as SharedLoopRecord;
  expect(rebuilt.state).toBe('open-breaker');
  expect(rebuilt.attempts).toBe(1);
  expect(rebuilt.totalFailures).toBe(1);
});
