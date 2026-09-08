import { canonical, consumeResult } from '../index.js';
import type { Hash, Json, Result } from '../index.js';
import type { ConflictClass } from '../facts/index.js';
import type { ProjectionDefinition, ProjectionGeneration } from '../projections/index.js';
import { boundary, ensure, freeze, take } from './boundary.js';
import { verificationIdentity, verificationKindFor, verificationLogicalKey } from './records.js';
import type { VerificationDecodeContext, VerificationRecord, VerificationRecordName } from './contracts.js';

const viewKinds: Readonly<Record<string, readonly VerificationRecordName[]>> = Object.freeze({
  'verification-due': ['VerificationPlan', 'VerificationRequest', 'VerificationAssessment', 'ProbeRecord', 'AssessmentClosure'],
  'guard-posture': ['VerificationPlan', 'ProbeRecord', 'SemanticReviewRecord'],
  'review-semantic-coverage': ['RetrospectiveReviewRecord', 'SemanticReviewRecord'],
  'grade-affected-claims': ['Grade', 'AssessmentClosure'],
  'feedback-improvement': ['FeedbackDisposition'],
  'waiver-review': ['RetrospectiveReviewRecord'],
  'benchmark-evaluation': ['Grade', 'BenchmarkEvaluation'],
});
export function verificationProjectionDefinitions(generation: ProjectionGeneration): readonly ProjectionDefinition[] {
  return freeze(Object.entries(viewKinds).map(([id, folds]) => ({ id, class: 'informational' as const,
    retention: 'all-identities' as const, stalenessBound: 60_000,
    decisions: Object.fromEntries(generation.kinds.map(kind => {
      const name = (Object.keys(viewKinds).flatMap(key => viewKinds[key]!) as VerificationRecordName[])
        .find(candidate => verificationKindFor(candidate) === kind);
      return [kind, name && folds.includes(name)
        ? { kind: 'folds' as const, merge: 'set-union' as const, identity: 'record.id', value: 'record' }
        : { kind: 'ignores' as const, reason: 'not an input to this verification view; source status remains in the spine' }];
    })),
  })));
}

export interface VerificationMerge {
  readonly records: readonly VerificationRecord[]; readonly conflicts: readonly ConflictClass[];
}
export function mergeVerificationRecords(records: readonly VerificationRecord[]): VerificationMerge {
  const unique = new Map<string, VerificationRecord>(), conflicts: ConflictClass[] = [];
  for (const record of records) {
    const identity = verificationIdentity(record), key = verificationLogicalKey(record);
    const storageKey = `${record.type}:${key}`;
    const prior = unique.get(storageKey);
    if (!prior) { unique.set(storageKey, record); continue; }
    if (verificationIdentity(prior).canonicalHash === identity.canonicalHash) continue;
    conflicts.push({ key, kind: 'immutable-disagreement', facts: [verificationIdentity(prior).canonicalHash, identity.canonicalHash].sort(),
      detail: `concurrent ${record.type} content differs for one identity` });
  }
  return freeze({ records: [...unique.values()].sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`)),
    conflicts: conflicts.sort((a, b) => a.key.localeCompare(b.key)) });
}

export interface ReplicaCurrency {
  readonly knownLineages: readonly string[]; readonly requiredLineages: readonly string[];
  readonly missingLineages: readonly string[]; readonly authorityCurrent: boolean;
}
export function replicaCurrency(knownLineages: readonly string[], requiredLineages: readonly string[]): ReplicaCurrency {
  const known = [...new Set(knownLineages)].sort(), required = [...new Set(requiredLineages)].sort();
  const missing = required.filter(lineage => !known.includes(lineage));
  return freeze({ knownLineages: known, requiredLineages: required, missingLineages: missing, authorityCurrent: missing.length === 0 });
}
export function remoteCaptureUseAllowed(captureOwner: string, workerMachine: string): boolean {
  return captureOwner === workerMachine;
}
