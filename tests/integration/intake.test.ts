import { it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { createPrivateKey } from 'node:crypto';
import { createIntakePort, intakeWorkRegistration, intakeDedupDefinition } from '../../src/intake/index.js';
import { createFactStore, prepareSnapshot } from '../../src/facts/index.js';
import { foldProjection, readProjection } from '../../src/projections/index.js';
import type { FactEnvelope, SegmentStoragePort } from '../../src/facts/index.js';
import type { ProjectionGeneration } from '../../src/projections/index.js';
import { intakeFixture, route, message, stop, value, refused } from '../intake/fixtures.js';

it('P4-NF-01 failure before durable receipt never reaches authentication or parser', () => {
  const f = intakeFixture();
  const port = value(createIntakePort({ ...f.deps, storage: { ...f.storage, append() { throw new Error('disk unavailable'); } } }));
  const refusal = refused(port.receive(message(), route), 'disk unavailable');
  expect(refusal.preserved).toMatch(/^sha256:/);
  expect(f.trace).toEqual(['clock', 'capture']);
  expect(f.frames).toHaveLength(0);
});

it('P4-NF-10 P4-NF-15 re-resolving a held message retains arrival time and uses current admission time', () => {
  const f = intakeFixture();
  const failed = value(createIntakePort({ ...f.deps, adapter: { ...f.deps.adapter, authenticate() { throw new Error('not yet verifiable'); } } }));
  refused(failed.receive(message(), route)); f.setTime(500);
  const admitted = value(f.port().receive(message(), route));
  if (admitted.kind !== 'admitted') throw new Error('expected admitted');
  expect(admitted.intent.receivedAt.value).toBe(100);
  expect(f.facts().at(-1)!.at.value).toBe(500);
  f.setTime(1200); expect(value(f.port().expireHolds())).toBe(0);
});

it('P4-NF-14 stop precedes aged-queue drain and has a measured local recognition-to-durability bound', () => {
  const f = intakeFixture(); f.bind(); refused(f.port().receive('{}', { ...route, eventId: 'held' }));
  f.setTime(1200); f.trace.length = 0;
  let recognized = 0, persisted = 0;
  const port = value(createIntakePort({ ...f.deps,
    adapter: { ...f.deps.adapter, parse(raw) { const parsed = f.deps.adapter.parse(raw); recognized = performance.now(); return parsed; } },
    storage: { ...f.storage, append(bytes, head) {
      const result = f.storage.append(bytes, head);
      if ((JSON.parse(bytes) as { kind: string }).kind === 'intake-stop') persisted = performance.now();
      return result;
    } },
  }));
  expect(value(port.receive(stop, route)).kind).toBe('stopped');
  expect(persisted).toBeGreaterThan(recognized); expect(persisted - recognized).toBeLessThan(1000);
  expect(f.trace).not.toContain('append:intake-expired'); expect(f.trace).not.toContain('append:intake-resolved');
  expect(f.trace).not.toContain('append:intake-admitted');
  refused(f.port().receive(message('after stop'), { ...route, eventId: 'new' }), 'stopped');
});

it('P4-NF-03 P4-NF-08 partitioned same-event admissions become the part-two singleton Conflict, never a silent winner', () => {
  const f = intakeFixture(); f.bind();
  const base = [...f.frames], second: unknown[] = [...base];
  const storage: SegmentStoragePort = { owner: 'part-ten', read: () => second,
    append(bytes, head) {
      expect((second.at(-1) as FactEnvelope | undefined)?.contentHash ?? null).toBe(head);
      second.push(JSON.parse(bytes)); return f.f.success({ kind: 'local-durable' as const });
    } };
  const bKey = createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + '22'.repeat(32), 'hex'), format: 'der', type: 'pkcs8' }).export({ format: 'pem', type: 'pkcs8' }).toString();
  const generation = (frames: readonly unknown[]): ProjectionGeneration => ({ reference: f.context.decode.register.generation,
    kinds: [...new Set(f.context.schemas.map(s => s.kind))], lineages: Object.fromEntries(['machine-a', 'machine-b'].flatMap(machine => {
      const head = (frames as readonly FactEnvelope[]).filter(f => f.machine === machine).at(-1)?.segment;
      return head ? [[machine, { head, observedAt: 100, closed: false }]] : [];
    })) });
  const right = value(createIntakePort({ ...f.deps, storage, author: { ...f.deps.author, machine: 'machine-b', privateKey: bKey },
    dedupGeneration: () => generation(second) }));
  const leftResult = value(f.port().receive(message(), route)), rightResult = value(right.receive(message(), route));
  expect(leftResult.logicalId).toBe(rightResult.logicalId);
  const merged = [...f.frames, ...second.slice(base.length)];
  const b = { site: 'intake.admit', preserved: 'capture:merged', register: f.context.decode.register };
  const context = { ...f.context, ownedBodies: [value(intakeWorkRegistration(b, f.deps.author.principal.id))] };
  const facts = value(createFactStore(context, { ...storage, read: () => merged }).read());
  const snapshot = value(prepareSnapshot(facts, { ...context, facts }));
  const definition = intakeDedupDefinition(generation(merged).kinds, 1000);
  const view = value(foldProjection(definition, snapshot, generation(merged), b));
  expect(view.conflicts.some(c => c.key.startsWith('exclusive:intake-admitted:'))).toBe(true);
  refused(readProjection(view, definition, f.f.now, b), 'conflicted or tainted');
  // The intake consumer itself uses that same read, including after restart.
  const mergedPort = value(createIntakePort({ ...f.deps, context: () => context, storage: { ...storage, read: () => merged,
    append(bytes) { merged.push(JSON.parse(bytes)); return f.f.success({ kind: 'local-durable' as const }); } }, dedupGeneration: () => generation(merged) }));
  refused(mergedPort.receive(message(), route), 'conflicted or tainted');
});

it('P4-NF-03 stale dedup currency preserves work and does not pretend safe admission', () => {
  const f = intakeFixture();
  const port = value(createIntakePort({ ...f.deps, dedupGeneration: () => ({ ...f.deps.dedupGeneration(),
    lineages: { 'machine-a': { head: null, observedAt: null, closed: false } } }) }));
  refused(port.receive(message(), route), 'staleness');
  expect(f.facts().some(f => f.kind === 'intake-resolved')).toBe(true);
  expect(f.facts().some(f => f.kind === 'intake-admitted')).toBe(false);
});
