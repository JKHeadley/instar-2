import { it } from 'vitest';
// Round-4 re-review permanent regressions (V25-V64). Each proves a new signed-record
// decoder/consumer re-resolves copied fields against the owner records it references.
// @ts-expect-error Reviewer regression module uses native assertion functions.
import { registerCases as signedRecords } from '../model-provider/review/rereview-signed-records.mjs';
// @ts-expect-error Reviewer regression module uses native assertion functions.
import { registerCases as dependencyIsolation } from '../model-provider/review/rereview-dependency-isolation.mjs';
// @ts-expect-error Reviewer regression module uses native assertion functions.
import { registerCases as settlementAccounting } from '../model-provider/review/rereview-settlement-accounting.mjs';
// @ts-expect-error Reviewer regression module uses native assertion functions.
import { registerCases as runConsumer } from '../model-provider/review/rereview-run-consumer.mjs';
// @ts-expect-error Reviewer regression module uses native assertion functions.
import { registerCases as ordering } from '../model-provider/review/rereview-ordering.mjs';
// @ts-expect-error Native assertion execution receipt.
import { runAssertions } from '../model-provider/review/assertions.mjs';
const register = (id: string, name: string, run: () => Promise<unknown>) =>
  it(`MODEL-PROVIDER-PATH REREVIEW ${id} ${name}`, () => runAssertions(id, run), 120000);
[signedRecords, dependencyIsolation, settlementAccounting, runConsumer, ordering].forEach(suite => suite(register));
