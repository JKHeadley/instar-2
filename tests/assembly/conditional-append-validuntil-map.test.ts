import { expect, it } from 'vitest';
// @ts-expect-error The additive contract-map checker is executable ESM without declarations.
import { assemblyConditionalAppendValidityMap, checkAssemblyConditionalAppend } from '../../scripts/check-assembly-conditional-append.mjs';

// Additive row-127 map validation. It composes BESIDE the original row-58 map test (which is
// preserved byte-for-byte) and never changes what row 58 requires: it drives only the separate
// validity map, proving the checker maps the exclusive-validUntil evidence across all three tiers.
const id = 'P10-SEAM-CONDITIONAL-APPEND-127';
const behavior = '[behavior:appendIfSubjectFrontier]';
const passed = (name: string) => ({ fullName: `${id} ${behavior} ${name}`, status: 'passed' });
const report = { success: true, testResults: [
  { name: '/repo/tests/assembly/conditional-append-validuntil.test.ts', assertionResults: [passed('[case:evidence-expiry] unit')] },
  { name: '/repo/tests/integration/assembly-conditional-append-validuntil.test.ts', assertionResults: [passed('[case:evidence-expiry] integration')] },
  { name: '/repo/tests/e2e/assembly-conditional-append-validuntil.test.ts', assertionResults: [passed('[case:evidence-expiry] lifecycle')] },
] };

it('P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:contract-map] additive validity map maps three tiers and evidence-expiry evidence', () => {
  expect(checkAssemblyConditionalAppend(report, assemblyConditionalAppendValidityMap)).toEqual(assemblyConditionalAppendValidityMap);
  expect(() => checkAssemblyConditionalAppend({ ...report, success: false }, assemblyConditionalAppendValidityMap)).toThrow('successful actual test run');
});
