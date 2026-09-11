import { canonical, consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeLocalCapabilityPackage } from '../../src/assembly/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { activeScheduledFixture, clone, packageArchive, scheduledFixture, value } from './fixture.js';

export type Round7Decision = Readonly<{ status: 'accepted' | 'refused'; detail?: string }>;

function decision<T>(result: Result<T>): Round7Decision {
  return consumeResult<T, Round7Decision>(result, {
    Success: () => ({ status: 'accepted' as const }),
    Refused: refusal => ({ status: 'refused' as const, detail: refusal.detail }),
  });
}

function resourceCase(kind: 'manifest' | 'job-definition' | 'schedule-resource' | 'support' | 'hidden-second') {
  const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  const input = clone(scheduled.package) as any;
  const resources: Record<string, string> = {
    'scheduled/manifest.json': scheduled.manifestBytes,
    'dist/maintenance.js': scheduled.bodyBytes,
  };
  if (kind === 'job-definition' || kind === 'schedule-resource') input.entrypoints[0].id = kind;
  if (kind === 'support') {
    resources['data/dependencies.json'] = '{"dependencies":[]}';
    input.entrypoints.push({ id: 'dependency-manifest', path: 'data/dependencies.json',
      digest: hashBytes(resources['data/dependencies.json']) });
  }
  if (kind === 'hidden-second') {
    const second = clone(scheduled.manifest) as any; second.schedule.at = '2027-01-02T00:00:00Z';
    resources['data/second.json'] = value(canonical(second)).bytes;
    input.entrypoints.push({ id: 'job-definition-2', path: 'data/second.json',
      digest: hashBytes(resources['data/second.json']) });
  }
  const pkg = value(assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(input, assembly.c))));
  value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: `transition:round7:${kind}`, operation: `operation:round7:${kind}`,
    package: pkg.namespace, manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
  return decision(createScheduledWorkPackagePort().admitPackageResource({ package: pkg,
    archive: packageArchive(pkg, resources),
    manifestPath: 'scheduled/manifest.json', manifestBytes: scheduled.manifestBytes, existingManifests: [] }, assembly.c));
}

function activityCase(state: 'recorded' | 'staged' | 'active' | 'retired' | 'inhibited') {
  const f = activeScheduledFixture(); const input = clone(f.package) as any;
  Object.assign(input, { id: `package:round7-competitor:${state}`,
    namespace: `alice.round7-competitor-${state}`, contentDigest: f.h('d') });
  const competing = value(f.assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(input, f.context))));
  if (state !== 'recorded') {
    const first = value(f.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
      id: `transition:round7-competitor:${state}:first`, operation: `operation:round7-competitor:${state}:first`,
      package: competing.namespace, manifestDigest: competing.contentDigest,
      observedArtifactDigest: competing.contentDigest,
      ...(state === 'staged' ? { from: 'none', to: 'staged' } : {}) }));
    if (state === 'retired' || state === 'inhibited') {
      const firstRow = value(f.assembly.runtime.inspectCurrent()).find(row => row.record.id === first.id)!;
      value(f.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
        id: `transition:round7-competitor:${state}:terminal`, operation: `operation:round7-competitor:${state}:terminal`,
        predecessors: [firstRow.fact.id], package: competing.namespace,
        manifestDigest: competing.contentDigest, observedArtifactDigest: competing.contentDigest,
        from: 'active', to: state }));
    }
  }
  return decision(createScheduledWorkPackagePort().admitPackageResource({ package: f.package,
    archive: f.archive, manifestPath: 'scheduled/manifest.json', manifestBytes: f.manifestBytes, existingManifests: [] }, f.context));
}

let cachedRound7Proof: ReturnType<typeof buildP15Round7Proof> | undefined;

function buildP15Round7Proof() {
  return {
    resources: Object.fromEntries((['manifest', 'job-definition', 'schedule-resource', 'support', 'hidden-second'] as const)
      .map(kind => [kind, resourceCase(kind)])),
    activity: Object.fromEntries((['recorded', 'staged', 'active', 'retired', 'inhibited'] as const)
      .map(state => [state, activityCase(state)])),
  };
}

export function exerciseP15Round7Proof() {
  return cachedRound7Proof ??= buildP15Round7Proof();
}
