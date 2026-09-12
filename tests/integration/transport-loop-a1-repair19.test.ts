import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createLoopA1Authority, createLoopA1Spine, decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { LoopOutcomeInput, SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const pressureScope = {
  target: 'target:review', conversation: 'conversation:1', machine: 'fleet', pool: 'holders',
} as const;
const reference = (record: SharedLoopRecord) => ({
  owner: 'part-six' as const, name: 'LoopRecord' as const, id: record.episode,
});
const bytes = (input: unknown) => value(canonical(input)).bytes;
const detail = (result: unknown) => consumeResult(result as never, {
  Success: () => '', Refused: refusal => refusal.detail,
});

function setup(halfOpenTrials: number, leaseTerm = 1000) {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: `repair19-policy:${halfOpenTrials}`,
    failureThreshold: 1,
    halfOpenTrials,
    halfOpenConcurrency: 1,
    maxDuration: Math.max(fixture.sharedPolicy.maxDuration, leaseTerm),
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  (fixture.host as { maxLeaseTerm: number }).maxLeaseTerm = leaseTerm;
  const fence = value(fixture.api.acquire('repair19-lease', '', leaseTerm));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'repair19-schedule', fence, currentOwnerRun: fixture.run, policy,
    episodeKey: 'only', operationFamily: 'recovery', pressureScope, sourceVector: fixture.vector,
  }));
  const admit = (attempt: string) => {
    loop = value(fixture.api.admitLoopAttempt({
      command: `repair19-admit:${attempt}`, fence, episode: reference(loop), attempt,
    }));
  };
  const completion = new Map<string, LoopOutcomeInput['completion']>();
  const outcomeInput = (attempt: string, kind: 'accepted' | 'failed' = 'accepted',
    restoration: LoopOutcomeInput['restoration'] = []): LoopOutcomeInput => ({
    command: `repair19-finish:${attempt}`, fence, episode: reference(loop), attempt, kind,
    failureClass: kind === 'failed' ? 'transport' : '',
    completion: completion.get(attempt) ?? (() => {
      const added = fixture.appendOutcome(kind, attempt);
      completion.set(attempt, added);
      return added;
    })(),
    jitterPermille: 1000,
    restoration,
  });
  const finish = (attempt: string, kind: 'accepted' | 'failed' = 'accepted',
    restoration: LoopOutcomeInput['restoration'] = []) => {
    loop = value(fixture.api.recordLoopOutcome(outcomeInput(attempt, kind, restoration)));
  };
  fixture.time(101);
  admit('failure');
  finish('failure', 'failed');
  fixture.time(121);
  return { fixture, policy, fence, admit, finish, outcomeInput,
    get loop() { return loop; }, set loop(value: SharedLoopRecord) { loop = value; } };
}

function reopened(state: ReturnType<typeof setup>, storage = state.fixture.storage) {
  const store = createFactStore(state.fixture.ctx, storage);
  return createLoopA1Authority(state.fixture.host,
    createLoopA1Spine(state.fixture.host, { context: state.fixture.ctx, privateKey }, store), state.fixture.c);
}

function cutNextLoopAppend(state: ReturnType<typeof setup>, cut: 'before' | 'after') {
  let fired = false;
  return {
    owner: 'part-ten' as const,
    read: () => state.fixture.storage.read(),
    append: (raw: string, head: string | null) => {
      const type = (JSON.parse(raw) as { body?: { record?: { type?: unknown } } }).body?.record?.type;
      if (!fired && type === 'SharedLoopRecord') {
        fired = true;
        if (cut === 'after') value(state.fixture.storage.append(raw, head));
        return state.fixture.result(() => { throw new Error(`repair19-${cut}-append-cut`); });
      }
      return state.fixture.storage.append(raw, head);
    },
  };
}

it.each(['before', 'after'] as const)(
  'SLB-A1-COMPLETE-RETENTION-121 V15 retains complete evidence until all governed trials finish across a %s-append restart cut',
  cut => {
    const state = setup(2);
    state.admit('trial-1');
    state.finish('trial-1');
    const complete = state.fixture.restorationReference('assessment:witnessed-review');
    const input = { ...state.outcomeInput('trial-1'), command: 'repair19-retain-complete', restoration: [complete] };
    const before = bytes(state.fixture.storage.read());
    const interrupted = reopened(state, cutNextLoopAppend(state, cut));
    expect(detail(interrupted.recordLoopOutcome(input))).toContain(`repair19-${cut}-append-cut`);
    if (cut === 'before') expect(bytes(state.fixture.storage.read())).toBe(before);

    const restarted = reopened(state);
    const retained = value(restarted.recordLoopOutcome(input));
    expect(retained).toMatchObject({
      state: 'half-open', transition: 'evidence-retained', halfOpenSucceeded: 1,
      pendingAttempts: [], closureEvidence: [complete], evidenceSubmission: input,
    });
    expect(retained.outcomeLog.find(value => value.attempt === 'trial-1')!.restoration).toEqual([complete]);
    expect(value(reopened(state).inspect()).at(-1)!.record).toEqual(retained);

    state.loop = retained;
    state.admit('trial-2');
    state.finish('trial-2');
    expect(state.loop).toMatchObject({ state: 'closed', closureEvidence: [complete], halfOpenSucceeded: 2 });
  }, 20_000,
);

it('SLB-A1-EXPIRED-RETRY-122 V17 V24 returns an exact durable close after evidence expiry and a lost acknowledgment', () => {
  const state = setup(1, 20_000);
  state.admit('trial');
  state.finish('trial');
  state.fixture.time(130);
  state.fixture.addAssessment('repair19-lost-ack-proof');
  const complete = state.fixture.restorationReference('repair19-lost-ack-proof');
  const input = { ...state.outcomeInput('trial'), command: 'repair19-close-lost-ack', restoration: [complete] };
  const interrupted = reopened(state, cutNextLoopAppend(state, 'after'));
  expect(detail(interrupted.recordLoopOutcome(input))).toContain('repair19-after-append-cut');
  const durable = value(reopened(state).inspect()).at(-1)!.record as SharedLoopRecord;
  expect(durable).toMatchObject({ state: 'closed', closureEvidence: [complete] });
  const before = bytes(state.fixture.storage.read());

  const assessment = (state.fixture.assessmentFact('repair19-lost-ack-proof')!.body as unknown as {
    record: { validUntil: number; captureStatuses: readonly { reference: string }[] };
  }).record;
  state.fixture.time(assessment.validUntil);
  const retry = value(reopened(state).recordLoopOutcome(input));
  expect(bytes(retry)).toBe(bytes(durable));
  expect(bytes(state.fixture.storage.read())).toBe(before);

  const capture = assessment.captureStatuses[0]!.reference;
  const captures = state.fixture.ctx.captures as Record<string,
    NonNullable<(typeof state.fixture.ctx.captures)[string]>>;
  const available = captures[capture]!;
  captures[capture] = { ...available, status: 'missing' };
  expect(detail(reopened(state).recordLoopOutcome(input))).not.toBe('');
  expect(bytes(state.fixture.storage.read())).toBe(before);
  captures[capture] = available;
});
