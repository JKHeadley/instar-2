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

function setup(overrides: Partial<SharedBreakerLoopPolicy> = {}) {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: `repair17-policy:${overrides.maxAttempts ?? 'default'}`,
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
    ...overrides,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const fence = value(fixture.api.acquire('repair17-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'repair17-schedule',
    fence,
    currentOwnerRun: fixture.run,
    policy,
    episodeKey: 'only',
    operationFamily: 'recovery',
    pressureScope,
    sourceVector: fixture.vector,
  }));
  const admit = (attempt: string, command = `repair17-admit:${attempt}`) => fixture.api.admitLoopAttempt({
    command,
    fence,
    episode: reference(loop),
    attempt,
  });
  const prepareEvidenceClose = () => {
    fixture.advance(1);
    loop = value(admit('opening-failure'));
    loop = value(fixture.api.recordLoopOutcome({
      command: 'repair17-open',
      fence,
      episode: reference(loop),
      attempt: 'opening-failure',
      kind: 'failed',
      failureClass: 'transport',
      completion: fixture.appendOutcome('failed', 'opening-failure'),
      jitterPermille: 1000,
      restoration: [],
    }));
    fixture.advance(20);
    loop = value(admit('trial'));
    const completion = fixture.appendOutcome('accepted', 'trial');
    loop = value(fixture.api.recordLoopOutcome({
      command: 'repair17-record-trial',
      fence,
      episode: reference(loop),
      attempt: 'trial',
      kind: 'accepted',
      failureClass: '',
      completion,
      jitterPermille: 1000,
      restoration: [],
    }));
    return completion;
  };
  return {
    fixture,
    policy,
    fence,
    get loop() { return loop; },
    set loop(record: SharedLoopRecord) { loop = record; },
    admit,
    prepareEvidenceClose,
  };
}

function reopened(fixture: ReturnType<typeof transportLoopFixture>, storage = fixture.storage) {
  const store = createFactStore(fixture.ctx, storage);
  return createLoopA1Authority(fixture.host,
    createLoopA1Spine(fixture.host, { context: fixture.ctx, privateKey }, store), fixture.c);
}

function cutAfterNextLoopAppend(fixture: ReturnType<typeof transportLoopFixture>) {
  let fired = 0;
  return {
    owner: 'part-ten' as const,
    read: () => fixture.storage.read(),
    append: (raw: string, head: string | null) => {
      const record = (JSON.parse(raw) as { body?: { record?: { type?: unknown } } }).body?.record;
      if (record?.type === 'SharedLoopRecord' && fired++ === 0) {
        value(fixture.storage.append(raw, head));
        return fixture.result(() => { throw new Error('lost acknowledgment after durable append'); });
      }
      return fixture.storage.append(raw, head);
    },
  };
}

it('SLB-A1-PARTIAL-RETENTION-113 V28 retains honest partial restoration on an evidence-only close without promotion', () => {
  const state = setup();
  const completion = state.prepareEvidenceClose();
  const partialFact = state.fixture.addPartialAssessment('assessment:repair17-partial');
  const partial = state.fixture.restorationReference('assessment:repair17-partial');
  const complete = state.fixture.restorationReference('assessment:witnessed-review');
  const input: LoopOutcomeInput = {
    command: 'repair17-close-mixed',
    fence: state.fence,
    episode: reference(state.loop),
    attempt: 'trial',
    kind: 'accepted',
    failureClass: '',
    completion,
    jitterPermille: 1000,
    restoration: [partial, complete],
  };
  state.loop = value(state.fixture.api.recordLoopOutcome(input));
  expect(state.loop).toMatchObject({ state: 'closed', closureEvidence: [complete] });
  expect(state.loop.outcomeLog.at(-1)!.restoration).toEqual([partial, complete]);
  const recorded = value(state.fixture.api.inspect()).at(-1)!;
  expect(recorded.fact.predecessors.required).toContain(partialFact.id);
});

it('SLB-A1-LOST-ACK-IDEMPOTENCY-112 V27 returns the original evidence-only close after durable append and restart', () => {
  const state = setup();
  const completion = state.prepareEvidenceClose();
  const complete = state.fixture.restorationReference('assessment:witnessed-review');
  const input: LoopOutcomeInput = {
    command: 'repair17-close-after-cut',
    fence: state.fence,
    episode: reference(state.loop),
    attempt: 'trial',
    kind: 'accepted',
    failureClass: '',
    completion,
    jitterPermille: 1000,
    restoration: [complete],
  };
  const cut = reopened(state.fixture, cutAfterNextLoopAppend(state.fixture));
  expect(detail(cut.recordLoopOutcome(input))).toContain('lost acknowledgment');
  const after = bytes(state.fixture.storage.read());
  const restarted = reopened(state.fixture);
  const original = value(restarted.inspect()).at(-1)!.record as SharedLoopRecord;
  const retry = value(restarted.recordLoopOutcome(input));
  expect(bytes(retry)).toBe(bytes(original));
  expect(bytes(state.fixture.storage.read())).toBe(after);
  expect(retry).toMatchObject({ state: 'closed', attempts: 2, totalFailures: 1, closureEvidence: [complete] });
});

it('SLB-A1-LOST-ACK-IDEMPOTENCY-112 V27 returns the original stopped record and refuses a changed bounded attempt', () => {
  const state = setup({ maxAttempts: 0 });
  state.fixture.advance(1);
  const input = {
    command: 'repair17-stop-after-cut',
    fence: state.fence,
    episode: reference(state.loop),
    attempt: 'beyond-bound',
  };
  const cut = reopened(state.fixture, cutAfterNextLoopAppend(state.fixture));
  expect(detail(cut.admitLoopAttempt(input))).toContain('lost acknowledgment');
  const after = bytes(state.fixture.storage.read());
  const restarted = reopened(state.fixture);
  const original = value(restarted.inspect()).at(-1)!.record as SharedLoopRecord;
  const retry = value(restarted.admitLoopAttempt(input));
  expect(bytes(retry)).toBe(bytes(original));
  expect(retry).toMatchObject({ state: 'stopped', transition: 'stopped', attempts: 0 });
  expect(bytes(state.fixture.storage.read())).toBe(after);
  expect(detail(restarted.admitLoopAttempt({ ...input, attempt: 'different-attempt' }))).toContain('terminal');
  expect(bytes(state.fixture.storage.read())).toBe(after);
});
