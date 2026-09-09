import type { CalendarExpansionPort, DispatchClaim, FenceToken, LoopPolicy, MissedRangeRecord,
  ObservationPort, RestorationEvidencePort, SharedLoopClockPort } from '../../src/transport/index.js';
import type { Clock, OwnedReference, Result } from '../../src/index.js';

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

function recurringJoint(policy: LoopPolicy, record: MissedRangeRecord, clock: SharedLoopClockPort,
  calendar: CalendarExpansionPort, restoration: RestorationEvidencePort) {
  if (policy.breaker === 'stub-closed') { const one: 1 = policy.concurrency; void one; }
  else { const finite: number = policy.parentAttemptBudget + policy.parentResourceBudget; void finite; }
  const disposition = record.dispositions[0];
  if (disposition?.kind === 'missed-no-execution') disposition.result.fact;
  else disposition?.run;
  const owners: readonly ['part-ten', 'part-fifteen', 'part-nine'] =
    [clock.owner, calendar.owner, restoration.owner];
  void owners;
}
void recurringJoint;

// @ts-expect-error Missed members carry a constitutional Result, never a generic fact reference.
const wrongMissedDisposition: MissedRangeRecord['dispositions'][number] = { scheduledInstant: {} as Clock, kind: 'missed-no-execution', reference: { owner: 'part-two', name: 'FactEnvelope', id: 'fact:1' } };
// @ts-expect-error Restoration judgments remain Part Nine-owned.
const wrongRestorationOwner: RestorationEvidencePort = { owner: 'part-eight', verify: input => ({} as Result<typeof input.reference>) };
void wrongMissedDisposition; void wrongRestorationOwner;
