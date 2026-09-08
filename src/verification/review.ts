import type { Authorization, Json } from '../index.js';
import type { FactEnvelope } from '../facts/index.js';
import { snapshotCurrent } from '../facts/snapshot.js';
import type { FactSnapshot } from '../facts/snapshot.js';
import { freeze } from './boundary.js';
import type { BenchmarkEvaluation, FeedbackDisposition, Grade, RetrospectiveReviewRecord,
  SemanticReviewRecord, VerificationRecord } from './contracts.js';

export interface ReviewPopulationCase {
  readonly id: string; readonly category: 'intake' | 'question' | 'refusal' | 'default' | 'cancellation' | 'feedback' | 'unsettled';
  readonly fact: string;
}
function recordOf(fact: FactEnvelope): Readonly<Record<string, Json>> | undefined {
  const body = fact.body as Readonly<Record<string, Json>>; const record = body.record;
  return record && typeof record === 'object' && !Array.isArray(record) ? record as Readonly<Record<string, Json>> : undefined;
}
export function enumerateReviewPopulation(facts: readonly FactEnvelope[]): readonly ReviewPopulationCase[] {
  const cases = new Map<string, ReviewPopulationCase>();
  const add = (row: ReviewPopulationCase) => { if (!cases.has(row.id)) cases.set(row.id, row); };
  const settlements = new Set(facts.filter(fact => fact.kind === 'effect-EffectSettlement').map(fact => String(recordOf(fact)?.request ?? '')));
  for (const fact of facts) {
    const record = recordOf(fact);
    if (fact.kind === 'intake-admitted') add({ id: `intake:${fact.id}`, category: 'intake', fact: fact.id });
    if (fact.kind === 'judgment-JudgmentRequest') add({ id: `question:${String(record?.id ?? fact.id)}`, category: 'question', fact: fact.id });
    if (fact.kind === 'judgment-JudgmentResolution' && record?.disposition === 'refused') add({ id: `refusal:${String(record.id)}`, category: 'refusal', fact: fact.id });
    if (fact.kind === 'judgment-JudgmentResolution' && record?.disposition === 'defaulted') add({ id: `default:${String(record.id)}`, category: 'default', fact: fact.id });
    if ((fact.kind === 'run-transition' && (record?.to === 'cancelled' || record?.kind === 'cancel')) || record?.disposition === 'cancelled')
      add({ id: `cancellation:${String(record?.id ?? fact.id)}`, category: 'cancellation', fact: fact.id });
    if (fact.kind === 'verification-FeedbackDisposition') add({ id: `feedback:${String(record?.id ?? fact.id)}`, category: 'feedback', fact: fact.id });
    if (fact.kind === 'effect-EffectRequest' && !settlements.has(String(record?.id ?? '')))
      add({ id: `unsettled:${String(record?.id ?? fact.id)}`, category: 'unsettled', fact: fact.id });
  }
  return freeze([...cases.values()].sort((a, b) => a.id.localeCompare(b.id)));
}

export interface ReviewAccounting {
  readonly eligible: number; readonly inspected: number; readonly omitted: number; readonly complete: boolean;
  readonly categories: Readonly<Record<ReviewPopulationCase['category'], number>>;
}
export function reviewAccounting(population: readonly ReviewPopulationCase[], record: RetrospectiveReviewRecord): ReviewAccounting {
  const ids = new Set(population.map(row => row.id));
  const inspected = new Set(record.inspected), omitted = new Set(record.omitted.map(row => row.caseId));
  const accounted = [...ids].every(id => inspected.has(id) !== omitted.has(id));
  const categories = Object.fromEntries((['intake', 'question', 'refusal', 'default', 'cancellation', 'feedback', 'unsettled'] as const)
    .map(category => [category, population.filter(row => row.category === category).length])) as ReviewAccounting['categories'];
  return freeze({ eligible: ids.size, inspected: [...inspected].filter(id => ids.has(id)).length,
    omitted: [...omitted].filter(id => ids.has(id)).length,
    complete: accounted && record.eligibleCases.length === ids.size && record.eligibleCases.every(id => ids.has(id)), categories });
}

export interface FeedbackCoverage {
  readonly total: number; readonly inspectedOrPending: number; readonly missing: readonly string[];
  readonly openImprovement: readonly string[]; readonly verifiedImprovement: readonly string[];
}
export function feedbackCoverage(admittedIntentIds: readonly string[], dispositions: readonly FeedbackDisposition[]): FeedbackCoverage {
  const unique = [...new Set(admittedIntentIds)].sort();
  const byIntent = new Map(dispositions.map(row => [row.sourceIntent, row]));
  const missing = unique.filter(id => !byIntent.has(id));
  const open = dispositions.filter(row => !['verified-improvement', 'duplicate-linked', 'declined-with-reason'].includes(row.disposition)).map(row => row.id).sort();
  const verified = dispositions.filter(row => row.disposition === 'verified-improvement').map(row => row.id).sort();
  return freeze({ total: unique.length, inspectedOrPending: unique.length - missing.length, missing,
    openImprovement: open, verifiedImprovement: verified });
}

