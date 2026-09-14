import { describe, expect, it } from 'vitest';
import { loadOwnerReferences } from '../../scripts/register-owner-references.mjs';
import { decodeShape, decodeShapeChangeDocument, shapeDifferences } from '../../src/register/index.js';
import { detail, hash, json, setup, value } from './fixtures.js';

describe.skip('round-seven owner enrollment identity SKIPPED: GRANT:NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment', () => {
  it('P3-NF-09 refuses part 15 paired with the Part Fourteen owner and manifest in every roster position', () => {
    const s = setup();
    for (const placement of ['append', 'prepend'] as const) {
      const raw = JSON.parse(JSON.stringify(s.context.shape));
      if (placement === 'append') raw.parts.push(15); else raw.parts.unshift(15);
      const candidate = value(decodeShape(raw, s.context));
      const document = json('ShapeChangeDocument', { id: `mismatched-${placement}`,
        parent: hash(s.context.shape), candidateShape: hash(candidate),
        changes: shapeDifferences(s.context.shape, candidate), ownerReferences: [{ part: 15,
          owner: 'part-fourteen', manifest: { path: 'register-source/owner-references/part-fourteen.json', hash: hash({}) } }],
        approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: `approval:${placement}` } });
      expect(detail(decodeShapeChangeDocument(document, s.context))).toContain('part, owner, and manifest path must name one owner');
      expect(() => loadOwnerReferences('.', { commit: '0'.repeat(40), files: [], sources: {} },
        [{ part: 15, owner: 'part-fourteen', manifest: {
          path: 'register-source/owner-references/part-fourteen.json', hash: hash({}) } }]))
        .toThrow('part, owner, and manifest path must name one owner');
    }
  });

  it('P3-NF-09 accepts the adjacent part-14 Part Fourteen identity', () => {
    const s = setup(); const raw = JSON.parse(JSON.stringify(s.context.shape)); raw.parts.push(14);
    const candidate = value(decodeShape(raw, s.context));
    expect(value(decodeShapeChangeDocument(json('ShapeChangeDocument', { id: 'valid-part-fourteen',
      parent: hash(s.context.shape), candidateShape: hash(candidate), changes: shapeDifferences(s.context.shape, candidate),
      ownerReferences: [{ part: 14, owner: 'part-fourteen', manifest: {
        path: 'register-source/owner-references/part-fourteen.json', hash: hash({}) } }],
      approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'approval:part-fourteen' },
    }), s.context)).ownerReferences[0]?.part).toBe(14);
  });
});
