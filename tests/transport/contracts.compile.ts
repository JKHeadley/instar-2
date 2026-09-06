import type { DispatchClaim, FenceToken } from '../../src/transport/index.js';

// P6-NF-02 compile boundary: consumers import values, never public constructors.
// @ts-expect-error Only six's live issuer may construct a DispatchClaim.
const claim: DispatchClaim = { operation: 'o', attempt: 'a', digest: 'd', executor: 'e' };
// @ts-expect-error Fields alone do not construct a FenceToken.
const fence: FenceToken = { type: 'FenceToken', schemaVersion: 1, domain: 'd', epoch: 1,
  assignment: 'a', holder: 'h', machine: 'm', incarnation: 'i', authority: 'a', generation: 'g' };
void claim; void fence;
