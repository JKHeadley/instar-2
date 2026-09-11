import { canonical, consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeLocalCapabilityPackage } from '../../src/assembly/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { activeScheduledFixture, clone, scheduledFixture, value } from './fixture.js';

const status = <T>(result: Result<T>) => consumeResult(result, {
  Success: () => 'accepted' as const,
  Refused: () => 'refused' as const,
});

function competingAdmission(state: 'recorded' | 'staged' | 'active' | 'retired' | 'inhibited') {
  const f = activeScheduledFixture();
  const input = clone(f.package) as any;
  Object.assign(input, { id: `package:competitor:${state}`, namespace: `alice.competitor-${state}`, contentDigest: f.h('d') });
  const competing = value(f.assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(input, f.context))));
  if (state !== 'recorded') {
    const first = value(f.assembly.runtime.record('PackageTransition', {
      ...assemblyInput('PackageTransition'), id: `transition:competitor:${state}:first`, operation: `operation:competitor:${state}:first`,
      package: competing.namespace, manifestDigest: competing.contentDigest, observedArtifactDigest: competing.contentDigest,
      ...(state === 'staged' ? { from: 'none', to: 'staged' } : {}),
    }));
    if (state === 'retired' || state === 'inhibited') value(f.assembly.runtime.record('PackageTransition', {
      ...assemblyInput('PackageTransition'), id: `transition:competitor:${state}:terminal`, operation: `operation:competitor:${state}:terminal`,
      predecessors: [value(f.assembly.runtime.inspectCurrent()).find(row => row.record.id === first.id)!.fact.id],
      package: competing.namespace, manifestDigest: competing.contentDigest, observedArtifactDigest: competing.contentDigest,
      from: 'active', to: state,
    }));
  }
  return status(createScheduledWorkPackagePort().admitPackageResource({ package: f.package,
    manifestPath: 'scheduled/manifest.json', manifestBytes: f.manifestBytes, existingManifests: [] }, f.context));
}

function supportAdmission(path: string) {
  const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  const input = clone(scheduled.package) as any;
  input.entrypoints.push({ id: 'support-data', path, digest: hashBytes('{"threshold":3}') });
  const pkg = value(assembly.runtime.record('LocalCapabilityPackage', value(decodeLocalCapabilityPackage(input, assembly.c))));
  value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'), id: `transition:support:${path}`,
    operation: `operation:support:${path}`, package: pkg.namespace, manifestDigest: pkg.contentDigest,
    observedArtifactDigest: pkg.contentDigest }));
  return status(createScheduledWorkPackagePort().admitPackageResource({ package: pkg,
    manifestPath: 'scheduled/manifest.json', manifestBytes: scheduled.manifestBytes, existingManifests: [] }, assembly.c));
}

function twoManifestAdmissions() {
  const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  const second = clone(scheduled.manifest) as any; second.schedule.at = '2027-01-02T00:00:00Z';
  const secondBytes = value(canonical(second)).bytes; const input = clone(scheduled.package) as any;
  input.entrypoints.push({ id: 'another-manifest', path: 'data/second.json', digest: hashBytes(secondBytes) });
  const pkg = value(assembly.runtime.record('LocalCapabilityPackage', value(decodeLocalCapabilityPackage(input, assembly.c))));
  value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'), id: 'transition:two-manifests:round6',
    operation: 'operation:two-manifests:round6', package: pkg.namespace, manifestDigest: pkg.contentDigest,
    observedArtifactDigest: pkg.contentDigest }));
  const port = createScheduledWorkPackagePort();
  return [
    status(port.admitPackageResource({ package: pkg, manifestPath: 'scheduled/manifest.json',
      manifestBytes: scheduled.manifestBytes, existingManifests: [] }, assembly.c)),
    status(port.admitPackageResource({ package: pkg, manifestPath: 'data/second.json',
      manifestBytes: secondBytes, existingManifests: [] }, assembly.c)),
  ];
}

export function exerciseP15Round6Proof() {
  return {
    competing: Object.fromEntries((['recorded', 'staged', 'active', 'retired', 'inhibited'] as const)
      .map(state => [state, competingAdmission(state)])),
    support: Object.fromEntries(['dist/support.js', 'data/support.json', 'scheduled/support.json']
      .map(path => [path, supportAdmission(path)])),
    twoManifests: twoManifestAdmissions(),
  };
}
