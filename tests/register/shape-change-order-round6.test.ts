import { describe, expect, it } from 'vitest';
import { decodeShape, decodeShapeChangeDocument, shapeDifferences, validateShapeChangeDocument } from '../../src/register/index.js';
import { hash, json, setup, value } from './fixtures.js';

describe.skip('round-six shape roster insertion SKIPPED: GRANT:NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment', () => {
  it('P3-NF-09 recognizes an enrolled part by set introduction, independent of roster position', () => {
    for (const parentHasLaterPart of [false, true]) {
      const s = setup();
      const parentRaw = JSON.parse(JSON.stringify(s.context.shape));
      if (parentHasLaterPart) parentRaw.parts.push(15);
      const parent = value(decodeShape(parentRaw, s.context));
      const candidateRaw = JSON.parse(JSON.stringify(parent));
      if (parentHasLaterPart) candidateRaw.parts.splice(candidateRaw.parts.indexOf(15), 0, 14);
      else candidateRaw.parts.unshift(14);
      const candidate = value(decodeShape(candidateRaw, s.context));
      const document = value(decodeShapeChangeDocument(json('ShapeChangeDocument', {
        id: parentHasLaterPart ? 'sorted-part-fourteen' : 'prepended-part-fourteen',
        parent: hash(parent), candidateShape: hash(candidate), changes: shapeDifferences(parent, candidate),
        ownerReferences: [{ part: 14, owner: 'part-fourteen', manifest: {
          path: 'register-source/owner-references/part-fourteen.json', hash: hash({}),
        } }], approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: 'approval:part-fourteen' },
      }), s.context));
      expect(document.changes.some(change => change.operation === 'replace')).toBe(true);
      expect(validateShapeChangeDocument(parent, candidate, document, s.context)).toBe(true);
    }
  });
});
