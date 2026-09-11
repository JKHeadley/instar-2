import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { decodeLoopPolicyA1, storeSharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const mode = process.env.SLB_A1_E2E_MODE;
const directory = process.env.SLB_A1_E2E_DIR;
if (!directory) throw new Error('SLB_A1_E2E_DIR is required');
const scope = { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' } as const;
const reference = (record: SharedLoopRecord) => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode });

function producer(policyOverrides: Partial<SharedBreakerLoopPolicy>) {
  const fixture = transportLoopFixture(directory);
  const policy = value(decodeLoopPolicyA1({ ...fixture.sharedPolicy, id: `a1-e2e-policy:${mode}`,
    ...policyOverrides }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const token = value(fixture.api.acquire(`a1-e2e-lease:${mode}`, '', 1000));
  let loop = value(fixture.api.scheduleEpisode({ command: `a1-e2e-schedule:${mode}`, fence: token,
    currentOwnerRun: fixture.run, policy, episodeKey: 'only', operationFamily: 'recovery', pressureScope: scope,
    sourceVector: fixture.vector }));
  const admit = (attempt: string) => {
    loop = value(fixture.api.admitLoopAttempt({ command: `a1-e2e-admit:${attempt}`, fence: token,
      episode: reference(loop), attempt }));
  };
  const finish = (attempt: string, kind: 'accepted' | 'failed', restoration: SharedLoopRecord['closureEvidence'] = []) => {
    const completion = fixture.appendOutcome(kind, attempt);
    loop = value(fixture.api.recordLoopOutcome({ command: `a1-e2e-finish:${attempt}`, fence: token,
      episode: reference(loop), attempt, kind, failureClass: kind === 'failed' ? 'transport' : '',
      completion, jitterPermille: 1000, restoration }));
    return completion;
  };
  return { fixture, token, get loop() { return loop; }, admit, finish };
}

it.skipIf(!mode?.startsWith('produce-'))('A1 producer persists the requested transition sequence', () => {
  if (mode === 'produce-primary') {
    const state = producer({ failureThreshold: 1, halfOpenTrials: 1, halfOpenConcurrency: 1 });
    state.fixture.advance(1); state.admit('failure'); state.finish('failure', 'failed');
    state.fixture.advance(20); state.admit('failed-trial'); state.finish('failed-trial', 'failed');
    state.fixture.advance(20); state.admit('passing-trial');
    state.finish('passing-trial', 'accepted',
      [state.fixture.restorationReference('assessment:witnessed-review')]);
    expect(state.loop.state).toBe('closed');
  } else if (mode === 'produce-waiting') {
    const state = producer({ failureThreshold: 2 });
    state.fixture.advance(1); state.admit('one-failure'); state.finish('one-failure', 'failed');
    expect(state.loop.state).toBe('waiting');
  } else if (mode === 'produce-stopped') {
    const state = producer({ maxAttempts: 1, failureThreshold: 2 });
    state.fixture.advance(1); state.admit('accepted'); state.finish('accepted', 'accepted');
    state.fixture.advance(1); state.admit('beyond-bound');
    expect(state.loop.state).toBe('stopped');
  } else if (mode === 'produce-evidence') {
    const state = producer({ failureThreshold: 1, halfOpenTrials: 1, halfOpenConcurrency: 1 });
    state.fixture.advance(1); state.admit('failure'); state.finish('failure', 'failed');
    state.fixture.advance(20); state.admit('passing-trial');
    const completion = state.finish('passing-trial', 'accepted');
    expect(state.loop.state).toBe('half-open');
    const closed = value(state.fixture.api.recordLoopOutcome({ command: 'a1-e2e-close-with-proof',
      fence: state.token, episode: reference(state.loop), attempt: 'passing-trial', kind: 'accepted',
      failureClass: '', completion, jitterPermille: 1000,
      restoration: [state.fixture.restorationReference('assessment:witnessed-review')] }));
    expect(closed.state).toBe('closed');
  } else throw new Error(`unknown producer mode: ${mode}`);
});

it.skipIf(mode !== 'recover')('A1 fresh process reconstructs the exact last record without rewriting history', () => {
  const file = join(directory, 'facts.json');
  const before = readFileSync(file, 'utf8');
  const wires = JSON.parse(before) as Array<{ body?: { record?: unknown } }>;
  const expected = [...wires].reverse().find(wire => {
    const record = wire.body?.record as { policy?: { breaker?: unknown } } | undefined;
    return record?.policy?.breaker === 'shared-circuit-v1';
  })?.body?.record;
  expect(expected).toBeDefined();
  const fixture = transportLoopFixture(directory, 'worker:a1-restart', 'authority:a1-restart');
  const actual = value(fixture.api.inspect()).filter(row => row.record.type === 'LoopRecord'
    && row.record.policy.breaker === 'shared-circuit-v1').at(-1)!.record as SharedLoopRecord;
  expect(value(canonical(storeSharedLoopRecord(actual))).bytes).toBe(value(canonical(expected)).bytes);
  expect(readFileSync(file, 'utf8')).toBe(before);
});
