import { describe, expect, it } from 'vitest';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { scheduledFixture, value } from '../scheduled/fixture.js';

describe('Part Fifteen durable-restart lifecycle', () => {
  it('P15-NF-08 preserves package and one-shot identity across a cold reconstruction cut', () => {
    const first = scheduledFixture(); const firstPort = createScheduledWorkPackagePort();
    const admitted = value(firstPort.admitPackageResource({ package: first.package, manifestPath: 'scheduled/manifest.json', manifestBytes: first.manifestBytes, existingManifests: [] }, first.context));
    const clock = first.core.clock(Date.UTC(2027, 0, 1, 0, 5));
    const before = value(firstPort.planOccurrence({ manifest: admitted, namespaceVersion: 'scheduled:v1', installationId: 'install:a', scheduledInstant: '2027-01-01T00:00:00Z', asOf: clock }, first.context));
    const persisted = JSON.stringify({ package: first.package, manifestBytes: first.manifestBytes, before });

    const after = scheduledFixture(); const restored = JSON.parse(persisted) as { package: typeof after.package; manifestBytes: string; before: typeof before };
    const afterPort = createScheduledWorkPackagePort();
    const readmitted = value(afterPort.admitPackageResource({ package: restored.package, manifestPath: 'scheduled/manifest.json', manifestBytes: restored.manifestBytes, existingManifests: [] }, after.context));
    const replay = value(afterPort.planOccurrence({ manifest: readmitted, namespaceVersion: 'scheduled:v1', installationId: 'install:a', scheduledInstant: '2027-01-01T00:00:00Z', asOf: after.core.clock(Date.UTC(2027, 0, 1, 0, 5)) }, after.context));
    expect(replay).toEqual(restored.before); expect(value(afterPort.identity(readmitted, after.context))).toEqual(value(firstPort.identity(admitted, first.context)));
  });

  it('P15-SLICE-A-CRON preserves normalized recurring declaration bytes across reconstruction without claiming expansion', () => {
    const before = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const recurring = { ...before.manifest, schedule: { kind: 'recurring' as const, expression: '10-20/5 1 * * 0', timeZone: 'America/New_York',
      activationInstant: before.manifest.schedule.activationInstant, timeZoneDataVersion: before.manifest.schedule.timeZoneDataVersion,
      calendarPolicyVersion: before.manifest.schedule.calendarPolicyVersion, currentLatenessCutoffMs: before.manifest.schedule.currentLatenessCutoffMs } };
    const first = value(port.identity(recurring, before.context));
    const after = scheduledFixture(); const rebuilt = value(createScheduledWorkPackagePort().identity(JSON.parse(JSON.stringify(recurring)), after.context));
    expect(rebuilt).toEqual(first);
  });
});
