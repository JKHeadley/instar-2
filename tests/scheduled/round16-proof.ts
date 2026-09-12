import { canonical, consumeResult } from '../../src/index.js';
import { decodeLocalCapabilityPackage } from '../../src/assembly/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { clone, packageArchive, scheduledFixture, value } from './fixture.js';

export function recurringScheduledManifest(timeZone: string) {
  const fixture = scheduledFixture();
  return {
    ...clone(fixture.manifest),
    schedule: {
      kind: 'recurring' as const,
      expression: '*/15 0 1-31 * 0-6',
      timeZone,
      activationInstant: fixture.manifest.schedule.activationInstant,
      timeZoneDataVersion: fixture.manifest.schedule.timeZoneDataVersion,
      calendarPolicyVersion: fixture.manifest.schedule.calendarPolicyVersion,
      currentLatenessCutoffMs: fixture.manifest.schedule.currentLatenessCutoffMs,
    },
  };
}

export function buildP15Round16ZoneCase(timeZone: string) {
  const fixture = scheduledFixture();
  const assembly = assemblyRuntimeFixture();
  const manifest = recurringScheduledManifest(timeZone);
  const manifestBytes = value(canonical(manifest)).bytes;
  const packageInput = {
    ...clone(fixture.package),
    entrypoints: fixture.package.entrypoints.map((entry, index) => ({
      ...entry,
      digest: index === 0 ? hashBytes(manifestBytes) : entry.digest,
    })),
  };
  const pkg = value(assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(packageInput, assembly.c))));
  value(assembly.runtime.record('PackageTransition', {
    ...assemblyInput('PackageTransition'),
    id: `transition:round16:${timeZone.replaceAll('/', '-')}`,
    operation: `operation:round16:${timeZone.replaceAll('/', '-')}`,
    package: pkg.namespace,
    manifestDigest: pkg.contentDigest,
    observedArtifactDigest: pkg.contentDigest,
  }));
  return {
    raw: clone(assembly.raw),
    request: {
      package: pkg,
      archive: packageArchive(pkg, {
        'scheduled/manifest.json': manifestBytes,
        'dist/maintenance.js': fixture.bodyBytes,
      }),
      manifestPath: 'scheduled/manifest.json',
      manifestBytes,
      existingManifests: [],
    },
  };
}

export function recoverP15Round16ZoneCase(saved: ReturnType<typeof buildP15Round16ZoneCase>) {
  const assembly = assemblyRuntimeFixture();
  assembly.raw.splice(0, assembly.raw.length, ...saved.raw);
  type Decision = { status: 'accepted'; timeZone: string | undefined } | { status: 'refused'; detail: string };
  return consumeResult(createScheduledWorkPackagePort().admitPackageResource(saved.request, assembly.c), {
    Success: (manifest): Decision => ({ status: 'accepted', timeZone: manifest.schedule.kind === 'recurring'
      ? manifest.schedule.timeZone : undefined }),
    Refused: (refusal): Decision => ({ status: 'refused', detail: refusal.detail }),
  });
}

export function exerciseP15Round16Zone(timeZone: string) {
  return recoverP15Round16ZoneCase(buildP15Round16ZoneCase(timeZone));
}
