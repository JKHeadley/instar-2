import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import { decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from './loop-fixture.js';

const verdict = (result: unknown) => consumeResult(result as never, {
  Success: () => 'accepted', Refused: refusal => refusal.detail,
});

it('SLB-A1-COMPLETE-REPLAY-120 V15 replays only the exact complete-evidence retention successor', () => {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair19-replay-policy',
    failureThreshold: 1,
    halfOpenTrials: 2,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair19-replay-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'repair19-replay-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'only', operationFamily: 'recovery',
    pressureScope: { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' },
    sourceVector: fixture.vector,
  }));
  const episode = () => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
  fixture.time(101);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair19-replay-admit-failure', fence, episode: episode(), attempt: 'failure',
  }));
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair19-replay-open', fence, episode: episode(), attempt: 'failure', kind: 'failed',
    failureClass: 'transport', completion: fixture.appendOutcome('failed', 'failure'),
    jitterPermille: 1000, restoration: [],
  }));
  fixture.time(121);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair19-replay-admit-trial', fence, episode: episode(), attempt: 'trial-1',
  }));
  const completion = fixture.appendOutcome('accepted', 'trial-1');
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair19-replay-record-trial', fence, episode: episode(), attempt: 'trial-1', kind: 'accepted',
    failureClass: '', completion, jitterPermille: 1000, restoration: [],
  }));
  const complete = fixture.restorationReference('assessment:witnessed-review');
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair19-replay-retain', fence, episode: episode(), attempt: 'trial-1', kind: 'accepted',
    failureClass: '', completion, jitterPermille: 1000, restoration: [complete],
  }));
  expect((loop as SharedLoopRecord)).toMatchObject({
    state: 'half-open', transition: 'evidence-retained', closureEvidence: [complete],
  });

  const wires = fixture.storage.read() as Array<{ body: { record: Record<string, unknown> } }>;
  const facts = value(fixture.store.read());
  const raw = structuredClone(wires.at(-1)!);
  const context = { ...fixture.ctx, facts: [...fixture.ctx.facts, ...facts.slice(0, -1)] };
  const replay = (mutate: (record: Record<string, unknown>) => void) => {
    const candidate = structuredClone(raw);
    mutate(candidate.body.record);
    const envelope = value(decodeEnvelope(signEnvelope(candidate as never, privateKey), context, 'replication'));
    return verdict(decodeHistoricalBody(envelope, context, context.decode));
  };

  expect(replay(() => {})).toBe('accepted');
  expect(replay(record => { record.closureEvidence = []; })).toContain('closure requirements');
});
