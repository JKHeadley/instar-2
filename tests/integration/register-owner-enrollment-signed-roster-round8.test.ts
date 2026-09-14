import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { createFactStore, decodeVersion } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeShape, decodeShapeChangeDocument,
  generateRegister, generationOf, loadRegister, resolveOwnerReferenceEnrollments, shapeDifferences } from '../../src/register/index.js';
import type { FactReference, ShapeChangeBinding } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { hash, json, setup, value } from '../register/fixtures.js';
import { generationRegistration, ownedSchema, vectorAt, versionSchema } from '../register/normal-provider-fixture.js';

describe.skip('round-eight signed roster-only enrollment regression SKIPPED: GRANT:NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment', () => {
  it('P3-NF-09 does not convert a signed part-roster addition into approval of a manifest tuple the document omits', () => {
    const f = factsFixture(), s = setup(), root = f.fact(), since = f.next(root);
    const oldRegister = s.build(undefined, { extract: { ...s.extract, vector: vectorAt(root) } });
    const oldGeneration = value(generationOf(oldRegister, s.context));
    const shapeRaw = JSON.parse(JSON.stringify(s.context.shape)); shapeRaw.parts.push(14);
    const shape = value(decodeShape(shapeRaw, s.context)); const context = { ...s.context, shape };
    const approval: FactReference = { owner: 'part-two', name: 'FactEnvelope', id: 'approval:roster-only' };
    const rosterDocument = value(decodeShapeChangeDocument(json('ShapeChangeDocument', { id: 'roster-only',
      parent: oldGeneration.id, candidateShape: hash(shape), changes: shapeDifferences(s.context.shape, shape),
      ownerReferences: [], approvedIn: approval }), s.context));
    const rosterBinding: ShapeChangeBinding = { parent: oldGeneration.id, candidateShape: hash(shape),
      document: { path: 'register-source/shape-changes/roster-only.json', hash: hash(rosterDocument) }, approval };
    const rosterEncoded = value(canonical(rosterBinding)); f.capture(rosterEncoded.bytes, rosterEncoded.hash);
    const signed = f.authorize({ id: approval.id, artifact: rosterEncoded.hash, base: 'base:roster' });
    const version = { id: 'shape:roster:v1', subject: 'register-shape:part-fourteen', content: rosterBinding,
      contentHash: rosterEncoded.hash, since: since.id, supersedes: [], approvedIn: signed.id,
      base: 'base:roster', landedIn: null };
    const versionContext = { ...f.ctx, facts: [root, since],
      schemas: [f.schema, versionSchema('register-shape-version-record', f.scope)], grants: [{ factId: root.id, grant: f.g }] };
    expect(value(decodeVersion(version, versionContext, f.scope, [], { owner: 'part-ten', merges: [] })).id).toBe(version.id);
    const versionFact = f.next(since, { kind: 'register-shape-version-record', body: { record: JSON.stringify(version) } }, versionContext);
    const register = value(generateRegister({ ...s.input(), extract: { ...s.extract, vector: vectorAt(versionFact) } }, context));
    const generation = value(generationOf(register, context)); const forceRecord = json('GenerationRecord', { generation, at: f.now });
    const registration = generationRegistration(forceRecord, context, f);
    const facts = { ...versionContext, facts: [], schemas: [...versionContext.schemas,
      ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope)], ownedBodies: [registration] };
    const force = f.next(versionFact, { kind: 'generation-record', body: { record: forceRecord } }, facts);
    const rows = [root, since, versionFact, force];
    const provider = createPartTwoRegisterProvider({ store: createFactStore(facts, { owner: 'part-ten', read: () => rows,
      append: () => f.success({ kind: 'local-durable' as const }) }),
      authority: createPartTwoRegisterAuthority({ facts, scope: f.scope,
        landing: { owner: 'part-ten', merges: [] }, context }),
      horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: force.segment.position }, observedAt: 100, closed: false } },
        stalenessBound: 100 }, context });
    const parent = value(loadRegister(register, generation, context, provider, f.now));
    const enrollment = { part: 14, owner: 'part-fourteen', manifest: {
      path: 'register-source/owner-references/part-fourteen.json', hash: hash({ manifest: 'not enrolled' }) } } as const;
    const enrollmentDocument = value(decodeShapeChangeDocument({ ...rosterDocument, id: 'manifest-enrollment',
      ownerReferences: [enrollment] }, context));
    const enrollmentBinding: ShapeChangeBinding = { ...rosterBinding,
      document: { path: 'register-source/shape-changes/manifest-enrollment.json', hash: hash(enrollmentDocument) } };

    expect(() => value(resolveOwnerReferenceEnrollments([enrollment], parent, shape, null, provider, context,
      undefined, [{ binding: enrollmentBinding as Extract<ShapeChangeBinding, { approval: FactReference }>, document: enrollmentDocument }])))
      .toThrow('no unique current governed version approves this exact shape change');
    expect(() => value(resolveOwnerReferenceEnrollments([enrollment], parent, shape, null, provider, context)))
      .toThrow('one exact signed shape-change document');
  });
});
