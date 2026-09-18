import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { setup } from './fixtures.js';

const accepted = (result: ReturnType<typeof createRunGraph>) => consumeResult(result, {
  Success: () => true,
  Refused: () => false,
});

it('PRODUCTION-GROUNDING rejects a caller-labelled reader that was not built by the invocation-owned Ten factory', () => {
  const f = setup();
  expect(accepted(createRunGraph({ ...f.deps,
    grounding: { ...f.deps.grounding, production: true },
    assemblyHistory: { owner: 'part-ten', current: () => f.success([]), lookup: () => f.success(null),
      resolve: () => f.success({ admitted: true, completeness: 'complete', facts: [], conflicts: [], missing: [] }) },
  }))).toBe(false);
});

it('PRODUCTION-GROUNDING flat compatibility receipts remain readable only on an unmarked isolated graph', () => {
  const f = setup();
  expect(accepted(createRunGraph(f.deps))).toBe(true);
  expect(accepted(createRunGraph({ ...f.deps, grounding: { ...f.deps.grounding, production: true } }))).toBe(false);
});
