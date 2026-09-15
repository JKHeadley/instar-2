import { expect, it } from 'vitest';
import { round27AdmissionFreshness } from './round27-fixture.js';

it('P12-NF-07 P12-NF-46 round27 permanently executes conditional-append-clock-149-to-150 and both controls', () => {
  const rows = round27AdmissionFreshness();
  for (const row of rows) expect(row.actual, row.name).toBe(row.expected);
  expect(rows[0]!.passingConformanceCount).toBe(1);
  expect(rows[1]!.passingConformanceCount).toBe(0);
  expect(rows[2]!.passingConformanceCount).toBe(0);
  expect(rows[2]!.trace.some(event => event.at === 'append-enter')).toBe(false);
});
