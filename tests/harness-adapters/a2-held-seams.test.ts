import { it } from 'vitest';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { p13A2Dispositions } from '../../scripts/check-p13-contract-map.mjs';

interface Disposition { id: string; status: string; heldArms?: string }
for (const row of p13A2Dispositions() as Disposition[]) {
  if (row.status === 'EXECUTABLE' && !row.heldArms) continue;
  const disposition = row.status === 'EXECUTABLE' ? row.heldArms! : row.status;
  it.skip(`${row.id} ${disposition} A2 stops at the named owner boundary without a substitute`, () => {});
}
