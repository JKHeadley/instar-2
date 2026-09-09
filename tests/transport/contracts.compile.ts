import type { DispatchClaim, FenceToken, ObservationPort } from '../../src/transport/index.js';
import type { OwnedReference, Result } from '../../src/index.js';

// P6-NF-02 compile boundary: consumers import values, never public constructors.
// @ts-expect-error Only six's live issuer may construct a DispatchClaim.
const claim: DispatchClaim = { operation: 'o', attempt: 'a', digest: 'd', executor: 'e' };
// @ts-expect-error Fields alone do not construct a FenceToken.
const fence: FenceToken = { type: 'FenceToken', schemaVersion: 1, domain: 'd', epoch: 1,
  assignment: 'a', holder: 'h', machine: 'm', incarnation: 'i', authority: 'a', generation: 'g' };
void claim; void fence;

function observationJoint(approved: (operation: string) => Result<OwnedReference<'part-eight', 'OperationObservation'>>,
  invented: (operation: string) => Result<OwnedReference<'part-eight', 'EffectObservation'>>) {
  const positive: ObservationPort = { owner: 'part-eight', observe: approved };
  // @ts-expect-error R4 a six-invented name cannot stand in for eight's actual record.
  const negative: ObservationPort = { owner: 'part-eight', observe: invented };
  void positive; void negative;
}
void observationJoint;
