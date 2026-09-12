import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { decodeLoopPolicyA1, storeSharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import type { LoopOutcomeInput, SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const mode = process.env.SLB_A1_REPAIR19_E2E_MODE;
const directory = process.env.SLB_A1_REPAIR19_E2E_DIR;
if (!directory) throw new Error('SLB_A1_REPAIR19_E2E_DIR is required');
const scenario = mode?.split('-').at(-1);
const reference = (record: SharedLoopRecord) => ({
  owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode,
});
const encodedRecord = (record: SharedLoopRecord) => value(canonical(storeSharedLoopRecord(record))).bytes;

function passingTrial(halfOpenTrials: number, leaseTerm = 1000) {
  const fixture = transportLoopFixture(directory);
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: `repair19-e2e-policy:${scenario}`,
    failureThreshold: 1,
    halfOpenTrials,
    halfOpenConcurrency: 1,
    maxDuration: Math.max(fixture.sharedPolicy.maxDuration, leaseTerm),
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  (fixture.host as { maxLeaseTerm: number }).maxLeaseTerm = leaseTerm;
  const fence = value(fixture.api.acquire(`repair19-e2e-lease:${scenario}`, '', leaseTerm));
  let loop = value(fixture.api.scheduleEpisode({
    command: `repair19-e2e-schedule:${scenario}`, fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'only', operationFamily: 'recovery',
    pressureScope: { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' },
    sourceVector: fixture.vector,
  }));
  fixture.time(101);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair19-e2e-admit-failure', fence, episode: reference(loop), attempt: 'failure',
  }));
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair19-e2e-open', fence, episode: reference(loop), attempt: 'failure', kind: 'failed',
    failureClass: 'transport', completion: fixture.appendOutcome('failed', 'failure'),
    jitterPermille: 1000, restoration: [],
  }));
  fixture.time(121);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair19-e2e-admit-trial', fence, episode: reference(loop), attempt: 'trial-1',
  }));
  const completion = fixture.appendOutcome('accepted', 'trial-1');
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair19-e2e-record-trial', fence, episode: reference(loop), attempt: 'trial-1', kind: 'accepted',
    failureClass: '', completion, jitterPermille: 1000, restoration: [],
  }));
  return { fixture, fence, completion, loop };
}

it.skipIf(!mode?.startsWith('produce-'))('produces the repair19 V15 or V17 durable successor', () => {
  const state = passingTrial(scenario === 'v15' ? 2 : 1, scenario === 'v17' ? 20_000 : 1000);
  if (scenario === 'v17') state.fixture.time(130);
  const complete = state.fixture.restorationReference(scenario === 'v17'
    ? 'assessment:e2e-repair18-late-complete' : 'assessment:witnessed-review');
  const input: LoopOutcomeInput = {
    command: `repair19-e2e-evidence:${scenario}`, fence: state.fence, episode: reference(state.loop),
    attempt: 'trial-1', kind: 'accepted', failureClass: '', completion: state.completion,
    jitterPermille: 1000, restoration: [complete],
  };
  const accepted = value(state.fixture.api.recordLoopOutcome(input));
  expect(accepted).toMatchObject(scenario === 'v15'
    ? { state: 'half-open', transition: 'evidence-retained', closureEvidence: [complete] }
    : { state: 'closed', transition: 'closed', closureEvidence: [complete] });
  writeFileSync(join(directory, 'expected.json'), JSON.stringify(storeSharedLoopRecord(accepted)));
  writeFileSync(join(directory, 'request.json'), JSON.stringify(input));
});

it.skipIf(!mode?.startsWith('recover-'))('replays the exact repair19 V15 or V17 successor in a fresh process', () => {
  const file = join(directory, 'facts.json');
  const before = readFileSync(file, 'utf8');
  const fixture = transportLoopFixture(directory);
  (fixture.host as { maxLeaseTerm: number }).maxLeaseTerm = scenario === 'v17' ? 20_000 : 1000;
  const original = value(fixture.api.inspect()).filter(row => row.record.type === 'LoopRecord'
    && row.record.policy.breaker === 'shared-circuit-v1').at(-1)!.record as SharedLoopRecord;
  expect(encodedRecord(original)).toBe(value(canonical(JSON.parse(
    readFileSync(join(directory, 'expected.json'), 'utf8')))).bytes);
  fixture.time(scenario === 'v17' ? 10_130 : original.transitionAt.value);
  const input = JSON.parse(readFileSync(join(directory, 'request.json'), 'utf8')) as LoopOutcomeInput;
  const retry = value(fixture.api.recordLoopOutcome(input));
  expect(encodedRecord(retry)).toBe(encodedRecord(original));
  expect(readFileSync(file, 'utf8')).toBe(before);

  if (scenario === 'v15') {
    const admitted = value(fixture.api.admitLoopAttempt({
      command: 'repair19-e2e-admit-trial-2', fence: input.fence,
      episode: reference(retry), attempt: 'trial-2',
    }));
    const closed = value(fixture.api.recordLoopOutcome({
      command: 'repair19-e2e-finish-trial-2', fence: input.fence,
      episode: reference(admitted), attempt: 'trial-2', kind: 'accepted', failureClass: '',
      completion: fixture.appendOutcome('accepted', 'trial-2'), jitterPermille: 1000, restoration: [],
    }));
    expect(closed).toMatchObject({ state: 'closed', closureEvidence: original.closureEvidence });
  }
});
