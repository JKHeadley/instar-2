import { expect, it } from 'vitest';
import { round27AdmissionFreshness } from './round27-fixture.js';

it('P12-NF-07 P12-NF-46 round27 identity proof remains fresh through the admission commit', () => {
  const rows = round27AdmissionFreshness();
  expect(rows.map(row => ({
    name: row.name, expected: row.expected, actual: row.actual,
    passingConformanceCount: row.passingConformanceCount,
    conformanceFactClocks: row.conformanceFactClocks, testedAt: row.testedAt,
  }))).toEqual([
    { name: 'conditional-append-clock-149-to-149', expected: 'Success', actual: 'Success',
      passingConformanceCount: 1, conformanceFactClocks: [149], testedAt: [149] },
    { name: 'conditional-append-clock-149-to-150', expected: 'Refused', actual: 'Refused',
      passingConformanceCount: 0, conformanceFactClocks: [], testedAt: [] },
    { name: 'conditional-append-clock-150-to-150', expected: 'Refused', actual: 'Refused',
      passingConformanceCount: 0, conformanceFactClocks: [], testedAt: [] },
  ]);
});
