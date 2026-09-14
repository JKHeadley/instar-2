import { existsSync, writeFileSync } from 'node:fs';
import { createAssemblyRuntime, createAssemblySpine, createConditionalAssemblyAppendPort } from '../../src/assembly/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { boundary } from '../../src/facts/boundary.js';
// @ts-expect-error The physical file adapter is an executable JavaScript boundary.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';

const [mode, directory, cut, marker] = process.argv.slice(2);
if (!mode || !directory) throw new Error('mode and directory required');
const resultContext = factsFixture();
const result = <T>(run: () => T) => boundary('ConditionalAppendLifecycleStorage', null, resultContext.c, run);
let cutsEnabled = false;
const storage = createTransportFileStorage(directory, result, (stage: string) => {
  if (!cutsEnabled || stage !== cut) return;
  if (!marker) throw new Error('cut marker required');
  writeFileSync(marker, stage);
  while (existsSync(marker)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
});

if (mode === 'read') {
  const template = assemblyRuntimeFixture();
  const store = createFactStore(template.context, storage);
  const spine = createAssemblySpine(template.host, { context: template.context, privateKey }, store);
  const runtime = createAssemblyRuntime({ ...template.composition, spine });
  const rows = value(runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')
    .map(row => ({ id: row.record.id, adapter: (row.record as { adapter: string }).adapter, mode: (row.record as { mode: string }).mode }));
  process.stdout.write(`${JSON.stringify({ rows })}\n`);
  process.exit(0);
}

if (mode === 'attempt') {
  const template = assemblyRuntimeFixture();
  const store = createFactStore(template.context, storage);
  const spine = createAssemblySpine(template.host, { context: template.context, privateKey }, store);
  const runtime = createAssemblyRuntime({ ...template.composition, spine });
  const adapter = 'telegram:v1:bot:99';
  const port = createConditionalAssemblyAppendPort({
    host: template.host, author: { context: template.context, privateKey }, storage,
  });
  const outcome = port.appendIfSubjectFrontier('AdapterConformance', {
    ...assemblyInput('AdapterConformance'), id: 'conformance:contender', adapter, mode: 'long-poll',
  }, { subject: { type: 'AdapterConformance', field: 'adapter', value: adapter }, facts: [] });
  const rows = value(runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')
    .map(row => ({ id: row.record.id, adapter: (row.record as { adapter: string }).adapter, mode: (row.record as { mode: string }).mode }));
  process.stdout.write(`${JSON.stringify(outcome.kind === 'Success'
    ? { kind: 'Success', rows }
    : { kind: 'Refused', reason: outcome.reason, detail: outcome.detail, rows })}\n`);
  process.exit(0);
}

if (mode !== 'cut' || !cut || !marker) throw new Error('cut stage and marker required');
const f = assemblyRuntimeFixture(() => storage);
cutsEnabled = true;
const adapter = 'telegram:v1:bot:99';
const port = createConditionalAssemblyAppendPort({ host: f.host, author: { context: f.context, privateKey }, storage });
const outcome = port.appendIfSubjectFrontier('AdapterConformance', {
  ...assemblyInput('AdapterConformance'), id: 'conformance:cut', adapter, mode: 'webhook',
}, { subject: { type: 'AdapterConformance', field: 'adapter', value: adapter }, facts: [] });
process.stdout.write(`${JSON.stringify({ kind: outcome.kind })}\n`);
