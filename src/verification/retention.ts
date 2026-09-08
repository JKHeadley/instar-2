import { boundary, ensure, freeze } from './boundary.js';
import type { VerificationDecodeContext, CaptureAdmissionDecision, CaptureAdmissionState, AssessmentClosure } from './contracts.js';
import type { Result } from '../index.js';

export function assessCaptureAdmission(state: CaptureAdmissionState, inputBytes: number, outputBytes: number,
  assessmentBytes: number, context: VerificationDecodeContext): Result<CaptureAdmissionDecision> {
  return boundary('CaptureAdmission', { state, inputBytes, outputBytes, assessmentBytes }, context, () => {
    for (const [name, value] of Object.entries({ capacity: state.capacity, retained: state.retained, reserved: state.reserved,
      repairReserve: state.repairReserve, inputBytes, outputBytes, assessmentBytes }))
      ensure(Number.isSafeInteger(value) && value >= 0, `${name} must be a finite nonnegative byte count`);
    ensure(state.retained + state.reserved + state.repairReserve <= state.capacity, 'capture accounting already exceeds capacity');
    ensure(state.pinned.every(pin => Number.isSafeInteger(pin.bytes) && pin.bytes >= 0 && pin.reference && pin.reasons.length), 'pin inventory incomplete');
    const requested = inputBytes + outputBytes + assessmentBytes;
    ensure(Number.isSafeInteger(requested), 'capture request overflow');
    const remaining = state.capacity - state.retained - state.reserved - state.repairReserve;
    return freeze({ admitted: requested <= remaining, requested, remaining,
      reason: requested <= remaining ? 'within-capacity' as const : 'capacity-refused' as const });
  });
}

export function closureReleasedPins(closure: AssessmentClosure): readonly string[] {
  // Re-derive ownership at the release consumer. Historical values may have
  // been admitted by an older decoder, so the record's nominated pin is never
  // sufficient authority on its own.
  const owned = `assessment-pin:${closure.caseId}`;
  const substantive = closure.requiredAssessments.length > 0
    && closure.dispositions.length === closure.requiredAssessments.length
    && closure.requiredAssessments.every(assessment => closure.dispositions.some(item => item.assessment === assessment))
    && closure.dispositions.every(item => item.reference.trim().length > 0
      && (item.disposition !== 'evidence-unavailable-with-reason' || item.reason.trim().length > 0));
  return freeze(closure.releasesPin === owned && substantive && closure.activeDisputes.length === 0 ? [owned] : []);
}

export function routineAgeRemovalAllowed(): false { return false; }
export const retainedGap = Object.freeze({
  status: 'partial' as const,
  rule: 7,
  policy: 'retain pinned and unique evidence; refuse new affected capture work at capacity',
  unsupported: 'routine maximum-age deletion without a new governed redaction reason',
});
