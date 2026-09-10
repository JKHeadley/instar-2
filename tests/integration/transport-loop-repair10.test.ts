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
const verdict = (result: unknown) => consumeResult(result as never, {
  Success: () => 'ACCEPT' as const,
  Refused: () => 'REFUSE' as const,
});

function setup() {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicy({ ...fixture.sharedPolicy, id: 'repair10-resource-policy',
    parentResourceBudget: 1 }, fixture.c)) as typeof fixture.sharedPolicy;
  fixture.registerPolicy(policy);
  const token = value(fixture.api.acquire('repair10-lease', '', 1000));
  const loop = value(fixture.api.scheduleEpisode({ command: 'repair10-schedule', fence: token,
    currentOwnerRun: fixture.run, policy, episodeKey: 'one', operationFamily: 'recovery',
    pressureScope: scope, sourceVector: fixture.vector }));
  fixture.advance(1);
  value(fixture.api.admitLoopAttempt({ command: 'repair10-admit', fence: token, episode: reference(loop),
    attempt: 'resource-attempt', holderFamily: 'sentinel', worker: 'worker:resource', machine: 'machine-a',
    resource: 1, sourceVector: fixture.vector }));
  return { fixture, token };
}

it('SLB-RESOURCE-DEMAND-77 V1 V2 accepts an exact shared resource demand and refuses overspend live', () => {
  const exact = setup();
  const reservation = value(exact.fixture.api.reserve(exact.fixture.input(exact.token, {
    attempt: 'resource-attempt', charge: 1,
  })));
  const claim = value(exact.fixture.api.claim('repair10-claim', exact.token, reservation.operation));
  expect(value(exact.fixture.api.consume(claim, exact.token)).charge).toBe(1);

  const excessive = setup();
  expect(verdict(excessive.fixture.api.reserve(excessive.fixture.input(excessive.token, {
    attempt: 'resource-attempt', charge: 20,
  })))).toBe('REFUSE');
});

it('SLB-RESOURCE-RESTART-78 V16 refuses shared resource overspend after durable reconstruction', () => {
  const state = setup();
  const rebuilt = transportLoopFixture(state.fixture.directory, 'worker:repair10', 'authority:repair10');
  rebuilt.time(101);
  const token = value(rebuilt.api.acquire('repair10-takeover', rebuilt.head(), 1000));
  expect(verdict(rebuilt.api.reserve(rebuilt.input(token, {
    attempt: 'resource-attempt', charge: 20,
  })))).toBe('REFUSE');
});

it('SLB-RESOURCE-REPLAY-79 V17 refuses a correctly signed inflated reservation on replay and replication', () => {
  const state = setup();
  value(state.fixture.api.reserve(state.fixture.input(state.token, { attempt: 'resource-attempt', charge: 1 })));
  const records = value(state.fixture.store.read());
  const wires = state.fixture.storage.read() as FactEnvelope[];
  const wire = wires.at(-1)!;
  const altered = signEnvelope({ ...wire, body: { record: { ...(wire.body as any).record, charge: 20 } } }, privateKey);
  const context = { ...state.fixture.ctx, facts: [...state.fixture.ctx.facts, ...records.slice(0, -1)] };
  const historical = decodeHistoricalBody(value(decodeEnvelope(altered, context, 'replication')), context, context.decode);
  const prefix = wires.slice(0, -1);
  const store = createFactStore(state.fixture.ctx, { owner: 'part-ten', read: () => prefix,
    append: (bytes, expected) => state.fixture.result(() => {
      expect(prefix.at(-1)?.contentHash ?? null).toBe(expected);
      prefix.push(JSON.parse(bytes) as FactEnvelope);
      return { kind: 'local-durable' as const };
    }) });
  expect({ historical: verdict(historical), replicated: verdict(store.append(altered, { peer: state.fixture.host.machine })) })
    .toEqual({ historical: 'REFUSE', replicated: 'REFUSE' });
});
