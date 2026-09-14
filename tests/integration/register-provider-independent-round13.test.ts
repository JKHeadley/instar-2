import { describe, expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, generationOf, loadRegister,
  readRegisterEntry } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { detail, json, setup, value } from '../register/fixtures.js';
import { generationRegistration, ownedSchema, vectorAt } from '../register/normal-provider-fixture.js';

function fixture() {
  const f = factsFixture(), s = setup(), root = f.fact();
  const vector = vectorAt(root);
  const register = s.build(undefined, { extract: { ...s.extract, vector } });
  const generation = value(generationOf(register, s.context));
  const record = json('GenerationRecord', { generation, at: f.now });
  const registration = generationRegistration(record, s.context, f);
  const context = { ...f.ctx, facts: [], schemas: [f.schema,
    ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope),
    { ...f.schema, kind: 'retraction', fields: { target: { kind: 'reference' as const },
      reason: { kind: 'text' as const, maxLength: 100 } } }], ownedBodies: [registration] };
  const force = f.next(root, { kind: 'generation-record', body: { record } }, context);
  const rows = [root, force];
  const lineages = { 'machine-a': { head: { epoch: 0, position: 1 }, observedAt: 100, closed: false } };
  const store = createFactStore(context, { owner: 'part-ten', read: () => rows,
    append: () => { throw new Error('read-only fixture'); } });
  const authority = createPartTwoRegisterAuthority({ facts: context, scope: f.scope,
    landing: { owner: 'part-ten', merges: [] }, context: s.context });
  const provider = createPartTwoRegisterProvider({ store, authority,
    horizon: { lineages, stalenessBound: 100 }, context: s.context });
  return { f, s, context, root, force, rows, lineages, provider, register, generation, record, vector, store };
}

describe('round-thirteen independent normal provider data validation', () => {
  it('P3-NF-21 accepts an identical entering-force replay without invalidating loaded or fresh reads', () => {
    const x = fixture();
    const loaded = value(loadRegister(x.register, x.generation, x.s.context, x.provider, x.f.now));
    expect(value(readRegisterEntry('store', loaded, x.s.context))).toBeDefined();

    const replay = x.f.next(x.force, { kind: 'generation-record', body: { record: x.record } }, x.context);
    x.rows.push(replay); x.lineages['machine-a'].head.position = 2;

    expect(value(x.store.readForProjection()).entries.every(entry =>
      entry.taint.length === 0 && entry.conflicts.length === 0)).toBe(true);
    expect(value(x.provider.isCurrent(x.vector, x.f.now))).toBe(true);
    expect(value(x.provider.enteringForce(x.generation))).toEqual(x.record);
    expect(value(readRegisterEntry('store', loaded, x.s.context))).toBeDefined();
    expect(value(loadRegister(x.register, x.generation, x.s.context, x.provider, x.f.now))).toBeDefined();
  });

  it('P3-NF-21 refuses different entering-force values under one generation identity', () => {
    const x = fixture();
    const different = json('GenerationRecord', {
      generation: { ...x.generation, vector: vectorAt(x.force) }, at: x.f.now,
    });
    x.rows.push(x.f.next(x.force, { kind: 'generation-record', body: { record: different } }, x.context));
    x.lineages['machine-a'].head.position = 2;
    expect(detail(x.provider.enteringForce(x.generation))).toContain('single consistent');
  });

  it('P3-NF-23 re-resolves a stale public reference through the owner projection', () => {
    const x = fixture();
    expect(value(x.provider.resolveReference({ provider: 'record', id: x.root.id, kind: 'note' }))).toBe(true);
    (x.s.context.types as unknown as { now: typeof x.f.now }).now = x.f.clock(201);
    expect(value(x.provider.isCurrent(x.vector, x.f.clock(201)))).toBe(false);
    expect(detail(x.provider.resolveReference({ provider: 'record', id: x.root.id, kind: 'note' })))
      .toMatch(/stale|current/);
  });
});
