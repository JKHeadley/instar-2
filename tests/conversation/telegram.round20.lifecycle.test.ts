import { expect, it } from 'vitest';
import { round20IndependentValidationMatrix, round20TwoHandleClaim } from './round20-fixture.js';

it('P12-NF-28 P12-NF-36 P12-NF-38 round20 keeps a lost-response reservation across equivalent handles', () => {
  const result = round20TwoHandleClaim(true, true);
  expect(result.distinctHandles).toBe(true);
  expect(result.sameConformance).toBe(true);
  expect(result.first.detail).toBe('response lost after provider application');
  expect(result.second).toEqual({
    kind: 'Refused',
    detail: 'Telegram reply claim handoff was already used',
  });
  expect(result.dispatch.stage).toBe('unknown');
  expect(result.providerCalls).toBe(1);
});

it('P12-NF-34 P12-NF-35 round20 permanently executes the independent 102-case record matrix', async () => {
  const rows = await round20IndependentValidationMatrix();
  expect(rows).toHaveLength(102);
  expect(rows.filter(row => row.owner === 'control')).toHaveLength(2);
  expect(rows.filter(row => row.owner !== 'control')).toHaveLength(100);
  for (const row of rows) {
    expect(row.result.kind, `${row.owner}.${row.key}:${row.reuse ? 'reuse' : 'fresh'}`).toBe(row.expected);
    expect(row.appended, `${row.owner}.${row.key}:${row.reuse ? 'reuse' : 'fresh'}`)
      .toBe(row.owner === 'control' && !row.reuse ? 2 : 0);
    expect(row.providerCalls, `${row.owner}.${row.key}:${row.reuse ? 'reuse' : 'fresh'}`).toBe(1);
  }
}, 600_000);
