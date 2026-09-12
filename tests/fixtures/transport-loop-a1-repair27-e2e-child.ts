import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy } from '../../src/transport/loop-a1/index.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const mode = process.env.SLB_A1_REPAIR27_E2E_MODE;
const directory = process.env.SLB_A1_REPAIR27_E2E_DIR;
if (!directory) throw new Error('SLB_A1_REPAIR27_E2E_DIR is required');
const bytes = (input: unknown) => value(canonical(input)).bytes;
const pressureScope = {
  target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders',
} as const;

it.skipIf(mode !== 'produce')('persists original command results and later episode work', () => {
  const fixture = transportLoopFixture(directory);
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair27-e2e-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair27-e2e-lease', '', 1000));
  const scheduleInput = {
    command: 'repair27-e2e-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'one', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  } as const;
  const scheduled = value(fixture.api.scheduleEpisode(scheduleInput));
  fixture.time(101);
  const episode = { owner: 'part-six' as const, name: 'LoopRecord' as const, id: scheduled.episode };
  const admissionInput = { command: 'repair27-e2e-admit:a', fence, episode, attempt: 'a' } as const;
  const admitted = value(fixture.api.admitLoopAttempt(admissionInput));
  value(fixture.api.recordLoopOutcome({
    command: 'repair27-e2e-finish:a', fence, episode, attempt: 'a', kind: 'accepted',
    failureClass: '', completion: fixture.appendOutcome('accepted', 'a'),
    jitterPermille: 1000, restoration: [],
  }));
  writeFileSync(join(directory, 'repair27-commands.json'), JSON.stringify({
    scheduleInput, admissionInput, scheduled, admitted,
  }));
});

it.skipIf(mode !== 'recover')('returns the original command results without another append', () => {
  const saved = JSON.parse(readFileSync(join(directory, 'repair27-commands.json'), 'utf8'));
  const facts = join(directory, 'facts.json');
  const before = readFileSync(facts, 'utf8');
  const fixture = transportLoopFixture(directory);
  fixture.time(101);
  expect(bytes(value(fixture.api.scheduleEpisode(saved.scheduleInput)))).toBe(bytes(saved.scheduled));
  expect(bytes(value(fixture.api.admitLoopAttempt(saved.admissionInput)))).toBe(bytes(saved.admitted));
  expect(readFileSync(facts, 'utf8')).toBe(before);
});
