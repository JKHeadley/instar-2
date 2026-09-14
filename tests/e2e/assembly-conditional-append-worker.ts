import { existsSync, writeFileSync } from 'node:fs';
import { createAssemblyRuntime, createAssemblySpine, createConditionalAssemblyAppendPort } from '../../src/assembly/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { boundary } from '../../src/facts/boundary.js';
// @ts-expect-error Test-only fs interception composes the executable production adapter.
import { createCuttableTransportFileStorage } from '../../scripts/test-support/transport-file-storage-cuts.mjs';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';

const [mode, directory, cut, marker, options = '{}'] = process.argv.slice(2);
if (!mode || !directory) throw new Error('mode and directory required');
const opts = JSON.parse(options) as { adapter?: string; id?: string; candidateMode?: string };
const resultContext = factsFixture();
const result = <T>(run: () => T) => boundary('ConditionalAppendLifecycleStorage', null, resultContext.c, run);
const cuttable = await createCuttableTransportFileStorage(directory, result, cut, marker);
const storage = cuttable.storage;

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
  const adapter = opts.adapter ?? 'telegram:v1:bot:99';
  const frontier = value(runtime.inspectCurrent()).filter(row => row.record.type === 'AdapterConformance'
    && (row.record as { adapter: string }).adapter === adapter).map(row => row.fact.id);
  const port = createConditionalAssemblyAppendPort({
    host: template.host, author: { context: template.context, privateKey }, storage,
  });
  const outcome = port.appendIfSubjectFrontier('AdapterConformance', {
    ...assemblyInput('AdapterConformance'), id: opts.id ?? 'conformance:contender', adapter,
    mode: opts.candidateMode ?? 'long-poll',
  }, { subject: { type: 'AdapterConformance', field: 'adapter', value: adapter }, facts: frontier });
  const rows = value(runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')
    .map(row => ({ id: row.record.id, adapter: (row.record as { adapter: string }).adapter, mode: (row.record as { mode: string }).mode }));
  process.stdout.write(`${JSON.stringify(outcome.kind === 'Success'
    ? { kind: 'Success', rows }
    : { kind: 'Refused', reason: outcome.reason, detail: outcome.detail, rows })}\n`);
  process.exit(0);
}

if (mode === 'gate') {
  if (!marker) throw new Error('gate marker required');
  let gateEnabled = false;
  const gated = { owner: 'part-ten' as const, read: storage.read,
    append(bytes: string, expectedHead: string | null) {
      if (gateEnabled) {
        writeFileSync(`${marker}.ready`, 'ready');
        while (!existsSync(marker)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
      }
      return storage.append(bytes, expectedHead);
    },
  };
  const template = assemblyRuntimeFixture(() => gated);
  gateEnabled = true;
  const adapter = opts.adapter ?? 'telegram:v1:bot:99';
  const frontier = value(template.runtime.inspectCurrent()).filter(row => row.record.type === 'AdapterConformance'
    && (row.record as { adapter: string }).adapter === adapter).map(row => row.fact.id);
  const outcome = createConditionalAssemblyAppendPort({
    host: template.host, author: { context: template.context, privateKey }, storage: gated,
  }).appendIfSubjectFrontier('AdapterConformance', {
    ...assemblyInput('AdapterConformance'), id: opts.id ?? 'conformance:gated', adapter,
    mode: opts.candidateMode ?? 'long-poll',
  }, { subject: { type: 'AdapterConformance', field: 'adapter', value: adapter }, facts: frontier });
  process.stdout.write(`${JSON.stringify(outcome.kind === 'Success'
    ? { kind: 'Success', id: outcome.value.id, mode: outcome.value.mode }
    : { kind: 'Refused', reason: outcome.reason, detail: outcome.detail })}\n`);
  process.exit(0);
}

if (mode !== 'cut' || !cut || !marker) throw new Error('cut stage and marker required');
const f = assemblyRuntimeFixture(() => storage);
cuttable.enableCuts();
const adapter = opts.adapter ?? 'telegram:v1:bot:99';
const frontier = value(f.runtime.inspectCurrent()).filter(row => row.record.type === 'AdapterConformance'
  && (row.record as { adapter: string }).adapter === adapter).map(row => row.fact.id);
const port = createConditionalAssemblyAppendPort({ host: f.host, author: { context: f.context, privateKey }, storage });
const outcome = port.appendIfSubjectFrontier('AdapterConformance', {
  ...assemblyInput('AdapterConformance'), id: opts.id ?? 'conformance:cut', adapter,
  mode: opts.candidateMode ?? 'webhook',
}, { subject: { type: 'AdapterConformance', field: 'adapter', value: adapter }, facts: frontier });
process.stdout.write(`${JSON.stringify({ kind: outcome.kind })}\n`);
