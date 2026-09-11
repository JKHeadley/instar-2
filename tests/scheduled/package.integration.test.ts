import { describe, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { activeScheduledFixture, clone, scheduledFixture, value } from './fixture.js';

describe('Part Fifteen full public package-port integration', () => {
  it('P15-NF-08 binds manifest and body bytes to the landed Part Ten package contract', () => {
    const f = activeScheduledFixture(); const port = createScheduledWorkPackagePort();
    expect(value(port.admitPackageResource({ package: f.package, manifestPath: 'scheduled/manifest.json', manifestBytes: f.manifestBytes, existingManifests: [] }, f.context)).identity.jobId).toBe('job:maintenance');
    const changed = f.manifestBytes.replace('Maintenance', 'Forged');
    expect(consumeResult(port.admitPackageResource({ package: f.package, manifestPath: 'scheduled/manifest.json', manifestBytes: changed, existingManifests: [] }, f.context), { Success: () => '', Refused: item => item.detail })).toContain('bytes differ');
    expect(consumeResult(port.admitPackageResource({ package: f.package, manifestPath: 'scheduled/manifest.json', manifestBytes: f.manifestBytes, existingManifests: [f.manifest] }, f.context), { Success: () => '', Refused: item => item.detail })).toContain('duplicate scheduled job id');
  });

  it('P15-NF-10 refuses one invalid job while an independent package resource remains usable', () => {
    const f = activeScheduledFixture(); const port = createScheduledWorkPackagePort(); const invalid = { ...f.manifest, surprise: true };
    const surfaced = consumeResult(port.decode(invalid, f.context), { Success: () => '', Refused: refusal => refusal.detail });
    expect(surfaced).toContain('unexpected field');
    expect(value(port.admitPackageResource({ package: f.package, manifestPath: 'scheduled/manifest.json', manifestBytes: f.manifestBytes, existingManifests: [] }, f.context)).identity.jobId).toBe('job:maintenance');
    expect(value(canonical({ minimalPlane: 'still-operating' })).bytes).toContain('still-operating');
  });

  it('P15-NF-09 P15-SLICE-A-CRON binds normalized cron-v1 into the closed manifest through the public port', () => {
    const f = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const manifest = { ...clone(f.manifest), schedule: { kind: 'recurring' as const, expression: '*/15 0 1-31 1-12 0-6', timeZone: 'America/New_York',
      activationInstant: f.manifest.schedule.activationInstant, timeZoneDataVersion: f.manifest.schedule.timeZoneDataVersion,
      calendarPolicyVersion: f.manifest.schedule.calendarPolicyVersion, currentLatenessCutoffMs: f.manifest.schedule.currentLatenessCutoffMs } };
    const decoded = value(port.decode(manifest, f.context));
    expect(decoded.schedule.kind).toBe('recurring');
    if (decoded.schedule.kind === 'recurring') expect(decoded.schedule.expression).toContain('0,15,30,45');
  });

  it('P15-NF-14 P15-NF-27 P15-SLICE-A-ONE-SHOT plans only the absolute activation-bounded identity', () => {
    const f = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const at = f.core.clock(Date.UTC(2027, 0, 1, 0, 5));
    const plan = value(port.planOccurrence({ manifest: f.manifest, namespaceVersion: 'scheduled:v1', installationId: 'install:a', scheduledInstant: '2027-01-01T01:00:00+01:00', asOf: at }, f.context));
    expect(plan.disposition).toBe('current'); expect(JSON.parse(plan.tickBytes)).toEqual({ schemaVersion: 1, jobInstanceId: plan.jobInstanceId,
      scheduledInstant: '2027-01-01T00:00:00Z', packageDigest: f.manifest.identity.contentDigest,
      calendarPolicyVersion: f.manifest.schedule.calendarPolicyVersion, timeZoneDataVersion: f.manifest.schedule.timeZoneDataVersion });
    expect(plan.tickBytes).not.toContain('install:a'); expect(plan.tickBytes).not.toContain(String(at.value));
  });

  it('P15-NF-18 P15-SLICE-A-MACHINE-IDENTITY expands every-machine identity without collapsing targets', () => {
    const f = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const manifest = { ...clone(f.manifest), admission: { ...f.manifest.admission, placement: 'every-eligible-machine' as const } };
    const at = f.core.clock(Date.UTC(2027, 0, 1));
    const a = value(port.planOccurrence({ manifest, namespaceVersion: 'scheduled:v1', installationId: 'install:a', targetMachineId: 'machine-a', scheduledInstant: '2027-01-01T00:00:00Z', asOf: at }, f.context));
    const b = value(port.planOccurrence({ manifest, namespaceVersion: 'scheduled:v1', installationId: 'install:a', targetMachineId: 'machine-b', scheduledInstant: '2027-01-01T00:00:00Z', asOf: at }, f.context));
    expect(a.jobInstanceId).not.toBe(b.jobInstanceId); expect(a.eventId).not.toBe(b.eventId);
  });

  it('P15-NF-39 priority changes ordering metadata without widening authority or budget', () => {
    const f = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const critical = value(port.decode({ ...clone(f.manifest), admission: { ...clone(f.manifest.admission), priority: 'critical' } }, f.context));
    expect(critical.authority).toEqual(f.manifest.authority); expect(critical.bounds).toEqual(f.manifest.bounds);
    const hiddenAuthority = { ...clone(f.manifest), admission: { ...clone(f.manifest.admission), priority: 'critical', extraScope: 'organization' } };
    expect(consumeResult(port.decode(hiddenAuthority, f.context), { Success: () => 'accepted', Refused: () => 'refused' })).toBe('refused');
  });
});
