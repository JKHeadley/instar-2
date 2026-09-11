import { expect, it } from 'vitest';
import { decodeLoopPolicy } from '../../src/transport/index.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/index.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const mode = process.env.SLB_A1_E2E_MODE;
const directory = process.env.SLB_A1_E2E_DIR;
if (!directory) throw new Error('SLB_A1_E2E_DIR is required');
const scope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const reference = (record: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode });

it.skipIf(mode !== 'produce')('A1 producer persists an opened breaker at the transition boundary', () => {
  const fixture = transportLoopFixture(directory);
  const policy = value(decodeLoopPolicy({ ...fixture.sharedPolicy, id: 'a1-e2e-policy', failureThreshold: 1 }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const token = value(fixture.api.acquire('a1-e2e-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({ command: 'a1-e2e-schedule', fence: token,
    currentOwnerRun: fixture.run, policy, episodeKey: 'only', operationFamily: 'recovery', pressureScope: scope,
    sourceVector: fixture.vector }));
  fixture.advance(1);
  loop = value(fixture.api.admitLoopAttempt({ command: 'a1-e2e-admit', fence: token,
    episode: reference(loop), attempt: 'failure' }));
  loop = value(fixture.api.recordLoopOutcome({ command: 'a1-e2e-finish', fence: token,
    episode: reference(loop), attempt: 'failure', kind: 'failed', failureClass: 'transport',
    completion: fixture.appendOutcome('failed', 'failure'), jitterPermille: 1000, restoration: [] }));
  expect(loop).toMatchObject({ state: 'open-breaker', attempts: 1, totalFailures: 1 });
});

it.skipIf(mode !== 'recover')('A1 fresh process reconstructs the exact opened state and counters', () => {
  const fixture = transportLoopFixture(directory, 'worker:a1-restart', 'authority:a1-restart');
  fixture.time(101);
  const loop = value(fixture.api.inspect()).filter(row => row.record.type === 'LoopRecord'
    && row.record.policy.breaker === 'shared-circuit-v1').at(-1)!.record as SharedLoopRecord;
  expect(loop).toMatchObject({ state: 'open-breaker', attempts: 1, totalFailures: 1,
    policyGeneration: { id: 'generation:1' } });
});
