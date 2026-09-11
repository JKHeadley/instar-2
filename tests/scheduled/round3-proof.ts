import { readFileSync } from 'node:fs';
import { canonical, consumeResult } from '../../src/index.js';
import { decodeLocalCapabilityPackage } from '../../src/assembly/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { decodeScheduledCapacityMeasurement, createScheduledWorkPackagePort, importLegacyScheduledJob,
  parseRfc3339Offset } from '../../src/scheduled/index.js';
import type { Result } from '../../src/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { closeUnreachable } from '../rungraph/closure-fixtures.js';
import { setup } from '../rungraph/fixtures.js';
import { assemblyInput } from '../assembly/fixture.js';
import { activeScheduledFixture, clone, scheduledFixture, value } from './fixture.js';

type Outcome<T> = { status: 'accepted'; value: T } | { status: 'refused'; detail: string };
const outcome = <T>(result: Result<T>): Outcome<T> => consumeResult<T, Outcome<T>>(result, {
  Success: value => ({ status: 'accepted' as const, value }),
  Refused: refusal => ({ status: 'refused' as const, detail: refusal.detail }),
});

export function exerciseP15Round3Proof() {
  const port = createScheduledWorkPackagePort();
  const active = activeScheduledFixture();
  const admission = { package: active.package, manifestPath: 'scheduled/manifest.json',
    manifestBytes: active.manifestBytes, existingManifests: [] };
  const currentNeighbor = outcome(port.admitPackageResource(admission, active.context));
  const invalid = outcome(port.decode({ ...active.manifest, surprise: true }, active.context));
  const planeAfterRefusal = outcome(active.assembly.runtime.inspectCurrent());

  const otherManifest = { ...clone(active.manifest),
    identity: { ...clone(active.manifest.identity), contentDigest: active.h('d') },
    schedule: { ...clone(active.manifest.schedule), at: '2027-01-02T00:00:00Z' } };
  const otherBytes = value(canonical(otherManifest)).bytes;
  const otherInput = clone(active.package) as unknown as Record<string, any>;
  Object.assign(otherInput, { id: 'package:second', namespace: 'alice.second', contentDigest: active.h('d') });
  otherInput.entrypoints[0].digest = hashBytes(otherBytes);
  const other = value(decodeLocalCapabilityPackage(otherInput, active.context));
  const recorded = value(active.assembly.runtime.record('LocalCapabilityPackage', other));
  value(active.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: 'transition:second:active', package: other.namespace, manifestDigest: other.contentDigest,
    observedArtifactDigest: other.contentDigest }));
  const firstCollision = outcome(port.admitPackageResource(admission, active.context));
  const secondCollision = outcome(port.admitPackageResource({ ...admission, package: recorded, manifestBytes: otherBytes }, active.context));

  const fixture = scheduledFixture();
  const capacityContext = { ...fixture.core.ctx, site: 'types.decode', actAt: fixture.core.clock(1_000_000),
    register: { ...fixture.core.ctx.register, entries: [...fixture.core.ctx.register.entries, 'account:a'],
      subjects: { ...fixture.core.ctx.register.subjects, 'quota-utilization': ['percent'] } } };
  const measurement = { type: 'Measurement', schemaVersion: 1, subject: { kind: 'quota-utilization', instance: 'account:a' },
    value: 50, unit: 'percent', at: fixture.core.clock(100), by: 'probe' };
  const freshCapacity = outcome(decodeScheduledCapacityMeasurement('quota-utilization', 'account:a', measurement, capacityContext));
  const invalidCapacity = [-1, 186].map(capacityValue => outcome(decodeScheduledCapacityMeasurement('quota-utilization', 'account:a',
    { ...measurement, value: capacityValue }, capacityContext)).status);
  const staleCapacity = outcome(decodeScheduledCapacityMeasurement('quota-utilization', 'account:a',
    { ...measurement, at: fixture.core.clock(0) }, capacityContext));
  const { actAt: _actAt, ...withoutActionClock } = capacityContext;
  const unknownCapacity = outcome(decodeScheduledCapacityMeasurement('quota-utilization', 'account:a', measurement,
    withoutActionClock));
  const unobservableFramework = outcome(decodeScheduledCapacityMeasurement('framework-quota', 'framework:none', measurement, capacityContext));

  const lower = outcome(port.decode({ ...clone(fixture.manifest), schedule: { ...clone(fixture.manifest.schedule),
    at: '2027-01-01t00:00:00z' } }, fixture.context));
  const subMillisecond = outcome(port.decode({ ...clone(fixture.manifest), schedule: { ...clone(fixture.manifest.schedule),
    at: '2027-01-01T00:00:00.0001Z' } }, fixture.context));
  let representationMismatch = '';
  try { parseRfc3339Offset('2027-01-01T00:00:00.0001Z'); } catch (error) {
    representationMismatch = error instanceof Error ? error.message : String(error);
  }

  const captured = readFileSync('tests/scheduled/fixtures/legacy-health-check.json', 'utf8');
  const omitted = readFileSync('tests/scheduled/fixtures/legacy-benchmark-divergence-analysis.json', 'utf8');
  const legacyCaptured = outcome(importLegacyScheduledJob(captured, fixture.context));
  const legacyOmitted = outcome(importLegacyScheduledJob(omitted, fixture.context));
  const arbitraryModel = outcome(importLegacyScheduledJob(captured.replace('"haiku"', '"not-a-1x-model"'), fixture.context));

  const durable: unknown[] = [];
  const storage = (fallback: SegmentStoragePort): SegmentStoragePort => ({ owner: 'part-ten', read: () => durable,
    append: (bytes, expected) => { const result = fallback.append(bytes, expected); durable.push(JSON.parse(bytes)); return result; } });
  const admissions = new Set<string>(); const recovery = { admissions, witness: (_id: string) => {}, worker: 'w', harness: 'h',
    lease: 'lease:1', message: 'request bytes' };
  const beforeRestart = setup(storage, recovery); value(beforeRestart.graph.open(beforeRestart.run));
  const afterRestart = setup(storage, recovery); const retained = outcome(afterRestart.graph.read(beforeRestart.id));
  const unresolved = outcome(afterRestart.graph.readExit({ owner: 'part-five', name: 'Run', id: beforeRestart.id }));
  const unreachableFixture = closeUnreachable();
  const unreachable = outcome(unreachableFixture.graph.readExit({ owner: 'part-five', name: 'Run', id: unreachableFixture.id }));

  return {
    currentNeighbor: currentNeighbor.status, invalidJob: invalid.status, planeAfterRefusal: planeAfterRefusal.status,
    signedCollisions: [firstCollision.status, secondCollision.status], freshCapacity: freshCapacity.status,
    invalidCapacity, staleCapacity: staleCapacity.status, unknownCapacity: unknownCapacity.status,
    unobservableFramework: unobservableFramework.status, lowerTimestamp: lower.status,
    subMillisecondTimestamp: subMillisecond.status, representationMismatch,
    legacyCaptured: legacyCaptured.status === 'accepted' ? {
      sourceKind: legacyCaptured.value.sourceKind, schedule: legacyCaptured.value.schedule, priority: legacyCaptured.value.priority,
      duration: legacyCaptured.value.expectedDurationMinutes, model: legacyCaptured.value.model,
    } : { sourceKind: 'refused' },
    legacyOmittedModel: legacyOmitted.status === 'accepted' ? legacyOmitted.value.model : 'refused',
    arbitraryModel: arbitraryModel.status, retainedRun: retained.status === 'accepted' ? retained.value.state : retained.status,
    retainedDetail: retained.status === 'refused' ? retained.detail : '',
    unresolvedExit: unresolved.status, unreachableExit: unreachable.status === 'accepted' ? unreachable.value.exit.kind : unreachable.status,
  };
}
