import { freeze } from './boundary.js';
import type { Grade, RetrospectiveReviewRecord, VerificationPlan } from './contracts.js';

export const adapterStimulusClasses = freeze([
  { id: 'conversation', authentication: 'channel-attested', limit: 'stolen platform credentials remain outside sampling proof' },
  { id: 'signed-webhook', authentication: 'verified-signature', limit: 'unsigned fetched records remain channel-attested' },
  { id: 'scheduler', authentication: 'registered-source-credential', limit: 'local reachability is not authority' },
  { id: 'agent-transport', authentication: 'signed-receiver-receipt', limit: 'relay acknowledgement is not peer delivery' },
  { id: 'harness', authentication: 'worker-consumption-receipt', limit: 'stdin/session creation is not consumption' },
  { id: 'model', authentication: 'provider-receipt-and-usage', limit: 'fluency is not provider identity or quality' },
  { id: 'persistence-vault', authentication: 'durable-read-and-access-refusal', limit: 'a hash is not an authentic source' },
  { id: 'effect-adapter', authentication: 'authoritative-operation-query', limit: 'eventual search miss is not non-occurrence' },
  { id: 'operator-surface', authentication: 'verified-exact-request', limit: 'canaries never mint governing operator approval' },
] as const);

export interface SupervisionObservation {
  readonly boundary: string; readonly state: 'validated' | 'unavailable';
  readonly attempt: string; readonly resolution: string; readonly operation: string;
  readonly recursivelySupervisesOwnCall: boolean;
}
export interface SupervisionCoverageRow {
  readonly boundary: string; readonly state: 'validated' | 'unavailable' | 'missing' | 'recursive-refused';
  readonly references: readonly string[];
}
export function supervisionCoverage(required: readonly string[], observations: readonly SupervisionObservation[]): readonly SupervisionCoverageRow[] {
  return freeze([...new Set(required)].sort().map(boundary => {
    const matches = observations.filter(row => row.boundary === boundary);
    const recursive = matches.some(row => row.recursivelySupervisesOwnCall);
    const state = recursive ? 'recursive-refused' as const : matches.some(row => row.state === 'validated') ? 'validated' as const
      : matches.some(row => row.state === 'unavailable') ? 'unavailable' as const : 'missing' as const;
    return { boundary, state, references: matches.flatMap(row => [row.attempt, row.resolution, row.operation]).filter(Boolean).sort() };
  }));
}

export function reviewDisclosureAllowed(plan: VerificationPlan, reader: string, provider: string | null): boolean {
  if (!plan.privacy.readers.includes(reader)) return false;
  return provider === null || plan.privacy.providers.includes(provider);
}

export interface ReportClaim { readonly operation: string; readonly result: 'success' | 'refused'; readonly subject: string }
export function reportContradictsActual(report: ReportClaim, actual: ReportClaim): boolean | null {
  if (report.operation !== actual.operation || report.subject !== actual.subject) return null;
  return report.result === 'success' && actual.result === 'refused';
}

export function outcomeWindowStatus(grade: Grade, observationAt: number | null): 'within-window' | 'late' | 'missing' {
  if (observationAt === null) return 'missing';
  return observationAt >= grade.window.start && observationAt < grade.window.end ? 'within-window' : 'late';
}

export function convergenceEligible(record: RetrospectiveReviewRecord, artifactAuthor: string): boolean {
  return record.closure === 'converged' && record.reviewer !== artifactAuthor
    && record.independenceEvidence.length > 0 && record.layerBelow.length > 0;
}

export function activationGaps(plan: VerificationPlan): readonly string[] {
  const gaps: string[] = [];
  if (!plan.activation.unit.length) gaps.push('unit');
  if (!plan.activation.integration.length) gaps.push('integration');
  if (!plan.activation.lifecycle.length) gaps.push('lifecycle');
  if (!plan.activation.semantic.length) gaps.push('semantic');
  if (!plan.activation.limits.length || !plan.bounds.length) gaps.push('bounds');
  if (!plan.activation.evidence.length) gaps.push('check-run-evidence');
  if (!plan.arms.some(arm => arm.kind === 'probe')) gaps.push('live-probe-arm');
  return freeze(gaps.sort());
}
