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
    id: 'repair27-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair27-lease', '', 1000));
  const scheduleInput = {
    command: 'repair27-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'one', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  } as const;
  let loop = value(fixture.api.scheduleEpisode(scheduleInput));
  const scheduled = loop;
  const episode = { owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode };
  const admitInput = (attempt: string, command = `repair27-admit:${attempt}`) => ({
    command, fence, episode, attempt,
  });
  const admit = (attempt: string) => {
    loop = value(fixture.api.admitLoopAttempt(admitInput(attempt)));
    return loop;
  };
  const finish = (attempt: string) => {
    loop = value(fixture.api.recordLoopOutcome({
      command: `repair27-finish:${attempt}`, fence, episode, attempt, kind: 'accepted',
      failureClass: '', completion: fixture.appendOutcome('accepted', attempt),
      jitterPermille: 1000, restoration: [],
    }));
    return loop;
  };
  const restart = () => createLoopA1Authority(fixture.host,
    createLoopA1Spine(fixture.host, { context: fixture.ctx, privateKey },
      createFactStore(fixture.ctx, fixture.storage)), fixture.c);
  return { fixture, policy, fence, scheduleInput, scheduled, episode, admitInput, admit, finish, restart };
}

it.each([
  ['V14 undeclared field', { ...pressureScope, extra: 'unrecognized' }],
  ['V15 missing target', (({ target: _target, ...rest }) => rest)(pressureScope)],
] as const)(
  'SLB-A1-CLOSED-PRESSURE-141 %s refuses before a normalizing owner resolver can replace the input',
  (_case, malformed) => {
    const state = setup();
    const original = state.fixture.host.loopScopeBinding!;
    (state.fixture.host as { loopScopeBinding: typeof original }).loopScopeBinding = {
      owner: 'part-three',
      resolve: input => original.resolve({ ...input, pressureScope }),
    };
    const before = bytes(state.fixture.storage.read());
    expect(detail(state.fixture.api.scheduleEpisode({
      ...state.scheduleInput, pressureScope: malformed,
    } as never))).not.toBe('');
    expect(bytes(state.fixture.storage.read())).toBe(before);
  },
);

it('SLB-A1-CLOSED-PRESSURE-141 V26 refuses a malformed scope on a fresh schedule without appending', () => {
  const fixture = transportLoopFixture();
  const original = fixture.host.loopScopeBinding!;
  (fixture.host as { loopScopeBinding: typeof original }).loopScopeBinding = {
    owner: 'part-three', resolve: input => original.resolve({ ...input, pressureScope }),
  };
  const fence = value(fixture.api.acquire('repair27-fresh-scope-lease', '', 1000));
  const before = bytes(fixture.storage.read());
  expect(detail(fixture.api.scheduleEpisode({
    command: 'repair27-fresh-malformed', fence, currentOwnerRun: fixture.run,
    policy: fixture.sharedPolicy, episodeKey: 'one', operationFamily: 'recovery',
    pressureScope: { ...pressureScope, extra: 'unknown' }, sourceVector: fixture.vector,
  } as never))).not.toBe('');
  expect(bytes(fixture.storage.read())).toBe(before);
});

it('SLB-A1-COMMAND-RESULT-142 V16 returns the original schedule result after later work', () => {
  const state = setup();
  state.fixture.time(101);
  state.admit('a');
  expect(value(state.fixture.api.scheduleEpisode(state.scheduleInput))).toEqual(state.scheduled);
});

it('SLB-A1-COMMAND-RESULT-142 V17 returns the original admission result after its outcome', () => {
  const state = setup();
  state.fixture.time(101);
  const admitted = state.admit('a');
  state.finish('a');
  expect(value(state.fixture.api.admitLoopAttempt(state.admitInput('a')))).toEqual(admitted);
});

it.each(['schedule', 'admission'] as const)(
  'SLB-A1-COMMAND-RESULT-142 V25 returns the original %s bytes after durable reconstruction', mode => {
    const state = setup();
    state.fixture.time(101);
    const admitted = state.admit('a');
    state.finish('a');
    const result = mode === 'schedule'
      ? state.restart().scheduleEpisode(state.scheduleInput)
      : state.restart().admitLoopAttempt(state.admitInput('a'));
    expect(bytes(value(result))).toBe(bytes(mode === 'schedule' ? state.scheduled : admitted));
  },
);

it('SLB-A1-COMMAND-RESULT-142 V27 refuses a command identifier already committed to another operation', () => {
  const state = setup();
  state.fixture.time(101);
  state.admit('a');
  const before = bytes(state.fixture.storage.read());
  expect(detail(state.fixture.api.scheduleEpisode({
    ...state.scheduleInput, command: 'repair27-admit:a',
  }))).toContain('command reused');
  expect(bytes(state.fixture.storage.read())).toBe(before);
});

it('SLB-A1-COMMAND-RESULT-142 refuses schedule-command reuse by a fresh attempt', () => {
  const state = setup();
  state.fixture.time(101);
  const before = bytes(state.fixture.storage.read());
  expect(detail(state.fixture.api.admitLoopAttempt(
    state.admitInput('a', state.scheduleInput.command),
  ))).toContain('command reused');
  expect(bytes(state.fixture.storage.read())).toBe(before);
});
