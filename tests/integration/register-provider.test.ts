import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonical } from '../../src/index.js';
import { createFactStore, decodeVersion } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeExtract, decodeShape,
  decodeShapeChangeDocument, generateAgainstParent, generationOf, loadRegister, readRegisterEntry,
  shapeDifferences } from '../../src/register/index.js';
import type { FactPositionVectorReference, PartTwoRegisterAuthorityPort, ShapeChangeBinding } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { detail, json, setup, value } from '../register/fixtures.js';
import { generationRegistration, ownedSchema, vectorAt, versionSchema } from '../register/normal-provider-fixture.js';
import { realRepositoryLanding } from '../register/repository-landing-round11.js';

describe('Part Two register provider', () => {
  it('P3-NF-09 P3-NF-21 P3-NF-23 uses the landed version decoder for complete history and exact approval', () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), 'instar-register-real-landing-'));
    try {
    const resolvedLanding = realRepositoryLanding(repositoryRoot);
    const f = factsFixture(), s = setup(); const root = f.fact(), since = f.next(root);
    const content = s.declaration(); const encoded = value(canonical(content)); f.capture(encoded.bytes, encoded.hash);
    const { base, commit: landingCommit, landing } = resolvedLanding;
    const approval = f.authorize({ id: 'approval:store:v1', artifact: encoded.hash, base, action: { kind: 'merge', scope: f.scope } });
    const version = { id: 'store:v1', subject: 'store', content, contentHash: encoded.hash, since: since.id, supersedes: [],
      approvedIn: approval.id, base, landedIn: landingCommit };
    const shapeApprovalId = 'approval:shape:v1';
    const versionContext = { ...f.ctx, facts: [root, since], grants: [{ factId: root.id, grant: f.g }] };
    const decodedVersion = value(decodeVersion(version, versionContext, f.scope, [], landing));
    const versionContextForStore = { ...versionContext,
      schemas: [f.schema, versionSchema('register-version-record', f.scope)] };
    const versionFact = f.next(since, { kind: 'register-version-record', body: { record: JSON.stringify(version) } }, versionContextForStore);
    const vector: FactPositionVectorReference = vectorAt(versionFact);
    const row = { id: 'store', version: 'store:v1', status: 'live' as const, since: since.id, supersedes: [],
      approvedIn: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: approval.id },
      landedIn: landingCommit, base, contentHash: encoded.hash };
    const extract = value(decodeExtract(json('ChainExtract', { vector, rows: [row] }), s.context));
    const register = s.build([content], { extract }); const generation = value(generationOf(register, s.context));
    const shapeInput = JSON.parse(JSON.stringify(s.context.shape)); shapeInput.parts.push(14);
    const candidate = value(decodeShape(shapeInput, s.context));
    const shapeApprovalReference = { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: shapeApprovalId };
    const document = value(decodeShapeChangeDocument(json('ShapeChangeDocument', { id: 'part-fourteen-shape',
      parent: generation.id, candidateShape: value(canonical(candidate)).hash,
      changes: shapeDifferences(s.context.shape, candidate), ownerReferences: [], approvedIn: shapeApprovalReference }), s.context));
    const binding: ShapeChangeBinding = { parent: generation.id, candidateShape: value(canonical(candidate)).hash,
      document: { path: 'register-source/shape-changes/part-fourteen.json', hash: value(canonical(document)).hash },
      approval: shapeApprovalReference };
    const shapeEncoded = value(canonical(binding)); f.capture(shapeEncoded.bytes, shapeEncoded.hash);
    const shapeApproval = f.authorize({ id: shapeApprovalId, artifact: shapeEncoded.hash, base: 'base:shape' });
    const shapeVersion = { id: 'shape:v1', subject: 'register-shape:part-fourteen', content: binding,
      contentHash: shapeEncoded.hash, since: since.id, supersedes: [], approvedIn: shapeApproval.id, base: 'base:shape', landedIn: null };
    const decodedShapeVersion = value(decodeVersion(shapeVersion, versionContextForStore, f.scope, [], landing));
    const generationRecord = json('GenerationRecord', { generation, at: f.now });
    const generationBody = generationRegistration(generationRecord, s.context, f);
    const factContext = { ...versionContextForStore, facts: [],
      schemas: [...versionContextForStore.schemas,
        versionSchema('register-shape-version-record', f.scope),
        ownedSchema('generation-record', 'part-three', 'GenerationRecord', f.scope)],
      ownedBodies: [generationBody] };
    const shapeFact = f.next(versionFact, { kind: 'register-shape-version-record', body: { record: JSON.stringify(shapeVersion) } }, factContext);
    const generationFact = f.next(shapeFact, { kind: 'generation-record', body: { record: generationRecord } }, factContext);
    const records = [root, since, versionFact, shapeFact, generationFact];
    const store = createFactStore(factContext, { owner: 'part-ten', read: () => records,
      append: () => f.success({ kind: 'local-durable' as const }) });
    const authority = createPartTwoRegisterAuthority({ facts: factContext, scope: f.scope,
      landing,
      context: s.context });
    const provider = createPartTwoRegisterProvider({ store, authority, horizon: {
      lineages: { 'machine-a': { head: { epoch: 0, position: 4 }, observedAt: f.now.value, closed: false } }, stalenessBound: 100,
    }, context: s.context, types: { ...s.context.types, now: f.now } });

    expect(decodedVersion.id).toBe(version.id);
    expect(decodedShapeVersion.id).toBe(shapeVersion.id);

    expect(value(provider.verifyExtract(extract))).toEqual(vector);
    expect(value(provider.enteringForce(generation)).generation).toEqual(generation);
    expect(value(provider.verifyShapeChange(binding)).id).toBe(shapeApproval.id);
    expect(value(provider.isCurrent(vector, f.now))).toBe(true);
    expect(value(provider.resolveReference({ provider: 'record', id: root.id, kind: 'note' }))).toBe(true);
    const loaded = value(loadRegister(register, generation, s.context, provider, f.now));
    expect(value(readRegisterEntry('store', loaded, s.context)).declaration.id).toBe('store');
    expect(value(generateAgainstParent(s.input(), loaded, candidate, binding, provider, s.context, document)).shape)
      .toEqual(candidate);
    const changedDocument = value(decodeShapeChangeDocument({ ...document, id: 'changed-document' }, s.context));
    expect(detail(generateAgainstParent(s.input(), loaded, candidate, binding, provider, s.context, changedDocument)))
      .toContain('bytes differ');

    const omitted = value(decodeExtract(json('ChainExtract', { vector, rows: [] }), s.context));
    expect(detail(provider.verifyExtract(omitted))).toContain('complete current');
    for (const id of ['vector:completely-invented', 'vector:foreign-machine-page']) {
      const inventedVector = { owner: 'part-two' as const, name: 'FactPositionVector' as const, id };
      const invented = value(decodeExtract(json('ChainExtract', { vector: inventedVector, rows: [row] }), s.context));
      expect(detail(provider.verifyExtract(invented))).toContain('does not name one admitted Part Two position witness');
      expect(detail(provider.isCurrent(inventedVector, f.now))).toContain('does not name one admitted Part Two position witness');
    }
    const cold = createFactStore(factContext, { owner: 'part-ten', read: () => [root, since],
      append: () => f.success({ kind: 'local-durable' as const }) });
    const coldAuthority = createPartTwoRegisterAuthority({ facts: { ...factContext, facts: records }, scope: f.scope,
      landing, context: s.context });
    const coldProvider = createPartTwoRegisterProvider({ store: cold, authority: coldAuthority, horizon: {
      lineages: { 'machine-a': { head: { epoch: 0, position: 1 }, observedAt: f.now.value, closed: false } }, stalenessBound: 100,
    }, context: s.context });
    expect(detail(coldProvider.verifyExtract(extract))).toContain('does not name one admitted Part Two position witness');
    expect(detail(coldProvider.isCurrent(vector, f.now))).toContain('does not name one admitted Part Two position witness');
    const invalidVersions = [
      { ...version, approvedIn: root.id },
      { ...version, content: { changed: true }, contentHash: value(canonical({ changed: true })).hash },
      { ...version, base: 'base:unapproved' },
    ];
    for (const invalidVersion of invalidVersions) {
      const invalidFact = f.next(since, { kind: 'register-version-record',
        body: { record: JSON.stringify(invalidVersion) } }, factContext);
      const invalidStore = createFactStore(factContext, { owner: 'part-ten', read: () => [root, since, invalidFact],
        append: () => f.success({ kind: 'local-durable' as const }) });
      const invalidProvider = createPartTwoRegisterProvider({ store: invalidStore,
        authority: createPartTwoRegisterAuthority({ facts: factContext, scope: f.scope, landing, context: s.context }),
        horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: 2 }, observedAt: f.now.value, closed: false } },
          stalenessBound: 100 }, context: s.context });
      const invalidExtract = value(decodeExtract(json('ChainExtract', { vector: vectorAt(invalidFact), rows: [row] }), s.context));
      expect(detail(invalidProvider.verifyExtract(invalidExtract))).toMatch(/approvedIn|content|base|approval/);
    }
    const noteShapeVersion = { ...shapeVersion, approvedIn: root.id };
    const noteShapeFact = f.next(since, { kind: 'register-shape-version-record',
      body: { record: JSON.stringify(noteShapeVersion) } }, factContext);
    const noteShapeStore = createFactStore(factContext, { owner: 'part-ten', read: () => [root, since, noteShapeFact],
      append: () => f.success({ kind: 'local-durable' as const }) });
    const noteShapeProvider = createPartTwoRegisterProvider({ store: noteShapeStore,
      authority: createPartTwoRegisterAuthority({ facts: factContext, scope: f.scope, landing, context: s.context }),
      horizon: { lineages: { 'machine-a': { head: { epoch: 0, position: 2 }, observedAt: f.now.value, closed: false } },
        stalenessBound: 100 }, context: s.context });
    expect(detail(noteShapeProvider.verifyShapeChange(binding))).toContain('approvedIn');
    const changed = value(decodeExtract(json('ChainExtract', { vector, rows: [{ ...row,
      contentHash: value(canonical({ ...content, status: 'retired' })).hash, status: 'retired' }] }), s.context));
    expect(detail(provider.verifyExtract(changed))).toContain('complete current');
    expect(detail(provider.verifyShapeChange({ ...binding, document: { ...binding.document,
      hash: value(canonical({ tampered: true })).hash } }))).toContain('no unique current');
    expect(() => createPartTwoRegisterProvider({ store, authority: { owner: 'part-two',
      verifyExtract: () => f.success(vector), verifyShapeChange: () => f.success(binding.approval!) } as PartTwoRegisterAuthorityPort,
    horizon: { lineages: {}, stalenessBound: 100 }, context: s.context })).toThrow('landed Part Two version-chain');
    } finally { rmSync(repositoryRoot, { recursive: true, force: true }); }
  });
});
