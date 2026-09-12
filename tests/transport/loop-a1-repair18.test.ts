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

it('SLB-A1-EVIDENCE-SUBMISSION-119 validates the signed partial-evidence successor without changing old record arms', () => {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair18-shape-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair18-shape-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'repair18-shape-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'only', operationFamily: 'recovery',
    pressureScope: { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' },
    sourceVector: fixture.vector,
  }));
  const episode = () => ({ owner: 'part-six' as const, name: 'LoopRecord' as const, id: loop.episode });
  fixture.time(101);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair18-shape-admit-failure', fence, episode: episode(), attempt: 'failure',
  }));
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair18-shape-open', fence, episode: episode(), attempt: 'failure', kind: 'failed',
    failureClass: 'transport', completion: fixture.appendOutcome('failed', 'failure'),
    jitterPermille: 1000, restoration: [],
  }));
  fixture.time(121);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair18-shape-admit-trial', fence, episode: episode(), attempt: 'trial',
  }));
  const completion = fixture.appendOutcome('accepted', 'trial');
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair18-shape-record-trial', fence, episode: episode(), attempt: 'trial', kind: 'accepted',
    failureClass: '', completion, jitterPermille: 1000, restoration: [],
  }));
  fixture.addPartialAssessment('repair18-shape-partial');
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair18-shape-retain', fence, episode: episode(), attempt: 'trial', kind: 'accepted',
    failureClass: '', completion, jitterPermille: 1000,
    restoration: [fixture.restorationReference('repair18-shape-partial')],
  }));
  expect((loop as SharedLoopRecord).transition).toBe('evidence-retained');

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
  expect(replay(record => { delete record.evidenceSubmission; })).toContain('history reset or changed');
  expect(replay(record => {
    (record.evidenceSubmission as Record<string, unknown>).command = 'different-command';
  })).toContain('evidence submission');
});
