import { expect, it } from 'vitest';
import { round27AdmissionFreshness } from './round27-fixture.js';

it('P12-NF-07 P12-NF-46 round27 conditional append refuses identity expiry without a conformance fact', () => {
  const rows = round27AdmissionFreshness();
  const boundary = rows.find(row => row.name === 'conditional-append-clock-149-to-150')!;
  expect(boundary.actual).toBe(boundary.expected);
  expect(boundary.detail).toBe('evidence-expired: validUntil=150; commitClock=150');
  expect(boundary.passingConformanceCount).toBe(0);
  expect(boundary.trace).toContainEqual({ at: 'append-enter', now: 149, validUntil: 150 });
  expect(boundary.trace).toContainEqual({ at: 'append-result', now: 150, kind: 'Refused' });
});
