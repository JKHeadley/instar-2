import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import {
  decodeHarnessValidationFloor,
} from '../../src/harness-adapters/index.js';
import {
  createMemoryHarnessAdapterStateStore,
  sameMachineReconnectCandidate,
} from '../../src/harness-adapters/holder.js';
import type { HarnessEvidenceStateStorePort } from '../../src/harness-adapters/holder.js';
import { decodeProbeRecord } from '../../src/verification/index.js';
import { value } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { round9PoisonPrefixFixture } from './a2-round9-fixture.js';

function appendLatePoisonProbe(
  nine: ReturnType<ReturnType<typeof round9PoisonPrefixFixture>['freshNine']>,
): void {
  const plan = value(nine.runtime.inspectCurrent())
    .find(row => row.record.id === 'r9:plan:transcript-poison');
  if (!plan || plan.record.type !== 'VerificationPlan') throw new Error('poison plan missing');
  const probe = value(decodeProbeRecord({
    ...verificationInput('ProbeRecord'),
    id: 'r11:late:probe:transcript-poison',
    predecessors: [plan.fact.id],
    plan: plan.record.id,
    planVersion: plan.record.bar.version,
    arm: 'transcript-poison',
    subject: plan.record.subject.governed,
  }, nine.c));
  const witness = nine.witnessFor(probe, 'r11:late:evidence:transcript-poison');
  nine.setEvidence([...nine.host.current().evidence, witness]);
  value(nine.runtime.record('ProbeRecord', { ...probe, witnesses: [witness.id] }));
}

it('A2-UNIT R11-F1-OMITTED-NATURAL P13-NF-24 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 failed local poison append retains a floor before owner-only poison', () => {
  const durable = createMemoryHarnessAdapterStateStore('r11:omitted-natural');
  let blockedLocalAppend = false;
  const state: HarnessEvidenceStateStorePort = Object.freeze({
    ...durable,
    save(expected: Parameters<HarnessEvidenceStateStorePort['save']>[0],
      snapshot: Parameters<HarnessEvidenceStateStorePort['save']>[1]) {
      if (snapshot.events.some(event => event.diagnosticCode.startsWith('transcript-poison:'))) {
        blockedLocalAppend = true;
        throw new Error('injected EIO before local poison event commit');
      }
      durable.save(expected, snapshot);
    },
  });
  const fixture = round9PoisonPrefixFixture({ confirmPoison: false, eventState: state });
  expect(blockedLocalAppend).toBe(true);
  expect(state.loadPoisonCandidates()).toHaveLength(1);

  const currentNine = fixture.freshNine(fixture.fullNine);
  appendLatePoisonProbe(currentNine);
  const confirmed = fixture.holder(state, currentNine);
  expect(confirmed.resume(fixture.handle, 22)).toMatchObject({ state: 'poisoned' });
  expect(state.loadValidationFloors()).toHaveLength(1);

  for (const rows of [fixture.probePrefix, fixture.planPrefix]) {
    const older = fixture.holder(state, fixture.freshNine(rows));
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
  }
});

it('A2-UNIT R11-F2-FLOOR-INDEPENDENT P13-NF-01 P13-NF-28 P13-NF-38 P13-NF-51 all 54 schema-valid floor mutations preserve uncertainty', async () => {
  const seed = round9PoisonPrefixFixture();
  const floor = seed.eventState.loadValidationFloors()[0] as Record<string, unknown>;
  const semanticFields = Object.keys(floor)
    .filter(field => !['type', 'purpose', 'schemaVersion', 'id', 'eventHash', 'confirmedAt'].includes(field));
  expect(semanticFields).toHaveLength(18);

  let scenarios = 0;
  for (const field of semanticFields) {
    const mutated = { ...floor,
      [field]: field === 'artifact' ? `sha256:${'1'.repeat(64)}` : `foreign:${String(floor[field])}` };
    const decoded = value(decodeHarnessValidationFloor(mutated));
    for (const rows of [seed.fullNine, seed.probePrefix, seed.planPrefix]) {
      const store = createMemoryHarnessAdapterStateStore(`r11:floor:${field}:${scenarios}`);
      store.save(null, seed.eventState.load() as never);
      store.appendValidationFloor(decoded);
      const holder = seed.holder(store, seed.freshNine(rows));
      expect(holder.resume(seed.handle, 22), field).toMatchObject({ state: 'unknown' });
      expect(sameMachineReconnectCandidate({
        launch: seed.handle.launch,
        machine: seed.handle.machine,
        incarnation: seed.handle.incarnation,
        fence: seed.fence,
        now: 22,
        evidence: holder,
        authority: seed.six.api,
      }, seed.handles), field).toMatchObject({ disposition: 'refused', handle: null });
      scenarios++;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  expect(scenarios).toBe(54);
}, 120_000);
