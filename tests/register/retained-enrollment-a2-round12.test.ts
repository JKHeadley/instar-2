import { describe, expect, it } from 'vitest';
import { decodeShape, decodeShapeChangeDocument, shapeDifferences, validateShapeChangeDocument } from '../../src/register/index.js';
import { hash, json, setup, value } from './fixtures.js';

describe.skip('round-twelve retained enrollment shape validation SKIPPED: HELD-BY-SCOPE:SEAM-LEDGER-row-124', () => {
  it('P3-NF-09 reviewer cases valid, wrong-candidate-shape, and wrong-shape-difference validate exact introduced entries', () => {
    const s = setup();
    const raw = JSON.parse(JSON.stringify(s.context.shape)); raw.parts.push(14);
    const candidate = value(decodeShape(raw, s.context));
    const enrollment = { part: 14, owner: 'part-fourteen', manifest: {
      path: 'register-source/owner-references/part-fourteen.json', hash: hash({ owner: 'part-fourteen' }) } } as const;
    const approvedIn = { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: 'approval:enrollment' };
    const document = value(decodeShapeChangeDocument(json('ShapeChangeDocument', { id: 'reviewer-valid',
      parent: hash({ parent: true }), candidateShape: hash(candidate), changes: shapeDifferences(s.context.shape, candidate),
      ownerReferences: [enrollment], approvedIn }), s.context));

    expect(validateShapeChangeDocument(s.context.shape, candidate, document, s.context)).toBe(true);
    const wrongCandidate = value(decodeShapeChangeDocument({ ...document, id: 'wrong-candidate-shape',
      candidateShape: hash({ notAShape: true }) }, s.context));
    expect(() => validateShapeChangeDocument(s.context.shape, candidate, wrongCandidate, s.context))
      .toThrow('P3-NF-09: shape-change document candidate differs');
    const wrongDifference = value(decodeShapeChangeDocument({ ...document, id: 'wrong-shape-difference',
      changes: [{ operation: 'add', path: '/parts/9999', after: 99 }] }, s.context));
    expect(() => validateShapeChangeDocument(s.context.shape, candidate, wrongDifference, s.context))
      .toThrow('P3-NF-09: shape-change document does not name the exact shape entries changed');
  });
});
