import { expect, it } from 'vitest';
import { checkpoint, foldProjection, readProjection, verifyRebuild } from '../../src/projections/index.js';
import type { ProjectionDefinition, ProjectionGeneration, FoldInput } from '../../src/projections/index.js';
import { decodeEnvelope, preimage } from '../../src/facts/index.js';
import { factsFixture, value, refused, point } from '../facts/fixtures.js';

function fixture() {
  const f = factsFixture(), a = f.fact(), b = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, body: { identity: 'one', amount: '20' } });
  const generation: ProjectionGeneration = { reference: f.ctx.decode.register.generation, kinds: ['note'], lineages: {
    'machine-a': { head: point(a), observedAt: 100, closed: false }, 'machine-b': { head: point(b), observedAt: 100, closed: false } } };
  const definition: ProjectionDefinition = { id: 'totals', class: 'informational', stalenessBound: 100, retention: 'all-identities', decisions: { note: { kind: 'folds', identity: 'identity', value: 'amount', merge: 'additive' } } };
  const inputs: FoldInput[] = [{ fact: a, taint: [] }, { fact: b, taint: [] }];
  const fold = (rows = inputs, def = definition, gen = generation) => foldProjection(def, rows, gen, f.c);
  return { ...f, a, b, generation, definition, inputs, fold };
}
it('P2-NF-35 retracted facts remain visible as retracted in the view', () => {
  const f = fixture(), ctx = { ...f.ctx, schemas: [...f.ctx.schemas, { ...f.schema, kind: 'retraction' }] };
  const retraction = f.next(f.a, { kind: 'retraction', body: { target: f.a.id, reason: 'wrong' } }, ctx);
  const def = { ...f.definition, decisions: { ...f.definition.decisions, retraction: { kind: 'ignores' as const, reason: 'fold primitive handles retractions' } } };
  const view = value(f.fold([...f.inputs, { fact: retraction, taint: [] }], def, { ...f.generation, kinds: ['note', 'retraction'] }));
  expect(view.values['note:one']).toBe('20'); expect(view.retractions).toEqual([retraction.id]);
  expect(value(decodeEnvelope(f.a, f.ctx)).contentHash).toBe(preimage(f.a).hash);
});
it('P2-NF-36 corrections fold as replacement pairs, never double counted', () => {
  const f = fixture(), original = f.fact({ body: { identity: 'one', amount: '400' } });
  const correction = f.next(original, { body: { identity: 'one', amount: '40', corrects: original.id } });
  const view = value(f.fold([{ fact: original, taint: [] }, { fact: correction, taint: [] }]));
  expect(view.values['note:one']).toBe('40'); expect(view.corrections).toEqual([{ original: original.id, replacement: correction.id }]);
});
it('P2-NF-46 folded output has no external write path', () => {
  const f = fixture(), view = value(f.fold()); expect(Object.isFrozen(view)).toBe(true); expect(Object.isFrozen(view.values)).toBe(true);
  expect(() => { Reflect.set(view.values, 'note:one', '999'); }).not.toThrow();
  expect(view.values['note:one']).toBe('30'); expect(Object.keys(view)).not.toContain('set');
});
it('P2-NF-47 a fold cannot consume a kind it did not declare', () => { const f = fixture(); refused(f.fold(f.inputs, { ...f.definition, decisions: {} }), 'input'); });
it('P2-NF-48 new kinds require folds/ignores; poison is quarantined without wedging other rows', () => {
  const f = fixture(); refused(f.fold(f.inputs, f.definition, { ...f.generation, kinds: ['note', 'new-kind'] }), 'input');
  const bad = f.fact({ body: { identity: 'bad', amount: 'not-a-number' } });
  const view = value(f.fold([{ fact: bad, taint: [] }, { fact: f.b, taint: [] }]));
  expect(view.conflicts[0]?.kind).toBe('poison-fact'); expect(view.values['note:one']).toBe('20');
});
it('P2-NF-49 a clock-reading callback is refused by the data-only projection boundary', () => {
  const f = fixture(); let ran = false;
  const def = { ...f.definition, fold() { ran = true; return Date.now(); } };
  refused(f.fold(f.inputs, def)); expect(ran).toBe(false);
});
it('P2-NF-50 other stores/caches cannot enter the closed fold definition', () => {
  const f = fixture(); let ran = false;
  const otherView = { read() { ran = true; return { authority: true }; } };
  refused(f.fold(f.inputs, { ...f.definition, peer: otherView } as typeof f.definition)); expect(ran).toBe(false);
});
it('P2-NF-51 adjacent swaps, duplicates and clock ordering cannot choose a concurrent winner', () => {
  const f = fixture(); const first = value(f.fold()), swapped = value(f.fold([...f.inputs].reverse())); expect(first).toEqual(swapped);
  expect(value(f.fold([...f.inputs, ...f.inputs]))).toEqual(first);
  const def = { ...f.definition, decisions: { note: { kind: 'folds' as const, identity: 'identity', value: 'amount', merge: 'exclusive-singleton' as const } } };
  for (const input of [f.inputs, [...f.inputs].reverse()]) { const view = value(f.fold(input, def)); expect(view.values).toEqual({}); expect(view.conflicts).toHaveLength(1); }
});
it('P2-NF-53 binary floats refuse; exact integer arithmetic preserves large quantities', () => {
  const f = fixture(), a = f.fact({ body: { identity: 'one', amount: 0.1 } });
  expect(value(f.fold([{ fact: a, taint: [] }])).conflicts[0]?.kind).toBe('poison-fact');
  const large = f.fact({ body: { identity: 'one', amount: '9007199254740993000000' } });
  expect(value(f.fold([{ fact: large, taint: [] }, { fact: f.b, taint: [] }])).values['note:one']).toBe('9007199254740993000020');
});
it('P2-NF-54 views include vector and registered known set; unknown staleness refuses authority', () => {
  const f = fixture(), view = value(f.fold(f.inputs, f.definition, { ...f.generation, lineages: { ...f.generation.lineages, 'machine-c': { head: null, observedAt: null, closed: false } } }));
  expect(view.foldedThrough['machine-a']).toEqual(point(f.a)); expect(view.knownLineages['machine-c']).toBeDefined();
  refused(readProjection(view, { ...f.definition, class: 'authority-answering' }, f.now, f.c), 'staleness');
});
it('P2-NF-55 stale authority refuses while the informational channel stays labelled', () => {
  const f = fixture(), view = value(f.fold());
  refused(readProjection(view, { ...f.definition, class: 'authority-answering' }, f.clock(201), f.c), 'staleness');
  expect(value(readProjection(view, f.definition, f.clock(201), f.c)).stale).toHaveLength(2);
  expect(value(readProjection(view, { ...f.definition, class: 'authority-answering' }, f.clock(200), f.c)).stale).toEqual([]);
  const authoritative = value(f.fold(f.inputs, { ...f.definition, class: 'authority-answering' }));
  refused(readProjection(authoritative, { ...f.definition, stalenessBound: 100000 }, f.clock(201), f.c), 'staleness');
});
it('P2-NF-56 conflicted authority never serves as live', () => {
  const f = fixture(), def = { ...f.definition, decisions: { note: { kind: 'folds' as const, identity: 'identity', value: 'amount', merge: 'exclusive-singleton' as const } } };
  const view = value(f.fold(f.inputs, def)); refused(readProjection(view, { ...def, class: 'authority-answering' }, f.now, f.c), 'conflicted');
});
it('P2-NF-57 rebuild comparisons must use the same pinned vector', () => {
  const f = fixture(), a = checkpoint(value(f.fold())), b = checkpoint(value(f.fold(f.inputs.slice(0, 1)))); refused(verifyRebuild(a, b, f.c), 'vectors differ');
});
it('P2-NF-58 changed view at the same vector fails rebuild equivalence', () => {
  const f = fixture(), a = checkpoint(value(f.fold())), bad = checkpoint({ ...a.view, values: { 'note:one': '999' } });
  refused(verifyRebuild(a, bad, f.c), 'divergence'); expect(value(verifyRebuild(a, checkpoint(value(f.fold())), f.c))).toBe('equal');
});
it('P2-NF-59 checkpoint has no authority to remove any underlying facts', () => {
  const f = fixture(), before = JSON.stringify(f.inputs), saved = checkpoint(value(f.fold()));
  expect(Object.keys(saved).sort()).toEqual(['hash', 'vector', 'view']); expect(JSON.stringify(f.inputs)).toBe(before);
  expect(value(f.fold()).values).toEqual(saved.view.values);
});
it('P2-NF-74 every folded kind must declare a merge class', () => {
  const f = fixture(), def = { ...f.definition, decisions: { note: { kind: 'folds', identity: 'identity', value: 'amount' } } };
  refused(f.fold(f.inputs, def as never), 'merge class');
});
it('P2-NF-76 provisional, contested and unavailable evidence taint propagates to authority', () => {
  const f = fixture();
  for (const taint of ['provisional', 'contested', 'evidence-unavailable'] as const) {
    const view = value(f.fold([{ fact: f.a, taint: [taint] }, f.inputs[1]!]));
    expect(view.taint).toContain(taint); refused(readProjection(view, { ...f.definition, class: 'authority-answering' }, f.now, f.c), 'tainted');
  }
});
it('cap-checked aggregate emits a violation, with no invented constitutional Conflict', () => {
  const f = fixture(), def = { ...f.definition, decisions: { note: { kind: 'folds' as const, identity: 'identity', value: 'amount', merge: 'cap-checked aggregate' as const, cap: '25' } } };
  const view = value(f.fold(f.inputs, def)); expect(view.conflicts[0]).toMatchObject({ kind: 'aggregate-breach' }); expect(view.conflicts[0]).not.toHaveProperty('constitutional');
});
