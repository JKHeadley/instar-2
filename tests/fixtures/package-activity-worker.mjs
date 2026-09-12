import { writeSync } from 'node:fs';
import { consumeResult, decodeMeasurement, defineDecoder } from '@instar/constitutional-types';
import { createFactStore } from '@instar/constitutional-types/facts';
import { registerAssemblyBodies, resolvePackageActivity } from '@instar/constitutional-types/assembly';
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
context = { ...context, ownedBodies: take(registerAssemblyBodies(host)) };
const result = run => consumeResult(defineDecoder({ name: 'PackageActivityFileReceipt', owner: 'part-ten', currentVersion: 1,
  versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
  decodeCurrent: () => ({ ok: true, value: run() }),
}, baseBoundary.preserved), { Success: decoder => decoder.decode({ type: 'PackageActivityFileReceipt', schemaVersion: 1 }, baseBoundary), Refused: refusal => refusal });
const storage = createTransportFileStorage(directory, result);
const store = createFactStore(context, storage);

function activity() {
  return resolvePackageActivity(seed.namespace, store, (() => { let now = 500; return () => now++; })(), baseBoundary);
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
