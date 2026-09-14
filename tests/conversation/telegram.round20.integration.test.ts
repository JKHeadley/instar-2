import { expect, it } from 'vitest';
import { round20TwoHandleClaim } from './round20-fixture.js';

it('P12-NF-28 P12-NF-36 round20 permanently executes all four claim-two-handles rows', () => {
  const rows = [
    round20TwoHandleClaim(false, false),
    round20TwoHandleClaim(true, false),
    round20TwoHandleClaim(false, true),
    round20TwoHandleClaim(true, true),
  ];
  expect(rows).toHaveLength(4);
  for (const row of rows) {
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
