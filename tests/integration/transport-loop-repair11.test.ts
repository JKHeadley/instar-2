import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore, decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy } from '../../src/transport/index.js';
import type { SharedLoopRecord } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const scope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const reference = (loop: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
const verdict = (result: unknown) => consumeResult(result as never, {
  Success: () => 'ACCEPT' as const,
  Refused: () => 'REFUSE' as const,
});

function setup(overrides: Record<string, unknown> = {}) {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicy({ ...fixture.sharedPolicy, id: 'repair11-policy', ...overrides }, fixture.c)) as typeof fixture.sharedPolicy;
  fixture.registerPolicy(policy);
  const token = value(fixture.api.acquire('repair11-lease', '', 1000));
  const input = { command: 'repair11-schedule', fence: token, currentOwnerRun: fixture.run, policy,
    episodeKey: 'first', operationFamily: 'recovery', pressureScope: scope, sourceVector: fixture.vector };
  const loop = value(fixture.api.scheduleEpisode(input));
  return { fixture, policy, token, input, loop };
}

function admit(state: ReturnType<typeof setup>, id: string) {
  return state.fixture.api.admitLoopAttempt({ command: `repair11-admit:${id}`, fence: state.token,
    episode: reference(state.loop), attempt: id, holderFamily: 'sentinel', worker: `worker:${id}`,
    machine: 'machine-a', resource: 1, sourceVector: state.fixture.vector });
}

function finish(state: ReturnType<typeof setup>, id: string, kind: 'accepted' | 'failed',
  restoration: readonly { owner: 'part-nine'; name: 'VerificationAssessment'; id: string }[] = []) {
  const completion = state.fixture.appendOutcome(kind, id);
  return state.fixture.api.recordLoopOutcome({ command: `repair11-finish:${id}:${restoration.length}`,
    fence: state.token, episode: reference(state.loop), attempt: id, kind,
    failureClass: kind === 'failed' ? 'transport' : '', completion, jitterPermille: 1000,
    restoration, sourceVector: state.fixture.vector });
}

function replay(state: ReturnType<typeof setup>, mutate: (record: any, wires: readonly FactEnvelope[]) => any) {
  const stored = value(state.fixture.store.read());
  const wires = state.fixture.storage.read() as FactEnvelope[];
  const wire = wires.at(-1)!;
  const altered = signEnvelope({ ...wire, body: { record: mutate((wire.body as any).record, wires) } }, privateKey);
  const context = { ...state.fixture.ctx, facts: [...state.fixture.ctx.facts, ...stored.slice(0, -1)] };
  const historical = decodeHistoricalBody(value(decodeEnvelope(altered, context, 'replication')), context, context.decode);
  const prefix = wires.slice(0, -1);
  const replica = createFactStore(state.fixture.ctx, { owner: 'part-ten', read: () => prefix,
    append: (bytes, expected) => state.fixture.result(() => {
      expect(prefix.at(-1)?.contentHash ?? null).toBe(expected);
      prefix.push(JSON.parse(bytes) as FactEnvelope);
      return { kind: 'local-durable' as const };
    }) });
  return { historical: verdict(historical), replicated: verdict(replica.append(altered, { peer: state.fixture.host.machine })) };
}

it('SLB-CURRENT-STOP-82 review V27 refuses an old closed interval as a stop bound and keeps the current-open control', () => {
  const state = setup({ failureThreshold: 1, halfOpenTrials: 1, maxOpenDuration: 30 });
  state.fixture.advance(1);
  value(admit(state, 'first'));
  state.loop = value(finish(state, 'first', 'failed'));
  state.fixture.advance(20);
  value(admit(state, 'trial'));
  state.loop = value(finish(state, 'trial', 'accepted', [state.fixture.restorationReference('assessment:witnessed-review')]));
  state.fixture.advance(20);
  state.loop = value(state.fixture.api.scheduleEpisode({ ...state.input, command: 'repair11-cycle-two', episodeKey: 'second' }));
  state.fixture.advance(1);
  value(admit(state, 'healthy'));
  const stopped = replay(state, (_record, wires) => {
    const previous = (wires.at(-2)!.body as any).record;
    return { ...previous, command: 'repair11-admit:healthy', tick: 142, nextWake: 142, state: 'stopped', pending: '',
      transition: 'stopped', transitionAt: state.fixture.clock(142), nextEligible: state.fixture.clock(142) };
  });
  expect(stopped).toEqual({ historical: 'REFUSE', replicated: 'REFUSE' });

  const control = setup({ failureThreshold: 1, maxOpenDuration: 30 });
  control.fixture.advance(1);
  value(admit(control, 'failure'));
  control.loop = value(finish(control, 'failure', 'failed'));
  control.fixture.advance(31);
  expect(value(admit(control, 'beyond')).state).toBe('stopped');
});

it('SLB-DELAYED-WINDOW-83 review V38 recomputes closure at its own time and refuses the expired prior window', () => {
  const state = setup({ failureThreshold: 1, halfOpenTrials: 1, budgetWindow: 5, acceptedOutcomeWindow: 5 });
  state.fixture.advance(1);
  value(admit(state, 'failure'));
  state.loop = value(finish(state, 'failure', 'failed'));
  state.fixture.advance(20);
  value(admit(state, 'trial'));
  state.loop = value(finish(state, 'trial', 'accepted'));
  const staleDigest = state.loop.outcomeWindowDigest;
  expect(state.loop).toMatchObject({ state: 'half-open', rollingAttempts: 1, rollingResource: 1 });
  state.fixture.advance(6);
  state.loop = value(state.fixture.api.recordLoopOutcome({ command: 'repair11-delayed-proof', fence: state.token,
    episode: reference(state.loop), attempt: 'trial', kind: 'accepted', failureClass: '',
    completion: state.loop.outcomeLog.at(-1)!.completion, jitterPermille: 1000,
    restoration: [state.fixture.restorationReference('assessment:witnessed-review')],
    sourceVector: state.fixture.vector }));
  expect(state.loop).toMatchObject({ state: 'closed', attempts: 2, rollingAttempts: 0, rollingResource: 0 });
  expect(state.loop.outcomeWindowDigest).toBe(value(canonical([])).hash);
  expect(replay(state, record => record)).toEqual({ historical: 'ACCEPT', replicated: 'ACCEPT' });
  expect(replay(state, record => ({ ...record, rollingAttempts: 1, rollingResource: 1,
    outcomeWindowDigest: staleDigest }))).toEqual({ historical: 'REFUSE', replicated: 'REFUSE' });
});
