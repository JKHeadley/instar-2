import { existsSync, writeFileSync } from 'node:fs';
import { createConditionalAssemblyAppendPort } from '../../src/assembly/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { boundary } from '../../src/facts/boundary.js';
// @ts-expect-error The physical file adapter is an executable JavaScript boundary.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { privateKey, value } from '../facts/fixtures.js';

const [mode, directory, role, release] = process.argv.slice(2);
if (!mode || !directory) throw new Error('mode and directory required');

const resultFixture = assemblyRuntimeFixture();
const result = <T>(run: () => T) => boundary('ConditionalAppendWorkerStorage', null, resultFixture.c, run);

function fixture(storage: SegmentStoragePort) {
  return assemblyRuntimeFixture(() => storage);
}

const base = createTransportFileStorage(directory, result);

if (mode === 'read') {
  const f = fixture(base);
  const rows = value(f.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')
    .map(row => ({ id: row.record.id, adapter: (row.record as { adapter: string }).adapter, mode: (row.record as { mode: string }).mode }));
  process.stdout.write(`${JSON.stringify({ kind: 'read', rows })}\n`);
  process.exit(0);
}

if (mode !== 'race' || !role || !release) throw new Error('race role and release path required');
let paused = false;
let pauseEnabled = false;
const storage: SegmentStoragePort = {
  owner: 'part-ten', read: base.read,
  append(bytes, expectedHead) {
    if (pauseEnabled && !paused) {
      paused = true;
      writeFileSync(`${release}.ready`, role);
      while (!existsSync(release)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
    return base.append(bytes, expectedHead);
  },
};
const f = fixture(storage);
pauseEnabled = true;
const adapter = 'telegram:v1:bot:99';
const candidate = { ...assemblyInput('AdapterConformance'), id: `conformance:${role}`, adapter, mode: role };
const frontier = value(f.runtime.inspectCurrent())
  .filter(row => row.record.type === 'AdapterConformance' && (row.record as { adapter: string }).adapter === adapter)
  .map(row => row.fact.id);
const port = createConditionalAssemblyAppendPort({ host: f.host, author: { context: f.context, privateKey }, storage });
const outcome = port.appendIfSubjectFrontier('AdapterConformance', candidate, {
  subject: { type: 'AdapterConformance', field: 'adapter', value: adapter }, facts: frontier,
});
process.stdout.write(`${JSON.stringify(outcome.kind === 'Success'
  ? { kind: 'Success', id: outcome.value.id, mode: outcome.value.mode }
  : { kind: 'Refused', detail: outcome.detail, reason: outcome.reason })}\n`);
