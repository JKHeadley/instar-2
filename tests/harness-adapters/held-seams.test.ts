import { it } from 'vitest';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { p13Dispositions } from '../../scripts/check-p13-contract-map.mjs';

interface Disposition { id: string; status: string; heldArms?: string }
for (const row of p13Dispositions() as Disposition[]) {
  if (row.status === 'EXECUTABLE' && !row.heldArms) continue;
  const disposition = row.status === 'EXECUTABLE' ? row.heldArms! : row.status;
  it.skip(`${row.id} ${disposition} no substitute, stub, or title-only conformance credit`, () => {});
}
