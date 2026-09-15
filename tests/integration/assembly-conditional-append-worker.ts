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

if (mode === 'case') {
  const opts = JSON.parse(role ?? '{}') as {
    principal?: 'unknown' | 'forged' | 'missing';
    stop?: boolean;
    ordinary?: boolean;
    extraExpected?: Readonly<Record<string, unknown>>;
    extraSubject?: Readonly<Record<string, unknown>>;
    provenance?: 'other-authenticated-actor' | 'other-authenticated-act' | 'foreign-recorder';
    candidateMode?: string;
    candidateId?: string;
    startClock?: number;
    appendClock?: number;
    validUntil?: number;
  };
  const f = fixture(base);
  if (opts.startClock !== undefined) f.time(opts.startClock);
  if (opts.stop) f.stop();
  const adapter = 'telegram:v1:bot:99';
  const candidate = { ...assemblyInput('AdapterConformance'), id: opts.candidateId ?? 'review:webhook',
    adapter, mode: opts.candidateMode ?? 'webhook' };
  const current = value(f.runtime.inspectCurrent()).filter(row => row.record.type === 'AdapterConformance'
    && (row.record as { adapter: string }).adapter === adapter).map(row => row.fact.id);
  const expected = {
    subject: { type: 'AdapterConformance' as const, field: 'adapter', value: adapter, ...opts.extraSubject },
    facts: current,
    ...opts.extraExpected,
  };
  let host = f.host;
  if (opts.principal === 'unknown') host = { ...host, principal: { ...host.principal, id: 'principal:intruder' } } as unknown as typeof host;
  if (opts.principal === 'forged') host = { ...host, principal: { ...host.principal,
    provenance: { ...host.principal.provenance, captureHash: `sha256:${'0'.repeat(64)}` } } } as unknown as typeof host;
  if (opts.principal === 'missing') host = { ...host, principal: undefined } as unknown as typeof host;
  if (opts.provenance === 'foreign-recorder') host = { ...host, principal: f.bob };
  let context = f.context;
  if (opts.provenance === 'other-authenticated-actor') context = { ...context,
    decode: { ...context.decode, provenance: f.bob.provenance } };
  if (opts.provenance === 'other-authenticated-act') context = { ...context,
    decode: { ...context.decode, provenance: f.proof({ purpose: 'another signed act' }).p } };
  const conditionalStorage: SegmentStoragePort = opts.appendClock === undefined ? base : {
    owner: 'part-ten', read: base.read,
    append(bytes, expectedHead) {
      f.time(opts.appendClock!);
      return base.append(bytes, expectedHead);
    },
  };
  const outcome = opts.ordinary
    ? f.runtime.record('AdapterConformance', candidate)
    : createConditionalAssemblyAppendPort({ host, author: { context, privateKey }, storage: conditionalStorage })
      .appendIfSubjectFrontier('AdapterConformance', candidate, {
        ...expected,
        ...(opts.validUntil === undefined ? {} : { validUntil: opts.validUntil }),
      });
  const rows = value(f.runtime.inspect()).filter(row => row.record.type === 'AdapterConformance')
    .map(row => ({ id: row.record.id, adapter: (row.record as { adapter: string }).adapter, mode: (row.record as { mode: string }).mode }));
  process.stdout.write(`${JSON.stringify(outcome.kind === 'Success'
    ? { kind: 'Success', rows }
    : { kind: 'Refused', reason: outcome.reason, detail: outcome.detail, rows })}\n`);
  process.exit(0);
}

if (mode === 'current') {
  const f = fixture(base);
  const current = value(f.runtime.inspectCurrent()).filter(row => row.record.type === 'AdapterConformance');
  process.stdout.write(`${JSON.stringify({ kind: 'current', current,
    verdicts: current.map(row => value(f.runtime.resolve(row.record))) })}\n`);
  process.exit(0);
}

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
