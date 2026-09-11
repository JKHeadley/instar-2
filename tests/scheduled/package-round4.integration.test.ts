import { describe, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { decodeLocalCapabilityPackage, resolveActivePackage } from '../../src/assembly/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { activeScheduledFixture, clone, scheduledFixture, value } from './fixture.js';

const status = <T>(result: import('../../src/index.js').Result<T>) => consumeResult(result, {
  Success: () => 'accepted' as const, Refused: () => 'refused' as const,
});

describe('Part Fifteen round-four authoritative package conflicts', () => {
  it('P15-NF-01 P15-NF-03 P15-NF-08 P15-NF-17 re-resolves cross-namespace activity independently of dependency facts', () => {
    const f = activeScheduledFixture(); const port = createScheduledWorkPackagePort();
    const current = value(f.assembly.runtime.inspectCurrent());
    const firstTransition = current.find(row => row.record.id === 'transition:scheduled:active')!;
    const manifest = clone(f.manifest) as any; manifest.identity.contentDigest = f.h('d');
    manifest.schedule.at = '2027-01-02T00:00:00Z';
    const bytes = value(canonical(manifest)).bytes; const input = clone(f.package) as any;
    Object.assign(input, { id: 'package:cross', namespace: 'alice.cross', contentDigest: f.h('d') });
    input.entrypoints[0]!.digest = hashBytes(bytes);
    const pkg = value(f.assembly.runtime.record('LocalCapabilityPackage', value(decodeLocalCapabilityPackage(input, f.context))));
    value(f.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
      id: 'transition:cross:active', dependencyFacts: [firstTransition.fact.id], package: pkg.namespace,
      manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
    expect(status(resolveActivePackage(f.package.namespace, [], f.context))).toBe('accepted');
    expect(status(resolveActivePackage(pkg.namespace, [], f.context))).toBe('accepted');
    const admit = (candidate: typeof pkg, manifestBytes: string) => port.admitPackageResource({ package: candidate,
      manifestPath: 'scheduled/manifest.json', manifestBytes, existingManifests: [] }, f.context);
    expect(status(admit(f.package, f.manifestBytes))).toBe('refused');
    expect(status(admit(pkg, bytes))).toBe('refused');
  });

  it('P15-NF-08 refuses every entrypoint when one active package declares two scheduled manifest resources', () => {
    const s = scheduledFixture(); const a = assemblyRuntimeFixture(); const port = createScheduledWorkPackagePort();
    const second = clone(s.manifest) as any; second.schedule.at = '2027-01-02T00:00:00Z';
    const secondBytes = value(canonical(second)).bytes; const input = clone(s.package) as any;
    input.entrypoints.splice(1, 0, { id: 'second-manifest', path: 'scheduled/second.json', digest: hashBytes(secondBytes) });
    const pkg = value(a.runtime.record('LocalCapabilityPackage', value(decodeLocalCapabilityPackage(input, a.c))));
    value(a.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'), id: 'transition:two-manifests:active',
      package: pkg.namespace, manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
    expect(status(port.admitPackageResource({ package: pkg, manifestPath: 'scheduled/manifest.json',
      manifestBytes: s.manifestBytes, existingManifests: [] }, a.c))).toBe('refused');
    expect(status(port.admitPackageResource({ package: pkg, manifestPath: 'scheduled/second.json',
      manifestBytes: secondBytes, existingManifests: [] }, a.c))).toBe('refused');
  });
});
