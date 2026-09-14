import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { createFactStore, decodeVersion } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeShape, decodeShapeChangeDocument,
  generateRegister, generationOf, loadRegister, resolveOwnerReferenceEnrollments } from '../../src/register/index.js';
import type { FactReference, ShapeChangeBinding } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { hash, json, setup, value } from './fixtures.js';
import { generationRegistration, ownedSchema, vectorAt, versionSchema } from './normal-provider-fixture.js';

describe.skip('round-eight exact owner enrollment signatures SKIPPED: GRANT:NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment', () => {
  it('P3-NF-09 resolves a retained enrollment through real admitted Part Two and Part Three history', () => {
    const f = factsFixture(), s = setup(), root = f.fact(), since = f.next(root);
    const shapeInput = JSON.parse(JSON.stringify(s.context.shape)); shapeInput.parts.push(14);
    const shape = value(decodeShape(shapeInput, s.context)); const context = { ...s.context, shape };
    const enrollment = { part: 14, owner: 'part-fourteen', manifest: {
      path: 'register-source/owner-references/part-fourteen.json', hash: hash({ owner: 'part-fourteen' }) } } as const;
    const approval: FactReference = { owner: 'part-two', name: 'FactEnvelope', id: 'approval:enrollment' };
    const document = value(decodeShapeChangeDocument(json('ShapeChangeDocument', { id: 'historical-enrollment',
      parent: hash({ previous: true }), candidateShape: hash(shape),
      changes: [{ operation: 'add', path: `/parts/${shape.parts.length - 1}`, after: 14 }],
      ownerReferences: [enrollment], approvedIn: approval }), context));
    const binding: ShapeChangeBinding = { parent: document.parent, candidateShape: document.candidateShape,
      document: { path: 'register-source/shape-changes/part-fourteen.json', hash: value(canonical(document)).hash }, approval };
    const encoded = value(canonical(binding)); f.capture(encoded.bytes, encoded.hash);
    const signedApproval = f.authorize({ id: approval.id, artifact: encoded.hash, base: 'base:enrollment' });
    const version = { id: 'shape:part-fourteen:v1', subject: 'register-shape:part-fourteen', content: binding,
      contentHash: encoded.hash, since: since.id, supersedes: [], approvedIn: signedApproval.id,
      base: 'base:enrollment', landedIn: null };
    const versionContext = { ...f.ctx, facts: [root, since],
      schemas: [f.schema, versionSchema('register-shape-version-record', f.scope)],
      grants: [{ factId: root.id, grant: f.g }] };
    expect(value(decodeVersion(version, versionContext, f.scope, [], { owner: 'part-ten', merges: [] })).id).toBe(version.id);
    const shapeVersion = f.next(since,
      { kind: 'register-shape-version-record', body: { record: JSON.stringify(version) } }, versionContext);
    const register = value(generateRegister({ ...s.input(), extract: { ...s.extract, vector: vectorAt(shapeVersion) } }, context));
    const generation = value(generationOf(register, context));
    const forceRecord = json('GenerationRecord', { generation, at: f.now });
    const registration = generationRegistration(forceRecord, context, f);
    const facts = { ...versionContext, facts: [], schemas: [...versionContext.schemas,
      ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope)], ownedBodies: [registration] };
    const force = f.next(shapeVersion, { kind: 'generation-record', body: { record: forceRecord } }, facts);
    const rows = [root, since, shapeVersion, force];
    const provider = createPartTwoRegisterProvider({
      store: createFactStore(facts, { owner: 'part-ten', read: () => rows,
        append: () => f.success({ kind: 'local-durable' as const }) }),
      authority: createPartTwoRegisterAuthority({ facts, scope: f.scope,
        landing: { owner: 'part-ten', merges: [] }, context }),
      horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: force.segment.position }, observedAt: 100, closed: false } },
        stalenessBound: 100 }, context,
    });
    const parent = value(loadRegister(register, generation, context, provider, f.now));

    expect(value(provider.verifyShapeChange(binding))).toEqual(approval);
    expect(value(resolveOwnerReferenceEnrollments([enrollment], parent, shape, null, provider, context,
      undefined, [{ binding: binding as Extract<ShapeChangeBinding, { approval: FactReference }>, document }])))
      .toEqual([enrollment]);
    expect(() => value(resolveOwnerReferenceEnrollments([enrollment], parent, shape, null, provider, context)))
      .toThrow('one exact signed shape-change document');
  });
});
