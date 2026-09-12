import { afterEach, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createLoopA1Authority, createLoopA1Spine, decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy } from '../../src/transport/loop-a1/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));

const bytes = (input: unknown) => value(canonical(input)).bytes;
const detail = (result: unknown): string => consumeResult(result as never, {
  Success: () => '', Refused: refusal => refusal.detail,
});
const pressureScope = {
  target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders',
} as const;

function setup() {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair28-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair28-lease', '', 1000));
  const scheduleInput = {
    command: 'repair28-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'one', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  } as const;
  const scheduled = value(fixture.api.scheduleEpisode(scheduleInput));
  const episode = { owner: 'part-six' as const, name: 'LoopRecord' as const, id: scheduled.episode };
  const admissionInput = (attempt: string) => ({
    command: `repair28-admit:${attempt}`, fence, episode, attempt,
  });
  const admit = (attempt: string) => value(fixture.api.admitLoopAttempt(admissionInput(attempt)));
  const outcomeInput = (attempt: string) => ({
    command: `repair28-finish:${attempt}`, fence, episode, attempt, kind: 'accepted' as const,
    failureClass: '', completion: fixture.appendOutcome('accepted', attempt),
    jitterPermille: 1000, restoration: [],
  });
  const restart = () => createLoopA1Authority(fixture.host,
    createLoopA1Spine(fixture.host, { context: fixture.ctx, privateKey },
      createFactStore(fixture.ctx, fixture.storage)), fixture.c);
  return { fixture, fence, scheduleInput, scheduled, episode, admissionInput, admit, outcomeInput, restart };
}

it('SLB-A1-OUTCOME-COMMAND-145 V2 returns the original outcome after later admitted work', () => {
  const state = setup();
  state.fixture.time(101);
  state.admit('a');
  const input = state.outcomeInput('a');
  const original = value(state.fixture.api.recordLoopOutcome(input));
  state.fixture.time(102);
  state.admit('b');
  const before = bytes(state.fixture.storage.read());
  const replay = value(state.restart().recordLoopOutcome(input));
  expect(bytes(replay)).toBe(bytes(original));
  expect(replay).toMatchObject({ command: 'repair28-finish:a', state: 'waiting', attempts: 1,
    pending: '', pendingAttempts: [] });
  expect(bytes(state.fixture.storage.read())).toBe(before);
});

it.each(['repair28-schedule', 'repair28-admit:a'])(
  'SLB-A1-OUTCOME-COMMAND-145 V3 refuses outcome command %s owned by another operation', command => {
    const state = setup();
    state.fixture.time(101);
    state.admit('a');
    const input = state.outcomeInput('a');
    value(state.fixture.api.recordLoopOutcome(input));
    const before = bytes(state.fixture.storage.read());
    expect(detail(state.fixture.api.recordLoopOutcome({ ...input, command })))
      .toContain('command reused');
    expect(bytes(state.fixture.storage.read())).toBe(before);
  },
);

it('SLB-A1-OUTCOME-COMMAND-145 keeps exact and unused equivalent outcome neighbors', () => {
  const state = setup();
  state.fixture.time(101);
  state.admit('a');
  const input = state.outcomeInput('a');
  const original = value(state.fixture.api.recordLoopOutcome(input));
  expect(bytes(value(state.restart().recordLoopOutcome(input)))).toBe(bytes(original));
  const before = bytes(state.fixture.storage.read());
  const equivalent = value(state.fixture.api.recordLoopOutcome({ ...input, command: 'repair28-equivalent:a' }));
  expect(bytes(equivalent)).toBe(bytes(original));
  expect(bytes(state.fixture.storage.read())).toBe(before);
});
