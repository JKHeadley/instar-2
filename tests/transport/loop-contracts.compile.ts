import type { LoopPolicy, RestorationEvidencePort, SharedBreakerLoopPolicy,
  SharedLoopClockPort } from '../../src/transport/index.js';
import type { Result } from '../../src/index.js';

function recurringJoint(policy: LoopPolicy, shared: SharedBreakerLoopPolicy, clock: SharedLoopClockPort,
  restoration: RestorationEvidencePort) {
  if (policy.breaker === 'stub-closed') { const one: 1 = policy.concurrency; void one; }
  const finite: number = shared.parentAttemptBudget + shared.parentResourceBudget; void finite;
  const owners: readonly ['part-ten', 'part-nine'] = [clock.owner, restoration.owner];
  void owners;
}
void recurringJoint;

// @ts-expect-error Restoration judgments remain Part Nine-owned.
const wrongRestorationOwner: RestorationEvidencePort = { owner: 'part-eight', verify: input => ({} as Result<typeof input.reference>) };
void wrongRestorationOwner;
