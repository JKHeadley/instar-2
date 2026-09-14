import { expect, it } from 'vitest';
import { round22CaptureReferenceClaim, round22InvocationBoundary } from './round22-fixture.js';

it('P12-NF-28 P12-NF-36 P12-NF-38 round22 retains lost-response uncertainty across distinct capture references', () => {
  const result = round22CaptureReferenceClaim(true, true);
  expect(result.allocatedCaptureReferences).toHaveLength(2);
  expect(result.markerIds).toHaveLength(1);
  expect(result.invocations[0]?.detail).toBe('response lost after provider application');
  expect(result.invocations[1]).toEqual({
    kind: 'Refused',
    detail: 'Telegram reply claim handoff was already used',
  });
  expect(result.dispatch.stage).toBe('unknown');
  expect(result.providerCalls).toBe(1);
});

it('P12-NF-28 P12-NF-38 round22 retains the durable marker when expiry occurs after append', () => {
  const result = round22InvocationBoundary('expiry-after-marker-append');
  expect(result.fired).toBe(true);
  expect(result.providerCalls).toBe(0);
  expect(result.markerIds).toHaveLength(1);
  expect(result.observationStages).toEqual(['executor-accepted', 'executor-accepted', 'unknown']);
  expect(result.dispatch.stage).toBe('unknown');
});
