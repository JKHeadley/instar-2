import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { decodeLocalCapabilityPackage, resolveActivePackage } from '../../src/assembly/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { activeScheduledFixture, clone, scheduledFixture, value } from '../scheduled/fixture.js';

const status = <T>(result: import('../../src/index.js').Result<T>) => consumeResult(result, {
  Success: () => 'accepted' as const, Refused: () => 'refused' as const,
});

describe('Part Fifteen round-five owner-port integration', () => {
  it('P15-NF-08 P15-NF-17 P15-NF-19 preserves ambiguity from a potentially competing Part Ten namespace', () => {
    const f = activeScheduledFixture(); const port = createScheduledWorkPackagePort();
    const input = clone(f.package) as any;
    Object.assign(input, { id: 'package:competing', namespace: 'alice.competing', contentDigest: f.h('d') });
    const manifest = clone(f.manifest) as any;
    manifest.identity.contentDigest = f.h('d'); manifest.schedule.at = '2027-01-02T00:00:00Z';
    const bytes = value(canonical(manifest)).bytes; input.entrypoints[0].digest = hashBytes(bytes);
    const competing = value(f.assembly.runtime.record('LocalCapabilityPackage',
      value(decodeLocalCapabilityPackage(input, f.context))));
    for (const ordinal of [1, 2]) value(f.assembly.runtime.record('PackageTransition', {
      ...assemblyInput('PackageTransition'), id: `transition:competing:${ordinal}`,
      operation: `operation:competing:${ordinal}`, package: competing.namespace,
      manifestDigest: competing.contentDigest, observedArtifactDigest: competing.contentDigest,
    }));
    expect(status(resolveActivePackage(competing.namespace, [], f.context))).toBe('refused');
    expect(status(port.admitPackageResource({ package: f.package, manifestPath: 'scheduled/manifest.json',
      manifestBytes: f.manifestBytes, existingManifests: [] }, f.context))).toBe('refused');

    const clean = activeScheduledFixture();
    expect(status(port.admitPackageResource({ package: clean.package, manifestPath: 'scheduled/manifest.json',
      manifestBytes: clean.manifestBytes, existingManifests: [] }, clean.context))).toBe('accepted');
  });

  it('P15-NF-08 P15-NF-10 P15-NF-11 admits valid packages with independent declarations or support entry points', () => {
    const scheduled = scheduledFixture(); const port = createScheduledWorkPackagePort();
    for (const mode of ['ordinary', 'extra-entrypoint', 'extra-declaration'] as const) {
      const assembly = assemblyRuntimeFixture(); const input = clone(scheduled.package) as any;
      if (mode === 'extra-entrypoint') input.entrypoints.push({ id: 'support-library', path: 'dist/support.js', digest: scheduled.h('d') });
      if (mode === 'extra-declaration') input.declarationIds.push('capability:support');
      const pkg = value(assembly.runtime.record('LocalCapabilityPackage',
        value(decodeLocalCapabilityPackage(input, assembly.c))));
      value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
        id: `transition:${mode}`, operation: `operation:${mode}`, package: pkg.namespace,
        manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
      expect(status(resolveActivePackage(pkg.namespace, [], assembly.c))).toBe('accepted');
      expect(status(port.admitPackageResource({ package: pkg, manifestPath: 'scheduled/manifest.json',
        manifestBytes: scheduled.manifestBytes, existingManifests: [] }, assembly.c))).toBe('accepted');
    }
  });

  it('P15-NF-07 preserves byte-identical admission through memory and independently implemented file storage', () => {
    const directory = mkdtempSync(join(tmpdir(), 'p15-storage-replacement-')); const log = join(directory, 'facts.jsonl');
    const scheduled = scheduledFixture(); const port = createScheduledWorkPackagePort(); const admitted: string[] = [];
    try {
      for (const mode of ['memory', 'file'] as const) {
        if (mode === 'file') {
          const descriptor = openSync(log, 'w'); fsyncSync(descriptor); closeSync(descriptor);
        }
        const assembly = assemblyRuntimeFixture(mode === 'file' ? fixture => ({ owner: 'part-ten',
          read: () => readFileSync(log, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)),
          append: (bytes, expected) => {
            const rows = readFileSync(log, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
            if ((rows.at(-1)?.contentHash ?? null) !== expected) throw new Error('compare-head mismatch');
            const descriptor = openSync(log, 'a'); writeSync(descriptor, `${bytes}\n`); fsyncSync(descriptor); closeSync(descriptor);
            return fixture.success({ kind: 'local-durable' as const });
          },
        }) : undefined);
        const pkg = value(assembly.runtime.record('LocalCapabilityPackage', scheduled.package));
        value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
          id: 'transition:replacement', operation: 'operation:replacement', package: pkg.namespace,
          manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
        const manifest = value(port.admitPackageResource({ package: pkg, manifestPath: 'scheduled/manifest.json',
          manifestBytes: scheduled.manifestBytes, existingManifests: [] }, assembly.c));
        admitted.push(value(canonical(manifest)).bytes);
      }
      expect(admitted[1]).toBe(admitted[0]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
