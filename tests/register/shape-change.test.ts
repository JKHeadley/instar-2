import { describe, expect, it } from 'vitest';
import { decodeNormalRegisterWorkflow, decodeShape, decodeShapeChangeDocument, shapeDifferences, validateShapeChangeDocument } from '../../src/register/index.js';
import { detail, hash, json, setup, value } from './fixtures.js';

describe('governed shape-change document', () => {
  it('P3-NF-03 decodes the one closed normal workflow schema', () => {
    const s = setup();
    const workflow = json('RegisterWorkflow', { mode: 'normal', branch: 'shape-change', parent: { commit: 'a'.repeat(40),
      register: 'generated/register.json', source: 'generated/source.json', conversion: 'generated/conversion.json' },
      extract: s.extract, runs: [], catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] }, landedParts: [], references: [], claims: [],
      shapeChange: { document: { path: 'register-source/shape-changes/part-fourteen.json', hash: hash({ approved: true }) } } });
    expect(value(decodeNormalRegisterWorkflow(workflow, s.context)).parent.commit).toBe('a'.repeat(40));
    expect(detail(decodeNormalRegisterWorkflow({ ...workflow, conversion: {} }, s.context))).toContain('undeclared field');
    expect(detail(decodeNormalRegisterWorkflow({ ...workflow, parent: { ...workflow.parent, commit: 'main' } }, s.context))).toContain('exact commit');
  });
  it('P3-NF-09 decodes an exact part addition and binds its owner-reference enrollment', () => {
    const s = setup(), raw = JSON.parse(JSON.stringify(s.context.shape));
    raw.parts.push(14);
    const parent = s.context.shape, candidate = value(decodeShape(raw, s.context));
    const manifestHash = hash({ schemaVersion: 1, owner: 'part-fourteen', fixtures: [], probes: [], decoders: [], documents: [] });
    const document = value(decodeShapeChangeDocument(json('ShapeChangeDocument', {
      id: 'part-fourteen', parent: hash(parent), candidateShape: hash(candidate),
      changes: shapeDifferences(parent, candidate), ownerReferences: [{ part: 14, owner: 'part-fourteen',
        manifest: { path: 'register-source/owner-references/part-fourteen.json', hash: manifestHash } }],
      approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'approval:part-fourteen' },
    }), s.context));
    expect(validateShapeChangeDocument(parent, candidate, document, s.context)).toBe(true);
    expect(document.changes).toEqual([{ operation: 'add', path: `/parts/${parent.parts.length}`, after: 14 }]);
  });

  it('P3-NF-09 refuses omitted, invented, unsorted, or enrollment-unrelated changes', () => {
    const s = setup(), raw = JSON.parse(JSON.stringify(s.context.shape)); raw.parts.push(14);
    const parent = s.context.shape, candidate = value(decodeShape(raw, s.context));
    const base = json('ShapeChangeDocument', { id: 'part-fourteen', parent: hash(parent), candidateShape: hash(candidate),
      changes: shapeDifferences(parent, candidate), ownerReferences: [],
      approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'approval:part-fourteen' } });
    const missing = value(decodeShapeChangeDocument({ ...base, changes: [{ operation: 'add', path: '/parts/11', after: 99 }] }, s.context));
    expect(() => validateShapeChangeDocument(parent, candidate, missing, s.context)).toThrow('exact shape entries');
    expect(detail(decodeShapeChangeDocument({ ...base, changes: [] }, s.context))).toContain('at least one');
    expect(detail(decodeShapeChangeDocument({ ...base, changes: [
      { operation: 'add', path: '/parts/12', after: 15 }, { operation: 'add', path: '/parts/11', after: 14 },
    ] }, s.context))).toContain('path-sorted');
    const unrelated = value(decodeShapeChangeDocument({ ...base, ownerReferences: [{ part: 99, owner: 'part-ninety-nine',
      manifest: { path: 'register-source/owner-references/part-ninety-nine.json', hash: hash({}) } }] }, s.context));
    expect(() => validateShapeChangeDocument(parent, candidate, unrelated, s.context)).toThrow('not introduced');
  });
});
