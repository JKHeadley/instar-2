import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { factsFixture, value } from '../tests/facts/fixtures.ts';
import { measurementFixture } from '../tests/measurement/fixture.ts';
import { createFactStore } from '../src/facts/index.ts';
import { foldProjection } from '../src/projections/index.ts';
import { createBoundedReadCache, decodeReadCachePolicy, measurementProjectionDefinition } from '../src/measurement/index.ts';

const [directory, mode, cut] = process.argv.slice(2);
const kill = name => { if (mode === 'write' && cut === name) process.kill(-process.pid, 'SIGKILL'); };
let syncCount = 0;
const write = fs.writeFileSync; const sync = fs.fsyncSync; const rename = fs.renameSync;
fs.writeFileSync = function (...args) { kill('before-write'); const result = write(...args); kill('after-write'); return result; };
fs.fsyncSync = function (...args) {
  const label = ++syncCount === 1 ? 'file-sync' : 'directory-sync';
  kill(`before-${label}`); const result = sync(...args); kill(`after-${label}`); return result;
};
fs.renameSync = function (...args) { kill('before-rename'); const result = rename(...args); kill('after-rename'); return result; };
syncBuiltinESMExports();

const { createTransportFileStorage } = await import('./transport-file-storage.mjs');
const f = factsFixture(); const storage = createTransportFileStorage(directory, run => f.success(run()));
const store = createFactStore(f.ctx, storage);
if (mode === 'write') { value(store.append(f.wire())); kill('after-ack'); }
const snapshot = value(store.readForProjection()); const last = snapshot.entries.at(-1)?.fact;
const generation = { reference: f.c.register.generation, kinds: ['note'],
  lineages: last ? { 'machine-a': { head: last.segment, observedAt: 100, closed: false } } : {} };
const definition = value(measurementProjectionDefinition(generation,
  { note: { identity: 'identity', value: 'amount', merge: 'additive' } }, f.c));
const view = value(foldProjection(definition, snapshot, generation, f.c));
const mf = measurementFixture();
const cache = createBoundedReadCache(value(decodeReadCachePolicy({ type: 'ReadCachePolicy', schemaVersion: 2,
  id: 'cache:restart-cut', maxRows: 2, maxBytes: 100, maxAgeMs: 20, evictionBatch: 1 }, mf.c)), mf.c);
console.log(JSON.stringify({ facts: snapshot.entries.length, values: view.values, cache: value(cache.inspect()),
  abandonedLock: fs.existsSync(`${directory}/append.lock`), pending: fs.existsSync(`${directory}/facts.pending`) }));
