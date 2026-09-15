import { expect, it } from 'vitest';
import {
  round22CaptureReferenceClaim,
  round22InvocationBoundary,
  round22InvocationChanges,
} from './round22-fixture.js';

it('P12-NF-28 P12-NF-36 round22 permanently executes all four capture-reference-claim rows', () => {
  const rows = [
    round22CaptureReferenceClaim(false, false),
    round22CaptureReferenceClaim(false, true),
    round22CaptureReferenceClaim(true, false),
    round22CaptureReferenceClaim(true, true),
  ];
  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(row.invocations[0]?.kind).toBe(row.lostResponse ? 'Refused' : 'Success');
    expect(row.invocations[1]).toEqual({
      kind: 'Refused',
      detail: 'Telegram reply claim handoff was already used',
    });
    expect(row.dispatch.stage).toBe(row.lostResponse ? 'unknown' : 'response');
    expect(row.providerCalls).toBe(1);
    expect(row.markerIds).toHaveLength(1);
  }
}, 30_000);

it('P12-NF-28 round22 permanently executes all seven invocation-boundaries rows', () => {
  const rows = round22InvocationChanges.map(round22InvocationBoundary);
  expect(rows).toHaveLength(7);
  for (const row of rows) {
    const control = row.change === 'control';
    expect(row.fired, row.change).toBe(!control);
    expect(row.providerCalls, row.change).toBe(control ? 1 : 0);
    expect(row.dispatch.stage, row.change).toBe(control ? 'response' : 'unknown');
    expect(row.markerIds, row.change).toHaveLength(row.change.endsWith('before-invoke') ? 0 : 1);
  }
}, 30_000);
