import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import {
  decodeHarnessValidationFloor,
} from '../../src/harness-adapters/index.js';
import {
  createHarnessEvidenceHolder,
  HarnessEvidenceStateStoreBindingError,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import type {
  HarnessEvidenceStateStorePort,
} from '../../src/harness-adapters/holder.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
import { value } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { round9PoisonPrefixFixture } from './a2-round9-fixture.js';

function appendPoisonProbe(
  nine: ReturnType<ReturnType<typeof round9PoisonPrefixFixture>['freshNine']>,
): void {
  const plan = value(nine.runtime.inspectCurrent())
    .find(row => row.record.id === 'r9:plan:transcript-poison');
  if (!plan || plan.record.type !== 'VerificationPlan') throw new Error('poison plan missing');
  const probe = value(decodeProbeRecord({
    ...verificationInput('ProbeRecord'),
    id: 'r10:late:probe:transcript-poison',
    predecessors: [plan.fact.id],
    plan: plan.record.id,
    planVersion: plan.record.bar.version,
    arm: 'transcript-poison',
    subject: plan.record.subject.governed,
  }, nine.c));
  const witness = nine.witnessFor(probe, 'r10:late:evidence:transcript-poison');
  nine.setEvidence([...nine.host.current().evidence, witness]);
  value(nine.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
}

it('A2-UNIT R10-F1 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 late Part Nine confirmation is durably retained before poison is returned', () => {
  const fixture = round9PoisonPrefixFixture({ confirmPoison: false });
  expect(fixture.evidence.resume(fixture.handle, 22)).toMatchObject({ state: 'eligible' });

  const currentNine = fixture.freshNine(fixture.fullNine);
  appendPoisonProbe(currentNine);
  const confirmed = fixture.holder(fixture.eventState, currentNine);
  expect(confirmed.resume(fixture.handle, 22)).toMatchObject({ state: 'poisoned' });
  expect(fixture.eventState.loadValidationFloors()).toHaveLength(1);

  const older = fixture.holder(fixture.eventState, fixture.freshNine(fixture.fullNine));
  expect(older.resume(fixture.handle, 22)).toMatchObject({ state: 'unknown' });
  expect(sameMachineReconnectCandidate({
    launch: fixture.handle.launch,
    machine: fixture.handle.machine,
    incarnation: fixture.handle.incarnation,
    fence: fixture.fence,
    now: 22,
    evidence: older,
    authority: fixture.six.api,
  }, fixture.handles)).toMatchObject({ disposition: 'refused', handle: null });
});

it('A2-UNIT R10-F2 P13-NF-24 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 evidence holder construction rejects a state facade without durable confirmation custody', () => {
  const fixture = round9PoisonPrefixFixture();
  const facade = Object.freeze({
    owner: 'part-thirteen' as const,
    id: 'r10:non-durable-facade',
    load: () => fixture.eventState.load(),
    save: fixture.eventState.save.bind(fixture.eventState),
  });
  expect(() => createHarnessEvidenceHolder({
    adapter: fixture.handle.harness,
    artifact: fixture.handle.artifactDigest,
    platform: fixture.handle.platform,
    machine: fixture.handle.machine,
    scope: 'conversation:1',
    maxEvents: 32,
    maxCaptureBytes: 1024,
    context: fixture.ten.owner.c,
    state: facade as unknown as HarnessEvidenceStateStorePort,
    admission: fixture.ten.port,
    owners: { handles: fixture.handles, current: fixture.ten.owner.host },
  })).toThrowError(HarnessEvidenceStateStoreBindingError);
});

it('A2-UNIT R10-F3 P13-NF-01 P13-NF-28 P13-NF-38 P13-NF-51 the 24-field confirmation record has a closed total decoder', () => {
  const fixture = round9PoisonPrefixFixture();
  const floor = fixture.eventState.loadValidationFloors()[0] as Record<string, unknown>;
  expect(consumeResult(decodeHarnessValidationFloor(floor), {
    Success: () => 'accepted', Refused: () => 'refused',
  })).toBe('accepted');

  let fieldScenarios = 0;
  for (const field of Object.keys(floor)) {
    for (const mode of ['missing', 'wrong-type', 'extra'] as const) {
      const malformed = { ...floor };
      if (mode === 'missing') delete malformed[field];
      if (mode === 'wrong-type') malformed[field] = typeof malformed[field] === 'string' ? 123 : 'wrong';
      if (mode === 'extra') malformed.extra = true;
      expect(consumeResult(decodeHarnessValidationFloor(malformed), {
        Success: () => 'accepted', Refused: () => 'refused',
      }), `${field}/${mode}`).toBe('refused');
      fieldScenarios++;
    }
  }
  expect(fieldScenarios).toBe(72);

  const boundaryCases: ReadonlyArray<readonly [string, unknown]> = [
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, Number.NaN]
      .map(value => ['schemaVersion', value] as const),
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, Number.NaN]
      .map(value => ['confirmedAt', value] as const),
    ['schemaVersion', 2],
    ['type', 'AnotherRecord'],
    ['purpose', 'AnotherPurpose'],
    ['artifact', 'sha256:bad'],
    ['eventHash', 'sha256:bad'],
  ];
  for (const [field, invalid] of boundaryCases) {
    expect(consumeResult(decodeHarnessValidationFloor({ ...floor, [field]: invalid }), {
      Success: () => 'accepted', Refused: () => 'refused',
    }), `${field}/${String(invalid)}`).toBe('refused');
  }
  expect(boundaryCases).toHaveLength(15);
});

it('A2-UNIT R10-F3-SEMANTIC P13-NF-28 P13-NF-38 P13-NF-51 schema-valid but inconsistent retained confirmation cannot produce poison or eligibility', () => {
  const variants = [
    (floor: Record<string, unknown>) => ({ ...floor, event: 'r10:unrelated-event' }),
    (floor: Record<string, unknown>) => {
      const eventHash = `sha256:${'a'.repeat(64)}`;
      return { ...floor, id: `validation-floor:${eventHash}`, eventHash };
    },
    (floor: Record<string, unknown>) => ({ ...floor, confirmedAt: 23 }),
  ];
  let scenarios = 0;
  for (const mutate of variants) {
    const fixture = round9PoisonPrefixFixture();
    const raw = fixture.eventState.loadValidationFloors()[0] as Record<string, unknown>;
    const malformed = mutate(raw);
    const facade: HarnessEvidenceStateStorePort = Object.freeze({
      owner: 'part-thirteen' as const,
      id: `r10:malformed:${scenarios}`,
      load: () => fixture.eventState.load(),
      save: fixture.eventState.save.bind(fixture.eventState),
      loadValidationFloors: () => [malformed],
      appendValidationFloor: () => { throw new Error('read-only malformed fixture'); },
      loadPoisonCandidates: () => fixture.eventState.loadPoisonCandidates(),
      appendPoisonCandidate: () => { throw new Error('read-only malformed fixture'); },
    });
    const holder = fixture.holder(facade, fixture.freshNine(fixture.fullNine));
    expect(holder.resume(fixture.handle, 22)).toMatchObject({ state: 'unknown' });
    scenarios++;
  }
  expect(scenarios).toBe(3);
});
