/** An owner-issued (Part Nine) HISTORICAL validation of a provider effect settlement.
 * Given a settlement's proposed charge/outcome/exposure/quiescence and the Nine
 * assessment it references, it answers whether those values are EXACTLY what the
 * assessment's own predicates support — re-deriving them the same way Nine's live
 * consumer does (occurrence/non-occurrence/quiescence/charge predicates → outcome
 * kind, delayed-execution exclusion and final charge), never trusting the amounts a
 * settlement record copies. Eight's settlement decoder calls this so an unwitnessed
 * charge (or a flipped outcome/quiescence) cannot pass historical decoding, while
 * Six keeps its own exact owner-decoded wire comparison. Pure: the caller resolves
 * each charge-evidence amount and the operation's reservation charge from the facts. */
export interface ProviderSettlementSupportInput {
  readonly assessment: Readonly<{ predicates: readonly Readonly<{ predicate: string; verdict: string; evidence: readonly string[] }>[] }>;
  /** Resolves the numeric amount an assessment charge-evidence id witnesses, or null. */
  readonly chargeAmount: (evidenceId: string) => number | null;
  readonly reservationCharge: number;
  readonly settlement: Readonly<{ finalCharge: number | null; retainedExposure: number;
    delayedExecutionExcluded: boolean; outcomeKind: string }>;
}
export function providerSettlementSupported(input: ProviderSettlementSupportInput): boolean {
  const predicate = (name: string) => input.assessment.predicates.find(p => p.predicate === name);
  const occurrence = predicate('occurrence'), absent = predicate('non-occurrence'),
    quiet = predicate('quiescence'), charge = predicate('charge');
  if (!occurrence || !absent || !quiet || !charge) return false;
  const kind = occurrence.verdict === 'satisfied' ? 'happened'
    : absent.verdict === 'satisfied' && quiet.verdict === 'satisfied' ? 'did-not-happen' : 'uncertain';
  const delayedExecutionExcluded = quiet.verdict === 'satisfied';
  let finalCharge: number | null = null;
  if (charge.verdict === 'satisfied' && charge.evidence.length > 0) {
    const amounts = charge.evidence.map(id => input.chargeAmount(id));
    const amount = amounts[0];
    if (typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0 && amounts.every(n => n === amount)) finalCharge = amount;
    else return false;
  }
  const uncertain = kind === 'uncertain';
  const retainedExposure = uncertain || finalCharge === null || !delayedExecutionExcluded ? input.reservationCharge : finalCharge;
  return input.settlement.outcomeKind === kind
    && input.settlement.delayedExecutionExcluded === delayedExecutionExcluded
    && input.settlement.finalCharge === finalCharge
    && input.settlement.retainedExposure === retainedExposure;
}
