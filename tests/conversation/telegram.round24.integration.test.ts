import { expect, it } from 'vitest';
import { round24IndependentValidationMatrix } from './round24-fixture.js';

it('P12-NF-28 P12-NF-29 P12-NF-34 P12-NF-35 round24 permanently executes the independent 21-case validation matrix', async () => {
  const rows = await round24IndependentValidationMatrix();
  expect(rows).toHaveLength(21);
  expect(rows.filter(row => row.expected === 'Success')).toHaveLength(3);
  expect(rows.filter(row => row.expected === 'Refused')).toHaveLength(18);
  for (const row of rows) {
    expect(row.actual, `${row.name}:${row.reuse ? 'reuse' : 'fresh'}`).toBe(row.expected);
    if (row.name.startsWith('definition.') && row.name !== 'definition.control') {
      expect(row.appended, `${row.name}:${row.reuse ? 'reuse' : 'fresh'}`).toBe(0);
    }
    expect(row.providerCalls, row.name).toBe(1);
  }
}, 120_000);
