import { afterEach, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore, signEnvelope } from '../../src/facts/index.js';
import { decodeLoopPolicy } from '../../src/transport/index.js';
import type { SharedLoopRecord } from '../../src/transport/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportFixture as legacyFixture } from '../transport/fixture.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));

const scope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' };
const reference = (loop: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
const verdict = (result: any): any => consumeResult(result, {
  Success: (accepted: any) => ({ kind: 'ACCEPT', value: accepted }),
  Refused: (refusal: any) => ({ kind: 'REFUSE', detail: refusal.detail }),
} as any);
const refused = (result: any) => expect(verdict(result)).toMatchObject({ kind: 'REFUSE' });

function setup(overrides: Record<string, unknown> = {}) {
  const fixture = transportLoopFixture();
  const policy: any = value(decodeLoopPolicy({ ...fixture.sharedPolicy, id: 'repair8-policy', ...overrides }, fixture.c));
  fixture.registerPolicy(policy);
  const token = value(fixture.api.acquire('repair8-lease', '', 1000));
  const loop = value(fixture.api.scheduleEpisode({ command: 'repair8-schedule', fence: token,
    currentOwnerRun: fixture.run, policy, episodeKey: 'repair8-episode', operationFamily: 'recovery',
    pressureScope: scope, sourceVector: fixture.vector }));
  return { fixture, policy, token, loop };
}

function admit(state: ReturnType<typeof setup>, attempt: string) {
  return state.fixture.api.admitLoopAttempt({ command: `repair8-admit:${attempt}`, fence: state.token,
    episode: reference(state.loop), attempt, holderFamily: 'sentinel', worker: `worker:${attempt}`,
    machine: 'machine-a', resource: 1, sourceVector: state.fixture.vector });
}

function finish(state: ReturnType<typeof setup>, attempt: string, kind: 'accepted' | 'failed' = 'failed') {
  return state.fixture.api.recordLoopOutcome({ command: `repair8-finish:${attempt}`, fence: state.token,
    episode: reference(state.loop), attempt, kind, failureClass: kind === 'failed' ? 'transport' : '',
    completion: state.fixture.appendOutcome(kind, attempt), jitterPermille: 1000, restoration: [],
    sourceVector: state.fixture.vector });
}

it('SLB-LEGACY-REPLICATION-66 V17 refuses a signed legacy record carrying unwitnessed shared metadata during Part Two replication', () => {
  const fixture = legacyFixture(), token = value(fixture.api.acquire('legacy-lease', '', 500));
  value(fixture.api.schedule('legacy-schedule', token, fixture.run, fixture.policy));
  const wires = fixture.storage.read() as any[], wire = wires.at(-1)!, prefix = wires.slice(0, -1);
  const altered = signEnvelope({ ...wire,
    body: { record: { ...wire.body.record, pressureKey: 'pressure:unwitnessed' } } }, privateKey);
  const store = createFactStore(fixture.ctx, { owner: 'part-ten', read: () => prefix,
    append: (bytes: string, expected: string | null) => fixture.result(() => {
      expect(prefix.at(-1)?.contentHash ?? null).toBe(expected);
      prefix.push(JSON.parse(bytes)); return { kind: 'local-durable' };
    }) });
  expect(verdict(store.append(altered, { peer: fixture.host.machine })).kind).toBe('REFUSE');
});

it('SLB-EXECUTABLE-ADMISSION-67 V14 V18 binds reserve, claim and consume to an admitted shared attempt across ordinary, half-open, cooldown and zero-budget cases', () => {
  {
    const state = setup(); state.fixture.advance(1); value(admit(state, 'ordinary'));
    const reservation = value(state.fixture.api.reserve(state.fixture.input(state.token, { attempt: 'ordinary' })));
    const claim = value(state.fixture.api.claim('ordinary-claim', state.token, reservation.operation));
    expect(value(state.fixture.api.consume(claim, state.token)).state).toBe('consumed');
  }
  {
    const state = setup({ failureThreshold: 1, halfOpenTrials: 1 }); state.fixture.advance(1);
    value(admit(state, 'failure')); value(finish(state, 'failure'));
    refused(state.fixture.api.reserve(state.fixture.input(state.token, { attempt: 'unwitnessed-cooldown' })));
    state.fixture.advance(20); value(admit(state, 'half-open'));
    const reservation = value(state.fixture.api.reserve(state.fixture.input(state.token, { attempt: 'half-open' })));
    const claim = value(state.fixture.api.claim('half-open-claim', state.token, reservation.operation));
    expect(value(state.fixture.api.consume(claim, state.token)).attempt).toBe('half-open');
  }
  {
    const state = setup({ parentAttemptBudget: 0, parentResourceBudget: 0 }); state.fixture.advance(1);
    refused(admit(state, 'zero-budget'));
    refused(state.fixture.api.reserve(state.fixture.input(state.token, { attempt: 'zero-budget' })));
  }
});

it('SLB-LOCALE-ORDER-68 V21 orders non-ASCII attempt identities by canonical bytes', () => {
  const state = setup({ failureThreshold: 1 }); state.fixture.advance(1);
  value(admit(state, 'ä')); value(admit(state, 'z'));
  const completions = { 'ä': state.fixture.appendOutcome('failed', 'ä'), z: state.fixture.appendOutcome('accepted', 'z') };
  let loop = value(state.fixture.api.recordLoopOutcome({ command: 'locale-outcome:ä', fence: state.token,
    episode: reference(state.loop), attempt: 'ä', kind: 'failed', failureClass: 'transport', completion: completions['ä'],
    jitterPermille: 1000, restoration: [], sourceVector: state.fixture.vector }));
  loop = value(state.fixture.api.recordLoopOutcome({ command: 'locale-outcome:z', fence: state.token,
    episode: reference(state.loop), attempt: 'z', kind: 'accepted', failureClass: '', completion: completions.z,
    jitterPermille: 1000, restoration: [], sourceVector: state.fixture.vector }));
  expect(loop.outcomeLog.map(outcome => outcome.attempt)).toEqual(['z', 'ä']);
  expect(loop.failureCount).toBe(1);
  expect(value(canonical(loop.outcomeLog)).hash).toBe(loop.outcomeWindowDigest);
});
