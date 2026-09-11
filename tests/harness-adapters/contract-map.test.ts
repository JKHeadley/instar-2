import { expect, it } from 'vitest';
// @ts-expect-error The contract-map checker is an executable JavaScript boundary.
import { p13Dispositions } from '../../scripts/check-p13-contract-map.mjs';

it('P13-CONTRACT-MAP assigns every approved check exactly one executable or exact owner-seam disposition', () => {
  const rows = p13Dispositions();
  expect(rows).toHaveLength(52);
  expect(new Set(rows.map((row: { id: string }) => row.id)).size).toBe(52);
  expect(rows.filter((row: { status: string }) => row.status === 'EXECUTABLE')).toHaveLength(22);
  expect(rows.filter((row: { heldArms?: string }) => row.heldArms)).toHaveLength(9);
  for (const row of rows) expect(row.status).toMatch(/^(EXECUTABLE|NON-EXECUTABLE-UNTIL-\S.+)$/);
});
