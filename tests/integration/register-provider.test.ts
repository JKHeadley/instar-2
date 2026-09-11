import { describe, expect, it } from 'vitest';
import type { Json } from '../../src/index.js';
import { canonical } from '../../src/index.js';
import { createFactStore, factId, registerOwnedBody } from '../../src/facts/index.js';
import type { FactSchema, OwnedShape } from '../../src/facts/index.js';
import { createPartTwoRegisterProvider, decodeExtract, generationOf } from '../../src/register/index.js';
import type { ShapeChangeBinding } from '../../src/register/index.js';
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
  it('P3-NF-21/23 reads current extract, entering force, and exact shape approval from a real FactStore', () => {
    const f = factsFixture(), s = setup();
    const generation = value(generationOf(s.build(), s.context));
    const approvalId = factId({ machine: 'machine-a', epoch: 0, position: 2 });
    const binding: ShapeChangeBinding = { parent: generation.id, candidateShape: value(canonical(s.context.shape)).hash,
      document: { path: 'register-source/shape-changes/part-fourteen.json', hash: value(canonical({ approved: true })).hash },
      approval: { owner: 'part-two', name: 'FactEnvelope', id: approvalId } };
    const lineages = { 'machine-a': { head: { epoch: 0, position: 2 }, observedAt: f.now.value, closed: false } };
    const vector = { owner: 'part-two', name: 'FactPositionVector', id: value(canonical({ type: 'FactPositionVector', schemaVersion: 1,
      foldedThrough: { 'machine-a': { epoch: 0, position: 2 } }, knownLineages: lineages })).hash };
    const extract = value(decodeExtract(json('ChainExtract', { vector, rows: [] }), s.context));
    const record = (input: unknown): Json => JSON.parse(JSON.stringify(input)) as Json;
    const records: readonly { kind: string; name: string; value: Json }[] = [
      { kind: 'chain-extract-record', name: 'ChainExtractRecord', value: record(json('ChainExtractRecord', { extract })) },
      { kind: 'generation-record', name: 'GenerationRecord', value: record(json('GenerationRecord', { generation, at: f.now })) },
      { kind: 'shape-change-approval', name: 'ShapeChangeApproval', value: record(json('ShapeChangeApproval', { binding })) },
    ];
    const registrations = records.map(row => value(registerOwnedBody({ owner: 'part-three', name: row.name, currentVersion: 1,
      versions: { 1: { validate: input => ({ ok: true as const, value: input }) } }, migrations: {},
      decodeCurrent: input => ({ ok: true as const, value: input }) }, policy(row.value), f.c)));
    const schemas: FactSchema[] = records.map(row => ({ kind: row.kind, version: 1,
      fields: { record: { kind: 'owned', owner: 'part-three', name: row.name } }, machineScope: 'shared', standing: 'requester',
      action: 'work', scope: f.scope, causallyBound: false, requiredReferences: [], authority: 'none' }));
    const context = { ...f.ctx, schemas, ownedBodies: registrations };
    const [extractRecord, generationRecord, approvalRecord] = records;
    const first = f.fact({ kind: extractRecord!.kind, body: { record: extractRecord!.value } }, context);
    const second = f.next(first, { kind: generationRecord!.kind, body: { record: generationRecord!.value } }, context);
    const third = f.next(second, { kind: approvalRecord!.kind, body: { record: approvalRecord!.value } }, context);
    const storage = { owner: 'part-ten' as const, read: () => [first, second, third], append: () => f.success({ kind: 'local-durable' as const }) };
    const provider = createPartTwoRegisterProvider({ store: createFactStore(context, storage), horizon: { lineages, stalenessBound: 100 }, context: s.context });
    expect(value(provider.verifyExtract(extract)).id).toBe(first.id);
    expect(value(provider.enteringForce(generation)).generation).toEqual(generation);
    expect(value(provider.verifyShapeChange(binding)).id).toBe(third.id);
    expect(value(provider.isCurrent(extract.vector, f.now))).toBe(true);
    expect(value(provider.resolveReference({ provider: 'record', id: binding.approval.id }))).toBe(true);
    expect(value(provider.isCurrent(extract.vector, f.clock(201)))).toBe(false);
    const stale = value(decodeExtract(json('ChainExtract', { vector: { ...vector, id: value(canonical({ stale: true })).hash }, rows: [] }), s.context));
    expect(detail(provider.verifyExtract(stale))).toContain('current verified P2 vector');
    expect(detail(provider.verifyShapeChange({ ...binding, document: { ...binding.document, hash: value(canonical({ tampered: true })).hash } }))).toContain('no current Part Two approval');
  });
});
