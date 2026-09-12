import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const bytes = (input: unknown) => value(canonical(input)).bytes;
const detail = (result: unknown) => consumeResult(result as never, {
  Success: () => '', Refused: refusal => refusal.detail,
});

it('SLB-A1-COMMAND-SHAPE-132 validates command bounds before every repeated A1 request', () => {
  const fixture = transportLoopFixture();
  const fence = value(fixture.api.acquire('command-shape-lease', '', 1000));
  const schedule = {
    command: 'command-shape-schedule', fence, currentOwnerRun: fixture.run,
    policy: fixture.sharedPolicy, episodeKey: 'only', operationFamily: 'recovery',
    pressureScope: { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' },
    sourceVector: fixture.vector,
  };
  const scheduled = value(fixture.api.scheduleEpisode(schedule));
  const check = (repeat: (command: unknown) => unknown) => {
    const before = bytes(fixture.storage.read());
    for (const command of ['', null, 7, 'x'.repeat(257)]) {
      expect(detail(repeat(command))).toContain('bounded nonempty A1 command');
      expect(bytes(fixture.storage.read())).toBe(before);
    }
    for (const command of ['x', 'x'.repeat(256)]) {
      expect(detail(repeat(command))).toBe('');
      expect(bytes(fixture.storage.read())).toBe(before);
    }
  };
  check(command => fixture.api.scheduleEpisode({ ...schedule, command } as never));
  fixture.time(101);
  const admission = {
    command: 'command-shape-admit', fence,
    episode: { owner: 'part-six' as const, name: 'LoopRecord' as const, id: scheduled.episode },
    attempt: 'command-shape-attempt',
  };
  value(fixture.api.admitLoopAttempt(admission));
  check(command => fixture.api.admitLoopAttempt({ ...admission, command } as never));
  const outcome = {
    command: 'command-shape-outcome', fence, episode: admission.episode, attempt: admission.attempt,
    kind: 'accepted' as const, failureClass: '',
    completion: fixture.appendOutcome('accepted', admission.attempt), jitterPermille: 1000, restoration: [],
  };
  value(fixture.api.recordLoopOutcome(outcome));
  check(command => fixture.api.recordLoopOutcome({ ...outcome, command } as never));
});
