import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createFactStore, decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import type { FactEnvelope } from '../../src/facts/index.js';
import { createTransportAuthority, createTransportSpine, decodeLoopPolicy } from '../../src/transport/index.js';
import type { SharedLoopRecord } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const scope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const reference = (loop: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
type Verdict = { kind: 'ACCEPT' | 'REFUSE'; value?: SharedLoopRecord; detail?: string };
const verdict = (result: unknown): Verdict =>
  consumeResult<unknown, Verdict>(result as never, {
    Success: value => ({ kind: 'ACCEPT' as const, value: value as SharedLoopRecord }),
    Refused: refusal => ({ kind: 'REFUSE' as const, detail: refusal.detail }),
  });

function setup(overrides: Record<string, unknown> = {}) {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicy({ ...fixture.sharedPolicy, id: 'repair9-policy', ...overrides }, fixture.c)) as typeof fixture.sharedPolicy;
  fixture.registerPolicy(policy);
  const token = value(fixture.api.acquire('repair9-lease', '', 1000));
  const input = { command: 'repair9-schedule', fence: token, currentOwnerRun: fixture.run, policy,
    episodeKey: 'one', operationFamily: 'recovery', pressureScope: scope, sourceVector: fixture.vector };
  const loop = value(fixture.api.scheduleEpisode(input));
  return { fixture, policy, token, input, loop };
}

function admit(state: ReturnType<typeof setup>, id: string) {
  return state.fixture.api.admitLoopAttempt({ command: `repair9-admit:${id}`, fence: state.token,
    episode: reference(state.loop), attempt: id, holderFamily: 'sentinel', worker: `worker:${id}`,
    machine: 'machine-a', resource: 1, sourceVector: state.fixture.vector });
}

function finish(state: ReturnType<typeof setup>, id: string, kind: 'accepted' | 'failed' = 'failed',
  restoration: SharedLoopRecord['closureEvidence'] = []) {
  return state.fixture.api.recordLoopOutcome({ command: `repair9-finish:${id}`, fence: state.token,
    episode: reference(state.loop), attempt: id, kind, failureClass: kind === 'failed' ? 'transport' : '',
    completion: state.fixture.appendOutcome(kind, id), jitterPermille: 1000, restoration,
    sourceVector: state.fixture.vector });
}

it('SLB-PARENT-CLOCK-70 V01 refuses an incomparable parent-budget clock live and after durable reconstruction', () => {
  const state = setup({ budgetWindow: 10, parentAttemptBudget: 1, parentResourceBudget: 1 });
  state.fixture.advance(1);
  value(admit(state, 'a'));
  value(finish(state, 'a', 'accepted'));
  const originalClock = state.fixture.host.loopClock!;
  Object.assign(state.fixture.host, { loopClock: { owner: 'part-ten', now: () => ({ ...originalClock.now(),
    subject: { kind: 'clock', instance: 'machine-b' } }) } });
  const next = { ...state.input, command: 'repair9-second-scope', episodeKey: 'two',
    pressureScope: { ...scope, target: 'other' } };
  expect(verdict(state.fixture.api.scheduleEpisode(next))).toMatchObject({ kind: 'REFUSE' });

  const store = createFactStore(state.fixture.ctx, state.fixture.storage);
  const rebuilt = createTransportAuthority(state.fixture.host,
    createTransportSpine(state.fixture.host, { context: state.fixture.ctx, privateKey }, store), state.fixture.c);
  expect(verdict(rebuilt.scheduleEpisode(next))).toMatchObject({ kind: 'REFUSE' });

  Object.assign(state.fixture.host, { loopClock: originalClock });
  state.fixture.advance(11);
  const later = value(state.fixture.api.scheduleEpisode({ ...next, command: 'repair9-later-signed' }));
  const stored = value(state.fixture.store.read());
  const fact = stored.filter(candidate => candidate.kind === 'transport-LoopRecord').at(-1)!;
  const wires = state.fixture.storage.read() as FactEnvelope[];
  const wire = wires.find(candidate => candidate.id === fact.id)!;
  const otherClock = (clock: SharedLoopRecord['transitionAt']) => ({ ...clock,
    subject: { kind: 'clock' as const, instance: 'machine-b' } });
  const changed = { ...later, transitionAt: otherClock(later.transitionAt), nextEligible: otherClock(later.nextEligible),
    breakerFirstOpened: otherClock(later.breakerFirstOpened), clockBasis: 'machine-b' };
  const historical = { ...state.fixture.ctx,
    facts: [...state.fixture.ctx.facts, ...stored.filter(candidate => candidate.id !== fact.id)] };
  const altered = signEnvelope({ ...wire, body: { record: changed } }, privateKey);
  const frame = value(decodeEnvelope(altered, historical, 'replication'));
  expect(verdict(decodeHistoricalBody(frame, historical, historical.decode))).toMatchObject({ kind: 'REFUSE' });
  const prefix = wires.filter(candidate => candidate.id !== fact.id);
  const replica = createFactStore(state.fixture.ctx, { owner: 'part-ten', read: () => prefix,
    append: (bytes, expected) => state.fixture.result(() => {
      expect(prefix.at(-1)?.contentHash ?? null).toBe(expected);
      prefix.push(JSON.parse(bytes) as FactEnvelope); return { kind: 'local-durable' as const };
    }) });
  expect(verdict(replica.append(altered, { peer: state.fixture.host.machine }))).toMatchObject({ kind: 'REFUSE' });
});

it('SLB-LATER-CYCLE-71 V02 starts a new uninterrupted open timer after witnessed closure and reconstructs it', () => {
  const state = setup({ failureThreshold: 1, halfOpenTrials: 1, maxOpenDuration: 30 });
  state.fixture.advance(1);
  value(admit(state, 'fail-1'));
  value(finish(state, 'fail-1'));
  state.fixture.advance(20);
  value(admit(state, 'trial-1'));
  const restored = state.fixture.restorationReference('assessment:witnessed-review');
  expect(value(finish(state, 'trial-1', 'accepted', [restored])).state).toBe('closed');

  state.fixture.advance(20);
  state.loop = value(state.fixture.api.scheduleEpisode({ ...state.input, command: 'repair9-cycle-two', episodeKey: 'two' }));
  state.fixture.advance(1);
  value(admit(state, 'fail-2'));
  const opened = value(finish(state, 'fail-2'));
  expect(opened.breakerFirstOpened.value).toBe(142);
  state.fixture.advance(20);
  const trial = value(admit(state, 'trial-2'));
  expect(trial).toMatchObject({ state: 'half-open', transition: 'half-opened', pendingAttempts: ['trial-2'] });

  const rebuilt = transportLoopFixture(state.fixture.directory, 'worker:repair9-rebuild', 'authority:repair9-rebuild');
  rebuilt.time(162);
  const latest = value(rebuilt.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record as SharedLoopRecord;
  expect(latest).toMatchObject({ state: 'half-open', breakerFirstOpened: { value: 142 }, pendingAttempts: ['trial-2'] });
}, 15_000);
