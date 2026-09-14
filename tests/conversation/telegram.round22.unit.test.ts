import { expect, it } from 'vitest';
import { round22CaptureReferenceClaim, round22InvocationBoundary } from './round22-fixture.js';

it('P12-NF-28 round22 excludes opaque capture allocation from the consumed-claim marker identity', () => {
  const result = round22CaptureReferenceClaim(true, false);
  expect(result.allocatedCaptureReferences).toEqual(['capture:invocation:1', 'capture:invocation:2']);
  expect(result.markerIds).toHaveLength(1);
  expect(result.markerCaptureReferences).toEqual(['capture:invocation:1']);
  expect(result.invocations.map(row => row.kind)).toEqual(['Success', 'Refused']);
  expect(result.providerCalls).toBe(1);
});

it('P12-NF-28 round22 rechecks stop after invocation-marker capture', () => {
  const result = round22InvocationBoundary('stop-at-marker-capture');
  expect(result.fired).toBe(true);
  expect(result.providerCalls).toBe(0);
  expect(result.markerIds).toHaveLength(1);
  expect(result.dispatch.stage).toBe('unknown');
});
