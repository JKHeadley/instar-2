import { expect, it } from 'vitest';
// @ts-expect-error The additive contract-map checker is executable ESM without declarations.
import { assemblyConditionalAppendMap, checkAssemblyConditionalAppend } from '../../scripts/check-assembly-conditional-append.mjs';

const id = 'P10-SEAM-CONDITIONAL-APPEND-58';
const behavior = '[behavior:appendIfSubjectFrontier]';
const passed = (name: string) => ({ fullName: `${id} ${behavior} ${name}`, status: 'passed' });
const report = { success: true, testResults: [
  { name: '/repo/tests/assembly/conditional-append.test.ts', assertionResults: [
    passed('[case:replay-authentication] unit'), passed('[case:stop-inhibition] unit'),
    passed('[case:closed-shape-refusal] unit'), passed('[case:held-lock-contention] unit'),
    passed('[case:read-window-race] unit'), passed('[case:replay-stop] unit'),
  ] },
  { name: '/repo/tests/integration/assembly-conditional-append.test.ts', assertionResults: [passed('integration')] },
  { name: '/repo/tests/e2e/assembly-conditional-append.test.ts', assertionResults: [passed('lifecycle')] },
] };

it('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:contract-map] additive map retains three tiers and required evidence', () => {
  expect(checkAssemblyConditionalAppend(report)).toEqual(assemblyConditionalAppendMap);
  expect(() => checkAssemblyConditionalAppend({ ...report, success: false })).toThrow('successful actual test run');
});
