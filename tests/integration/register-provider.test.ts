import { describe, expect, it } from 'vitest';
import type { Json } from '../../src/index.js';
import { canonical } from '../../src/index.js';
import { createFactStore, registerOwnedBody } from '../../src/facts/index.js';
import type { FactSchema, OwnedShape } from '../../src/facts/index.js';
import { createPartTwoRegisterProvider, decodeExtract, generationOf, loadRegister, readRegisterEntry } from '../../src/register/index.js';
import type { FactPositionVectorReference, PartTwoRegisterAuthorityPort, ShapeChangeBinding } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { detail, json, setup, value } from '../register/fixtures.js';

function policy(input: Json): OwnedShape {
  if (input === null) return { kind: 'null' };
  if (typeof input === 'string') return { kind: 'text', maxLength: Math.max(1, input.length) };
  if (typeof input === 'number') return { kind: 'integer' };
  if (typeof input === 'boolean') return { kind: 'boolean' };
  if (Array.isArray(input)) return { kind: 'array', maxLength: Math.max(1, input.length), items: input.length ? policy(input[0]!) : { kind: 'null' } };
  return { kind: 'object', fields: Object.fromEntries(Object.entries(input).map(([key, value]) => [key, policy(value)])) };
}

describe('Part Two register provider', () => {
  it('P3-NF-09 P3-NF-21 P3-NF-23 uses owner-resolved witnesses, live repair state, exact namespaces, clocks, and position vectors', () => {
    const f = factsFixture(), s = setup();
    const generation = value(generationOf(s.build(), s.context));
    const record = JSON.parse(JSON.stringify(json('GenerationRecord', { generation, at: f.now }))) as Json;
    const registration = value(registerOwnedBody({ owner: 'part-three', name: 'GenerationRecord', currentVersion: 1,
      versions: { 1: { validate: input => ({ ok: true as const, value: input }) } }, migrations: {},
      decodeCurrent: input => ({ ok: true as const, value: input }) }, policy(record), f.c));
    const generationSchema: FactSchema = { kind: 'generation-record', version: 1,
      fields: { record: { kind: 'owned', owner: 'part-three', name: 'GenerationRecord' } }, machineScope: 'shared',
      standing: 'requester', action: 'work', scope: f.scope, causallyBound: false, requiredReferences: [], authority: 'none' };
    const retractionSchema: FactSchema = { kind: 'retraction', version: 1,
      fields: { target: { kind: 'text', maxLength: 256 }, reason: { kind: 'text', maxLength: 256 } }, machineScope: 'shared',
      standing: 'requester', action: 'work', scope: f.scope, causallyBound: false, requiredReferences: [], authority: 'none' };
    const factContext = { ...f.ctx, schemas: [f.schema, generationSchema, retractionSchema], ownedBodies: [registration] };
    const approvalFact = f.fact({}, factContext);
    const generationFact = f.next(approvalFact, { kind: 'generation-record', body: { record } }, factContext);
    const records = [approvalFact, generationFact];
    const storage = { owner: 'part-ten' as const, read: () => records,
      append: () => f.success({ kind: 'local-durable' as const }) };
    const store = createFactStore(factContext, storage);
    const vector: FactPositionVectorReference = generation.vector;
    const binding: ShapeChangeBinding = { parent: generation.id, candidateShape: value(canonical(s.context.shape)).hash,
      document: { path: 'register-source/shape-changes/part-fourteen.json', hash: value(canonical({ approved: true })).hash },
      approval: { owner: 'part-two', name: 'FactEnvelope', id: approvalFact.id } };
    const authority: PartTwoRegisterAuthorityPort = { owner: 'part-two', vector,
      verifyVersionRow: () => f.success({ since: binding.approval!, approval: binding.approval!, landing: binding.approval! }),
      verifyShapeChange: candidate => f.success(value(canonical(candidate)).bytes === value(canonical(binding)).bytes
        ? binding.approval! : { owner: 'part-two', name: 'FactEnvelope', id: 'missing:approval' }) };
    const makeProvider = (observedAt: number, position = records.length - 1) => createPartTwoRegisterProvider({ store, authority,
      horizon: { lineages: { 'machine-a': { head: { epoch: 0, position }, observedAt, closed: false } }, stalenessBound: 100 }, context: s.context });
    const extract = value(decodeExtract(json('ChainExtract', { vector, rows: [] }), s.context));
    const provider = makeProvider(f.now.value);

    expect(value(provider.verifyExtract(extract))).toEqual(vector);
    expect(value(provider.enteringForce(generation)).generation).toEqual(generation);
    expect(value(provider.verifyShapeChange(binding)).id).toBe(approvalFact.id);
    expect(value(provider.isCurrent(vector, f.now))).toBe(true);
    expect(value(provider.resolveReference({ provider: 'record', id: approvalFact.id, kind: 'note' }))).toBe(true);
    const loaded = value(loadRegister(s.build(), generation, s.context, provider, f.now));
    expect(value(readRegisterEntry('store', loaded, s.context)).declaration.id).toBe('store');
    expect(detail(provider.resolveReference({ provider: 'completely-foreign-owner', id: approvalFact.id }))).toContain('namespace');
    expect(detail(provider.isCurrent(vector, { value: 100 } as never))).toMatch(/clock|object|field/);
    expect(detail(provider.isCurrent(vector, { ...f.now, value: 'not-a-clock' } as never))).toMatch(/finite|number/);
    expect(value(makeProvider(f.now.value + 1).isCurrent(vector, f.clock(f.now.value + 1)))).toBe(true);
    expect(detail(provider.verifyShapeChange({ ...binding, document: { ...binding.document, hash: value(canonical({ tampered: true })).hash } }))).toContain('different record');

    const retractApproval = f.next(generationFact, { kind: 'retraction', body: { target: approvalFact.id, reason: 'withdrawn' } }, factContext);
    const retractGeneration = f.next(retractApproval, { kind: 'retraction', body: { target: generationFact.id, reason: 'superseded' } }, factContext);
    records.push(retractApproval, retractGeneration);
    const repaired = makeProvider(f.now.value, 3);
    expect(detail(repaired.verifyShapeChange(binding))).toContain('retracted');
    expect(detail(repaired.enteringForce(generation))).toContain('no unique current');
    expect(detail(repaired.resolveReference({ provider: 'record', id: approvalFact.id }))).toContain('retracted');
    expect(detail(readRegisterEntry('store', loaded, s.context))).toContain('loadRegister');
  });
});
