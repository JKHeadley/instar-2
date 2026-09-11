import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createFactStore, decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy } from '../../src/transport/index.js';
import type { FenceToken, SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const pressureScope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const reference = (record: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode });
const detail = (result: unknown) => consumeResult(result as never, { Success: () => '', Refused: refusal => refusal.detail });

function setup(overrides: Partial<SharedBreakerLoopPolicy> = {}) {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicy({ ...fixture.sharedPolicy, id: 'a1-policy', ...overrides }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  let token = value(fixture.api.acquire('a1-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({ command: 'a1-schedule', fence: token,
    currentOwnerRun: fixture.run, policy, episodeKey: 'only', operationFamily: 'recovery',
    pressureScope, sourceVector: fixture.vector }));
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
  for (const extra of [{ sourceVector: [...state.fixture.vector, { machine: 'z', epoch: 0, position: 0 }] },
    { holderFamily: 'sentinel' }, { worker: 'worker:a' }, { machine: 'machine-a' }, { resource: 1 }])
    expect(detail(state.admit(`excluded-${Object.keys(extra)[0]}`, extra))).toBe('unsupported-in-slice-a1');
  expect(state.fixture.storage.read()).toEqual(before);
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
  const advanced = [...state.fixture.vector, { machine: 'z', epoch: 9, position: 9 }];
  expect(detail(state.admit('advance', { sourceVector: advanced }))).toBe('unsupported-in-slice-a1');
  state.loop = value(state.admit('plain'));
  expect(state.loop.sourceVector).toEqual(state.fixture.vector);
  expect(detail(state.finish('plain', 'accepted', [], { sourceVector: advanced }))).toBe('unsupported-in-slice-a1');
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
