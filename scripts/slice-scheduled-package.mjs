import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScheduledWorkPackagePort, importLegacyScheduledJob } from '../src/scheduled/index.ts';
import { canonical, consumeResult } from '../src/index.ts';
import { decodeLocalCapabilityPackage } from '../src/assembly/index.ts';
import { hashBytes } from '../src/facts/index.ts';
import { assemblyRuntimeFixture } from '../tests/assembly/runtime-fixture.ts';
import { assemblyInput } from '../tests/assembly/fixture.ts';
import { activeScheduledFixture, clone, scheduledFixture, value } from '../tests/scheduled/fixture.ts';

const [directory, mode, kind] = process.argv.slice(2); const durable = join(directory, 'scheduled-package-cut.json');
if (mode === 'seed-cut') {
  const f = activeScheduledFixture(); const port = createScheduledWorkPackagePort();
  const admitted = value(port.admitPackageResource({ package: f.package, manifestPath: 'scheduled/manifest.json',
    manifestBytes: f.manifestBytes, existingManifests: [] }, f.context));
  const before = value(port.planOccurrence({ manifest: admitted, namespaceVersion: 'scheduled:v1', installationId: 'install:a',
    scheduledInstant: '2027-01-01T00:00:00Z', asOf: f.core.clock(Date.UTC(2027, 0, 1, 0, 5)) }, f.context));
  const bytes = JSON.stringify({ tail: f.assembly.raw.slice(f.baselineLength), package: f.package, manifestBytes: f.manifestBytes, before });
  const descriptor = openSync(durable, 'w'); writeSync(descriptor, bytes); fsyncSync(descriptor); closeSync(descriptor);
  process.kill(process.pid, 'SIGKILL');
}
if (mode === 'recover') {
  const persisted = JSON.parse(readFileSync(durable, 'utf8')); const s = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  assembly.raw.push(...persisted.tail); const port = createScheduledWorkPackagePort();
  const context = { ...assembly.c, register: { ...assembly.c.register,
    entries: [...new Set([...assembly.c.register.entries, ...s.context.register.entries])] } };
  const admitted = value(port.admitPackageResource({ package: persisted.package, manifestPath: 'scheduled/manifest.json',
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
  const result = consumeResult(createScheduledWorkPackagePort().admitPackageResource({ package: s.package,
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
    manifestBytes: active.manifestBytes, crossPackage, crossBytes, samePackage, sameBytes, sameSecondBytes };
  const descriptor = openSync(durable, 'w'); writeSync(descriptor, JSON.stringify(payload)); fsyncSync(descriptor); closeSync(descriptor);
  process.kill(process.pid, 'SIGKILL');
}
if (mode === 'round4-conflicts-recover') {
  const persisted = JSON.parse(readFileSync(durable, 'utf8')); const s = scheduledFixture(); const assembly = assemblyRuntimeFixture();
  assembly.raw.push(...persisted.tail); const port = createScheduledWorkPackagePort();
  const context = { ...assembly.c, register: { ...assembly.c.register,
    entries: [...new Set([...assembly.c.register.entries, ...s.context.register.entries])] } };
  const admit = (pkg, path, bytes) => consumeResult(port.admitPackageResource({ package: pkg, manifestPath: path,
    manifestBytes: bytes, existingManifests: [] }, context), { Success: () => 'accepted', Refused: () => 'refused' });
  process.stdout.write(JSON.stringify({ cross: [admit(persisted.package, 'scheduled/manifest.json', persisted.manifestBytes),
    admit(persisted.crossPackage, 'scheduled/manifest.json', persisted.crossBytes)],
  same: [admit(persisted.samePackage, 'scheduled/manifest.json', persisted.sameBytes),
    admit(persisted.samePackage, 'scheduled/second.json', persisted.sameSecondBytes)] }));
}
if (mode === 'legacy-recover') {
  const sourceBytes = readFileSync(durable, 'utf8'); const context = scheduledFixture().context;
  process.stdout.write(JSON.stringify(value(importLegacyScheduledJob(sourceBytes, context))));
}
