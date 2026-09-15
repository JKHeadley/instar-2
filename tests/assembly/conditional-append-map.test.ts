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
    passed('[case:read-window-race] unit'), passed('[case:replay-read-race] unit'), passed('[case:replay-stop] unit'),
    { ...passed('[case:evidence-expiry] unit'), fullName: `P10-SEAM-CONDITIONAL-APPEND-127 ${behavior} [case:evidence-expiry] unit` },
  ] },
  { name: '/repo/tests/integration/assembly-conditional-append.test.ts', assertionResults: [passed('integration'),
    { ...passed('[case:evidence-expiry] integration'), fullName: `P10-SEAM-CONDITIONAL-APPEND-127 ${behavior} [case:evidence-expiry] integration` }] },
  { name: '/repo/tests/e2e/assembly-conditional-append.test.ts', assertionResults: [passed('lifecycle'),
    { ...passed('[case:evidence-expiry] lifecycle'), fullName: `P10-SEAM-CONDITIONAL-APPEND-127 ${behavior} [case:evidence-expiry] lifecycle` }] },
] };

it('P10-SEAM-CONDITIONAL-APPEND-58 P10-SEAM-CONDITIONAL-APPEND-127 [behavior:appendIfSubjectFrontier] [case:contract-map] additive map retains three tiers and required evidence', () => {
  expect(checkAssemblyConditionalAppend(report)).toEqual(assemblyConditionalAppendMap);
  expect(() => checkAssemblyConditionalAppend({ ...report, success: false })).toThrow('successful actual test run');
});
