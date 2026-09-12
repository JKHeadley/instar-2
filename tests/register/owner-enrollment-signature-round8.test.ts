import { describe, expect, it } from 'vitest';
import { canonical, defineDecoder } from '../../src/index.js';
import type { Result } from '../../src/index.js';
import { decodeGenerationRecord, decodeShape, decodeShapeChangeDocument, generateRegister, generationOf, loadRegister,
  resolveOwnerReferenceEnrollments } from '../../src/register/index.js';
import type { FactReference, RegisterContext, ShapeChangeBinding, SpineReadPort } from '../../src/register/index.js';
import { hash, json, setup, value } from './fixtures.js';

function reply<T>(payload: T, context: RegisterContext): Result<T> {
  return value(defineDecoder<T, RegisterContext>({ name: 'RoundEightEnrollmentReply', owner: 'test-only', currentVersion: 1,
    versions: { 1: { validate: input => ({ ok: true, value: input }) } }, migrations: {},
    decodeCurrent: () => ({ ok: true, value: payload }) }, context.preserved)).decode(json('RoundEightEnrollmentReply', {}), context);
}

describe('round-eight exact owner enrollment signatures', () => {
  it('P3-NF-09 requires an exact signed document for a retained row even when its part is already in the roster', () => {
    const s = setup();
    const raw = JSON.parse(JSON.stringify(s.context.shape)); raw.parts.push(14);
    const shape = value(decodeShape(raw, s.context)); const context = { ...s.context, shape };
    const register = value(generateRegister(s.input(undefined, { extract: s.extract }), context));
    const generation = value(generationOf(register, context));
    const approval: FactReference = { owner: 'part-two', name: 'FactEnvelope', id: 'approval:enrollment' };
    const force = value(decodeGenerationRecord(json('GenerationRecord', { generation, at: s.f.now }), context));
    const spine: SpineReadPort = { owner: 'part-two', verifyExtract: () => reply(approval, context),
      enteringForce: () => reply(force, context), isCurrent: () => reply(true, context) };
    const parent = value(loadRegister(register, generation, context, spine, s.f.now));
    const enrollment = { part: 14, owner: 'part-fourteen', manifest: {
      path: 'register-source/owner-references/part-fourteen.json', hash: hash({ owner: 'part-fourteen' }) } } as const;
    const document = value(decodeShapeChangeDocument(json('ShapeChangeDocument', { id: 'historical-enrollment',
      parent: hash({ previous: true }), candidateShape: hash(shape),
      changes: [{ operation: 'add', path: `/parts/${shape.parts.length - 1}`, after: 14 }],
      ownerReferences: [enrollment], approvedIn: approval }), context));
    const binding: ShapeChangeBinding = { parent: document.parent, candidateShape: document.candidateShape,
      document: { path: 'register-source/shape-changes/part-fourteen.json', hash: value(canonical(document)).hash }, approval };
    let calls = 0;
    const approvals = { owner: 'part-two' as const, verifyShapeChange: (actual: ShapeChangeBinding) => {
      calls++; expect(actual).toEqual(binding); return reply(approval, context);
    } };

    expect(value(resolveOwnerReferenceEnrollments([enrollment], parent, shape, null, approvals, context,
      undefined, [{ binding: binding as Extract<ShapeChangeBinding, { approval: FactReference }>, document }]))).toEqual([enrollment]);
    expect(calls).toBe(1);
    expect(() => value(resolveOwnerReferenceEnrollments([enrollment], parent, shape, null, approvals, context)))
      .toThrow('one exact signed shape-change document');
    expect(calls).toBe(1);
  });
});
