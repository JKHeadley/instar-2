import { closeSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { createScheduledWorkPackagePort, importLegacyScheduledJob } from '../src/scheduled/index.ts';
import { assemblyRuntimeFixture } from '../tests/assembly/runtime-fixture.ts';
import { activeScheduledFixture, scheduledFixture, value } from '../tests/scheduled/fixture.ts';

const [directory, mode] = process.argv.slice(2); const durable = join(directory, 'scheduled-package-cut.json');
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
  const admitted = value(port.admitPackageResource({ package: persisted.package, manifestPath: 'scheduled/manifest.json',
    manifestBytes: persisted.manifestBytes, existingManifests: [] }, assembly.c));
  const replay = value(port.planOccurrence({ manifest: admitted, namespaceVersion: 'scheduled:v1', installationId: 'install:a',
    scheduledInstant: '2027-01-01T00:00:00Z', asOf: s.core.clock(Date.UTC(2027, 0, 1, 0, 5)) }, assembly.c));
  process.stdout.write(JSON.stringify({ replay, before: persisted.before }));
}
if (mode === 'legacy-seed-cut') {
  const sourceBytes = JSON.stringify({ slug: 'maintenance', executionMode: 'model-session', livingSkills: { enabled: true },
    serverComposition: 'default-with-integration-gate', perMachineIndependent: false, machineLocalEffects: false });
  const descriptor = openSync(durable, 'w'); writeSync(descriptor, sourceBytes); fsyncSync(descriptor); closeSync(descriptor);
  process.kill(process.pid, 'SIGKILL');
}
if (mode === 'legacy-recover') {
  const sourceBytes = readFileSync(durable, 'utf8'); const context = scheduledFixture().context;
  process.stdout.write(JSON.stringify(value(importLegacyScheduledJob(sourceBytes, context))));
}
