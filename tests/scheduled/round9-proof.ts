import { canonical, consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeLocalCapabilityPackage, resolveActivePackage } from '../../src/assembly/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { activeScheduledFixture, clone, packageArchive, scheduledFixture, value } from './fixture.js';

export type Round9Decision = Readonly<{ status: 'accepted' | 'refused'; detail?: string }>;

function decision<T>(result: Result<T>): Round9Decision {
  return consumeResult<T, Round9Decision>(result, {
    Success: () => ({ status: 'accepted' as const }),
    Refused: refusal => ({ status: 'refused' as const, detail: refusal.detail }),
  });
}

function admission(fixture: ReturnType<typeof activeScheduledFixture>) {
  return { package: fixture.package, archive: fixture.archive,
    manifestPath: 'scheduled/manifest.json', manifestBytes: fixture.manifestBytes,
    existingManifests: [] };
}

function retirementRace(cutAt: 3 | 4 | 20) {
  const fixture = activeScheduledFixture(); const original = fixture.context.history!;
  let reads = 0; let changed = false;
  const retire = () => {
    const head = value(fixture.assembly.runtime.inspectCurrent())
      .find(row => row.record.id === 'transition:scheduled:active')!;
    value(fixture.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
      id: `transition:round9:retired:${cutAt}`, operation: `operation:round9:retired:${cutAt}`,
      package: fixture.package.namespace, manifestDigest: fixture.package.contentDigest,
      observedArtifactDigest: fixture.package.contentDigest, predecessors: [head.fact.id],
      from: 'active', to: 'retired' }));
    changed = true;
  };
  const context = { ...fixture.context, history: { ...original, current() {
    reads++; if (reads === cutAt) retire(); return original.current();
  } } };
  const admitted = decision(createScheduledWorkPackagePort().admitPackageResource(admission(fixture), context));
  const ownerNow = decision(resolveActivePackage(fixture.package.namespace,
    value(fixture.assembly.runtime.inspectCurrent()), fixture.context));
  return { admitted, ownerNow, reads, changed };
}

type ResourceKind = 'support' | 'normal-second' | 'repeated-type' | 'repeated-type-overridden'
  | 'repeated-display-name' | 'repeated-at';

function resourceRole(kind: ResourceKind) {
  const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  const second = clone(scheduled.manifest) as any; second.schedule.at = '2027-01-02T00:00:00Z';
  let bytes = value(canonical(second)).bytes;
  if (kind === 'support') bytes = '{"dependencies":[]}';
  if (kind === 'repeated-type') bytes = bytes.replace('"type":"ScheduledWorkManifest"',
    '"type":"ScheduledWorkManifest","type":"ScheduledWorkManifest"');
  if (kind === 'repeated-type-overridden') bytes = bytes.replace('"type":"ScheduledWorkManifest"',
    '"type":"ScheduledWorkManifest","type":"support"');
  if (kind === 'repeated-display-name') bytes = bytes.replace('"displayName":"Maintenance"',
    '"displayName":"Old","displayName":"Maintenance"');
  if (kind === 'repeated-at') bytes = bytes.replace('"at":"2027-01-02T00:00:00Z"',
    '"at":"2027-01-03T00:00:00Z","at":"2027-01-02T00:00:00Z"');
  const input = clone(scheduled.package) as any;
  input.entrypoints.push({ id: 'unrecognized-resource', path: 'data/extra.json', digest: hashBytes(bytes) });
  const pkg = value(assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(input, assembly.c))));
  value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: `transition:round9:resource:${kind}`, operation: `operation:round9:resource:${kind}`,
    package: pkg.namespace, manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
  const archive = packageArchive(pkg, { 'scheduled/manifest.json': scheduled.manifestBytes,
    'dist/maintenance.js': scheduled.bodyBytes, 'data/extra.json': bytes });
  const base = { package: pkg, archive, existingManifests: [] };
  return {
    selectedOriginal: decision(createScheduledWorkPackagePort().admitPackageResource({ ...base,
      manifestPath: 'scheduled/manifest.json', manifestBytes: scheduled.manifestBytes }, assembly.c)),
    selectedExtra: decision(createScheduledWorkPackagePort().admitPackageResource({ ...base,
      manifestPath: 'data/extra.json', manifestBytes: bytes }, assembly.c)),
  };
}

let cached: ReturnType<typeof buildP15Round9Proof> | undefined;

function buildP15Round9Proof() {
  return {
    retirement: Object.fromEntries(([3, 4, 20] as const).map(cut => [cut, retirementRace(cut)])),
    resources: Object.fromEntries((['support', 'normal-second', 'repeated-type', 'repeated-type-overridden',
      'repeated-display-name', 'repeated-at'] as const).map(kind => [kind, resourceRole(kind)])),
  };
}

export function exerciseP15Round9Proof() {
  return cached ??= buildP15Round9Proof();
}
