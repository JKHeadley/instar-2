import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createLoopA1Authority, createLoopA1Spine, decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import type { LoopOutcomeInput, SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
import { privateKey } from '../facts/fixtures.js';
import { transportLoopFixture, value } from '../transport/loop-fixture.js';

const pressureScope = {
  target: 'target:review',
  conversation: 'conversation:1',
  machine: 'fleet',
  pool: 'holders',
} as const;
const reference = (record: SharedLoopRecord) => ({
  owner: 'part-six' as const,
  name: 'LoopRecord' as const,
  id: record.episode,
});
const bytes = (input: unknown) => value(canonical(input)).bytes;
const detail = (result: unknown) => consumeResult(result as never, {
  Success: () => '',
  Refused: refusal => refusal.detail,
});

function setup() {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair18-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair18-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'repair18-schedule',
    fence,
    currentOwnerRun: fixture.run,
    policy,
    episodeKey: 'only',
    operationFamily: 'recovery',
    pressureScope,
    sourceVector: fixture.vector,
  }));
  fixture.time(101);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair18-admit-failure', fence, episode: reference(loop), attempt: 'failure',
  }));
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair18-open', fence, episode: reference(loop), attempt: 'failure', kind: 'failed',
    failureClass: 'transport', completion: fixture.appendOutcome('failed', 'failure'),
    jitterPermille: 1000, restoration: [],
  }));
  fixture.time(121);
  loop = value(fixture.api.admitLoopAttempt({
    command: 'repair18-admit-trial', fence, episode: reference(loop), attempt: 'trial',
  }));
  const completion = fixture.appendOutcome('accepted', 'trial');
  loop = value(fixture.api.recordLoopOutcome({
    command: 'repair18-record-trial', fence, episode: reference(loop), attempt: 'trial', kind: 'accepted',
    failureClass: '', completion, jitterPermille: 1000, restoration: [],
  }));
  expect(loop).toMatchObject({ state: 'half-open', halfOpenSucceeded: 1 });
  return { fixture, fence, completion, get loop() { return loop; } };
}

function reopened(fixture: ReturnType<typeof transportLoopFixture>, storage = fixture.storage) {
  const store = createFactStore(fixture.ctx, storage);
  return createLoopA1Authority(fixture.host,
    createLoopA1Spine(fixture.host, { context: fixture.ctx, privateKey }, store), fixture.c);
}

function cutNextLoopAppend(fixture: ReturnType<typeof transportLoopFixture>, cut: 'before' | 'after') {
  let fired = false;
  return {
    owner: 'part-ten' as const,
    read: () => fixture.storage.read(),
    append: (raw: string, head: string | null) => {
      const record = (JSON.parse(raw) as { body?: { record?: { type?: unknown } } }).body?.record;
      if (!fired && record?.type === 'SharedLoopRecord') {
        fired = true;
        if (cut === 'after') value(fixture.storage.append(raw, head));
        return fixture.result(() => { throw new Error(`repair18-${cut}-append-cut`); });
      }
      return fixture.storage.append(raw, head);
    },
  };
}

function exerciseCut(state: ReturnType<typeof setup>, input: LoopOutcomeInput, cut: 'before' | 'after') {
  const before = bytes(state.fixture.storage.read());
  const interrupted = reopened(state.fixture, cutNextLoopAppend(state.fixture, cut));
  expect(detail(interrupted.recordLoopOutcome(input))).toContain(`repair18-${cut}-append-cut`);
  if (cut === 'before') expect(bytes(state.fixture.storage.read())).toBe(before);
  const restarted = reopened(state.fixture);
  const accepted = value(restarted.recordLoopOutcome(input));
  expect(value(restarted.inspect()).filter(row => row.record.type === 'LoopRecord'
    && 'command' in row.record && row.record.command === input.command)).toHaveLength(1);
  expect(value(reopened(state.fixture).inspect()).at(-1)!.record).toEqual(accepted);
  return accepted;
}

it.each(['before', 'after'] as const)(
  'SLB-A1-LATE-RESTORATION-116 V11 V12 accepts late evidence at its introducing transition across a %s-append restart cut',
  cut => {
    const state = setup();
    state.fixture.time(130);
    state.fixture.addPartialAssessment('repair18-late-partial');
    state.fixture.addAssessment('repair18-late-complete');
    state.fixture.time(131);
    const partial = state.fixture.restorationReference('repair18-late-partial');
    const complete = state.fixture.restorationReference('repair18-late-complete');
    const input: LoopOutcomeInput = {
      command: 'repair18-close-late', fence: state.fence, episode: reference(state.loop), attempt: 'trial',
      kind: 'accepted', failureClass: '', completion: state.completion, jitterPermille: 1000,
      restoration: [partial, complete],
    };
    const closed = exerciseCut(state, input, cut);
    expect(closed).toMatchObject({ state: 'closed', closureEvidence: [complete] });
    expect(closed.outcomeLog.at(-1)).toMatchObject({ recordedAt: { value: 121 }, restoration: [partial, complete] });
  }, 15_000,
);

it.each(['before', 'after'] as const)(
  'SLB-A1-PARTIAL-ONLY-117 V17 retains later partial evidence without closure across a %s-append restart cut',
  cut => {
    const state = setup();
    state.fixture.addPartialAssessment('repair18-partial-only');
    const partial = state.fixture.restorationReference('repair18-partial-only');
    const input: LoopOutcomeInput = {
      command: 'repair18-retain-partial', fence: state.fence, episode: reference(state.loop), attempt: 'trial',
      kind: 'accepted', failureClass: '', completion: state.completion, jitterPermille: 1000,
      restoration: [partial],
    };
    const retained = exerciseCut(state, input, cut);
    expect(retained).toMatchObject({
      state: 'half-open', transition: 'evidence-retained', closureEvidence: [], evidenceSubmission: input,
    });
    expect(retained.outcomeLog.at(-1)!.restoration).toEqual([partial]);
    state.fixture.time(130);
    state.fixture.addAssessment('repair18-complete-after-partial');
    state.fixture.time(131);
    const complete = state.fixture.restorationReference('repair18-complete-after-partial');
    const closed = value(reopened(state.fixture).recordLoopOutcome({
      ...input,
      command: 'repair18-close-after-partial',
      episode: reference(retained),
      restoration: [complete],
    }));
    expect(closed).toMatchObject({ state: 'closed', closureEvidence: [complete] });
    expect(closed.outcomeLog.at(-1)!.restoration).toEqual([partial, complete]);
    expect(value(reopened(state.fixture).inspect()).at(-1)!.record).toEqual(closed);
  }, 15_000,
);
