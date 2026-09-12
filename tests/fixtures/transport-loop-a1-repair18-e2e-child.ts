import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { decodeLoopPolicyA1, storeSharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import type { LoopOutcomeInput, SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const mode = process.env.SLB_A1_REPAIR18_E2E_MODE;
const directory = process.env.SLB_A1_REPAIR18_E2E_DIR;
if (!directory) throw new Error('SLB_A1_REPAIR18_E2E_DIR is required');
const reference = (record: SharedLoopRecord) => ({
  owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode,
});
const encodedRecord = (record: SharedLoopRecord) => value(canonical(storeSharedLoopRecord(record))).bytes;

function passingTrial() {
  const fixture = transportLoopFixture(directory);
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: `repair18-e2e-policy:${mode}`,
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire(`repair18-e2e-lease:${mode}`, '', 1000));
  let loop = value(fixture.api.scheduleEpisode({
    command: `repair18-e2e-schedule:${mode}`, fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'only', operationFamily: 'recovery',
    pressureScope: { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' },
    sourceVector: fixture.vector,
  }));
  fixture.time(101);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair18-e2e-admit-failure', fence, episode: reference(loop), attempt: 'failure',
  }));
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair18-e2e-open', fence, episode: reference(loop), attempt: 'failure', kind: 'failed',
    failureClass: 'transport', completion: fixture.appendOutcome('failed', 'failure'),
    jitterPermille: 1000, restoration: [],
  }));
  fixture.time(121);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair18-e2e-admit-trial', fence, episode: reference(loop), attempt: 'trial',
  }));
  const completion = fixture.appendOutcome('accepted', 'trial');
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair18-e2e-record-trial', fence, episode: reference(loop), attempt: 'trial', kind: 'accepted',
    failureClass: '', completion, jitterPermille: 1000, restoration: [],
  }));
  return { fixture, fence, completion, loop };
}

it.skipIf(!mode?.startsWith('produce-'))('produces one repair18 successor for fresh-process replay', () => {
  const state = passingTrial();
  let input: LoopOutcomeInput;
  if (mode === 'produce-late') {
    state.fixture.time(130);
    state.fixture.time(131);
    input = {
      command: 'repair18-e2e-close-late', fence: state.fence, episode: reference(state.loop), attempt: 'trial',
      kind: 'accepted', failureClass: '', completion: state.completion, jitterPermille: 1000,
      restoration: [state.fixture.restorationReference('assessment:e2e-repair18-late-partial'),
        state.fixture.restorationReference('assessment:e2e-repair18-late-complete')],
    };
  } else if (mode === 'produce-partial') {
    input = {
      command: 'repair18-e2e-retain-partial', fence: state.fence, episode: reference(state.loop), attempt: 'trial',
      kind: 'accepted', failureClass: '', completion: state.completion, jitterPermille: 1000,
      restoration: [state.fixture.restorationReference('assessment:e2e-repair17-partial')],
    };
  } else throw new Error(`unknown repair18 producer mode: ${mode}`);
  const accepted = value(state.fixture.api.recordLoopOutcome(input));
  expect(accepted.state).toBe(mode === 'produce-late' ? 'closed' : 'half-open');
  writeFileSync(join(directory, 'expected.json'), JSON.stringify(storeSharedLoopRecord(accepted)));
  writeFileSync(join(directory, 'request.json'), JSON.stringify(input));
});

it.skipIf(!mode?.startsWith('recover-'))('replays the exact repair18 successor in a fresh process', () => {
  const file = join(directory, 'facts.json');
  const before = readFileSync(file, 'utf8');
  const fixture = transportLoopFixture(directory);
  const original = value(fixture.api.inspect()).filter(row => row.record.type === 'LoopRecord'
    && row.record.policy.breaker === 'shared-circuit-v1').at(-1)!.record as SharedLoopRecord;
  expect(encodedRecord(original)).toBe(value(canonical(JSON.parse(
    readFileSync(join(directory, 'expected.json'), 'utf8')))).bytes);
  fixture.time(original.transitionAt.value);
  const retry = value(fixture.api.recordLoopOutcome(JSON.parse(
    readFileSync(join(directory, 'request.json'), 'utf8')) as LoopOutcomeInput));
  expect(encodedRecord(retry)).toBe(encodedRecord(original));
  expect(readFileSync(file, 'utf8')).toBe(before);
});
