import { expect, it } from 'vitest';
// @ts-expect-error Repository contract checker is intentionally JavaScript.
import { p16A2Dispositions, p16Dispositions } from '../../scripts/check-p16-contract-map.mjs';

it('Slice A2 flips exactly its runnable rows while the permanent A1 compatibility inventory stays intact', () => {
  const legacy = p16Dispositions() as Array<{ number: number; status: string }>;
  const active = p16A2Dispositions() as Array<{ number: number; status: string;
    dependencies: string[]; arms?: unknown[] }>;
  expect(legacy.filter(row => row.status === 'NON-EXECUTABLE-UNTIL-slice-A2')).toHaveLength(16);
  expect(active.filter(row => row.status === 'NON-EXECUTABLE-UNTIL-slice-A2')).toEqual([]);
  expect(active.filter(row => row.status === 'EXECUTABLE').map(row => row.number)
    .filter(number => [4, 12, 13, 14, 16, 33, 34, 36, 37, 38, 39, 40, 41, 47, 48, 50]
      .includes(number))).toEqual([12, 13, 34, 39, 40, 41]);
  for (const number of [4, 14, 16, 33, 36, 47, 48, 50]) {
    const row = active.find(candidate => candidate.number === number)!;
    expect(row.status).toMatch(/^MIXED-EXECUTABLE-A2-PLUS-NON-EXECUTABLE-UNTIL-/);
    expect(row.dependencies.length).toBeGreaterThan(0);
    expect(row.arms).toHaveLength(2);
  }
  for (const number of [37, 38]) expect(active.find(row => row.number === number)).toMatchObject({
    status: 'NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge',
    dependencies: ['slice-A2b-peer-merge'],
  });
  expect(active.find(row => row.number === 2)?.status).toBe('NON-EXECUTABLE-UNTIL-slice-A1-arch');
  expect(active.find(row => row.number === 23)?.status).toContain('slice-A1-arch');
});
