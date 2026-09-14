import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeShape, decodeShapeChangeDocument,
  generationOf, loadRegister, resolveOwnerReferenceEnrollments, shapeDifferences } from '../../src/register/index.js';
import type { ShapeChangeBinding } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { detail, hash, json, setup, value } from '../register/fixtures.js';
import { generationRegistration, ownedSchema, vectorAt, versionSchema } from '../register/normal-provider-fixture.js';

describe.skip('round-seven witnessed owner enrollment authority SKIPPED: GRANT:NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment', () => {
  it('P3-NF-09 refuses an unwitnessed retained enrollment and resolves candidate additions through the real signed provider', () => {
    const f = factsFixture(), s = setup(), root = f.fact(), vector = vectorAt(root);
    const register = s.build(undefined, { extract: { ...s.extract, vector } });
    const generation = value(generationOf(register, s.context));
    const forceRecord = json('GenerationRecord', { generation, at: f.now });
    const registration = generationRegistration(forceRecord, s.context, f);
    const facts = { ...f.ctx, facts: [], schemas: [f.schema,
      versionSchema('register-shape-version-record', f.scope),
      ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope)], ownedBodies: [registration] };
    const force = f.next(root, { kind: 'generation-record', body: { record: forceRecord } }, facts);
    const records = [root, force];
    const provider = createPartTwoRegisterProvider({
      store: createFactStore(facts, { owner: 'part-ten', read: () => records,
        append: () => f.success({ kind: 'local-durable' as const }) }),
      authority: createPartTwoRegisterAuthority({ facts, scope: f.scope,
        landing: { owner: 'part-ten', merges: [] }, context: s.context }),
      horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: 1 }, observedAt: 100, closed: false } },
        stalenessBound: 100 }, context: s.context,
    });
    const parent = value(loadRegister(register, generation, s.context, provider, f.now));
    const enrollment = { part: 14, owner: 'part-fourteen', manifest: {
      path: 'register-source/owner-references/part-fourteen.json', hash: hash({}) } } as const;
    expect(detail(resolveOwnerReferenceEnrollments([enrollment], parent, parent.shape, null,
      provider, s.context))).toContain('part absent from the parent');

    const raw = JSON.parse(JSON.stringify(parent.shape)); raw.parts.push(14);
    const candidate = value(decodeShape(raw, s.context));
    const approval = { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: 'approval:part-fourteen' };
    const document = value(decodeShapeChangeDocument(json('ShapeChangeDocument', { id: 'part-fourteen',
      parent: generation.id, candidateShape: hash(candidate), changes: shapeDifferences(parent.shape, candidate),
      ownerReferences: [enrollment], approvedIn: approval }), s.context));
    const binding: ShapeChangeBinding = { parent: generation.id, candidateShape: hash(candidate),
      document: { path: 'register-source/shape-changes/part-fourteen.json', hash: value(canonical(document)).hash }, approval };
    expect(detail(resolveOwnerReferenceEnrollments([enrollment], parent, candidate, binding,
      provider, s.context, document))).toContain('no unique current governed version approves this exact shape change');
  });
});
