import { expect, it } from 'vitest';
import { createRunGraph } from '../../src/rungraph/index.js';
import { refused, setup, value } from '../rungraph/fixtures.js';

it('PRODUCTION-GROUNDING integration: P10 delivery evidence structurally activates the P5 signed-history arm', () => {
  const f = setup();
  expect(value(createRunGraph(f.deps)).owner).toBe('part-five');
  refused(createRunGraph({ ...f.deps, grounding: { ...f.deps.grounding, production: true } }),
    'production grounding requires public Ten assembly history');
  const history = { owner: 'part-ten' as const, current: () => f.success([]), lookup: () => f.success(null),
    resolve: () => f.success({ admitted: true, completeness: 'complete' as const, facts: [], conflicts: [], missing: [] }) };
  expect(value(createRunGraph({ ...f.deps, grounding: { ...f.deps.grounding, production: true }, assemblyHistory: history })).owner).toBe('part-five');
});
