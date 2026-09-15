import { createAssemblyRuntime, createAssemblySpine, createConditionalAssemblyAppendPort } from '../../src/assembly/index.js';
import { createFactStore } from '../../src/facts/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { boundary } from '../../src/facts/boundary.js';
// @ts-expect-error The physical file adapter is an executable JavaScript boundary.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';

// Additive row-127 lifecycle worker: composes the production assembly runtime over the real
// physical file adapter and drives the exclusive `validUntil` precondition end to end in a fresh
// process. `startClock` pins the frontier-observation clock; `appendClock` advances the commit
// clock at physical append time so an at-or-below-commit bound refuses with nothing durable.

const [mode, directory, options = '{}'] = process.argv.slice(2);
if (!mode || !directory) throw new Error('mode and directory required');
const opts = JSON.parse(options) as { startClock?: number; appendClock?: number; validUntil?: number };
const resultContext = factsFixture();
const result = <T>(run: () => T) => boundary('ConditionalAppendValidityLifecycleStorage', null, resultContext.c, run);
const storage = createTransportFileStorage(directory, result);

if (mode === 'attempt') {
  const template = assemblyRuntimeFixture();
  if (opts.startClock !== undefined) template.time(opts.startClock);
  const store = createFactStore(template.context, storage);
  const spine = createAssemblySpine(template.host, { context: template.context, privateKey }, store);
  const runtime = createAssemblyRuntime({ ...template.composition, spine });
  const adapter = 'telegram:v1:bot:99';
  const frontier = value(runtime.inspectCurrent()).filter(row => row.record.type === 'AdapterConformance'
    && (row.record as { adapter: string }).adapter === adapter).map(row => row.fact.id);
  const conditionalStorage: SegmentStoragePort = opts.appendClock === undefined ? storage : {
    owner: 'part-ten', read: storage.read,
    append(bytes, expectedHead) {
      template.time(opts.appendClock!);
      return storage.append(bytes, expectedHead);
    },
  };
  const outcome = createConditionalAssemblyAppendPort({
    host: template.host, author: { context: template.context, privateKey }, storage: conditionalStorage,
  }).appendIfSubjectFrontier('AdapterConformance', {
    ...assemblyInput('AdapterConformance'), id: 'conformance:contender', adapter, mode: 'long-poll',
  }, { subject: { type: 'AdapterConformance', field: 'adapter', value: adapter }, facts: frontier,
    ...(opts.validUntil === undefined ? {} : { validUntil: opts.validUntil }) });
  const rows = value(runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')
    .map(row => ({ id: row.record.id, adapter: (row.record as { adapter: string }).adapter }));
  process.stdout.write(`${JSON.stringify(outcome.kind === 'Success'
    ? { kind: 'Success', rows }
    : { kind: 'Refused', reason: outcome.reason, detail: outcome.detail, rows })}\n`);
  process.exit(0);
}

if (mode === 'read') {
  const template = assemblyRuntimeFixture();
  const store = createFactStore(template.context, storage);
  const spine = createAssemblySpine(template.host, { context: template.context, privateKey }, store);
  const runtime = createAssemblyRuntime({ ...template.composition, spine });
  const rows = value(runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')
    .map(row => ({ id: row.record.id, adapter: (row.record as { adapter: string }).adapter }));
  process.stdout.write(`${JSON.stringify({ rows })}\n`);
  process.exit(0);
}

throw new Error('unsupported mode');
