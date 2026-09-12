import { writeSync } from 'node:fs';
import { consumeResult, decodeMeasurement, defineDecoder } from '@instar/constitutional-types';
import { createFactStore, registerOwnedBody } from '@instar/constitutional-types/facts';
import { currentAssemblyRows, registerAssemblyBodies, resolveAssemblyHistory, resolvePackageActivity } from '@instar/constitutional-types/assembly';
import { decodeCheckRun } from '@instar/constitutional-types/register';
import { registerVerificationBodies } from '@instar/constitutional-types/verification';
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

const [seedPath, directory, mode, cut] = process.argv.slice(2);
const seed = JSON.parse((await import('node:fs')).readFileSync(seedPath, 'utf8'));
const take = result => consumeResult(result, { Success: value => value, Refused: refusal => { throw new Error(refusal.detail); } });
const refused = result => consumeResult(result, { Success: () => null, Refused: refusal => refusal.detail });
const baseBoundary = { site: seed.context.site, preserved: seed.context.preserved, register: seed.context.decode.register };
const clock = take(decodeMeasurement('clock', seed.context.genesis.clock, seed.context.decode));
let context = { ...seed.context, genesis: { ...seed.context.genesis, clock } };
const host = { machine: seed.machine, principal: seed.principal, scope: seed.scope, boundary: baseBoundary,
  current: () => ({ facts: context, generation: seed.generation, stopped: false, clock }) };
const text = { kind: 'text', maxLength: 65_536 };
const checkRunShape = { kind: 'object', fields: {
  type: text, schemaVersion: { kind: 'integer' }, id: text, commit: text, branch: text, providerRun: text, outcome: text,
  fixtures: { kind: 'array', maxLength: 16_384, items: { kind: 'object', fields: { id: text, stage: text, outcome: text } } },
  at: { kind: 'object', fields: { type: text, schemaVersion: { kind: 'integer' },
    subject: { kind: 'object', fields: { kind: text, instance: text } }, value: { kind: 'integer' }, unit: text,
    at: { kind: 'integer' }, by: text } },
} };
const checkRun = take(registerOwnedBody({ name: 'CheckRunRecord', owner: 'part-three', currentVersion: 1,
  versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
  decodeCurrent: input => {
    try { return { ok: true, value: take(decodeCheckRun(input, { ...baseBoundary, types: context.decode,
      shape: { factSchemas: [] }, provenance: seed.principal.provenance, source: { path: seedPath, symbol: 'CheckRunRecord' } })) }; }
    catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'check run refused' }; }
  },
}, checkRunShape, baseBoundary));
context = { ...context, ownedBodies: [checkRun, ...take(registerAssemblyBodies(host)), ...take(registerVerificationBodies(host))] };
const result = run => consumeResult(defineDecoder({ name: 'PackageActivityFileReceipt', owner: 'part-ten', currentVersion: 1,
  versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
  decodeCurrent: () => ({ ok: true, value: run() }),
}, baseBoundary.preserved), { Success: decoder => decoder.decode({ type: 'PackageActivityFileReceipt', schemaVersion: 1 }, baseBoundary), Refused: refusal => refusal });
const storage = createTransportFileStorage(directory, result);
const store = createFactStore(context, storage);
const spine = { store, append: () => { throw new Error('read-only restart fixture'); } };
const aliases = fact => [fact.id, fact.body?.id, fact.body?.record?.id, fact.body?.measurement?.id].filter(Boolean);
let runtimeBoundary;
const history = { owner: 'part-ten',
  current: () => result(() => currentAssemblyRows(take(store.readForProjection()), runtimeBoundary)),
  lookup: reference => result(() => {
    const snapshot = take(store.readForProjection()); const rows = currentAssemblyRows(snapshot, runtimeBoundary);
    const assembly = rows.find(row => row.fact.id === reference || row.record.id === reference);
    const status = snapshot.entries.find(row => row.fact.id === (assembly?.fact.id ?? reference))
      ?? snapshot.entries.find(row => aliases(row.fact).includes(reference));
    return status ? { fact: status.fact, ...(assembly ? { record: assembly.record } : {}), taint: status.taint,
      conflicts: assembly ? [...status.conflicts, ...assembly.conflicts] : status.conflicts,
      completeness: assembly?.record.type === 'GrowthObservation' && assembly.record.completion === 'incomplete' ? 'partial' : 'complete' } : null;
  }),
  resolve: record => resolveAssemblyHistory(record, spine, runtimeBoundary),
};
runtimeBoundary = { ...baseBoundary, history, validateReferences: true };

function activity() {
  return resolvePackageActivity(seed.namespace, store, (() => { let now = 500; return () => now++; })(), runtimeBoundary);
}

if (mode === 'start') {
  const [side, target] = cut.split(':');
  for (const step of seed.steps) {
    if (step.name === target && side === 'before') break;
    take(store.append(step.fact, { peer: step.fact.machine }));
    if (step.name === target) break;
  }
  const witnessed = take(activity());
  writeSync(1, JSON.stringify({ ready: true, witnessed }) + '\n');
  process.kill(process.pid, 'SIGSTOP');
  throw new Error('fault worker must be killed, never resumed');
} else {
  const result = activity();
  const refusal = refused(result);
  writeSync(1, JSON.stringify(refusal === null ? { result: take(result) } : { refusal }) + '\n');
}
