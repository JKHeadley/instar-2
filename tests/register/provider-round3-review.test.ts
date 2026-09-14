import { describe, expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { foldProjection } from '../../src/projections/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeShape, generationOf, loadRegister, readRegisterEntry } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { clone, detail, json, setup, value } from './fixtures.js';
import { generationRegistration, ownedSchema, vectorAt } from './normal-provider-fixture.js';

describe('round-three provider review regressions', () => {
  it('P3-NF-23 follows Part Two correction selection and refuses a superseded correction', () => {
    const f = factsFixture(), s = setup();
    const context = { ...f.ctx, schemas: [{ ...f.schema, fields: { ...f.schema.fields, corrects: { kind: 'reference' as const } }, optional: ['corrects'] }] };
    const original = f.fact({}, context);
    const first = f.next(original, { body: { identity: 'one', amount: '20', corrects: original.id } }, context);
    const latest = f.next(first, { body: { identity: 'one', amount: '30', corrects: original.id } }, context);
    const records = [original, first, latest];
    const store = createFactStore(context, { owner: 'part-ten', read: () => records, append: () => f.success({ kind: 'local-durable' }) });
    const lineages = { 'machine-a': { head: { epoch: 0, position: 2 }, observedAt: 100, closed: false } };
    const snapshot = value(store.readForProjection());
    const owner = value(foldProjection({ id: 'review.corrections', class: 'authority-answering', stalenessBound: 100,
      retention: 'all-identities', decisions: { note: { kind: 'folds', merge: 'additive', identity: 'identity', value: 'amount' } } },
    snapshot, { reference: s.context.types.register.generation, kinds: ['note'], lineages }, s.context));
    expect(owner.corrections).toEqual([{ original: original.id, replacement: latest.id }]);
    const authority = createPartTwoRegisterAuthority({ facts: context, scope: f.scope,
      landing: { owner: 'part-ten', merges: [] }, context: s.context });
    const provider = createPartTwoRegisterProvider({ store, authority, horizon: { lineages, stalenessBound: 100 },
      context: s.context, types: { ...s.context.types, now: f.now } });
    expect(detail(provider.resolveReference({ provider: 'record', id: original.id, kind: 'note' }))).toContain('corrected');
    expect(detail(provider.resolveReference({ provider: 'record', id: first.id, kind: 'note' }))).toContain('corrected');
    expect(value(provider.resolveReference({ provider: 'record', id: latest.id, kind: 'note' }))).toBe(true);
  });

  it('P3-NF-23 rechecks an already loaded register with the concrete provider and consumer clock', () => {
    const f = factsFixture(), s = setup(); const first = f.fact();
    const vector = vectorAt(first); const register = s.build(undefined, { extract: { ...s.extract, vector } });
    const generation = value(generationOf(register, s.context));
    const record = json('GenerationRecord', { generation, at: f.now });
    const registration = generationRegistration(record, s.context, f);
    const facts = { ...f.ctx, schemas: [f.schema, ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope)],
      ownedBodies: [registration] };
    const force = f.next(first, { kind: 'generation-record', body: { record } }, facts);
    const store = createFactStore(facts, { owner: 'part-ten', read: () => [first, force], append: () => f.success({ kind: 'local-durable' }) });
    const authority = createPartTwoRegisterAuthority({ facts, scope: f.scope,
      landing: { owner: 'part-ten', merges: [] }, context: s.context });
    const provider = createPartTwoRegisterProvider({ store, authority, horizon: {
      lineages: { 'machine-a': { head: { epoch: 0, position: 1 }, observedAt: 100, closed: false } }, stalenessBound: 100,
    }, context: s.context });
    const loaded = value(loadRegister(register, generation, s.context, provider, f.now));
    expect(value(readRegisterEntry('store', loaded, s.context)).declaration.id).toBe('store');
    expect(detail(readRegisterEntry('store', loaded, { ...s.context, types: { ...s.context.types, now: f.clock(201) } })))
      .toContain('current entering-force');
  });

  it('P3-NF-02 refuses a present null nested schema instead of silently dropping it', () => {
    const s = setup(); const malformed = clone(s.context.shape) as unknown as { kinds: { name: string; fields: { name: string; schema?: unknown }[] }[] };
    const field = malformed.kinds.find(kind => kind.name === 'stores')!.fields.find(item => item.name === 'machineScope')!;
    field.schema = null;
    expect(detail(decodeShape(malformed, s.context))).toMatch(/schema|object/);
  });
});
