import { canonical, consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeLocalCapabilityPackage } from '../../src/assembly/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { clone, packageArchive, scheduledFixture, value } from './fixture.js';
import { exerciseP15Round7Proof } from './round7-proof.js';

export type Round8Decision = Readonly<{ status: 'accepted' | 'refused'; detail?: string }>;

function decision<T>(result: Result<T>): Round8Decision {
  return consumeResult<T, Round8Decision>(result, {
    Success: () => ({ status: 'accepted' as const }),
    Refused: refusal => ({ status: 'refused' as const, detail: refusal.detail }),
  });
}

function dependencyCase(kind: 'none' | 'missing' | 'matching' | 'wrong-digest' | 'self') {
  const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  const input = clone(scheduled.package) as any;
  if (kind !== 'none') input.dependencies = [{
    package: kind === 'self' ? input.namespace : 'alice.support-package',
    digest: kind === 'self' ? input.contentDigest : scheduled.h('d'), contract: 'support:v1',
  }];
  if (kind === 'matching' || kind === 'wrong-digest') {
    const dependency = clone(scheduled.package) as any;
    Object.assign(dependency, { id: `package:support:${kind}`, namespace: 'alice.support-package',
      contentDigest: kind === 'matching' ? scheduled.h('d') : scheduled.h('e'), dependencies: [],
      declarationIds: ['capability:support'] });
    const recordedDependency = value(assembly.runtime.record('LocalCapabilityPackage',
      value(decodeLocalCapabilityPackage(dependency, assembly.c))));
    value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
      id: `transition:support:${kind}`, operation: `operation:support:${kind}`,
      package: recordedDependency.namespace, manifestDigest: recordedDependency.contentDigest,
      observedArtifactDigest: recordedDependency.contentDigest }));
  }
  const pkg = value(assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(input, assembly.c))));
  value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: `transition:round8:${kind}`, operation: `operation:round8:${kind}`,
    package: pkg.namespace, manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
  return decision(createScheduledWorkPackagePort().admitPackageResource({ package: pkg,
    archive: packageArchive(pkg, { 'scheduled/manifest.json': scheduled.manifestBytes,
      'dist/maintenance.js': scheduled.bodyBytes }), manifestPath: 'scheduled/manifest.json',
    manifestBytes: scheduled.manifestBytes, existingManifests: [] }, assembly.c));
}

function resourceCase(kind: 'support' | 'second-manifest' | 'missing-bytes' | 'changed-bytes') {
  const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  const input = clone(scheduled.package) as any;
  const second = clone(scheduled.manifest) as any; second.schedule.at = '2027-01-02T00:00:00Z';
  const extraBytes = kind === 'second-manifest' ? value(canonical(second)).bytes : '{"dependencies":[]}';
  input.entrypoints.push({ id: 'arbitrary-resource', path: 'data/extra.json', digest: hashBytes(extraBytes) });
  const pkg = value(assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(input, assembly.c))));
  value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: `transition:round8:resource:${kind}`, operation: `operation:round8:resource:${kind}`,
    package: pkg.namespace, manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
  const archive = [...packageArchive(pkg, { 'scheduled/manifest.json': scheduled.manifestBytes,
    'dist/maintenance.js': scheduled.bodyBytes, 'data/extra.json': extraBytes })];
  if (kind === 'missing-bytes') archive.pop();
  if (kind === 'changed-bytes') archive[2] = { ...archive[2]!, bytes: `${archive[2]!.bytes} ` };
  return decision(createScheduledWorkPackagePort().admitPackageResource({ package: pkg, archive,
    manifestPath: 'scheduled/manifest.json', manifestBytes: scheduled.manifestBytes,
    existingManifests: [] }, assembly.c));
}

let cached: ReturnType<typeof buildP15Round8Proof> | undefined;

function buildP15Round8Proof() {
  return {
    dependencies: Object.fromEntries((['none', 'missing', 'matching', 'wrong-digest', 'self'] as const)
      .map(kind => [kind, dependencyCase(kind)])),
    resources: Object.fromEntries((['support', 'second-manifest', 'missing-bytes', 'changed-bytes'] as const)
      .map(kind => [kind, resourceCase(kind)])),
    activity: exerciseP15Round7Proof().activity,
  };
}

export function exerciseP15Round8Proof() {
  return cached ??= buildP15Round8Proof();
}
