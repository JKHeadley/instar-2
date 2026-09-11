import { describe, expect, it } from 'vitest';
import type { Json } from '../../src/index.js';
import { canonical } from '../../src/index.js';
import { createFactStore, registerOwnedBody } from '../../src/facts/index.js';
import type { FactSchema, OwnedShape } from '../../src/facts/index.js';
import { createPartTwoRegisterAuthority, createPartTwoRegisterProvider, decodeExtract, generationOf, loadRegister, readRegisterEntry } from '../../src/register/index.js';
import type { FactPositionVectorReference, PartTwoRegisterAuthorityPort, ShapeChangeBinding } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { detail, json, setup, value } from '../register/fixtures.js';

function policy(input: Json): OwnedShape {
  if (input === null) return { kind: 'null' };
  if (typeof input === 'string') return { kind: 'text', maxLength: Math.max(1, input.length) };
  if (typeof input === 'number') return { kind: 'integer' };
  if (typeof input === 'boolean') return { kind: 'boolean' };
  if (Array.isArray(input)) return { kind: 'array', maxLength: Math.max(1, input.length), items: input.length ? policy(input[0]!) : { kind: 'null' } };
  return { kind: 'object', fields: Object.fromEntries(Object.entries(input).map(([key, child]) => [key, policy(child)])) };
}

describe('Part Two register provider', () => {
  it('P3-NF-09 P3-NF-21 P3-NF-23 uses the landed version decoder for complete history and exact approval', () => {
    const f = factsFixture(), s = setup(); const root = f.fact(), since = f.next(root);
    const content = s.declaration(); const encoded = value(canonical(content)); f.capture(encoded.bytes, encoded.hash);
    const base = 'base:register'; const landingCommit = 'merge:register';
    const approval = f.authorize({ id: 'approval:store:v1', artifact: encoded.hash, base, action: { kind: 'merge', scope: f.scope } });
    const version = { id: 'store:v1', subject: 'store', content, contentHash: encoded.hash, since: since.id, supersedes: [],
      approvedIn: approval.id, base, landedIn: landingCommit };
    const row = { id: 'store', version: 'store:v1', status: 'live' as const, since: since.id, supersedes: [],
      approvedIn: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: approval.id },
      landedIn: landingCommit, base, contentHash: encoded.hash };
    const extract = value(decodeExtract(json('ChainExtract', { vector: s.extract.vector, rows: [row] }), s.context));
    const register = s.build([content], { extract }); const generation = value(generationOf(register, s.context));
    const generationRecord = JSON.parse(JSON.stringify(json('GenerationRecord', { generation, at: f.now }))) as Json;
    const registration = value(registerOwnedBody({ owner: 'part-three', name: 'GenerationRecord', currentVersion: 1,
      versions: { 1: { validate: input => ({ ok: true as const, value: input }) } }, migrations: {},
      decodeCurrent: input => ({ ok: true as const, value: input }) }, policy(generationRecord), f.c));
    const generationSchema: FactSchema = { kind: 'generation-record', version: 1,
      fields: { record: { kind: 'owned', owner: 'part-three', name: 'GenerationRecord' } }, machineScope: 'shared',
      standing: 'requester', action: 'work', scope: f.scope, causallyBound: false, requiredReferences: [], authority: 'none' };
    const factContext = { ...f.ctx, schemas: [f.schema, generationSchema], ownedBodies: [registration] };
    const generationFact = f.next(since, { kind: 'generation-record', body: { record: generationRecord } }, factContext);
    const records = [root, since, generationFact];
    const store = createFactStore(factContext, { owner: 'part-ten', read: () => records,
      append: () => f.success({ kind: 'local-durable' as const }) });

    const shapeApprovalId = 'approval:shape:v1';
    const binding: ShapeChangeBinding = { parent: generation.id, candidateShape: value(canonical(s.context.shape)).hash,
      document: { path: 'register-source/shape-changes/part-fourteen.json', hash: value(canonical({ approved: true })).hash },
      approval: { owner: 'part-two', name: 'FactEnvelope', id: shapeApprovalId } };
    const shapeEncoded = value(canonical(binding)); f.capture(shapeEncoded.bytes, shapeEncoded.hash);
    const shapeApproval = f.authorize({ id: shapeApprovalId, artifact: shapeEncoded.hash, base: 'base:shape' });
    const shapeVersion = { id: 'shape:v1', subject: 'register-shape:part-fourteen', content: binding,
      contentHash: shapeEncoded.hash, since: since.id, supersedes: [], approvedIn: shapeApproval.id, base: 'base:shape', landedIn: null };
    const authorityFacts = { ...factContext, facts: [root, since], grants: [{ factId: root.id, grant: f.g }] };
    const vector: FactPositionVectorReference = generation.vector;
    const authority = createPartTwoRegisterAuthority({ vector, facts: authorityFacts, scope: f.scope,
      landing: { owner: 'part-ten', merges: [{ commit: landingCommit, onMain: true, parentCount: 2, reviewedBase: base }] },
      versions: [version], shapeChanges: [shapeVersion], context: s.context });
    const provider = createPartTwoRegisterProvider({ store, authority, horizon: {
      lineages: { 'machine-a': { head: { epoch: 0, position: 2 }, observedAt: f.now.value, closed: false } }, stalenessBound: 100,
    }, context: s.context });

    expect(value(provider.verifyExtract(extract))).toEqual(vector);
    expect(value(provider.enteringForce(generation)).generation).toEqual(generation);
    expect(value(provider.verifyShapeChange(binding)).id).toBe(shapeApproval.id);
    expect(value(provider.isCurrent(vector, f.now))).toBe(true);
    expect(value(provider.resolveReference({ provider: 'record', id: root.id, kind: 'note' }))).toBe(true);
    const loaded = value(loadRegister(register, generation, s.context, provider, f.now));
    expect(value(readRegisterEntry('store', loaded, s.context)).declaration.id).toBe('store');

    const omitted = value(decodeExtract(json('ChainExtract', { vector, rows: [] }), s.context));
    expect(detail(provider.verifyExtract(omitted))).toContain('complete current');
    const changed = value(decodeExtract(json('ChainExtract', { vector, rows: [{ ...row,
      contentHash: value(canonical({ ...content, status: 'retired' })).hash, status: 'retired' }] }), s.context));
    expect(detail(provider.verifyExtract(changed))).toContain('complete current');
    expect(detail(provider.verifyShapeChange({ ...binding, document: { ...binding.document,
      hash: value(canonical({ tampered: true })).hash } }))).toContain('no unique current');
    expect(() => createPartTwoRegisterProvider({ store, authority: { owner: 'part-two', vector,
      verifyExtract: () => f.success(vector), verifyShapeChange: () => f.success(binding.approval!) } as PartTwoRegisterAuthorityPort,
    horizon: { lineages: {}, stalenessBound: 100 }, context: s.context })).toThrow('landed Part Two version-chain');
  });
});