export interface HeldEdge { readonly edge: string; readonly generation: string; readonly firstSeen: number }
export interface SemanticCoverageRow {
  readonly edge: string; readonly generation: string; readonly reviewed: boolean;
  readonly verdict: 'adequate' | 'partial' | 'inadequate' | 'disputed' | 'never'; readonly records: readonly string[];
}
export interface SemanticCoverageHistory { readonly snapshot: FactSnapshot }
function cleanHistoricalReferences(history: SemanticCoverageHistory | undefined): Readonly<{ all: ReadonlySet<string>; checkRuns: ReadonlySet<string> }> {
  const ids = new Set<string>(), checkRuns = new Set<string>();
  if (!history || !snapshotCurrent(history.snapshot)) return { all: ids, checkRuns };
  for (const entry of history.snapshot.entries) {
    if (entry.taint.length || entry.conflicts.length) continue;
    ids.add(entry.fact.id); if (entry.fact.kind === 'check-run-record') checkRuns.add(entry.fact.id);
    const body = entry.body && typeof entry.body === 'object' && !Array.isArray(entry.body)
      ? entry.body as Readonly<Record<string, Json>> : undefined;
    if (typeof body?.id === 'string') {
      ids.add(body.id); if (entry.fact.kind === 'check-run-record') checkRuns.add(body.id);
    }
    const nested = body?.record && typeof body.record === 'object' && !Array.isArray(body.record)
      ? body.record as Readonly<Record<string, Json>> : undefined;
    if (typeof nested?.id === 'string') {
      ids.add(nested.id); if (entry.fact.kind === 'check-run-record') checkRuns.add(nested.id);
    }
  }
  return { all: ids, checkRuns };
}
export function semanticCoverage(edges: readonly HeldEdge[], reviews: readonly SemanticReviewRecord[],
  history?: SemanticCoverageHistory): readonly SemanticCoverageRow[] {
  const resolved = cleanHistoricalReferences(history);
  return freeze(edges.map(edge => {
    const exact = reviews.filter(review => review.edge === edge.edge && review.generation === edge.generation);
    const verdicts = new Set(exact.map(review => review.verdict));
    const adequateResolved = exact.filter(review => review.verdict === 'adequate').every(review =>
      review.layerBelow.length > 0 && review.evidencePopulation.length > 0 && review.checkRuns.length > 0
      && [...review.layerBelow, ...review.evidencePopulation].every(id => resolved.all.has(id))
      && review.checkRuns.every(id => resolved.checkRuns.has(id)));
    const verdict = exact.length === 0 ? 'never' as const : verdicts.size > 1 ? 'disputed' as const
      : exact[0]!.verdict === 'adequate' && !adequateResolved ? 'partial' as const : exact[0]!.verdict;
    return { edge: edge.edge, generation: edge.generation, reviewed: verdict === 'adequate', verdict,
      records: exact.map(review => review.id).sort() };
  }).sort((a, b) => a.edge.localeCompare(b.edge)));
}

export interface GradeSupport {
  readonly grade: string; readonly current: boolean; readonly reasons: readonly string[];
}
export function gradeSupport(grade: Grade, changedEvidence: readonly string[] = []): GradeSupport {
  const used = new Set([grade.conclusion, grade.statedReason, grade.outcome, ...grade.processAssessments].flatMap(row => row.evidence));
  const reasons: string[] = [];
  if (grade.taints.length) reasons.push('tainted-source');
  if (grade.captureStatuses.some(row => row.status !== 'available')) reasons.push('capture-unavailable');
  if (changedEvidence.some(id => used.has(id))) reasons.push('dependency-changed');
  if (grade.completeness.assessment !== 'complete') reasons.push(`case-${grade.completeness.assessment}`);
  return freeze({ grade: grade.id, current: reasons.length === 0, reasons: [...new Set(reasons)].sort() });
}
export function affectedGrades(grades: readonly Grade[], changedEvidence: readonly string[]): readonly string[] {
  return grades.filter(grade => !gradeSupport(grade, changedEvidence).current).map(grade => grade.id).sort();
}

export interface BenchmarkAccounting {
  readonly evaluation: string; readonly denominator: number; readonly accounted: number;
  readonly complete: boolean; readonly heldOutLeakage: readonly string[]; readonly selected: string | null;
}
export function benchmarkAccounting(record: BenchmarkEvaluation): BenchmarkAccounting {
  const sourceGroup = new Map<string, string>(), leakage = new Set<string>();
  for (const group of record.heldOutGroups) for (const source of group.sources) {
    const prior = sourceGroup.get(source); if (prior && prior !== group.group) leakage.add(source); else sourceGroup.set(source, group.group);
  }
  const accounted = record.executions.length + record.missing.length + record.cancelled.length + record.refused.length;
  const complete = record.complete && record.sampleSize > 0 && accounted === record.sampleSize && !record.missing.length && !leakage.size;
  return freeze({ evaluation: record.id, denominator: record.sampleSize, accounted, complete,
    heldOutLeakage: [...leakage].sort(), selected: complete && record.selection ? record.selection : null });
}

export interface WaiverAct { readonly id: string; readonly rule: string; readonly scope: string; readonly at: number; readonly predecessors: readonly string[] }
export interface WaiverReview {
  readonly waivers: number; readonly linkedActs: number; readonly unusedWaivers: readonly string[];
  readonly actsWithoutPriorWaiver: readonly string[];
}
export function waiverReview(authorizations: readonly Authorization[], acts: readonly WaiverAct[]): WaiverReview {
  const waivers = [...new Map(authorizations.filter(a => a.kind.kind === 'waiver').map(a => [a.id, a])).values()];
  const links = new Set<string>(); const missing: string[] = [];
  for (const act of acts) {
    const matched = waivers.find(waiver => waiver.kind.kind === 'waiver' && waiver.kind.rule === act.rule
      && waiver.at.value < act.at && act.predecessors.includes(waiver.id));
    if (matched) links.add(matched.id); else missing.push(act.id);
  }
  return freeze({ waivers: waivers.length, linkedActs: acts.length - missing.length,
    unusedWaivers: waivers.filter(waiver => !links.has(waiver.id)).map(waiver => waiver.id).sort(),
    actsWithoutPriorWaiver: missing.sort() });
}

export function verificationKindsIgnoredByExistingProjection(record: VerificationRecord): string {
  return `projection must explicitly fold or ignore ${record.type}`;
}
