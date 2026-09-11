import { expect, it } from 'vitest';
import type { Json } from '../../src/index.js';
import { decodeRunTransition, recordWire } from '../../src/rungraph/index.js';
import { closingRun, json, refused } from './fixtures.js';

const legacyCases = [
  ['P5-SEAM-RC-R6-V40-LEGACY-EXITTEST', 'exitTest', 'missing required field exitTest'],
  ['P5-SEAM-RC-R6-V41-LEGACY-CHECK', 'check', 'missing required field check'],
  ['P5-SEAM-RC-R6-V42-LEGACY-EVIDENCE', 'evidence', 'missing required field evidence'],
  ['P5-SEAM-RC-R6-V43-LEGACY-RESULT', 'result', 'missing required field result'],
] as const;

it.each(legacyCases)('%s preserves the completed-transition nested refusal value', (_id, field, expected) => {
  const f = closingRun();
  const malformed = structuredClone(json(f.close)) as Record<string, Json>;
  const exit = malformed.exit as Record<string, Json>;
  delete exit[field];
  delete exit.settledOperations;
  expect(refused(decodeRunTransition(malformed, f.context()))).toBe(expected);
  expect(() => f.append('run-transition', json({ run: f.id,
    record: recordWire(malformed as never) }))).toThrow('missing required field');
});

it('P5-SEAM-RC-R6-V44-LEGACY-PRECEDENCE preserves nested completed shape refusal before parent-reference validation', () => {
  const f = closingRun();
  const malformed = structuredClone(json(f.close)) as Record<string, Json>;
  const exit = malformed.exit as Record<string, Json>;
  delete exit.exitTest;
  malformed.responsible = { ...(malformed.responsible as Record<string, Json>), id: 'missing-owner' };
  expect(refused(decodeRunTransition(malformed, f.context()))).toBe('missing required field exitTest');
  expect(() => f.append('run-transition', json({ run: f.id,
    record: recordWire(malformed as never) }))).toThrow('missing required field');
});
