import { expect, it } from 'vitest';
// @ts-expect-error Executable repository contract checker is intentionally JavaScript.
import { checkP16Architecture, p16Dispositions } from '../../scripts/check-p16-contract-map.mjs';

it('P16-NF-52 contract map keeps all 52 rows contiguous and excludes every unlanded follow-on from foundation acceptance', () => {
  const rows = p16Dispositions() as { id: string; status: string; dependencies: string[] }[];
  expect(rows).toHaveLength(52);
  expect(rows.filter(row => row.status === 'EXECUTABLE').map(row => row.id)).toEqual([
    'P16-NF-01', 'P16-NF-02', 'P16-NF-05', 'P16-NF-12', 'P16-NF-13', 'P16-NF-22', 'P16-NF-23',
    'P16-NF-25', 'P16-NF-26', 'P16-NF-27', 'P16-NF-28', 'P16-NF-29', 'P16-NF-30', 'P16-NF-33',
    'P16-NF-34', 'P16-NF-39', 'P16-NF-40', 'P16-NF-41', 'P16-NF-46', 'P16-NF-47', 'P16-NF-48', 'P16-NF-52',
  ]);
  expect(rows.filter(row => row.status !== 'EXECUTABLE')).toHaveLength(30);
  expect(rows.filter(row => row.status !== 'EXECUTABLE').every(row => row.status.startsWith('NON-EXECUTABLE-UNTIL-') && row.dependencies.length > 0)).toBe(true);
  expect(checkP16Architecture()).toMatchObject({ declarations: 2 });
});
