import { expect, it } from 'vitest';
import { setup, value, refused } from './fixtures.js';
import { ref, json, digest } from './fixtures.js';
import { clone, omission } from '../fixtures.js';
import { consumeResult, decode, compareMeasurements } from '../../src/index.js';
import { createRunGraph, decodeRun, decodeRunStep, decodeRunTransition, decodeSessionGrounding, foldRun, recordWire, recordFromWire,
  INITIAL_MAX_CHILDREN, INITIAL_MAX_DEPTH, INITIAL_MAX_ATTEMPTS } from '../../src/rungraph/index.js';
import { prepareSnapshot } from '../../src/facts/index.js';

function active() {
  const f = setup(), ready = value(f.graph.open(f.run));
  const ground = value(f.graph.ground(f.id, 'worker:1', 'harness:1', 'start', f.lease));
  const start = f.start(ready, ground), running = value(f.graph.transition(start));
  return { ...f, ready, ground, startRecord: start, running };
}

it('P5-NF-03 opens a complete accountable root through owner decoders', () => {
  const f = setup(), view = value(f.graph.open(f.run));
  expect(view.state).toBe('ready'); expect(view.run.owner.id).toBe('bob');
  expect(value(f.graph.open(f.run)).head).toBe(view.head);
});

it('P5-NF-02 closed versioned owner records reject missing/extra/secret fields and preserve P1 measurement identity', () => {
  const f = setup();
  for (const bad of [omission(f.run, 'schemaVersion'), { ...f.run, schemaVersion: 2 }, { ...f.run, secret: 'password' }, { ...f.run, id: 'other' }]) refused(decodeRun(bad, f.context()));
  const run = value(decodeRun(f.run, f.context()));
  expect(value(compareMeasurements(run.createdAt, f.now, f.ctx.preserved))).toBe(0);
  expect(Object.isFrozen(run.budget)).toBe(true);
});
it('P5-NF-03 every required opening field has a refusing omission fixture', () => {
  const f = setup();
  for (const key of Object.keys(f.run)) refused(decodeRun(omission(f.run, key), f.context()));
  expect(value(decodeRun(f.run, f.context())).depth).toBe(1);
});
it('P5-NF-05 immutable opening, expected predecessor, and unrecorded view edits cannot change state', () => {
  const f = active();
  refused(f.graph.open({ ...f.run, cadence: { ...f.run.cadence, milliseconds: 1 } }), 'immutable');
  refused(f.graph.transition({ ...f.startRecord, id: 'other', expected: 'missing' }), 'predecessor');
  const altered = clone(f.running); Object.assign(altered, { state: 'ready', pending: [] });
  expect(value(f.graph.read(f.id)).state).toBe('running');
  expect(value(f.graph.read(f.id)).pending).toHaveLength(1);
});
it('P5-NF-06 P5-NF-14 operator ceilings, measurement subjects and explicit zero survive decoding', () => {
  const f = setup(); expect([INITIAL_MAX_CHILDREN, INITIAL_MAX_DEPTH, INITIAL_MAX_ATTEMPTS]).toEqual([32, 16, 3]);
  for (const [key, n] of [['maxChildren', 33], ['maxDepth', 17], ['maxAttempts', 4]] as const) refused(decodeRun({ ...f.run, budget: { ...f.run.budget, [key]: n } }, f.context()), 'ceiling');
  refused(decodeRun({ ...f.run, depth: 2 }, f.context()), 'out of slice scope');
  refused(decodeRun({ ...f.run, budget: { ...f.run.budget, resources: [{ ...f.run.budget.resources[0], subject: { kind: 'run-work', instance: 'other-budget' } }] } }, f.context()), 'subject');
  const zero = { ...f.run, budget: { ...f.run.budget, maxWorkers: 0 } }, ready = value(f.graph.open(zero));
  const ground = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  refused(f.graph.transition(f.start(ready, ground)), 'zero capacity');
});
it('P5-NF-08 unknown state pairs and timers cannot satisfy pending work', () => {
  const f = active();
  for (const to of ['completed', 'unreachable', 'cancelled', 'ready']) refused(f.graph.transition({ ...f.startRecord, id: `timer:${to}`, expected: f.running.head, from: 'running', to }));
  f.setClock(2000); expect(value(f.graph.read(f.id)).pending).toHaveLength(1);
});
it('P5-NF-09 concurrent incompatible heads inhibit identically under input permutations', () => {
  const f = setup(), ready = value(f.graph.open(f.run)), ground = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const a = value(decodeRunTransition(f.start(ready, ground, 'a'), f.context()));
  const first = f.append('run-transition', json({ run: f.id, record: recordWire(a) }), [ref(ground).id, ref(f.opening).id]).fact;
  const b = value(decodeRunTransition(f.start(ready, ground, 'b'), f.context()));
  const second = f.append('run-transition', json({ run: f.id, record: recordWire(b) }), [ref(ground).id, ref(f.opening).id]).fact;
  f.admissions.add(first.id); f.admissions.add(second.id);
  const facts = value(f.store.read()), context = f.context(), witness = { verify: (fact: typeof first) => f.success(ref(fact)) };
  const heads = [facts, [...facts].reverse()].map(rows => value(foldRun(f.id, value(prepareSnapshot(rows, f.ctx)), f.generation(), context, f.now, witness)));
  expect(heads.map(v => v.state)).toEqual(['halted', 'halted']); expect(heads[0]!.conflicts).toEqual(heads[1]!.conflicts);
  refused(f.graph.transition(f.start(heads[0]!, ground, 'c')), 'conflicted');
});
it('P5-NF-10 current fence refusal prevents writes even with withheld loss notification', () => {
  const f = setup(), ready = value(f.graph.open(f.run)), ground = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const before = value(f.store.read()).length; f.fence();
  refused(f.graph.transition(f.start(ready, ground)), 'stale fence'); expect(value(f.store.read())).toHaveLength(before);
  expect(value(f.graph.read(f.id)).state).toBe('ready');
});
it('P5-NF-12 P5-NF-15 occurrence without charge and claim settlement is still pending', () => {
  const f = active(), observation = f.observe(f.running, 'happened');
  refused(f.graph.transition({ ...observation, to: 'ready', blockedOn: { kind: 'nothing' } }), 'uncertain execution/charge');
  const waiting = value(f.graph.transition(observation)); expect(waiting.pending).toHaveLength(1);
  expect(value(f.graph.transition(observation)).head).toBe(waiting.head);
  expect(waiting.settled).toEqual([]);
});
it('P5-NF-13 P5-NF-53 lost notification queues reconstruct owned pending obligations and wake unchanged', () => {
  const f = active(), rebuilt = value(createRunGraph(f.deps));
  expect(value(rebuilt.read(f.id)).nextWake).toEqual(f.running.nextWake);
  expect(value(rebuilt.read(f.id)).blockedOn).toEqual(f.running.blockedOn);
  expect(value(rebuilt.read(f.id)).source.foldedThrough).toEqual(f.running.source.foldedThrough);
});
it('P5-NF-16 P5-NF-60 retry identity cannot reset the admitted-operation ledger', () => {
  const f = active(), waiting = value(f.graph.transition(f.observe(f.running)));
  for (const key of ['operation:1', 'fresh-key']) refused(f.graph.transition(f.start({ ...waiting, state: 'ready' }, f.ground, key)));
  expect(value(f.graph.read(f.id)).usedKeys).toEqual(['operation:1']);
});
it('P5-NF-44 actual-start clock cannot reuse intake time and late grounding must be refreshed', () => {
  const f = setup(), ready = value(f.graph.open(f.run)); f.setClock(110);
  const stale = value(f.deps.grounding.read({ run: ready, worker: 'w', harness: 'h', reason: 'start' }));
  f.setClock(120);
  const graph = value(createRunGraph({ ...f.deps, grounding: { owner: 'part-ten', read: () => f.success(stale) } }));
  refused(graph.ground(f.id, 'w', 'h', 'start', f.lease), 'intake clock');
  const ground = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease)); f.setClock(200);
  refused(f.graph.transition(f.start(ready, ground)), 'grounding stale');
  const fresh = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  expect(value(f.graph.transition(f.start(ready, fresh))).state).toBe('running');
});
it('P5-NF-45 P5-NF-47 coverage gaps, changed captures and omitted start briefing classes refuse', () => {
  for (const mutate of [(g: Record<string, unknown>) => ({ ...g, messages: [] }), (g: Record<string, unknown>) => ({ ...g, briefingClasses: [] }), (g: Record<string, unknown>) => ({ ...g, knownLineages: [] })]) {
    const f = setup(); value(f.graph.open(f.run));
    const graph = value(createRunGraph({ ...f.deps, grounding: { owner: 'part-ten', read: request => f.success(mutate(value(f.deps.grounding.read(request)) as Record<string, unknown>)) } }));
    refused(graph.ground(f.id, 'w', 'h', 'start', f.lease));
  }
  const f = setup(); value(f.graph.open(f.run));
  Object.assign(f.ctx.captures['message:1']!, { bytes: 'changed bytes' });
  const snapshot = value(prepareSnapshot(value(f.store.read()), f.ctx));
  expect(snapshot.entries.some(e => e.conflicts.length > 0)).toBe(true);
  refused(f.graph.read(f.id));
});
it('P5-NF-51 P5-NF-52 equal-vector rebuild retains history and tampered projection cannot supply authority', () => {
  const f = active(), a = value(f.graph.read(f.id)), b = value(f.graph.read(f.id));
  expect(a).toEqual(b); const tampered = clone(a); Object.assign(tampered.source, { taint: [], values: {} });
  expect(value(f.graph.read(f.id)).source.values).toEqual(a.source.values);
  f.admissions.delete(value(f.store.read()).at(-1)!.id);
  refused(f.graph.read(f.id), 'not admitted by six');
});
it('P5-NF-56 null/no-op admission and writer ports cannot acknowledge a live feature', () => {
  const f = setup();
  refused(createRunGraph({ ...f.deps, admission: null as never }));
  const graph = value(createRunGraph({ ...f.deps, admission: { ...f.deps.admission, create: () => f.success({ fact: f.opening, durability: { kind: 'local-durable' }, taint: [] }) } }));
  refused(graph.open(f.run), 'did not commit'); expect(value(f.store.read())).toHaveLength(1);
});
it('P5-NF-20 stop requires owner verification and neither time nor resume can erase pending work', () => {
  const f = active();
  const stop = { ...f.startRecord, id: 'stop:1', expected: f.running.head, kind: 'stop', from: 'running', to: 'halted',
    step: undefined, grounding: undefined, blockedOn: { kind: 'stop', reference: 'stop-request', owner: f.owner, nextObservation: f.clock(1000) } };
  const clean = JSON.parse(JSON.stringify(stop));
  refused(f.graph.transition(clean), 'verified control');
  const graph = value(createRunGraph({ ...f.deps, control: { owner: 'part-four', verify: () => f.success(ref(f.opening)) } }));
  const halted = value(graph.transition(clean)); expect(halted.pending).toHaveLength(1);
  f.setClock(150); expect(value(graph.read(f.id)).state).toBe('halted');
  const resume = { ...clean, id: 'resume:1', expected: halted.head, kind: 'resume', from: 'halted', to: 'ready', at: f.clock(150) };
  refused(graph.transition(resume), 'unresolved work');
  expect(value(graph.transition({ ...resume, to: 'recovering', blockedOn: { kind: 'recovery', reference: 'operation:1', owner: f.owner, nextObservation: f.clock(1000) } })).pending).toHaveLength(1);
});
it('P5-NF-07 P5-NF-11 pending fact survives reconstruction and rejects fresh operation identity', () => {
  const f = setup(), view = value(f.graph.open(f.run));
  const ground = value(f.graph.ground(f.id, 'worker:1', 'harness:1', 'start', f.lease));
  const transition = f.start(view, ground), running = value(f.graph.transition(transition));
  expect(running.pending[0]!.operation.key).toBe('operation:1');
  expect(value(f.graph.transition(transition)).head).toBe(running.head);
  refused(f.graph.transition(f.start(running, ground, 'operation:2')));
  const waiting = value(f.graph.transition(f.observe(running)));
  expect(waiting.state).toBe('waiting'); expect(waiting.pending).toHaveLength(1);
});
