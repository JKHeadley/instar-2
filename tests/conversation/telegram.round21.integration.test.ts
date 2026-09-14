import { expect, it } from 'vitest';
import { round21TwoStoreClaim } from './round20-fixture.js';

it('P12-NF-28 P12-NF-36 round21 permanently executes all four claim-two-stores rows', () => {
  const rows = [
    round21TwoStoreClaim(false, false),
    round21TwoStoreClaim(false, true),
    round21TwoStoreClaim(true, false),
    round21TwoStoreClaim(true, true),
  ];
  expect(rows).toHaveLength(4);
  for (const [index, row] of rows.entries()) {
    expect(row.distinctHandles).toBe(true);
    expect(row.newStore).toBe(index >= 2);
    expect(row.distinctStoreHandles).toBe(row.newStore);
    expect(row.equalHistory).toBe(true);
    expect(row.sameStorage).toBe(true);
    expect(row.sameConformance).toBe(true);
    expect(row.first.kind).toBe(row.lostResponse ? 'Refused' : 'Success');
    expect(row.second).toEqual({
      kind: 'Refused',
      detail: 'Telegram reply claim handoff was already used',
    });
    expect(row.dispatch.stage).toBe(row.lostResponse ? 'unknown' : 'response');
    expect(row.providerCalls).toBe(1);
    expect(row.reservationStates).toEqual(['prepared', 'dispatch-claimed', 'consumed']);
  }
}, 30_000);
