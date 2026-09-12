import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeEnvelope, decodeHistoricalBody, signEnvelope } from '../../src/facts/index.js';
import { decodeLoopPolicyA1 } from '../../src/transport/loop-a1/index.js';
import {
  loopA1ExcludedPolicyFields,
  loopA1ExcludedRecordFields,
} from '../../src/transport/loop-a1/shapes.js';
import type { SharedBreakerLoopPolicy, SharedLoopRecord } from '../../src/transport/loop-a1/index.js';
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

const detail = (result: unknown) => consumeResult(result as never, {
  Success: () => '',
  Refused: refusal => refusal.detail,
});

function setup() {
  const fixture = transportLoopFixture();
  const policy = value(decodeLoopPolicyA1({
    ...fixture.sharedPolicy,
    id: 'repair16-policy',
    failureThreshold: 1,
    halfOpenTrials: 1,
    halfOpenConcurrency: 1,
    maxDuration: 100_000,
    maxOpenDuration: 20_000,
  }, fixture.c)) as SharedBreakerLoopPolicy;
  fixture.registerPolicy(policy);
  const token = value(fixture.api.acquire('repair16-lease', '', 1000));
  let loop = value(fixture.api.scheduleEpisode({
    command: 'repair16-schedule',
    fence: token,
    currentOwnerRun: fixture.run,
    policy,
    episodeKey: 'only',
    operationFamily: 'recovery',
    pressureScope,
    sourceVector: fixture.vector,
  }));
  const admit = (attempt: string) => fixture.api.admitLoopAttempt({
    command: `repair16-admit:${attempt}`,
    fence: token,
    episode: reference(loop),
    attempt,
  });
  const submit = (command: string, attempt: string, completion: ReturnType<typeof fixture.appendOutcome>,
    restoration: SharedLoopRecord['closureEvidence'] = []) => fixture.api.recordLoopOutcome({
    command,
    fence: token,
    episode: reference(loop),
    attempt,
    kind: 'accepted',
    failureClass: '',
    completion,
    jitterPermille: 1000,
    restoration,
  });
  const openAndAdmitTrial = () => {
    fixture.advance(1);
    loop = value(admit('opening-failure'));
    loop = value(fixture.api.recordLoopOutcome({
      command: 'repair16-open',
      fence: token,
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
  };
  return {
    fixture,
    policy,
    token,
    get loop() { return loop; },
    set loop(value: SharedLoopRecord) { loop = value; },
    submit,
    openAndAdmitTrial,
  };
}

type MutableWire = {
  body: Record<string, unknown>;
};

function signedReplayDetail(state: ReturnType<typeof setup>, index: number,
  mutate: (wire: MutableWire) => void): string {
  const stored = value(state.fixture.store.read());
  const raw = structuredClone((state.fixture.storage.read() as MutableWire[])[index]!);
  mutate(raw);
  const context = { ...state.fixture.ctx, facts: [...state.fixture.ctx.facts, ...stored.slice(0, index)] };
  const wire = signEnvelope(raw as never, privateKey);
  const envelope = value(decodeEnvelope(wire, context, 'replication'));
  return detail(decodeHistoricalBody(envelope, context, context.decode));
}

it('SLB-A1-RESTORATION-TRANSITION-109 V18 V27 binds restoration to its introducing transition and preserves expired replay', () => {
  const state = setup();
  state.openAndAdmitTrial();
  const completion = state.fixture.appendOutcome('accepted', 'trial');
  expect(completion.fact.id.length).toBeGreaterThan(0);
  state.fixture.time(130);
  state.fixture.addAssessment('assessment:later');
  state.fixture.time(131);
  const restoration = [state.fixture.restorationReference('assessment:later')];
  state.loop = value(state.submit('repair16-finish-with-later-proof', 'trial', completion, restoration));
  expect(state.loop).toMatchObject({ state: 'closed', transition: 'closed' });
  expect(state.loop.outcomeLog.at(-1)).toMatchObject({
    observedAt: { value: 121 },
    recordedAt: { value: 131 },
  });

  const last = (state.fixture.storage.read() as MutableWire[]).length - 1;
  expect(signedReplayDetail(state, last, wire => {
    const record = wire.body.record as { outcomeLog: { recordedAt: object }[] };
    record.outcomeLog.at(-1)!.recordedAt = state.fixture.clock(130);
  })).toContain('recording time differs');

  state.fixture.time(10_131);
  expect(value(state.fixture.api.inspect()).filter(row => row.record.type === 'LoopRecord').at(-1)!.record)
    .toMatchObject({ state: 'closed', attempts: 2, totalFailures: 1 });

  const proofOnly = setup();
  proofOnly.openAndAdmitTrial();
  const proofOnlyCompletion = proofOnly.fixture.appendOutcome('accepted', 'trial');
  proofOnly.fixture.time(130);
  proofOnly.fixture.addAssessment('assessment:later-proof-only');
  proofOnly.fixture.time(131);
  proofOnly.loop = value(proofOnly.submit('repair16-finish-without-proof', 'trial', proofOnlyCompletion));
  expect(proofOnly.loop).toMatchObject({ state: 'half-open', transition: 'outcome-recorded' });
  proofOnly.loop = value(proofOnly.submit('repair16-proof-only', 'trial', proofOnlyCompletion,
    [proofOnly.fixture.restorationReference('assessment:later-proof-only')]));
  expect(proofOnly.loop).toMatchObject({ state: 'closed', transition: 'closed' });
  expect(proofOnly.loop.outcomeLog.at(-1)!.recordedAt.value).toBe(131);
}, 30_000);

it('SLB-A1-EXCLUSION-PRESENCE-110 V23 typed-refuses every excluded name before interpreting any supplied value', () => {
  const state = setup();
  const wires = state.fixture.storage.read() as MutableWire[];
  const before = JSON.stringify(wires);
  const recordIndex = wires.length - 1;
  const policyIndex = wires.findIndex(wire => {
    const policy = wire.body.policy as { id?: unknown } | undefined;
    return policy?.id === state.policy.id;
  });
  expect(policyIndex).toBeGreaterThanOrEqual(0);
  const suppliedValues = [null, '1', -1, { unknown: true }] as const;

  for (const field of loopA1ExcludedRecordFields) for (const supplied of suppliedValues) {
    expect(signedReplayDetail(state, recordIndex, wire => {
      const record = wire.body.record as Record<string, unknown>;
      record[field] = supplied;
    }), `top-level ${field}=${JSON.stringify(supplied)}`).toBe('unsupported-in-slice-a1');
  }
  for (const field of loopA1ExcludedPolicyFields) for (const supplied of suppliedValues) {
    expect(signedReplayDetail(state, recordIndex, wire => {
      const record = wire.body.record as { policy: Record<string, unknown> };
      record.policy[field] = supplied;
    }), `nested policy ${field}=${JSON.stringify(supplied)}`).toBe('unsupported-in-slice-a1');
    expect(signedReplayDetail(state, policyIndex, wire => {
      const policy = wire.body.policy as Record<string, unknown>;
      policy[field] = supplied;
    }), `policy ${field}=${JSON.stringify(supplied)}`).toBe('unsupported-in-slice-a1');
  }

  const unknownField = signedReplayDetail(state, recordIndex, wire => {
    const record = wire.body.record as Record<string, unknown>;
    record.unknown = null;
  });
  expect(unknownField).not.toBe('');
  expect(unknownField).not.toBe('unsupported-in-slice-a1');
  const malformedAdmittedField = signedReplayDetail(state, recordIndex, wire => {
    const record = wire.body.record as Record<string, unknown>;
    record.run = null;
  });
  expect(malformedAdmittedField).not.toBe('');
  expect(malformedAdmittedField).not.toBe('unsupported-in-slice-a1');
  expect(JSON.stringify(state.fixture.storage.read())).toBe(before);
}, 30_000);
