import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { factsFixture, refused, value } from './fixtures.js';
import { createFactStore } from '../../src/facts/index.js';
import { createHostResourceAllocation } from '../preview/six-host-resources.js';
import { transportSchemas, resourceSetSchemas, registerTransportBodies, registerResourceSetBodies } from '../../src/transport/index.js';

const bytes = gunzipSync(readFileSync(new URL('./recorded/host-111-facts.json.gz', import.meta.url)));
assert.equal(createHash('sha256').update(bytes).digest('hex'), '5bacc0664ad57b62cdb2a87e0bb3051c5d52ddd46258435e56a3e49a3049215e');
const facts = JSON.parse(bytes);
assert.equal(facts.length, 1820);
const f = factsFixture();
const host = { domain: 'host-resources', machine: 'machine-a', incarnation: 'launcher:90218:b12629d7eb783d1e',
  authorityIncarnation: 'launcher:90218:b12629d7eb783d1e', principal: f.alice, scope: f.scope,
  maxLeaseTerm: 86400000, budget: 0, monotonic: () => 26630, resourceDomains: () => [],
  current: () => ({ decode: f.ctx.decode, clock: f.clock(100),
    generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'generation:1' }, stopped: false }) };
const context = { ...f.ctx, schemas: [...transportSchemas(host), ...resourceSetSchemas(host)],
  ownedBodies: [...value(registerTransportBodies(host, f.c)), ...value(registerResourceSetBodies(host, f.c))] };
const readonlyStorage = rows => ({ owner: 'part-ten', read: () => rows, append: () => { throw Error('read-only evidence'); } });

if (process.argv[2] === 'projection') {
  // Verify the entire signed chain through P2 before using its prefix as retained context.
  const verified = value(createFactStore(context, readonlyStorage(facts)).read());
  const prefix = verified.slice(0, -1), tail = verified.at(-1), rows = [];
  assert.equal(tail.id, 'machine-a:0:1819');
  const store = createFactStore({ ...context, facts: prefix }, readonlyStorage(rows));
  assert.deepEqual(value(store.readForProjection()).entries, []);
  rows.push(tail);
  // Before the repair: signed conflict fact appender required; outbox receipt is insufficient.
  const snapshot = value(store.readForProjection());
  assert.equal(snapshot.entries.length, 1);
  assert.deepEqual(snapshot.entries[0].conflicts, []);
  assert.deepEqual(snapshot.entries[0].taint, []);
  assert.deepEqual(snapshot.entries[0].fact, tail);
  assert.equal(value(store.sweep()).length, 1);
  const changed = { ...tail, body: { record: { ...tail.body.record, term: 1 } } };
  assert.match(refused(createFactStore({ ...context, facts: prefix }, readonlyStorage([changed])).read()),
    /content hash mismatch/);
  console.log('PASS recorded first-acquisition projection; signed bytes retained');
} else if (process.argv[2] === 'allocation') {
  const root = mkdtempSync(join(tmpdir(), 'six-recorded-allocation-'));
  try {
    const directory = join(root, 'six', 'host-111');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'facts.json'), bytes);
    const ceilings = { launch: { memoryBytes: 2147483648, processCount: 32 },
      aggregate: { memoryBytes: 19327352832, processCount: 288, launches: 9 }, reserveLaunches: 1 };
    const allocator = createHostResourceAllocation({ root, machine: 'machine:DaBombs-Mac-Studio.local', ceilings,
      incarnation: 'recorded-copy-restart', now: () => 1792391384508, monotonic: () => 30000 });
    const result = allocator.reserve({ launch: 'recorded-first-process', work: 'maintenance', ...ceilings.launch });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(allocator.close(result.handle.set, 'never-launched:recorded-replay'), { ok: true });
    const retained = JSON.parse(readFileSync(join(directory, 'facts.json')));
    assert.deepEqual(retained.slice(0, facts.length), facts);
    assert.ok(retained.length > facts.length);
    // A restart cannot escape the operator's current capacity policy, nor erase past debits.
    const capped = createHostResourceAllocation({ root, machine: 'machine:DaBombs-Mac-Studio.local',
      ceilings: { ...ceilings, aggregate: { ...ceilings.aggregate, launches: 0 } },
      incarnation: 'recorded-copy-capped', now: () => 1792391384508, monotonic: () => 30000 });
    const refused = capped.reserve({ launch: 'must-not-launch', work: 'maintenance', ...ceilings.launch });
    assert.equal(refused.ok, false);
    assert.match(refused.reason, /resource domain capacity exhausted/);
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'facts.json'))).slice(0, facts.length), facts);
    console.log('PASS recorded restart allocates and returns; zero capacity refuses; all 1820 facts retained');
  } finally { rmSync(root, { recursive: true, force: true }); }
} else throw Error('choose projection or allocation');
