import type { Authorization, Hash, Json, VerifiedPrincipal } from '../index.js';
import type { FactEnvelope } from '../facts/index.js';
import { snapshotCurrent } from '../facts/snapshot.js';
import type { FactSnapshot } from '../facts/snapshot.js';
import { freeze } from './boundary.js';
import { mergeVerificationRecords, verificationRecordsShareIdentity } from './storage.js';
import { verificationIdentity } from './records.js';
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
interface HistoricalSemanticReview {
  readonly record: SemanticReviewRecord; readonly taint: readonly string[]; readonly conflicts: readonly unknown[];
}
interface HistoricalVerificationRecord {
  readonly record: VerificationRecord; readonly aliases: readonly string[];
  readonly conflicts: readonly unknown[];
}
function cleanHistoricalReferences(history: SemanticCoverageHistory | undefined): Readonly<{
  all: ReadonlySet<string>; checkRuns: ReadonlySet<string>; semanticReviews: readonly HistoricalSemanticReview[];
}> {
  const ids = new Set<string>(), checkRuns = new Set<string>();
  const semanticReviews: HistoricalSemanticReview[] = [];
  const verificationRecords: HistoricalVerificationRecord[] = [];
  if (!history || !snapshotCurrent(history.snapshot)) return { all: ids, checkRuns, semanticReviews };
  for (const entry of history.snapshot.entries) {
    const body = entry.body && typeof entry.body === 'object' && !Array.isArray(entry.body)
      ? entry.body as Readonly<Record<string, Json>> : undefined;
    const nested = body?.record && typeof body.record === 'object' && !Array.isArray(body.record)
      ? body.record as Readonly<Record<string, Json>> : undefined;
    if (entry.fact.kind === 'verification-SemanticReviewRecord' && nested?.type === 'SemanticReviewRecord') {
      semanticReviews.push({ record: nested as unknown as SemanticReviewRecord, taint: entry.taint, conflicts: entry.conflicts });
    }
    const aliases = [entry.fact.id];
    if (typeof body?.id === 'string') {
      aliases.push(body.id);
    }
    if (typeof nested?.id === 'string') {
      aliases.push(nested.id);
    }
    if (entry.fact.kind.startsWith('verification-') && typeof nested?.type === 'string') {
      verificationRecords.push({ record: nested as unknown as VerificationRecord, aliases, conflicts: entry.conflicts });
    }
    if (entry.taint.length || entry.conflicts.length) continue;
    ids.add(entry.fact.id); if (entry.fact.kind === 'check-run-record') checkRuns.add(entry.fact.id);
    if (typeof body?.id === 'string') {
      ids.add(body.id); if (entry.fact.kind === 'check-run-record') checkRuns.add(body.id);
    }
    if (typeof nested?.id === 'string') {
      ids.add(nested.id); if (entry.fact.kind === 'check-run-record') checkRuns.add(nested.id);
    }
  }
  for (const row of verificationRecords) {
    const related = verificationRecords.filter(other => verificationRecordsShareIdentity(row.record, other.record));
    if (mergeVerificationRecords(related.map(other => other.record)).conflicts.length > 0
      || related.some(other => other.conflicts.length > 0)) {
      related.flatMap(other => other.aliases).forEach(id => ids.delete(id));
    }
  }
  return { all: ids, checkRuns, semanticReviews };
}
function semanticHolderBinding(review: SemanticReviewRecord, history: ReturnType<typeof cleanHistoricalReferences>) {
  const related = history.semanticReviews.filter(row => verificationRecordsShareIdentity(row.record, review));
  const conflict = mergeVerificationRecords(related.map(row => row.record)).conflicts.length > 0
    || related.some(row => row.conflicts.length > 0);
  const hash = verificationIdentity(review).canonicalHash;
  const current = !conflict && related.some(row => verificationIdentity(row.record).canonicalHash === hash
    && row.taint.length === 0 && row.conflicts.length === 0);
  return { current, conflict };
}
export function semanticCoverage(edges: readonly HeldEdge[], reviews: readonly SemanticReviewRecord[],
  history?: SemanticCoverageHistory): readonly SemanticCoverageRow[] {
  const resolved = cleanHistoricalReferences(history);
  return freeze(edges.map(edge => {
    const exact = reviews.filter(review => review.edge === edge.edge && review.generation === edge.generation);
    const verdicts = new Set(exact.map(review => review.verdict));
    const bindings = exact.map(review => semanticHolderBinding(review, resolved));
    const holderConflict = bindings.some(binding => binding.conflict);
    const adequateResolved = exact.filter(review => review.verdict === 'adequate').every(review =>
      review.layerBelow.length > 0 && review.evidencePopulation.length > 0 && review.checkRuns.length > 0
      && [...review.layerBelow, ...review.evidencePopulation].every(id => resolved.all.has(id))
      && review.checkRuns.every(id => resolved.checkRuns.has(id))
      && bindings[exact.indexOf(review)]?.current === true);
    const verdict = exact.length === 0 ? 'never' as const : verdicts.size > 1 || holderConflict ? 'disputed' as const
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

// Rule 94: a waiver covers an act only when it names the act's rule, its scope covers the act,
// it binds the act's exact bytes and base where the act carries them, it came strictly before
// the act, and the act names it as a causal predecessor. Valid waivers are counted per rule so
// the rules review can see which rules keep needing them (amendment evidence).
export interface WaiverAct {
  readonly id: string; readonly rule: string; readonly scope: string; readonly at: number; readonly predecessors: readonly string[];
  readonly artifact?: Hash; readonly base?: string;
}
export interface WaiverReview {
  readonly waivers: number; readonly linkedActs: number; readonly unusedWaivers: readonly string[];
  readonly actsWithoutPriorWaiver: readonly string[];
  readonly validByRule: Readonly<Record<string, number>>; readonly recurringRules: readonly string[];
}
const waiverCovers = (waiver: Authorization, act: WaiverAct) => waiver.kind.kind === 'waiver' && waiver.kind.rule === act.rule
  && waiver.at.value < act.at && act.predecessors.includes(waiver.id)
  && (waiver.action.scope.kind === 'organization' || waiver.action.scope.members.includes(act.scope))
  && (act.artifact === undefined || waiver.artifact === act.artifact) && (act.base === undefined || waiver.base === act.base);
export function waiverReview(authorizations: readonly Authorization[], acts: readonly WaiverAct[], recurringAt = 2): WaiverReview {
  const waivers = [...new Map(authorizations.filter(a => a.kind.kind === 'waiver').map(a => [a.id, a])).values()];
  const links = new Set<string>(); const missing: string[] = [];
  for (const act of acts) {
    const matched = waivers.find(waiver => waiverCovers(waiver, act));
    if (matched) links.add(matched.id); else missing.push(act.id);
  }
  const validByRule: Record<string, number> = {};
  for (const waiver of waivers) if (links.has(waiver.id) && waiver.kind.kind === 'waiver')
    validByRule[waiver.kind.rule] = (validByRule[waiver.kind.rule] ?? 0) + 1;
  return freeze({ waivers: waivers.length, linkedActs: acts.length - missing.length,
    unusedWaivers: waivers.filter(waiver => !links.has(waiver.id)).map(waiver => waiver.id).sort(),
    actsWithoutPriorWaiver: missing.sort(), validByRule: freeze(validByRule),
    recurringRules: Object.keys(validByRule).filter(rule => validByRule[rule]! >= recurringAt).sort() });
}

// Rule 98: silence is never the operator's consent. A peer agent's silence concurs only past a
// deadline that was recorded no later than the request; any person's silence is never consent.
export interface PeerReviewDeadline { readonly reviewer: VerifiedPrincipal; readonly requestedAt: number; readonly declaredAt: number; readonly deadline: number }
export type SilenceDisposition = Readonly<{ kind: 'concurred-by-deadline'; reviewer: string; deadline: number }>
  | Readonly<{ kind: 'no-consent'; reason: 'operator-silence' | 'undeclared-deadline' | 'deadline-open' | 'responded' }>;
export function silenceDisposition(review: PeerReviewDeadline | undefined, responded: boolean, now: number): SilenceDisposition {
  if (responded) return freeze({ kind: 'no-consent', reason: 'responded' });
  if (!review || !Number.isSafeInteger(review.declaredAt) || !Number.isSafeInteger(review.deadline)
    || review.declaredAt > review.requestedAt || review.deadline <= review.requestedAt) return freeze({ kind: 'no-consent', reason: 'undeclared-deadline' });
  if (review.reviewer.kind !== 'agent') return freeze({ kind: 'no-consent', reason: 'operator-silence' });
  if (now <= review.deadline) return freeze({ kind: 'no-consent', reason: 'deadline-open' });
  return freeze({ kind: 'concurred-by-deadline', reviewer: review.reviewer.id, deadline: review.deadline });
}

export function verificationKindsIgnoredByExistingProjection(record: VerificationRecord): string {
  return `projection must explicitly fold or ignore ${record.type}`;
}
