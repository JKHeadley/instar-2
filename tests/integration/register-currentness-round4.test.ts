import { describe, expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, generateAgainstParent, generationOf,
  loadRegister, readRegisterEntry } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { detail, json, setup, value } from '../register/fixtures.js';
import { generationRegistration, ownedSchema, vectorAt } from '../register/normal-provider-fixture.js';

describe('round-four current owner re-resolution', () => {
  it('P3-NF-21/23 re-resolves same-clock withdrawal and parent freshness at every consequential use', () => {
    const f = factsFixture(), s = setup();
    const retraction = { ...f.schema, kind: 'retraction', fields: {
      target: { kind: 'reference' as const }, reason: { kind: 'text' as const, maxLength: 100 },
    } };
    const root = f.fact(); const vector = vectorAt(root);
    const register = s.build(undefined, { extract: { ...s.extract, vector } });
    const generation = value(generationOf(register, s.context));
    const record = json('GenerationRecord', { generation, at: f.now });
    const registration = generationRegistration(record, s.context, f);
    const context = { ...f.ctx, facts: [], schemas: [f.schema, retraction,
      ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope)], ownedBodies: [registration] };
    const force = f.next(root, { kind: 'generation-record', body: { record } }, context);
    const records = [root, force];
    const lineages = { 'machine-a': { head: { epoch: 0, position: 1 }, observedAt: 100, closed: false } };
    const store = createFactStore(context, { owner: 'part-ten', read: () => records,
      append: () => f.success({ kind: 'local-durable' as const }) });
    const authority = createPartTwoRegisterAuthority({ facts: context, scope: f.scope,
      landing: { owner: 'part-ten', merges: [] }, context: s.context });
    const provider = createPartTwoRegisterProvider({ store, authority,
      horizon: { lineages, stalenessBound: 100 }, context: s.context });
    const loaded = value(loadRegister(register, generation, s.context, provider, f.now));
    expect(value(readRegisterEntry('store', loaded, s.context)).declaration.id).toBe('store');

    const at200 = { ...s.context, types: { ...s.context.types, now: f.clock(200) } };
    const at201 = { ...s.context, types: { ...s.context.types, now: f.clock(201) } };
    expect(value(generateAgainstParent({ ...s.input(), extract: register.extract }, loaded, loaded.shape, null,
      provider, at200)).commit).toBe(register.commit);
    expect(detail(generateAgainstParent({ ...s.input(), extract: register.extract }, loaded, loaded.shape, null,
      provider, at201))).toContain('parent requires verified entering-force');

    const withdrawn = f.next(force, { kind: 'retraction', body: { target: force.id, reason: 'withdrawn' } }, context);
    records.push(withdrawn); lineages['machine-a'].head.position = 2;
    expect(detail(provider.enteringForce(generation))).toContain('no unique current entering-force');
    expect(detail(readRegisterEntry('store', loaded, s.context))).toContain('current entering-force');
  });
});
