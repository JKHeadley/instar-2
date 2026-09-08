import { canonical } from '../index.js';
import type { Clock, Json, Result } from '../index.js';
import type { FactEnvelope } from '../facts/index.js';
import { boundary, ensure, take } from './boundary.js';
import { decodeVerificationRequest } from './records.js';
import type { VerificationDecodeContext, VerificationPlan, VerificationRequest } from './contracts.js';

function record(fact: FactEnvelope): Readonly<Record<string, Json>> | undefined {
  const body = fact.body as Readonly<Record<string, Json>>; const value = body.record;
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, Json>> : undefined;
}
export interface VerificationPlanFact { readonly fact: string; readonly plan: VerificationPlan }

/** Reconstructs questions only. It has no effect adapter, reservation-release,
 * run-progress, or resubmission capability. */
export function recoverUnsettledVerificationRequests(facts: readonly FactEnvelope[], plans: readonly VerificationPlanFact[],
  existing: readonly VerificationRequest[], now: Clock, context: VerificationDecodeContext): Result<readonly VerificationRequest[]> {
  return boundary('RecoverUnsettledVerificationRequests', { facts: facts.map(f => f.id), plans: plans.map(p => p.fact), now }, context, () => {
    const settlements = new Set(facts.filter(fact => fact.kind === 'effect-EffectSettlement').map(fact => String(record(fact)?.request ?? '')));
    const recovered: VerificationRequest[] = [];
    for (const fact of facts.filter(fact => fact.kind === 'effect-EffectRequest')) {
      const effect = record(fact); ensure(effect, 'effect request body missing');
      const id = String(effect.id ?? ''); if (!id || settlements.has(id)) continue;
      const reservationFact = facts.find(candidate => candidate.kind === 'transport-AdmissionReservation'
        && record(candidate)?.request === id && record(candidate)?.digest === effect.digest);
      ensure(reservationFact, 'unsettled effect has no original six reservation');
      const reservation = record(reservationFact)!;
      const plan = plans.find(item => item.plan.bar.version === effect.verificationBar);
      ensure(plan, 'unsettled effect has no exact verification plan/bar');
      const logicalKey = take(canonical([reservation.operation, effect.digest, plan.plan.id, plan.plan.bar.version])).hash;
      const already = existing.find(request => request.logicalKey === logicalKey && request.predicate === 'occurrence');
      if (already) { recovered.push(already); continue; }
      recovered.push(take(decodeVerificationRequest({ type: 'VerificationRequest', schemaVersion: 1,
        id: `verification-request:${logicalKey}`, predecessors: [fact.id, reservationFact.id, plan.fact].sort(), logicalKey,
        operation: String(reservation.operation), attempt: String(reservation.attempt), reservation: reservationFact.id,
        operationDigest: String(effect.digest), scope: plan.plan.subject.scope, predicate: 'occurrence', plan: plan.plan.id,
        barVersion: plan.plan.bar.version, initialEvidence: [], missingEvidence: ['occurrence', 'non-occurrence', 'quiescence', 'charge'],
        owner: plan.plan.scheduling.owner, loop: plan.plan.scheduling.loopPolicy, createdAt: now.value,
        sourceGeneration: plan.plan.subject.generation }, context)));
    }
    return Object.freeze(recovered.sort((a, b) => a.logicalKey.localeCompare(b.logicalKey)));
  });
}
