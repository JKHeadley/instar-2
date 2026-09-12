import { readFileSync } from 'node:fs';
import { consumeResult } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeLocalCapabilityPackage, resolveActivePackage } from '../../src/assembly/index.js';
import { createScheduledWorkPackagePort, importLegacyScheduledJob } from '../../src/scheduled/index.js';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { clone, packageArchive, scheduledFixture, value } from './fixture.js';

export type Round10Decision = Readonly<{ status: 'accepted' | 'refused'; detail?: string;
  learning?: 'off' | 'required'; activation?: 'eligible' | 'inhibited' }>;

function decision<T>(result: Result<T>): Round10Decision {
  return consumeResult<T, Round10Decision>(result, {
    Success: item => ({ status: 'accepted' as const,
      ...((item as { postCompletionLearning?: 'off' | 'required' }).postCompletionLearning
        ? { learning: (item as { postCompletionLearning: 'off' | 'required' }).postCompletionLearning,
          activation: (item as { activation: 'eligible' | 'inhibited' }).activation } : {}) }),
    Refused: refusal => ({ status: 'refused' as const, detail: refusal.detail }),
  });
}

function activate(runtime: ReturnType<typeof assemblyRuntimeFixture>['runtime'], pkg: ReturnType<typeof scheduledFixture>['package'], id: string) {
  return value(runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'), id,
    operation: `operation:${id}`, package: pkg.namespace, manifestDigest: pkg.contentDigest,
    observedArtifactDigest: pkg.contentDigest }));
}

function collisionRace(cut: number) {
  const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  const selected = value(assembly.runtime.record('LocalCapabilityPackage', scheduled.package));
  activate(assembly.runtime, selected, 'transition:round10:selected:active');
  const original = assembly.c.history!; let reads = 0; let changed = false;
  let competitor: typeof selected | undefined;
  const introduce = () => {
    const input = clone(scheduled.package);
    Object.assign(input, { id: 'package:round10:competitor', namespace: 'alice.round10-competitor',
      contentDigest: scheduled.h('d') });
    competitor = value(assembly.runtime.record('LocalCapabilityPackage',
      value(decodeLocalCapabilityPackage(input, assembly.c))));
    activate(assembly.runtime, competitor, 'transition:round10:competitor:active'); changed = true;
  };
  const context = { ...assembly.c, history: { ...original, current() {
    reads++; if (reads === cut) introduce(); return original.current();
  } } };
  const input = { package: selected, archive: scheduled.archive, manifestPath: 'scheduled/manifest.json',
    manifestBytes: scheduled.manifestBytes, existingManifests: [] };
  return { cut, reads: () => reads, changed: () => changed,
    first: decision(createScheduledWorkPackagePort().admitPackageResource(input, context)),
    second: decision(createScheduledWorkPackagePort().admitPackageResource(input, assembly.c)),
    competitor: competitor ? decision(resolveActivePackage(competitor.namespace,
      value(assembly.runtime.inspectCurrent()), assembly.c)) : undefined };
}

function dependencyRace(cut: number) {
  const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  const dependencyInput = clone(scheduled.package);
  Object.assign(dependencyInput, { id: 'package:round10:dependency', namespace: 'alice.round10-dependency',
    contentDigest: scheduled.h('d'), declarationIds: ['capability:dependency'] });
  const dependency = value(assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(dependencyInput, assembly.c))));
  activate(assembly.runtime, dependency, 'transition:round10:dependency:active');
  const selectedInput = clone(scheduled.package) as any;
  selectedInput.dependencies = [{ package: dependency.namespace, digest: dependency.contentDigest, contract: 'support:v1' }];
  const selected = value(assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(selectedInput, assembly.c))));
  activate(assembly.runtime, selected, 'transition:round10:dependent:active');
  const original = assembly.c.history!; let reads = 0; let changed = false;
  const retire = () => {
    const head = value(assembly.runtime.inspectCurrent())
      .find(row => row.record.id === 'transition:round10:dependency:active')!;
    value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
      id: 'transition:round10:dependency:retired', operation: 'operation:round10:dependency:retired',
      predecessors: [head.fact.id], package: dependency.namespace, manifestDigest: dependency.contentDigest,
      observedArtifactDigest: dependency.contentDigest, from: 'active', to: 'retired' })); changed = true;
  };
  const context = { ...assembly.c, history: { ...original, current() {
    reads++; if (reads === cut) retire(); return original.current();
  } } };
  const archive = packageArchive(selected, { 'scheduled/manifest.json': scheduled.manifestBytes,
    'dist/maintenance.js': scheduled.bodyBytes });
  const input = { package: selected, archive, manifestPath: 'scheduled/manifest.json',
    manifestBytes: scheduled.manifestBytes, existingManifests: [] };
  return { cut, reads: () => reads, changed: () => changed,
    first: decision(createScheduledWorkPackagePort().admitPackageResource(input, context)),
    second: decision(createScheduledWorkPackagePort().admitPackageResource(input, assembly.c)),
    dependency: decision(resolveActivePackage(dependency.namespace,
      value(assembly.runtime.inspectCurrent()), assembly.c)) };
}

function legacyKinds() {
  const context = scheduledFixture().context; const rows: Record<string, Round10Decision> = {};
  for (const file of ['legacy-health-check.json', 'legacy-benchmark-divergence-analysis.json']) {
    const source = JSON.parse(readFileSync(`tests/scheduled/fixtures/${file}`, 'utf8'));
    for (const kind of ['script', 'prompt', 'skill']) {
      const current = { ...source, execute: { type: kind, value: 'registered-work' } };
      rows[`${file}:string:${kind}`] = decision(importLegacyScheduledJob(JSON.stringify(current), context));
      rows[`${file}:array:${kind}`] = decision(importLegacyScheduledJob(JSON.stringify({ ...current,
        execute: { ...current.execute, type: [kind] } }), context));
    }
    rows[`${file}:unknown`] = decision(importLegacyScheduledJob(JSON.stringify({ ...source,
      execute: { type: 'not-an-executor', value: 'registered-work' } }), context));
  }
  const learning = JSON.parse(readFileSync('tests/scheduled/fixtures/legacy-health-check.json', 'utf8'));
  learning.livingSkills = { enabled: true };
  rows['learning:string-script'] = decision(importLegacyScheduledJob(JSON.stringify({ ...learning,
    execute: { type: 'script', value: 'registered-work' } }), context));
  rows['learning:array-script'] = decision(importLegacyScheduledJob(JSON.stringify({ ...learning,
    execute: { type: ['script'], value: 'registered-work' } }), context));
  return rows;
}

let cached: ReturnType<typeof buildP15Round10Proof> | undefined;

function buildP15Round10Proof() {
  const collisions = Object.fromEntries([1, 4, 99].map(cut => [cut, collisionRace(cut)]));
  const dependencies = Object.fromEntries([1, 3, 4, 5, 99].map(cut => [cut, dependencyRace(cut)]));
  return { collisions, dependencies, legacy: legacyKinds() };
}

export function exerciseP15Round10Proof() {
  return cached ??= buildP15Round10Proof();
}
