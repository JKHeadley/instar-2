import type { CalendarExpansionPort, LoopPolicy, MissedRangeRecord, RestorationEvidencePort,
  SharedLoopClockPort } from '../../src/transport/index.js';
import type { Clock, Result } from '../../src/index.js';

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
