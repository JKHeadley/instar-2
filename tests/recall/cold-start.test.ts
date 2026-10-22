import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import { recordedSource } from './read-fixture.js';
import { value } from '../fixtures.js';
import { foldRun } from '../../src/rungraph/index.js';
import { ref } from '../rungraph/fixtures.js';

it('reopens the recorded message corpus with populated run work', async () => {
  const size = Number(process.env.INSTAR_COLD_RECORDS ?? 200);
  const { store, raw, context, runFixture: f } = recordedSource(size, true);
  console.log(JSON.stringify({ phase: 'source', records: raw.length, bytes: Buffer.byteLength(JSON.stringify(raw)) }));
  const start = performance.now();
  const facts = value(store.read());
  const verified = performance.now();
  console.log(JSON.stringify({ phase: 'verified', size, ms: verified - start }));
  const snapshot = value(store.readForProjection());
  const prepared = performance.now();
  console.log(JSON.stringify({ phase: 'status', size, ms: prepared - verified }));
  const view = value(foldRun(f!.id, snapshot, {
    reference: f!.ctx.decode.register.generation, kinds: context.schemas.map(s => s.kind),
    lineages: { 'machine-a': { head: facts.at(-1)!.segment, observedAt: f!.now.value, closed: false } },
  }, { ...f!.c, facts: { ...context, facts } }, f!.now,
  { verify: fact => f!.deps.admission.verify(ref(fact)) }));
  const end = performance.now();
  console.log(JSON.stringify({ phase: 'run', size, ms: end - prepared, totalMs: end - start }));
  expect(view.state).toBe('ready');
  expect(snapshot.entries).toHaveLength(size + 2);
  expect(snapshot.entries.flatMap(e => e.conflicts)).toEqual([]);
  // A scaled budget catches the existing superlinear replay on the small default corpus.
  expect(end - start).toBeLessThan(size === 20_000 ? 15_000 : 1500 + size * 3);
}, 180_000);
