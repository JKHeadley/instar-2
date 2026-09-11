import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScheduledWorkPackagePort, importLegacyScheduledJob } from '../src/scheduled/index.ts';
import { consumeResult } from '../src/index.ts';
import { assemblyRuntimeFixture } from '../tests/assembly/runtime-fixture.ts';
import { assemblyInput } from '../tests/assembly/fixture.ts';
import { activeScheduledFixture, scheduledFixture, value } from '../tests/scheduled/fixture.ts';

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
if (mode === 'legacy-recover') {
  const sourceBytes = readFileSync(durable, 'utf8'); const context = scheduledFixture().context;
  process.stdout.write(JSON.stringify(value(importLegacyScheduledJob(sourceBytes, context))));
}
