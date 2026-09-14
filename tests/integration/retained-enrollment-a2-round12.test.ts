import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeShape, decodeShapeChangeDocument,
  generateRegister, generationOf, loadRegister, resolveOwnerReferenceEnrollments, shapeDifferences } from '../../src/register/index.js';
import type { FactReference, OwnerReferenceEnrollment, ShapeChangeBinding } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { detail, hash, json, setup, value } from '../register/fixtures.js';
import { generationRegistration, ownedSchema, vectorAt, versionSchema } from '../register/normal-provider-fixture.js';

describe.skip('round-twelve retained enrollment authority cases SKIPPED: GRANT:NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment', () => {
  it('P3-NF-09 P3-NF-21 reviewer cases valid, unwitnessed-parent, wrong-candidate-shape, and wrong-shape-difference re-resolve historical shape data', () => {
    for (const variant of ['valid', 'unwitnessed-parent', 'wrong-candidate-shape', 'wrong-shape-difference'] as const) {
      const f = factsFixture(), s = setup(), root = f.fact(), since = f.next(root);
      const old = s.build(undefined, { extract: { ...s.extract, vector: vectorAt(root) } });
      const oldGeneration = value(generationOf(old, s.context));
      const shapeRaw = JSON.parse(JSON.stringify(s.context.shape)); shapeRaw.parts.push(14);
      const shape = value(decodeShape(shapeRaw, s.context)); const context = { ...s.context, shape };
      const enrollment: OwnerReferenceEnrollment = { part: 14, owner: 'part-fourteen', manifest: {
        path: 'register-source/owner-references/part-fourteen.json', hash: hash({ owner: 'part-fourteen' }) } };
      const approval: FactReference = { owner: 'part-two', name: 'FactEnvelope', id: 'approval:enrollment' };
      const document = value(decodeShapeChangeDocument(json('ShapeChangeDocument', { id: variant,
        parent: variant === 'unwitnessed-parent' ? hash({ neverEnteredForce: true }) : oldGeneration.id,
        candidateShape: variant === 'wrong-candidate-shape' ? hash({ notAShape: true }) : hash(shape),
        changes: variant === 'wrong-shape-difference'
          ? [{ operation: 'add', path: '/parts/9999', after: 99 }]
          : shapeDifferences(s.context.shape, shape),
        ownerReferences: [enrollment], approvedIn: approval }), context));
      const binding: Extract<ShapeChangeBinding, { approval: FactReference }> = {
        parent: document.parent, candidateShape: document.candidateShape,
        document: { path: 'register-source/shape-changes/part-fourteen.json', hash: hash(document) }, approval };
      const encoded = value(canonical(binding)); f.capture(encoded.bytes, encoded.hash);
      const signedApproval = f.authorize({ id: approval.id, artifact: encoded.hash, base: 'base:shape' });
      const version = { id: `shape:14:${variant}`, subject: 'register-shape:part-fourteen', content: binding,
        contentHash: encoded.hash, since: since.id, supersedes: [], approvedIn: signedApproval.id,
        base: 'base:shape', landedIn: null };
      const oldRecord = json('GenerationRecord', { generation: oldGeneration, at: f.now });
      const registration = generationRegistration(oldRecord, context, f);
      const factContext = { ...f.ctx, facts: [], schemas: [f.schema,
        versionSchema('register-shape-version-record', f.scope),
        ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope)],
        ownedBodies: [registration], grants: [{ factId: root.id, grant: f.g }] };
      const oldForce = f.next(since, { kind: 'generation-record', body: { record: oldRecord } }, factContext);
      const versionFact = f.next(oldForce,
        { kind: 'register-shape-version-record', body: { record: JSON.stringify(version) } }, factContext);
      const current = value(generateRegister({ ...s.input(), extract: { ...s.extract, vector: vectorAt(versionFact) } }, context));
      const generation = value(generationOf(current, context));
      const force = f.next(versionFact, { kind: 'generation-record', body: {
        record: json('GenerationRecord', { generation, at: f.now }) } }, factContext);
      const rows = [root, since, oldForce, versionFact, force];
      const provider = createPartTwoRegisterProvider({
        store: createFactStore(factContext, { owner: 'part-ten', read: () => rows,
          append: () => f.success({ kind: 'local-durable' as const }) }),
        authority: createPartTwoRegisterAuthority({ facts: factContext, scope: f.scope,
          landing: { owner: 'part-ten', merges: [] }, context }),
        horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: force.segment.position },
          observedAt: 100, closed: false } }, stalenessBound: 100 }, context,
      });
      const parent = value(loadRegister(current, generation, context, provider, f.now));
      const result = resolveOwnerReferenceEnrollments([enrollment], parent, shape, null, provider, context,
        undefined, [{ binding, document }]);

      if (variant === 'valid') expect(value(result)).toEqual([enrollment]);
      else if (variant === 'unwitnessed-parent') expect(detail(result)).toContain('P3-NF-21');
      else if (variant === 'wrong-candidate-shape') expect(detail(result)).toContain('candidate differs');
      else expect(detail(result)).toContain('exact shape entries changed');
    }
  });
});
