import { expect, it } from 'vitest';
// @ts-expect-error Repository contract checker is intentionally JavaScript.
import { checkP16Architecture, p16Dispositions } from '../../scripts/check-p16-contract-map.mjs';

it('contract inventory retains all 53 labels and marks every structural A2 row NON-EXECUTABLE-UNTIL-slice-A2', () => {
  const rows = p16Dispositions() as { id: string; status: string; dependencies: string[] }[];
  expect(rows).toHaveLength(53);
  expect(rows.filter(row => row.status === 'NON-EXECUTABLE-UNTIL-slice-A2').map(row => row.id)).toEqual([
    'P16-NF-04', 'P16-NF-12', 'P16-NF-13', 'P16-NF-14', 'P16-NF-16', 'P16-NF-33', 'P16-NF-34',
    'P16-NF-36', 'P16-NF-37', 'P16-NF-38', 'P16-NF-39', 'P16-NF-40', 'P16-NF-41',
    'P16-NF-47', 'P16-NF-48', 'P16-NF-50',
  ]);
  expect(rows.find(row => row.id === 'P16-NF-53')?.status).toBe('SUPPLEMENTAL-EXECUTABLE-NON-GOVERNING');
  expect(checkP16Architecture()).toMatchObject({ declarations: 2, executable: 12, mixed: 2, sliceA2: 16 });
});
