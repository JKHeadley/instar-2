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
const reference = (record: SharedLoopRecord) => ({
  owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode,
});

it('SLB-A1-CURRENT-PROOF-REPLAY-127 V20 signed replay uses fresh closure candidates and retains expired proof only in history', () => {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair20-replay-policy',
    failureThreshold: 1,
    halfOpenTrials: 2,
    halfOpenConcurrency: 1,
    maxDuration: 50_000,
    maxOpenDuration: 20_000,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  (fixture.host as { maxLeaseTerm: number }).maxLeaseTerm = 50_000;
  const fence = value(fixture.api.acquire('repair20-replay-lease', '', 50_000));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'repair20-replay-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'only', operationFamily: 'recovery',
    pressureScope: { target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders' },
    sourceVector: fixture.vector,
  }));
  const admit = (attempt: string) => {
    loop = value(fixture.api.admitLoopAttempt({
      command: `repair20-replay-admit:${attempt}`, fence, episode: reference(loop), attempt,
    }));
  };
  const finish = (attempt: string, kind: 'accepted' | 'failed', restoration = [] as never[]) => {
    loop = value(fixture.api.recordLoopOutcome({
      command: `repair20-replay-finish:${attempt}`, fence, episode: reference(loop), attempt, kind,
      failureClass: kind === 'failed' ? 'transport' : '',
      completion: fixture.appendOutcome(kind, attempt), jitterPermille: 1000, restoration,
    }));
  };

  fixture.time(101);
  admit('failure');
  finish('failure', 'failed');
  fixture.time(121);
  admit('trial-1');
  finish('trial-1', 'accepted', [fixture.restorationReference('assessment:witnessed-review')] as never[]);
  fixture.time(10_101);
  fixture.addAssessment('repair20-replay-fresh');
  admit('trial-2');
  const fresh = fixture.restorationReference('repair20-replay-fresh');
  finish('trial-2', 'accepted', [fresh] as never[]);
  expect(loop).toMatchObject({ state: 'closed', closureEvidence: [fresh] });
  expect(loop.outcomeLog.find(outcome => outcome.attempt === 'trial-1')!.restoration)
    .toEqual([fixture.restorationReference('assessment:witnessed-review')]);

  const raw = structuredClone(fixture.storage.read().at(-1)!);
  const facts = value(fixture.store.read());
  const context = { ...fixture.ctx, facts: [...fixture.ctx.facts, ...facts.slice(0, -1)] };
  const envelope = value(decodeEnvelope(signEnvelope(raw as never, privateKey), context, 'replication'));
  expect(verdict(decodeHistoricalBody(envelope, context, context.decode))).toBe('accepted');
}, 15_000);
