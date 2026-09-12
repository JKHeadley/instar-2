import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScheduledWorkPackagePort, importLegacyScheduledJob } from '../src/scheduled/index.ts';
import { canonical, consumeResult } from '../src/index.ts';
import { decodeLocalCapabilityPackage, resolveActivePackage } from '../src/assembly/index.ts';
import { hashBytes } from '../src/facts/index.ts';
import { assemblyRuntimeFixture } from '../tests/assembly/runtime-fixture.ts';
import { assemblyInput } from '../tests/assembly/fixture.ts';
import { activeScheduledFixture, clone, packageArchive, scheduledFixture, value } from '../tests/scheduled/fixture.ts';

const [directory, mode, kind] = process.argv.slice(2); const durable = join(directory, 'scheduled-package-cut.json');
if (mode === 'seed-cut') {
  const f = activeScheduledFixture(); const port = createScheduledWorkPackagePort();
  const admitted = value(port.admitPackageResource({ package: f.package, archive: f.archive, manifestPath: 'scheduled/manifest.json',
    manifestBytes: f.manifestBytes, existingManifests: [] }, f.context));
  const before = value(port.planOccurrence({ manifest: admitted, namespaceVersion: 'scheduled:v1', installationId: 'install:a',
    scheduledInstant: '2027-01-01T00:00:00Z', asOf: f.core.clock(Date.UTC(2027, 0, 1, 0, 5)) }, f.context));
  const bytes = JSON.stringify({ tail: f.assembly.raw.slice(f.baselineLength), package: f.package,
    archive: f.archive, manifestBytes: f.manifestBytes, before });
  const descriptor = openSync(durable, 'w'); writeSync(descriptor, bytes); fsyncSync(descriptor); closeSync(descriptor);
  process.kill(process.pid, 'SIGKILL');
}
if (mode === 'recover') {
  const persisted = JSON.parse(readFileSync(durable, 'utf8')); const s = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  assembly.raw.push(...persisted.tail); const port = createScheduledWorkPackagePort();
  const context = { ...assembly.c, register: { ...assembly.c.register,
    entries: [...new Set([...assembly.c.register.entries, ...s.context.register.entries])] } };
  const admitted = value(port.admitPackageResource({ package: persisted.package, archive: persisted.archive,
    manifestPath: 'scheduled/manifest.json',
    manifestBytes: persisted.manifestBytes, existingManifests: [] }, context));
  const replay = value(port.planOccurrence({ manifest: admitted, namespaceVersion: 'scheduled:v1', installationId: 'install:a',
    scheduledInstant: '2027-01-01T00:00:00Z', asOf: s.core.clock(Date.UTC(2027, 0, 1, 0, 5)) }, context));
  process.stdout.write(JSON.stringify({ replay, before: persisted.before }));
}
if (mode === 'legacy-seed-cut') {
  const sourceBytes = readFileSync('tests/scheduled/fixtures/legacy-health-check.json', 'utf8');
  const descriptor = openSync(durable, 'w'); writeSync(descriptor, sourceBytes); fsyncSync(descriptor); closeSync(descriptor);
  process.kill(process.pid, 'SIGKILL');
}
if (mode === 'legacy-learning-seed-cut') {
  const source = JSON.parse(readFileSync('tests/scheduled/fixtures/legacy-health-check.json', 'utf8'));
  source.execute = { type: 'prompt', value: 'Observe' };
  source.livingSkills = { enabled: true };
  source.integrationGate = true;
  const descriptor = openSync(durable, 'w'); writeSync(descriptor, JSON.stringify(source)); fsyncSync(descriptor); closeSync(descriptor);
  process.kill(process.pid, 'SIGKILL');
}
if (mode === 'owner-seed-cut') {
  const s = scheduledFixture(); const raw = []; const log = join(directory, 'facts.jsonl'); const descriptor = openSync(log, 'w');
  const assembly = assemblyRuntimeFixture(core => ({ owner: 'part-ten', read: () => raw, append: (bytes, expected) => {
    if ((raw.at(-1)?.contentHash ?? null) !== expected) throw new Error('head mismatch');
    const fact = JSON.parse(bytes); writeSync(descriptor, `${bytes}\n`); fsyncSync(descriptor); raw.push(fact);
    if (fact.body?.record?.type === kind) process.kill(process.pid, 'SIGKILL');
    return core.success({ kind: 'local-durable' });
  } }));
  const recorded = value(assembly.runtime.record('LocalCapabilityPackage', s.package));
  value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: 'transition:scheduled:active', package: recorded.namespace, manifestDigest: recorded.contentDigest,
    observedArtifactDigest: recorded.contentDigest }));
  closeSync(descriptor); process.exit(2);
}
if (mode === 'owner-recover') {
  const s = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  const raw = readFileSync(join(directory, 'facts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  if (kind === 'tampered') raw.at(-1).body.record.to = 'retired';
  if (kind === 'missing-prefix') raw.shift();
  assembly.raw.splice(0, assembly.raw.length, ...raw);
  const context = { ...assembly.c, register: { ...assembly.c.register,
    entries: [...new Set([...assembly.c.register.entries, ...s.context.register.entries])] } };
  const result = consumeResult(createScheduledWorkPackagePort().admitPackageResource({ package: s.package, archive: s.archive,
    manifestPath: 'scheduled/manifest.json', manifestBytes: s.manifestBytes, existingManifests: [] }, context), {
    Success: admitted => ({ status: 'accepted', jobId: admitted.identity.jobId }),
    Refused: refusal => ({ status: 'refused', detail: refusal.detail }),
  });
  process.stdout.write(JSON.stringify({ ...result, records: raw.length }));
}
if (mode === 'owner-cuts') {
  const rows = []; const script = fileURLToPath(import.meta.url);
  for (const cutKind of ['LocalCapabilityPackage', 'PackageTransition']) {
    const cutDirectory = join(directory, `cut-${cutKind}`); mkdirSync(cutDirectory, { recursive: true });
    const run = (runMode, runKind) => spawnSync(process.execPath,
      ['--loader', './scripts/slice-ts-loader.mjs', script, cutDirectory, runMode, runKind],
      { encoding: 'utf8', timeout: 30_000 });
    const seed = run('owner-seed-cut', cutKind); const recovered = run('owner-recover', cutKind);
    rows.push({ kind: cutKind, seedSignal: seed.signal, recoveryExit: recovered.status, ...JSON.parse(recovered.stdout) });
    if (cutKind === 'PackageTransition') for (const corruption of ['tampered', 'missing-prefix']) {
      const checked = run('owner-recover', corruption);
      rows.push({ kind: corruption, recoveryExit: checked.status, ...JSON.parse(checked.stdout) });
    }
  }
  process.stdout.write(JSON.stringify(rows));
}
if (mode === 'round4-conflicts-seed-cut') {
  const active = activeScheduledFixture(); const current = value(active.assembly.runtime.inspectCurrent());
  const firstTransition = current.find(row => row.record.id === 'transition:scheduled:active');
  const crossManifest = clone(active.manifest);
  crossManifest.identity.contentDigest = active.h('d'); crossManifest.schedule.at = '2027-01-02T00:00:00Z';
  const crossBytes = value(canonical(crossManifest)).bytes;
  const crossInput = clone(active.package);
  Object.assign(crossInput, { id: 'package:cross', namespace: 'alice.cross', contentDigest: active.h('d') });
  crossInput.entrypoints[0].digest = hashBytes(crossBytes);
  const crossPackage = value(active.assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(crossInput, active.context))));
  value(active.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: 'transition:cross:active', dependencyFacts: [firstTransition.fact.id], package: crossPackage.namespace,
    manifestDigest: crossPackage.contentDigest, observedArtifactDigest: crossPackage.contentDigest }));

  const sameManifest = clone(active.manifest);
  Object.assign(sameManifest.identity, { jobId: 'job:same', contentDigest: active.h('e') });
  const sameSecond = clone(sameManifest); sameSecond.schedule.at = '2027-01-03T00:00:00Z';
  const sameBytes = value(canonical(sameManifest)).bytes, sameSecondBytes = value(canonical(sameSecond)).bytes;
  const sameInput = clone(active.package);
  Object.assign(sameInput, { id: 'package:same', namespace: 'alice.same', contentDigest: active.h('e'),
    declarationIds: ['job:same'] });
  sameInput.entrypoints[0].digest = hashBytes(sameBytes);
  sameInput.entrypoints.splice(1, 0, { id: 'second-manifest', path: 'scheduled/second.json', digest: hashBytes(sameSecondBytes) });
  const samePackage = value(active.assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(sameInput, active.context))));
  value(active.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: 'transition:same:active', package: samePackage.namespace,
    manifestDigest: samePackage.contentDigest, observedArtifactDigest: samePackage.contentDigest }));
  const payload = { tail: active.assembly.raw.slice(active.baselineLength), package: active.package,
    archive: active.archive, manifestBytes: active.manifestBytes, crossPackage, crossBytes,
    crossArchive: packageArchive(crossPackage, { 'scheduled/manifest.json': crossBytes,
      'dist/maintenance.js': active.bodyBytes }), samePackage, sameBytes, sameSecondBytes,
    sameArchive: packageArchive(samePackage, { 'scheduled/manifest.json': sameBytes,
      'scheduled/second.json': sameSecondBytes, 'dist/maintenance.js': active.bodyBytes }) };
  const descriptor = openSync(durable, 'w'); writeSync(descriptor, JSON.stringify(payload)); fsyncSync(descriptor); closeSync(descriptor);
  process.kill(process.pid, 'SIGKILL');
}
if (mode === 'round4-conflicts-recover') {
  const persisted = JSON.parse(readFileSync(durable, 'utf8')); const s = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  assembly.raw.push(...persisted.tail); const port = createScheduledWorkPackagePort();
  const context = { ...assembly.c, register: { ...assembly.c.register,
    entries: [...new Set([...assembly.c.register.entries, ...s.context.register.entries])] } };
  const admit = (pkg, archive, path, bytes) => consumeResult(port.admitPackageResource({ package: pkg, archive, manifestPath: path,
    manifestBytes: bytes, existingManifests: [] }, context), { Success: () => 'accepted', Refused: () => 'refused' });
  process.stdout.write(JSON.stringify({ cross: [admit(persisted.package, persisted.archive, 'scheduled/manifest.json', persisted.manifestBytes),
    admit(persisted.crossPackage, persisted.crossArchive, 'scheduled/manifest.json', persisted.crossBytes)],
  same: [admit(persisted.samePackage, persisted.sameArchive, 'scheduled/manifest.json', persisted.sameBytes),
    admit(persisted.samePackage, persisted.sameArchive, 'scheduled/second.json', persisted.sameSecondBytes)] }));
}
if (mode === 'round5-validation-seed-cut') {
  const ambiguous = activeScheduledFixture();
  const competingInput = clone(ambiguous.package);
  Object.assign(competingInput, { id: 'package:competing', namespace: 'alice.competing', contentDigest: ambiguous.h('d') });
  const competingManifest = clone(ambiguous.manifest);
  competingManifest.identity.contentDigest = ambiguous.h('d'); competingManifest.schedule.at = '2027-01-02T00:00:00Z';
  const competingBytes = value(canonical(competingManifest)).bytes;
  competingInput.entrypoints[0].digest = hashBytes(competingBytes);
  const competingPackage = value(ambiguous.assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(competingInput, ambiguous.context))));
  for (const ordinal of [1, 2]) value(ambiguous.assembly.runtime.record('PackageTransition', {
    ...assemblyInput('PackageTransition'), id: `transition:competing:${ordinal}`,
    operation: `operation:competing:${ordinal}`, package: competingPackage.namespace,
    manifestDigest: competingPackage.contentDigest, observedArtifactDigest: competingPackage.contentDigest,
  }));

  const scheduled = scheduledFixture(); const extraAssembly = assemblyRuntimeFixture(); const extraBaselineLength = extraAssembly.raw.length;
  const extraInput = clone(scheduled.package);
  const supportBytes = 'export const support = true;\n';
  extraInput.entrypoints.push({ id: 'support-library', path: 'dist/support.js', digest: hashBytes(supportBytes) });
  extraInput.declarationIds.push('capability:support');
  const extraPackage = value(extraAssembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(extraInput, extraAssembly.c))));
  value(extraAssembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: 'transition:extra:active', operation: 'operation:extra:active', package: extraPackage.namespace,
    manifestDigest: extraPackage.contentDigest, observedArtifactDigest: extraPackage.contentDigest }));
  const payload = { ambiguousTail: ambiguous.assembly.raw.slice(ambiguous.baselineLength), package: ambiguous.package,
    archive: ambiguous.archive, manifestBytes: ambiguous.manifestBytes, extraTail: extraAssembly.raw.slice(extraBaselineLength),
    extraPackage, extraArchive: packageArchive(extraPackage, { 'scheduled/manifest.json': scheduled.manifestBytes,
      'dist/maintenance.js': scheduled.bodyBytes, 'dist/support.js': supportBytes }),
    extraManifestBytes: scheduled.manifestBytes };
  const descriptor = openSync(durable, 'w'); writeSync(descriptor, JSON.stringify(payload)); fsyncSync(descriptor); closeSync(descriptor);
  process.kill(process.pid, 'SIGKILL');
}
if (mode === 'round5-validation-recover') {
  const persisted = JSON.parse(readFileSync(durable, 'utf8')); const scheduled = scheduledFixture();
  const recover = (tail, pkg, archive, manifestBytes) => {
    const assembly = assemblyRuntimeFixture(); assembly.raw.push(...tail);
    const context = { ...assembly.c, register: { ...assembly.c.register,
      entries: [...new Set([...assembly.c.register.entries, ...scheduled.context.register.entries])] } };
    return consumeResult(createScheduledWorkPackagePort().admitPackageResource({ package: pkg, archive,
      manifestPath: 'scheduled/manifest.json', manifestBytes, existingManifests: [] }, context),
    { Success: () => 'accepted', Refused: () => 'refused' });
  };
  process.stdout.write(JSON.stringify({
    ambiguous: recover(persisted.ambiguousTail, persisted.package, persisted.archive, persisted.manifestBytes),
    additionalContent: recover(persisted.extraTail, persisted.extraPackage, persisted.extraArchive, persisted.extraManifestBytes),
  }));
}
if (mode === 'round6-validation-seed-cut') {
  const retired = activeScheduledFixture();
  const competingInput = clone(retired.package);
  Object.assign(competingInput, { id: 'package:round6-competitor', namespace: 'alice.round6-competitor', contentDigest: retired.h('d') });
  const competitor = value(retired.assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(competingInput, retired.context))));
  value(retired.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: 'transition:round6-competitor:active', operation: 'operation:round6-competitor:active',
    package: competitor.namespace, manifestDigest: competitor.contentDigest, observedArtifactDigest: competitor.contentDigest }));
  const activeHead = value(retired.assembly.runtime.inspectCurrent())
    .find(row => row.record.id === 'transition:round6-competitor:active');
  value(retired.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: 'transition:round6-competitor:retired', operation: 'operation:round6-competitor:retired',
    predecessors: [activeHead.fact.id], package: competitor.namespace, manifestDigest: competitor.contentDigest,
    observedArtifactDigest: competitor.contentDigest, from: 'active', to: 'retired' }));

  const scheduled = scheduledFixture(); const resources = assemblyRuntimeFixture();
  const resourceInput = clone(scheduled.package);
  resourceInput.entrypoints.push({ id: 'support-data', path: 'scheduled/support.json', digest: hashBytes('{"threshold":3}') });
  const resourcePackage = value(resources.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(resourceInput, resources.c))));
  value(resources.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: 'transition:round6-resources', operation: 'operation:round6-resources', package: resourcePackage.namespace,
    manifestDigest: resourcePackage.contentDigest, observedArtifactDigest: resourcePackage.contentDigest }));

  const doubled = assemblyRuntimeFixture(); const doubledInput = clone(scheduled.package);
  const secondManifest = clone(scheduled.manifest); secondManifest.schedule.at = '2027-01-02T00:00:00Z';
  const secondBytes = value(canonical(secondManifest)).bytes;
  doubledInput.entrypoints.push({ id: 'another-manifest', path: 'data/second.json', digest: hashBytes(secondBytes) });
  const doubledPackage = value(doubled.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(doubledInput, doubled.c))));
  value(doubled.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: 'transition:round6-doubled', operation: 'operation:round6-doubled', package: doubledPackage.namespace,
    manifestDigest: doubledPackage.contentDigest, observedArtifactDigest: doubledPackage.contentDigest }));

  const payload = { retired: { raw: retired.assembly.raw, package: retired.package,
      archive: retired.archive, bytes: retired.manifestBytes },
    support: { raw: resources.raw, package: resourcePackage,
      archive: packageArchive(resourcePackage, { 'scheduled/manifest.json': scheduled.manifestBytes,
        'dist/maintenance.js': scheduled.bodyBytes, 'scheduled/support.json': '{"threshold":3}' }),
      bytes: scheduled.manifestBytes },
    doubled: { raw: doubled.raw, package: doubledPackage,
      archive: packageArchive(doubledPackage, { 'scheduled/manifest.json': scheduled.manifestBytes,
        'dist/maintenance.js': scheduled.bodyBytes, 'data/second.json': secondBytes }),
      firstBytes: scheduled.manifestBytes, secondBytes } };
  const descriptor = openSync(durable, 'w'); writeSync(descriptor, JSON.stringify(payload)); fsyncSync(descriptor); closeSync(descriptor);
  process.kill(process.pid, 'SIGKILL');
}
if (mode === 'round6-validation-recover') {
  const persisted = JSON.parse(readFileSync(durable, 'utf8')); const port = createScheduledWorkPackagePort();
  const recover = data => {
    const assembly = assemblyRuntimeFixture(); assembly.raw.splice(0, assembly.raw.length, ...data.raw);
    const admit = (path, bytes) => consumeResult(port.admitPackageResource({ package: data.package, archive: data.archive,
      manifestPath: path, manifestBytes: bytes, existingManifests: [] }, assembly.c),
    { Success: () => 'accepted', Refused: () => 'refused' });
    return data.secondBytes
      ? [admit('scheduled/manifest.json', data.firstBytes), admit('data/second.json', data.secondBytes)]
      : admit('scheduled/manifest.json', data.bytes);
  };
  process.stdout.write(JSON.stringify({ retired: recover(persisted.retired), support: recover(persisted.support),
    doubled: recover(persisted.doubled) }));
}
if (mode === 'round7-validation-seed-cut') {
  const resourceCases = {};
  for (const resourceKind of ['manifest', 'job-definition', 'schedule-resource', 'support', 'hidden-second']) {
    const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture(); const input = clone(scheduled.package);
    const resources = { 'scheduled/manifest.json': scheduled.manifestBytes,
      'dist/maintenance.js': scheduled.bodyBytes };
    if (resourceKind === 'job-definition' || resourceKind === 'schedule-resource') input.entrypoints[0].id = resourceKind;
    if (resourceKind === 'support') {
      resources['data/dependencies.json'] = '{"dependencies":[]}';
      input.entrypoints.push({ id: 'dependency-manifest', path: 'data/dependencies.json',
        digest: hashBytes(resources['data/dependencies.json']) });
    }
    if (resourceKind === 'hidden-second') {
      const second = clone(scheduled.manifest); second.schedule.at = '2027-01-02T00:00:00Z';
      resources['data/second.json'] = value(canonical(second)).bytes;
      input.entrypoints.push({ id: 'job-definition-2', path: 'data/second.json',
        digest: hashBytes(resources['data/second.json']) });
    }
    const pkg = value(assembly.runtime.record('LocalCapabilityPackage', value(decodeLocalCapabilityPackage(input, assembly.c))));
    value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
      id: `transition:round7:${resourceKind}`, operation: `operation:round7:${resourceKind}`,
      package: pkg.namespace, manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
    resourceCases[resourceKind] = { raw: assembly.raw, package: pkg,
      archive: packageArchive(pkg, resources), bytes: scheduled.manifestBytes };
  }
  const activityCases = {};
  for (const state of ['recorded', 'staged', 'active', 'retired', 'inhibited']) {
    const active = activeScheduledFixture(); const input = clone(active.package);
    Object.assign(input, { id: `package:round7-competitor:${state}`,
      namespace: `alice.round7-competitor-${state}`, contentDigest: active.h('d') });
    const competing = value(active.assembly.runtime.record('LocalCapabilityPackage',
      value(decodeLocalCapabilityPackage(input, active.context))));
    if (state !== 'recorded') {
      const first = value(active.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
        id: `transition:round7-competitor:${state}:first`, operation: `operation:round7-competitor:${state}:first`,
        package: competing.namespace, manifestDigest: competing.contentDigest,
        observedArtifactDigest: competing.contentDigest,
        ...(state === 'staged' ? { from: 'none', to: 'staged' } : {}) }));
      if (state === 'retired' || state === 'inhibited') {
        const firstRow = value(active.assembly.runtime.inspectCurrent()).find(row => row.record.id === first.id);
        value(active.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
          id: `transition:round7-competitor:${state}:terminal`, operation: `operation:round7-competitor:${state}:terminal`,
          predecessors: [firstRow.fact.id], package: competing.namespace,
          manifestDigest: competing.contentDigest, observedArtifactDigest: competing.contentDigest,
          from: 'active', to: state }));
      }
    }
    activityCases[state] = { raw: active.assembly.raw, package: active.package,
      archive: active.archive, bytes: active.manifestBytes };
  }
  const descriptor = openSync(durable, 'w'); writeSync(descriptor, JSON.stringify({ resourceCases, activityCases }));
  fsyncSync(descriptor); closeSync(descriptor); process.kill(process.pid, 'SIGKILL');
}
if (mode === 'round7-validation-recover') {
  const persisted = JSON.parse(readFileSync(durable, 'utf8')); const port = createScheduledWorkPackagePort();
  const recover = data => {
    const assembly = assemblyRuntimeFixture(); assembly.raw.splice(0, assembly.raw.length, ...data.raw);
    return consumeResult(port.admitPackageResource({ package: data.package, archive: data.archive,
      manifestPath: 'scheduled/manifest.json',
      manifestBytes: data.bytes, existingManifests: [] }, assembly.c), {
      Success: () => ({ status: 'accepted' }),
      Refused: refusal => ({ status: 'refused', detail: refusal.detail }),
    });
  };
  process.stdout.write(JSON.stringify({
    resources: Object.fromEntries(Object.entries(persisted.resourceCases).map(([key, data]) => [key, recover(data)])),
    activity: Object.fromEntries(Object.entries(persisted.activityCases).map(([key, data]) => [key, recover(data)])),
  }));
}
if (mode === 'round8-validation-seed-cut') {
  const dependencyCases = {};
  for (const dependencyKind of ['none', 'missing', 'matching', 'wrong-digest', 'self']) {
    const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
    const input = clone(scheduled.package);
    if (dependencyKind !== 'none') input.dependencies = [{
      package: dependencyKind === 'self' ? input.namespace : 'alice.support-package',
      digest: dependencyKind === 'self' ? input.contentDigest : scheduled.h('d'), contract: 'support:v1',
    }];
    if (dependencyKind === 'matching' || dependencyKind === 'wrong-digest') {
      const dependency = clone(scheduled.package);
      Object.assign(dependency, { id: `package:support:${dependencyKind}`, namespace: 'alice.support-package',
        contentDigest: dependencyKind === 'matching' ? scheduled.h('d') : scheduled.h('e'), dependencies: [],
        declarationIds: ['capability:support'] });
      const recordedDependency = value(assembly.runtime.record('LocalCapabilityPackage',
        value(decodeLocalCapabilityPackage(dependency, assembly.c))));
      value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
        id: `transition:support:${dependencyKind}`, operation: `operation:support:${dependencyKind}`,
        package: recordedDependency.namespace, manifestDigest: recordedDependency.contentDigest,
        observedArtifactDigest: recordedDependency.contentDigest }));
    }
    const pkg = value(assembly.runtime.record('LocalCapabilityPackage',
      value(decodeLocalCapabilityPackage(input, assembly.c))));
    value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
      id: `transition:round8:${dependencyKind}`, operation: `operation:round8:${dependencyKind}`,
      package: pkg.namespace, manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
    dependencyCases[dependencyKind] = { raw: assembly.raw, package: pkg,
      archive: packageArchive(pkg, { 'scheduled/manifest.json': scheduled.manifestBytes,
        'dist/maintenance.js': scheduled.bodyBytes }), bytes: scheduled.manifestBytes };
  }
  const resourceCases = {};
  for (const resourceKind of ['support', 'second-manifest', 'missing-bytes', 'changed-bytes']) {
    const scheduled = scheduledFixture(); const assembly = assemblyRuntimeFixture();
    const input = clone(scheduled.package); const second = clone(scheduled.manifest);
    second.schedule.at = '2027-01-02T00:00:00Z';
    const extraBytes = resourceKind === 'second-manifest' ? value(canonical(second)).bytes : '{"dependencies":[]}';
    input.entrypoints.push({ id: 'arbitrary-resource', path: 'data/extra.json', digest: hashBytes(extraBytes) });
    const pkg = value(assembly.runtime.record('LocalCapabilityPackage',
      value(decodeLocalCapabilityPackage(input, assembly.c))));
    value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
      id: `transition:round8:resource:${resourceKind}`, operation: `operation:round8:resource:${resourceKind}`,
      package: pkg.namespace, manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
    const archive = [...packageArchive(pkg, { 'scheduled/manifest.json': scheduled.manifestBytes,
      'dist/maintenance.js': scheduled.bodyBytes, 'data/extra.json': extraBytes })];
    if (resourceKind === 'missing-bytes') archive.pop();
    if (resourceKind === 'changed-bytes') archive[2] = { ...archive[2], bytes: `${archive[2].bytes} ` };
    resourceCases[resourceKind] = { raw: assembly.raw, package: pkg, archive, bytes: scheduled.manifestBytes };
  }
  const activityCases = {};
  for (const state of ['recorded', 'staged', 'active', 'retired', 'inhibited']) {
    const active = activeScheduledFixture(); const input = clone(active.package);
    Object.assign(input, { id: `package:round8-competitor:${state}`,
      namespace: `alice.round8-competitor-${state}`, contentDigest: active.h('d') });
    const competing = value(active.assembly.runtime.record('LocalCapabilityPackage',
      value(decodeLocalCapabilityPackage(input, active.context))));
    if (state !== 'recorded') {
      const first = value(active.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
        id: `transition:round8-competitor:${state}:first`, operation: `operation:round8-competitor:${state}:first`,
        package: competing.namespace, manifestDigest: competing.contentDigest,
        observedArtifactDigest: competing.contentDigest,
        ...(state === 'staged' ? { from: 'none', to: 'staged' } : {}) }));
      if (state === 'retired' || state === 'inhibited') {
        const firstRow = value(active.assembly.runtime.inspectCurrent()).find(row => row.record.id === first.id);
        value(active.assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
          id: `transition:round8-competitor:${state}:terminal`, operation: `operation:round8-competitor:${state}:terminal`,
          predecessors: [firstRow.fact.id], package: competing.namespace,
          manifestDigest: competing.contentDigest, observedArtifactDigest: competing.contentDigest,
          from: 'active', to: state }));
      }
    }
    activityCases[state] = { raw: active.assembly.raw, package: active.package,
      archive: active.archive, bytes: active.manifestBytes };
  }
  const descriptor = openSync(durable, 'w');
  writeSync(descriptor, JSON.stringify({ dependencyCases, resourceCases, activityCases }));
  fsyncSync(descriptor); closeSync(descriptor); process.kill(process.pid, 'SIGKILL');
}
if (mode === 'round8-validation-recover') {
  const persisted = JSON.parse(readFileSync(durable, 'utf8')); const port = createScheduledWorkPackagePort();
  const recover = data => {
    const assembly = assemblyRuntimeFixture(); assembly.raw.splice(0, assembly.raw.length, ...data.raw);
    return consumeResult(port.admitPackageResource({ package: data.package, archive: data.archive,
      manifestPath: 'scheduled/manifest.json', manifestBytes: data.bytes, existingManifests: [] }, assembly.c), {
      Success: () => 'accepted', Refused: () => 'refused',
    });
  };
  process.stdout.write(JSON.stringify({
    dependencies: Object.fromEntries(Object.entries(persisted.dependencyCases).map(([key, data]) => [key, recover(data)])),
    resources: Object.fromEntries(Object.entries(persisted.resourceCases).map(([key, data]) => [key, recover(data)])),
    activity: Object.fromEntries(Object.entries(persisted.activityCases).map(([key, data]) => [key, recover(data)])),
  }));
}
if (mode === 'round9-validation-seed-cut') {
  mkdirSync(directory, { recursive: true });
  const scheduled = scheduledFixture(); const raw = []; const factsPath = join(directory, 'facts.jsonl');
  const facts = openSync(factsPath, 'w');
  const assembly = assemblyRuntimeFixture(core => ({ owner: 'part-ten', read: () => raw,
    append(bytes, expected) {
      if ((raw.at(-1)?.contentHash ?? null) !== expected) throw new Error('head mismatch');
      writeSync(facts, `${bytes}\n`); fsyncSync(facts); raw.push(JSON.parse(bytes));
      return core.success({ kind: 'local-durable' });
    } }));
  const input = clone(scheduled.package); const resources = {
    'scheduled/manifest.json': scheduled.manifestBytes, 'dist/maintenance.js': scheduled.bodyBytes,
  };
  if (['support', 'normal-second', 'repeated-type', 'repeated-type-overridden', 'repeated-display-name', 'repeated-at'].includes(kind)) {
    const second = clone(scheduled.manifest); second.schedule.at = '2027-01-02T00:00:00Z';
    let extra = value(canonical(second)).bytes;
    if (kind === 'support') extra = '{"dependencies":[]}';
    if (kind === 'repeated-type') extra = extra.replace('"type":"ScheduledWorkManifest"',
      '"type":"ScheduledWorkManifest","type":"ScheduledWorkManifest"');
    if (kind === 'repeated-type-overridden') extra = extra.replace('"type":"ScheduledWorkManifest"',
      '"type":"ScheduledWorkManifest","type":"support"');
    if (kind === 'repeated-display-name') extra = extra.replace('"displayName":"Maintenance"',
      '"displayName":"Old","displayName":"Maintenance"');
    if (kind === 'repeated-at') extra = extra.replace('"at":"2027-01-02T00:00:00Z"',
      '"at":"2027-01-03T00:00:00Z","at":"2027-01-02T00:00:00Z"');
    resources['data/extra.json'] = extra;
    input.entrypoints.push({ id: 'unrecognized-resource', path: 'data/extra.json', digest: hashBytes(extra) });
  }
  const pkg = value(assembly.runtime.record('LocalCapabilityPackage', value(decodeLocalCapabilityPackage(input, assembly.c))));
  value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
    id: `transition:round9:${kind}`, operation: `operation:round9:${kind}`, package: pkg.namespace,
    manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest }));
  const admission = { package: pkg, archive: packageArchive(pkg, resources), manifestPath: 'scheduled/manifest.json',
    manifestBytes: scheduled.manifestBytes, existingManifests: [] };
  const original = assembly.c.history; let reads = 0;
  const context = { ...assembly.c, history: { ...original, current() {
    reads++;
    if (kind.startsWith('retire-read-') && reads === Number(kind.slice('retire-read-'.length))) {
      const head = value(assembly.runtime.inspectCurrent()).find(row => row.record.id === `transition:round9:${kind}`);
      value(assembly.runtime.record('PackageTransition', { ...assemblyInput('PackageTransition'),
        id: `transition:round9:${kind}:retired`, operation: `operation:round9:${kind}:retired`,
        predecessors: [head.fact.id], package: pkg.namespace, manifestDigest: pkg.contentDigest,
        observedArtifactDigest: pkg.contentDigest, from: 'active', to: 'retired' }));
    }
    return original.current();
  } } };
  const before = consumeResult(createScheduledWorkPackagePort().admitPackageResource(admission, context), {
    Success: () => ({ status: 'accepted' }), Refused: refusal => ({ status: 'refused', detail: refusal.detail }),
  });
  const inputs = openSync(join(directory, 'inputs.json'), 'w');
  writeSync(inputs, JSON.stringify({ admission, before, reads })); fsyncSync(inputs); closeSync(inputs); closeSync(facts);
  process.kill(process.pid, 'SIGKILL');
}
if (mode === 'round9-validation-recover') {
  const saved = JSON.parse(readFileSync(join(directory, 'inputs.json'), 'utf8'));
  const assembly = assemblyRuntimeFixture();
  assembly.raw.splice(0, assembly.raw.length, ...readFileSync(join(directory, 'facts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse));
  const decide = result => consumeResult(result, { Success: () => ({ status: 'accepted' }),
    Refused: refusal => ({ status: 'refused', detail: refusal.detail }) });
  const after = decide(createScheduledWorkPackagePort().admitPackageResource(saved.admission, assembly.c));
  const owner = decide(resolveActivePackage(saved.admission.package.namespace,
    value(assembly.runtime.inspectCurrent()), assembly.c));
  process.stdout.write(JSON.stringify({ before: saved.before, after, owner, reads: saved.reads,
    facts: assembly.raw.length }));
}
if (mode === 'legacy-recover') {
  const sourceBytes = readFileSync(durable, 'utf8'); const context = scheduledFixture().context;
  process.stdout.write(JSON.stringify(value(importLegacyScheduledJob(sourceBytes, context))));
}
if (mode === 'round10-validation-seed-cut') {
  mkdirSync(directory, { recursive: true });
  const decide = result => consumeResult(result, {
    Success: item => ({ status: 'accepted', ...(item.postCompletionLearning
      ? { learning: item.postCompletionLearning, activation: item.activation } : {}) }),
    Refused: refusal => ({ status: 'refused', detail: refusal.detail }),
  });
  if (kind.startsWith('legacy-')) {
    const source = JSON.parse(readFileSync('tests/scheduled/fixtures/legacy-health-check.json', 'utf8'));
    source.livingSkills = { enabled: true };
    const executionKind = kind === 'legacy-array-script' ? ['script']
      : kind === 'legacy-unknown' ? 'not-an-executor' : 'script';
    source.execute = { type: executionKind, value: 'registered-work' };
    const bytes = JSON.stringify(source);
    const sourceFile = openSync(join(directory, 'source.json'), 'w');
    writeSync(sourceFile, bytes); fsyncSync(sourceFile); closeSync(sourceFile);
    const beforeFile = openSync(join(directory, 'before.json'), 'w');
    writeSync(beforeFile, JSON.stringify(decide(importLegacyScheduledJob(bytes, scheduledFixture().context))));
    fsyncSync(beforeFile); closeSync(beforeFile); process.kill(process.pid, 'SIGKILL');
  }
  const [raceKind, cutText] = kind.split('-'); const cut = Number(cutText);
  const scheduled = scheduledFixture(); const raw = []; const facts = openSync(join(directory, 'facts.jsonl'), 'w');
  const assembly = assemblyRuntimeFixture(core => ({ owner: 'part-ten', read: () => raw,
    append(bytes, expected) {
      if ((raw.at(-1)?.contentHash ?? null) !== expected) throw new Error('head mismatch');
      writeSync(facts, `${bytes}\n`); fsyncSync(facts); raw.push(JSON.parse(bytes));
      return core.success({ kind: 'local-durable' });
    } }));
  const activate = (pkg, id, extra = {}) => value(assembly.runtime.record('PackageTransition', {
    ...assemblyInput('PackageTransition'), id, operation: `operation:${id}`, package: pkg.namespace,
    manifestDigest: pkg.contentDigest, observedArtifactDigest: pkg.contentDigest, ...extra }));
  let dependency; const selectedInput = clone(scheduled.package);
  if (raceKind === 'dependency') {
    const dependencyInput = clone(scheduled.package);
    Object.assign(dependencyInput, { id: 'package:round10:dependency', namespace: 'alice.round10-dependency',
      contentDigest: scheduled.h('d'), declarationIds: ['capability:dependency'] });
    dependency = value(assembly.runtime.record('LocalCapabilityPackage',
      value(decodeLocalCapabilityPackage(dependencyInput, assembly.c))));
    activate(dependency, 'transition:round10:dependency:active');
    selectedInput.dependencies = [{ package: dependency.namespace, digest: dependency.contentDigest,
      contract: 'support:v1' }];
  }
  const selected = value(assembly.runtime.record('LocalCapabilityPackage',
    value(decodeLocalCapabilityPackage(selectedInput, assembly.c))));
  activate(selected, 'transition:round10:selected:active');
  const original = assembly.c.history; let reads = 0; let changed = false;
  const change = () => {
    if (raceKind === 'collision') {
      const competitorInput = clone(scheduled.package);
      Object.assign(competitorInput, { id: 'package:round10:competitor', namespace: 'alice.round10-competitor',
        contentDigest: scheduled.h('d') });
      const competitor = value(assembly.runtime.record('LocalCapabilityPackage',
        value(decodeLocalCapabilityPackage(competitorInput, assembly.c))));
      activate(competitor, 'transition:round10:competitor:active');
    } else {
      const head = value(assembly.runtime.inspectCurrent())
        .find(row => row.record.id === 'transition:round10:dependency:active');
      activate(dependency, 'transition:round10:dependency:retired', { predecessors: [head.fact.id],
        from: 'active', to: 'retired' });
    }
    changed = true;
  };
  const context = { ...assembly.c, history: { ...original, current() {
    reads++; if (reads === cut) change(); return original.current();
  } } };
  const archive = packageArchive(selected, { 'scheduled/manifest.json': scheduled.manifestBytes,
    'dist/maintenance.js': scheduled.bodyBytes });
  const request = { package: selected, archive, manifestPath: 'scheduled/manifest.json',
    manifestBytes: scheduled.manifestBytes, existingManifests: [] };
  const before = decide(createScheduledWorkPackagePort().admitPackageResource(request, context));
  const inputFile = openSync(join(directory, 'inputs.json'), 'w');
  writeSync(inputFile, JSON.stringify({ request, before, reads, changed })); fsyncSync(inputFile); closeSync(inputFile);
  closeSync(facts); process.kill(process.pid, 'SIGKILL');
}
if (mode === 'round10-validation-recover') {
  const decide = result => consumeResult(result, {
    Success: item => ({ status: 'accepted', ...(item.postCompletionLearning
      ? { learning: item.postCompletionLearning, activation: item.activation } : {}) }),
    Refused: refusal => ({ status: 'refused', detail: refusal.detail }),
  });
  if (kind.startsWith('legacy-')) {
    const bytes = readFileSync(join(directory, 'source.json'), 'utf8');
    process.stdout.write(JSON.stringify({ before: JSON.parse(readFileSync(join(directory, 'before.json'), 'utf8')),
      after: decide(importLegacyScheduledJob(bytes, scheduledFixture().context)) }));
  } else {
    const saved = JSON.parse(readFileSync(join(directory, 'inputs.json'), 'utf8'));
    const assembly = assemblyRuntimeFixture();
    assembly.raw.splice(0, assembly.raw.length, ...readFileSync(join(directory, 'facts.jsonl'), 'utf8')
      .trim().split('\n').map(JSON.parse));
    process.stdout.write(JSON.stringify({ before: saved.before,
      after: decide(createScheduledWorkPackagePort().admitPackageResource(saved.request, assembly.c)),
      reads: saved.reads, changed: saved.changed, facts: assembly.raw.length }));
  }
}
