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
export function verificationRecordsShareIdentity(left: VerificationRecord, right: VerificationRecord): boolean {
  return left.type === right.type
    && (left.id === right.id || verificationLogicalKey(left) === verificationLogicalKey(right));
}

export function verificationIdentityClosure<T extends Readonly<{ record: VerificationRecord }>>(
  rows: readonly T[], seeds: readonly T[],
): readonly T[] {
  const selected = new Set(seeds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (selected.has(row)) continue;
      if ([...selected].some(prior => verificationRecordsShareIdentity(prior.record, row.record))) {
        selected.add(row); changed = true;
      }
    }
  }
  return freeze([...selected]);
}

export function mergeVerificationRecords(records: readonly VerificationRecord[]): VerificationMerge {
  const ordered = [...records].sort((a, b) => {
    const ai = verificationIdentity(a), bi = verificationIdentity(b);
    return `${a.type}:${ai.logicalKey}:${ai.id}:${ai.canonicalHash}`.localeCompare(`${b.type}:${bi.logicalKey}:${bi.id}:${bi.canonicalHash}`);
  });
  const conflicts = new Map<string, ConflictClass>();
  for (let index = 0; index < ordered.length; index++) {
    const left = ordered[index]!, li = verificationIdentity(left);
    for (let other = index + 1; other < ordered.length; other++) {
      const right = ordered[other]!;
      if (!verificationRecordsShareIdentity(left, right)) continue;
      const ri = verificationIdentity(right);
      if (li.canonicalHash === ri.canonicalHash) continue;
      const sameLogicalKey = li.logicalKey === ri.logicalKey;
      const key = sameLogicalKey ? li.logicalKey : `id:${left.type}:${li.id}`;
      const facts = [li.canonicalHash, ri.canonicalHash].sort();
      conflicts.set(`${left.type}:${key}:${facts.join(':')}`, {
        key, kind: 'immutable-disagreement', facts,
        detail: sameLogicalKey
          ? `concurrent ${left.type} content differs for one logical identity ${key}`
          : `concurrent ${left.type} content differs for immutable record id ${li.id}`,
      });
    }
  }
  const unique = new Map<string, VerificationRecord>();
  for (const record of ordered) {
    const key = `${record.type}:${verificationLogicalKey(record)}`;
    if (!unique.has(key)) unique.set(key, record);
  }
  return freeze({ records: [...unique.values()].sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`)),
    conflicts: [...conflicts.values()].sort((a, b) => `${a.key}:${a.facts.join(':')}`.localeCompare(`${b.key}:${b.facts.join(':')}`)) });
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
