import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import { decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from './loop-fixture.js';

const verdict = (result: unknown) => consumeResult(result as never, {
  Success: () => 'accepted',
  Refused: refusal => refusal.detail,
});

it('SLB-A1-SUBMISSION-SHAPE-115 preserves old stopped records and refuses inconsistent signed retry evidence', () => {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair17-shape-policy',
    maxAttempts: 0,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair17-shape-lease', '', 1000));
  const scheduled = value(fixture.api.scheduleEpisode({
    command: 'repair17-shape-schedule',
    fence,
    currentOwnerRun: fixture.run,
    policy,
    episodeKey: 'only',
    operationFamily: 'recovery',
    pressureScope: { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' },
    sourceVector: fixture.vector,
  }));
  fixture.advance(1);
  const input = {
    command: 'repair17-shape-stop',
    fence,
    episode: { owner: 'part-six' as const, name: 'LoopRecord' as const, id: scheduled.episode },
    attempt: 'bounded-attempt',
  };
  const stopped = value(fixture.api.admitLoopAttempt(input));
  expect((stopped as SharedLoopRecord).stoppedSubmission).toEqual(input);

  const wires = fixture.storage.read() as Array<{ body: { record: Record<string, unknown> } }>;
  const facts = value(fixture.store.read());
  const raw = structuredClone(wires.at(-1)!);
  const context = { ...fixture.ctx, facts: [...fixture.ctx.facts, ...facts.slice(0, -1)] };
  const replay = (mutate: (record: Record<string, unknown>) => void) => {
    const candidate = structuredClone(raw);
    mutate(candidate.body.record);
    const wire = signEnvelope(candidate as never, privateKey);
    const envelope = value(decodeEnvelope(wire, context, 'replication'));
    return verdict(decodeHistoricalBody(envelope, context, context.decode));
  };

  expect(replay(record => { delete record.stoppedSubmission; })).toBe('accepted');
  expect(replay(record => {
    const submission = record.stoppedSubmission as Record<string, unknown>;
    submission.command = 'different-command';
  })).toContain('submission');
});
