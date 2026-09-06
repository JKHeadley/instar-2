import { expect, it } from 'vitest';
import { decodeMeasurement } from '../../src/index.js';
import { createRunGraph, decodeSessionGrounding, recordWire, recordFromWire } from '../../src/rungraph/index.js';
import { setup, value, refused, ref, json } from './fixtures.js';

it('P5-NF-44 R1 a replacement lease cannot consume dead-worker grounding; fresh placement and grounding succeed', () => {
  const f = setup(), ready = value(f.graph.open(f.run)); f.place('dead-worker', 'old-harness');
  const old = value(f.graph.ground(f.id, 'dead-worker', 'old-harness', 'start', f.lease));
  f.fence(); f.setClock(110); const lease = { ...f.lease, id: 'lease:2' };
  let reads = 0;
  const replacement = value(createRunGraph({ ...f.deps, grounding: { owner: 'part-ten', read: () => { reads++; throw new Error('not grounded'); } } }));
  const start = f.start(ready, old), next = { ...start, ownership: lease, step: { ...start.step, ownership: lease } };
  refused(replacement.transition(next), 'another ownership'); expect(reads).toBe(0);
  refused(f.graph.ground(f.id, 'dead-worker', 'old-harness', 'start', lease), 'verified execution context');
  f.place('replacement', 'h2');
  const fresh = value(f.graph.ground(f.id, 'replacement', 'h2', 'start', lease));
  expect(value(f.graph.transition({ ...next, grounding: ref(fresh) })).state).toBe('running');
});
it('P5-NF-44 R1 the same lease cannot silently change workers and raw unwitnessed grounding cannot start', () => {
  const f = setup(), ready = value(f.graph.open(f.run));
  const raw = value(f.deps.grounding.read({ run: ready, worker: 'w', harness: 'h', reason: 'start', execution: value(f.deps.admission.execution(f.id, f.lease)) }));
  const record = value(decodeSessionGrounding(raw, f.context()));
  const fact = f.append('session-grounding', json({ run: f.id, record: recordWire(record) }), [f.opening.id]).fact;
  expect(f.admissions.has(fact.id)).toBe(false); refused(f.graph.transition(f.start(ready, fact)), 'not admitted by six');
  const old = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  f.place('other-worker', 'other-harness');
  refused(f.graph.transition(f.start(ready, old)), 'verified executing worker');
  const fresh = value(f.graph.ground(f.id, 'other-worker', 'other-harness', 'start', f.lease));
  const running = value(f.graph.transition(f.start(ready, fresh))); expect(running.state).toBe('running');
  f.admissions.delete(fresh.id); refused(f.graph.read(f.id), 'not admitted by six');
});
it.each([99, 100, 101])('P5-NF-14 R3 subject-aware safety ceiling at %i admits below/at and refuses over', ceiling => {
  const f = setup(), ready = value(f.graph.open({ ...f.run, budget: { ...f.run.budget, safetyCeiling: f.clock(ceiling) } }));
  const g = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  if (ceiling < 100) refused(f.graph.transition(f.start(ready, g)), 'budget ceiling');
  else expect(value(f.graph.transition(f.start(ready, g))).state).toBe('running');
});
it('P5-NF-14 P5-NF-44 R3 genuine foreign-clock ceilings and start observations refuse owner comparison', () => {
  const f = setup(), foreign = value(decodeMeasurement('clock', f.clockRaw(10000, 'machine-b'), f.ctx.decode));
  const ready = value(f.graph.open({ ...f.run, budget: { ...f.run.budget, safetyCeiling: foreign } }));
  const g = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  refused(f.graph.transition(f.start(ready, g)), 'subject, instance, or unit mismatch');
  const n = setup(), root = value(n.graph.open(n.run)), grounded = value(n.graph.ground(n.id, 'w', 'h', 'start', n.lease));
  refused(n.graph.transition({ ...n.start(root, grounded), at: foreign }), 'subject, instance, or unit mismatch');
});
it('P5-NF-07 R5 only six AdmissionReservation is consumed and its owner must verify the exact operation', () => {
  const f = setup(), ready = value(f.graph.open(f.run)), g = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease)), start = f.start(ready, g);
  refused(f.graph.transition({ ...start, step: { ...start.step, allocation: { ...start.step.allocation, reservation: { ...start.step.allocation.reservation, name: 'ResourceReservation' } } } }), 'AdmissionReservation');
  refused(f.graph.transition({ ...start, step: { ...start.step, allocation: { ...start.step.allocation, reservation: { ...start.step.allocation.reservation, id: 'wrong' } } } }), 'reservation identity');
  expect(value(f.graph.transition(start)).state).toBe('running');
  const unrelated = f.append('note', json({ identity: 'different-reservation-witness', amount: '0' })).fact;
  const rewritten = value(createRunGraph({ ...f.deps, admission: { ...f.deps.admission, reservation: () => f.success(ref(unrelated)) } }));
  refused(rewritten.read(f.id), 'reservation witness differs');
});
it('P5-NF-02 R2 embedded budgets and grounding keep immutable identities across later admissions', () => {
  const f = setup(); value(f.graph.open(f.run));
  const first = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const firstGround = recordFromWire((first.body as { record: import('../../src/index.js').Json }).record) as { id: string };
  const replay = value(createRunGraph({ ...f.deps, grounding: { owner: 'part-ten', read: request => {
    const raw = value(f.deps.grounding.read(request)) as object;
    return f.success({ ...raw, id: firstGround.id });
  } } }));
  refused(replay.ground(f.id, 'w', 'h', 'start', f.lease), 'immutable SessionGrounding identity');
  refused(f.graph.open({ ...f.run, budget: { ...f.run.budget, maxOutstanding: 2 } }), 'immutable run opening');
  expect(value(f.graph.read(f.id)).identities.filter(i => i.type === 'RunBudget')).toHaveLength(1);
});
