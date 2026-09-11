import { describe, expect, it } from 'vitest';
import { canonical, consumeResult, decodeMeasurement } from '../../src/index.js';
import { decodeLocalCapabilityPackage, resolveActivePackage } from '../../src/assembly/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createScheduledWorkPackagePort, normalizeCronV1 } from '../../src/scheduled/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { activeScheduledFixture, clone, packageArchive, scheduledFixture, value } from './fixture.js';

const status = (result: unknown) => consumeResult(result as Parameters<typeof consumeResult>[0], {
  Success: () => 'accepted' as const, Refused: () => 'refused' as const,
});

describe('Part Fifteen independent review round 2 regressions', () => {
  it('P15-NF-03 P15-NF-16 P15-NF-17 re-resolves the owner-decoded current signed package', () => {
    const absent = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const admission = { package: absent.package, archive: absent.archive, manifestPath: 'scheduled/manifest.json', manifestBytes: absent.manifestBytes, existingManifests: [] };
    expect(status(resolveActivePackage(absent.package.namespace, [], absent.context))).toBe('refused');
    expect(status(port.admitPackageResource(admission, absent.context))).toBe('refused');

    const active = activeScheduledFixture();
    const activeAdmission = { ...admission, package: active.package, archive: active.archive, manifestBytes: active.manifestBytes };
    expect(status(resolveActivePackage(active.package.namespace, [], active.context))).toBe('accepted');
    expect(status(port.admitPackageResource(activeAdmission, active.context))).toBe('accepted');
    const current = value(active.assembly.runtime.inspectCurrent());
    const transition = current.find(row => row.record.id === 'transition:scheduled:active')!;
    value(active.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'), id: 'transition:scheduled:retired',
      predecessors: [transition.fact.id], package: active.package.namespace, manifestDigest: active.package.contentDigest,
      observedArtifactDigest: active.package.contentDigest, from: 'active', to: 'retired', cause: 'retire', operation: 'operation:retire:scheduled' }));
    expect(status(resolveActivePackage(active.package.namespace, current, active.context))).toBe('refused');
    expect(status(port.admitPackageResource(activeAdmission, active.context))).toBe('refused');

    const missingPrior = { ...clone(active.package), priorPackage: 'package:absent' } as unknown as typeof active.package;
    expect(status(decodeLocalCapabilityPackage(missingPrior, active.context))).toBe('refused');
    expect(status(port.admitPackageResource({ ...activeAdmission, package: missingPrior }, active.context))).toBe('refused');
  });

  it('P15-NF-08 refuses malformed Part Ten package copies before consuming their fields', () => {
    const f = activeScheduledFixture(); const port = createScheduledWorkPackagePort();
    const admission = { package: f.package, archive: f.archive, manifestPath: 'scheduled/manifest.json', manifestBytes: f.manifestBytes, existingManifests: [] };
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      value => { value.type = 'NotAPackage'; }, value => { value.schemaVersion = 999; },
      value => { delete value.namespace; }, value => { delete value.sourceDigest; }, value => { value.unexpected = true; },
    ];
    for (const mutate of mutations) {
      const candidate = clone(f.package) as unknown as Record<string, unknown>; mutate(candidate);
      expect(status(decodeLocalCapabilityPackage(candidate, f.context))).toBe('refused');
      expect(status(port.admitPackageResource({ ...admission, package: candidate as unknown as typeof f.package }, f.context))).toBe('refused');
    }
  });

  it('P15-NF-08 makes identity, comparison, cron, admission and planning total for non-JSON inputs', () => {
    const f = activeScheduledFixture(); const port = createScheduledWorkPackagePort();
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    for (const malformed of [undefined, () => undefined, Number.NaN, 1n, cycle]) {
      const calls = [
        () => port.identity(malformed, f.context), () => port.compare(f.manifest, malformed, f.context),
        () => normalizeCronV1(malformed, f.context), () => port.admitPackageResource(malformed as never, f.context),
        () => port.planOccurrence(malformed as never, f.context),
      ];
      for (const call of calls) expect(() => expect(status(call())).toBe('refused')).not.toThrow();
    }
  });

  it('P15-NF-14 P15-NF-27 validates clocks and occurrence identity fields through their owner boundaries', () => {
    const f = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const base = { manifest: f.manifest, namespaceVersion: 'scheduled:v1', installationId: 'install:a',
      scheduledInstant: f.manifest.schedule.kind === 'one-shot' ? f.manifest.schedule.at : '', asOf: f.core.clock(Date.UTC(2027, 0, 1)) };
    const clocks = [
      { type: 'Measurement', subject: { kind: 'clock' }, unit: 'unix-ms' },
      { ...base.asOf, value: String(base.asOf.value) }, { ...base.asOf, by: 'never-registered' },
      { ...base.asOf, subject: { kind: 'clock', instance: 'foreign' } },
      (() => { const clock = clone(base.asOf) as unknown as Record<string, unknown>; delete clock.at; return clock; })(),
      { ...base.asOf, proof: 'copied' },
    ];
    expect(status(decodeMeasurement('clock', base.asOf, f.core.ctx))).toBe('accepted');
    expect(status(port.planOccurrence(base, f.context))).toBe('accepted');
    for (const clock of clocks) {
      expect(status(decodeMeasurement('clock', clock, f.core.ctx))).toBe('refused');
      expect(status(port.planOccurrence({ ...base, asOf: clock as unknown as typeof base.asOf }, f.context))).toBe('refused');
    }
    for (const key of ['namespaceVersion', 'installationId'] as const) for (const malformed of ['', 3, null])
      expect(status(port.planOccurrence({ ...base, [key]: malformed } as never, f.context))).toBe('refused');
    expect(status(port.planOccurrence({ ...base, extra: true } as never, f.context))).toBe('refused');
    for (const [delta, disposition] of [[-1, 'not-yet-due'], [0, 'current'], [300_000, 'current'], [300_001, 'missed']] as const) {
      const plan = value(port.planOccurrence({ ...base, asOf: f.core.clock(Date.UTC(2027, 0, 1) + delta) }, f.context));
      expect(plan.disposition).toBe(disposition);
    }
  });

  it('P15-NF-08 refuses duplicate JSON members before manifest decoding', () => {
    const s = scheduledFixture(); const assembly = assemblyRuntimeFixture(); const port = createScheduledWorkPackagePort();
    const duplicateBytes = s.manifestBytes.replace('"displayName":"Maintenance"', '"displayName":"first","displayName":"Maintenance"');
    const candidate = clone(s.package) as unknown as Record<string, any>; candidate.namespace = 'alice.scheduled-duplicate'; candidate.id = 'package:scheduled-duplicate';
    candidate.entrypoints[0].digest = hashBytes(duplicateBytes);
    const pkg = value(decodeLocalCapabilityPackage(candidate, s.context)); value(assembly.runtime.record('LocalCapabilityPackage', pkg));
    value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'), id: 'transition:scheduled-duplicate:active',
      package: pkg.namespace, manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
    expect(status(port.admitPackageResource({ package: pkg,
      archive: packageArchive(pkg, { 'scheduled/manifest.json': duplicateBytes, 'dist/maintenance.js': s.bodyBytes }),
      manifestPath: 'scheduled/manifest.json', manifestBytes: duplicateBytes,
      existingManifests: [] }, assembly.c))).toBe('refused');
    const canonicalBytes = value(canonical(s.manifest)).bytes; const canonicalCandidate = clone(candidate) as Record<string, any>;
    canonicalCandidate.namespace = 'alice.scheduled-canonical'; canonicalCandidate.id = 'package:scheduled-canonical';
    canonicalCandidate.entrypoints[0].digest = hashBytes(canonicalBytes);
    const canonicalPackage = value(decodeLocalCapabilityPackage(canonicalCandidate, s.context));
    value(assembly.runtime.record('LocalCapabilityPackage', canonicalPackage));
    value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'), id: 'transition:scheduled-canonical:active',
      package: canonicalPackage.namespace, manifestDigest: canonicalPackage.contentDigest, observedArtifactDigest: canonicalPackage.contentDigest }));
    expect(status(port.admitPackageResource({ package: canonicalPackage,
      archive: packageArchive(canonicalPackage, { 'scheduled/manifest.json': canonicalBytes, 'dist/maintenance.js': s.bodyBytes }),
      manifestPath: 'scheduled/manifest.json', manifestBytes: canonicalBytes,
      existingManifests: [] }, assembly.c))).toBe('refused');
  });

  it('P15-NF-09 accepts unsigned decimal spellings and refuses non-text cron input', () => {
    const f = scheduledFixture();
    expect(value(normalizeCronV1('00 0 * * 0', f.context)).expression).toMatch(/^0 /);
    expect(value(normalizeCronV1('*/01 0 * * 0', f.context)).fields[0]).toHaveLength(60);
    expect(value(normalizeCronV1('10-20/05 0 * * 0', f.context)).fields[0]).toEqual([10, 15, 20]);
    expect(status(normalizeCronV1(['0 0 * * 0'], f.context))).toBe('refused');
  });

  it('P15-NF-08 accepts an RFC 3339 trailing-zero fraction equal to the whole-millisecond instant', () => {
    const f = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const extended = { ...clone(f.manifest), schedule: { ...clone(f.manifest.schedule), at: '2027-01-01T00:00:00.0000Z' } };
    expect(status(port.decode(extended, f.context))).toBe('accepted');
  });
});
