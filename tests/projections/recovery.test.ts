import { expect, it } from 'vitest';
import { prepareSnapshot } from '../../src/facts/index.js';
import { foldProjection, checkpoint, rebuildProjection, signCheckpoint, restoreCheckpoint, readProjection, verifyRebuild } from '../../src/projections/index.js';
import { factsFixture, value, refused, point, privateKey, publicKey } from '../facts/fixtures.js';
function setup() {
  const f = factsFixture(), a = f.fact({ at: f.clock(90) }), b = f.next(a, { at: f.clock(110) });
  const late = f.fact({ machine: 'machine-b', segment: { machine: 'machine-b', epoch: 0, position: 0 }, at: f.clock(100) });
  const definition = { id: 'recover', class: 'authority-answering' as const, stalenessBound: 100, retention: 'all-identities' as const, decisions: { note: { kind: 'folds' as const, identity: 'identity', value: 'amount', merge: 'additive' as const } } };
  const generation = { reference: f.ctx.decode.register.generation, kinds: ['note'], lineages: { 'machine-a': { head: point(b), observedAt: 100, closed: false }, 'machine-b': { head: point(late), observedAt: 100, closed: false } } };
  const snapshot = (facts: typeof a[]) => value(prepareSnapshot(facts, f.ctx));
  const first = checkpoint(value(foldProjection(definition, snapshot([a]), generation, f.c)));
  const second = checkpoint(value(foldProjection(definition, snapshot([a, b]), generation, f.c)));
  return { ...f, a, b, late, definition, generation, snapshot, first, second };
}
it('P2-NF-57 P2-NF-58 checkpoint resume folds only suffix; late insertion selects the earlier checkpoint', () => {
  const f = setup(), all = f.snapshot([f.a, f.b, f.late]);
  const result = value(rebuildProjection(f.definition, all, f.generation, f.c, [f.second, f.first], 2));
  expect(result.folded).toBe(2); expect(result.resumedFrom).toEqual(f.first.vector); expect(result.view.values['note:one']).toBe('30');
  const genesis = checkpoint(value(foldProjection(f.definition, all, f.generation, f.c)));
  expect(value(verifyRebuild(genesis, checkpoint(result.view), f.c))).toBe('equal');
  const same = value(rebuildProjection(f.definition, all, f.generation, f.c, [checkpoint(result.view)], 0)); expect(same.folded).toBe(0);
  refused(rebuildProjection(f.definition, all, f.generation, f.c, [f.first], 1), 'budget exhausted');
});
it('P2-NF-46 P2-NF-58 serialized checkpoint restoration verifies signer, source statuses and content, then resumes', () => {
  const f = setup(), all = f.snapshot([f.a, f.b, f.late]);
  const certificate = signCheckpoint(f.first, 'local-cache', privateKey), keys = [{ id: 'local-cache', publicKey }];
  const restored = value(restoreCheckpoint(JSON.parse(JSON.stringify(certificate)), all, f.c, keys));
  refused(readProjection(restored.view, f.definition, f.now, f.c), 'only a prefix');
  const resumed = value(rebuildProjection(f.definition, all, f.generation, f.c, [restored], 2));
  expect(value(readProjection(resumed.view, f.definition, f.now, f.c)).stale).toEqual([]);
  refused(restoreCheckpoint(certificate, all, f.c, []), 'independently trusted');
  const changed = JSON.parse(JSON.stringify(certificate)); changed.payload.value.checkpoint.view.values['note:one'] = '999';
  refused(restoreCheckpoint(changed, all, f.c, keys), 'hash mismatch');
  expect(() => signCheckpoint({ ...f.first, view: { ...f.first.view, taint: [] } } as never, 'local-cache', privateKey)).toThrow('validated producer');
});
