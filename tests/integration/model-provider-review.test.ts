import { it } from 'vitest';
// @ts-expect-error Reviewer regression module uses native assertion functions.
import { registerCases as conformance } from '../model-provider/review/conformance.mjs';
// @ts-expect-error Reviewer regression module uses native assertion functions.
import { registerCases as supplement } from '../model-provider/review/supplement.mjs';
// @ts-expect-error Reviewer regression module uses native assertion functions.
import { registerCases as partial } from '../model-provider/review/partial.mjs';
// @ts-expect-error Reviewer regression module uses native assertion functions.
import { registerCases as plan_copy } from '../model-provider/review/plan-copy.mjs';
// @ts-expect-error Native assertion execution receipt.
import { runAssertions } from '../model-provider/review/assertions.mjs';
const register = (id: string, name: string, run: () => Promise<unknown>) => it(`MODEL-PROVIDER-PATH REVIEW ${id} ${name}`, () => runAssertions(id, run), 120000);
[conformance, supplement, partial, plan_copy].forEach(suite => suite(register));
