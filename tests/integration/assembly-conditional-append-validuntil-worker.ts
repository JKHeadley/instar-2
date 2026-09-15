import { createConditionalAssemblyAppendPort } from '../../src/assembly/index.js';
import type { SegmentStoragePort } from '../../src/facts/index.js';
import { boundary } from '../../src/facts/boundary.js';
// @ts-expect-error The physical file adapter is an executable JavaScript boundary.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
import { assemblyInput } from '../assembly/fixture.js';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';
import { privateKey, value } from '../facts/fixtures.js';

// Additive row-127 integration worker: drives the exclusive `validUntil` precondition of
// appendIfSubjectFrontier over the real physical file adapter in a fresh process. `startClock`
// pins the frontier-observation clock; `appendClock` advances the commit clock at physical
// append time, so an evidence bound at or below the commit clock refuses with nothing durable.

const [mode, directory, role] = process.argv.slice(2);
if (!mode || !directory) throw new Error('mode and directory required');

const resultFixture = assemblyRuntimeFixture();
const result = <T>(run: () => T) => boundary('ConditionalAppendValidityWorkerStorage', null, resultFixture.c, run);
const base = createTransportFileStorage(directory, result);

if (mode === 'case') {
  const opts = JSON.parse(role ?? '{}') as { startClock?: number; appendClock?: number; validUntil?: number };
  const f = assemblyRuntimeFixture(() => base);
  if (opts.startClock !== undefined) f.time(opts.startClock);
  const adapter = 'telegram:v1:bot:99';
  const candidate = { ...assemblyInput('AdapterConformance'), id: 'review:webhook', adapter, mode: 'webhook' };
  const frontier = value(f.runtime.inspectCurrent()).filter(row => row.record.type === 'AdapterConformance'
    && (row.record as { adapter: string }).adapter === adapter).map(row => row.fact.id);
  const conditionalStorage: SegmentStoragePort = opts.appendClock === undefined ? base : {
    owner: 'part-ten', read: base.read,
    append(bytes, expectedHead) {
      f.time(opts.appendClock!);
      return base.append(bytes, expectedHead);
    },
  };
  const outcome = createConditionalAssemblyAppendPort({
    host: f.host, author: { context: f.context, privateKey }, storage: conditionalStorage,
  }).appendIfSubjectFrontier('AdapterConformance', candidate, {
    subject: { type: 'AdapterConformance', field: 'adapter', value: adapter }, facts: frontier,
    ...(opts.validUntil === undefined ? {} : { validUntil: opts.validUntil }),
  });
  const rows = value(f.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')
    .map(row => ({ id: row.record.id, adapter: (row.record as { adapter: string }).adapter }));
  process.stdout.write(`${JSON.stringify(outcome.kind === 'Success'
    ? { kind: 'Success', rows }
    : { kind: 'Refused', reason: outcome.reason, detail: outcome.detail, rows })}\n`);
  process.exit(0);
}

if (mode === 'read') {
  const f = assemblyRuntimeFixture(() => base);
  const rows = value(f.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')
    .map(row => ({ id: row.record.id, adapter: (row.record as { adapter: string }).adapter }));
  process.stdout.write(`${JSON.stringify({ kind: 'read', rows })}\n`);
  process.exit(0);
}

throw new Error('unsupported mode');
