import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy } from '../../src/transport/loop-a1/index.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const mode = process.env.SLB_A1_REPAIR28_E2E_MODE;
const directory = process.env.SLB_A1_REPAIR28_E2E_DIR;
if (!directory) throw new Error('SLB_A1_REPAIR28_E2E_DIR is required');
const bytes = (input: unknown) => value(canonical(input)).bytes;
const detail = (result: unknown): string => consumeResult(result as never, {
  Success: () => '', Refused: refusal => refusal.detail,
});
const pressureScope = {
  target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders',
} as const;

it.skipIf(mode !== 'produce')('persists an outcome followed by later admitted work', () => {
  const fixture = transportLoopFixture(directory);
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair28-e2e-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair28-e2e-lease', '', 1000));
  const scheduleInput = {
    command: 'repair28-e2e-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'one', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  } as const;
  const scheduled = value(fixture.api.scheduleEpisode(scheduleInput));
  const episode = { owner: 'part-six' as const, name: 'LoopRecord' as const, id: scheduled.episode };
  fixture.time(101);
  const admissionInput = { command: 'repair28-e2e-admit:a', fence, episode, attempt: 'a' } as const;
  value(fixture.api.admitLoopAttempt(admissionInput));
  const outcomeInput = {
    command: 'repair28-e2e-finish:a', fence, episode, attempt: 'a', kind: 'accepted' as const,
    failureClass: '', completion: fixture.appendOutcome('accepted', 'a'),
    jitterPermille: 1000, restoration: [],
  };
  const original = value(fixture.api.recordLoopOutcome(outcomeInput));
  fixture.time(102);
  value(fixture.api.admitLoopAttempt({
    command: 'repair28-e2e-admit:b', fence, episode, attempt: 'b',
  }));
  writeFileSync(join(directory, 'repair28-command.json'), JSON.stringify({
    outcomeInput, original, scheduleCommand: scheduleInput.command, admissionCommand: admissionInput.command,
  }));
});

it.skipIf(mode !== 'recover')('returns the original outcome and refuses foreign command reuse', () => {
  const saved = JSON.parse(readFileSync(join(directory, 'repair28-command.json'), 'utf8'));
  const facts = join(directory, 'facts.json');
  const before = readFileSync(facts, 'utf8');
  const fixture = transportLoopFixture(directory);
  fixture.time(102);
  const replay = value(fixture.api.recordLoopOutcome(saved.outcomeInput));
  expect(bytes(replay)).toBe(bytes(saved.original));
  expect(replay).toMatchObject({ command: 'repair28-e2e-finish:a', state: 'waiting', attempts: 1,
    pending: '', pendingAttempts: [] });
  for (const command of [saved.scheduleCommand, saved.admissionCommand]) {
    expect(detail(fixture.api.recordLoopOutcome({ ...saved.outcomeInput, command })))
      .toContain('command reused');
  }
  expect(readFileSync(facts, 'utf8')).toBe(before);
});
