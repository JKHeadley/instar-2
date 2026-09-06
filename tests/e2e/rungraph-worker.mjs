// Fresh Node boot, compiled public production packages, fsync-backed facts and
// a controlled durable six witness ledger. No Run crosses the process boundary.
import { readFileSync, existsSync, openSync, writeSync, closeSync, fsyncSync } from 'node:fs';
import { join } from 'node:path';
import { consumeResult, decode } from '@instar/constitutional-types';
import { recordFromWire } from '@instar/constitutional-types/rungraph';
import { setup, value, adapterTypes } from './rungraph-fixture-loader.mjs';
const [directory, mode] = process.argv.slice(2);
const rows = name => existsSync(join(directory, name)) ? readFileSync(join(directory, name), 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
function append(name, bytes) {
  const fd = openSync(join(directory, name), 'a', 0o600);
  try { writeSync(fd, bytes + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  const dir = openSync(directory, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); }
}
const placement = rows('placement.jsonl').at(-1) ?? { worker: 'first-worker', harness: 'first-harness', lease: 'lease:1' };
if (mode === 'intake-cut') append('captures.jsonl', JSON.stringify({ reference: 'message:1', bytes: 'request bytes' }));
const capture = rows('captures.jsonl').find(c => c.reference === 'message:1');
if (!capture) throw Error('durable intake capture unavailable');
// Installation fixture provides trusted identity verification material and bounded
// policy, not an admitted assignment. The intake record is read from this spine.
const f = setup(() => ({ owner: 'part-ten', read: () => rows('facts.jsonl'), append: (bytes, expected) => {
  if ((rows('facts.jsonl').at(-1)?.contentHash ?? null) !== expected) throw Error('disk CAS');
  append('facts.jsonl', bytes);
  return value(decode('Result', { type: 'Result', schemaVersion: 1, kind: 'Success', value: { kind: 'local-durable' }, capacity: { kind: 'none' } }, adapterTypes));
} }), { ...placement, message: capture.bytes, admissions: new Set(rows('admissions.jsonl')), witness: id => append('admissions.jsonl', JSON.stringify(id)),
  afterIntake: () => { if (mode === 'intake-cut') process.kill(process.pid, 'SIGKILL'); } });
const ready = value(f.graph.open(f.run));
if (mode === 'root') {
  console.log(JSON.stringify({ root: ready.run.id, owner: ready.run.owner.id, cause: ready.run.opening.id, head: ready.head }));
} else if (mode === 'ground-cut') {
  value(f.graph.ground(f.id, placement.worker, placement.harness, 'start', { ...f.lease, id: placement.lease }));
  process.kill(process.pid, 'SIGKILL');
} else if (mode === 'replacement') {
  f.setClock(110);
  const lease = { ...f.lease, id: placement.lease }, old = value(f.store.read()).find(fact => fact.kind === 'session-grounding');
  const request = ground => { const t = f.start(ready, ground); return { ...t, ownership: lease, step: { ...t.step, ownership: lease } }; };
  const stale = consumeResult(f.graph.transition(request(old)), { Success: () => { throw Error('dead worker grounding accepted'); }, Refused: r => r.detail });
  const fresh = value(f.graph.ground(f.id, placement.worker, placement.harness, 'recovery', lease));
  const running = value(f.graph.transition(request(fresh)));
  console.log(JSON.stringify({ stale, state: running.state, pending: running.pending.length, grounding: recordFromWire(fresh.body.record) }));
} else throw Error('unknown worker mode');
