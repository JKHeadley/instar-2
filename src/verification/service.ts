import { consumeResult } from '../index.js';
import type { Clock, Result } from '../index.js';
import { snapshotCurrent } from '../facts/snapshot.js';
import { boundary, encoded, ensure, take } from './boundary.js';
import { compareVerificationRecords, decodeVerificationRecord, verificationLogicalKey, verificationRecordFrom, verificationRows } from './records.js';
import { mergeVerificationRecords } from './storage.js';
import { deriveGuardPosture, deriveVerificationDue, probeBoundToCurrentEvidence } from './runtime.js';
import type { GuardPostureView, VerificationDueItem, VerificationFact, VerificationHost,
  VerificationRecord, VerificationRecordName, VerificationRuntimePort, VerificationSpine } from './contracts.js';

export function createVerificationRuntime(host: VerificationHost, spine: VerificationSpine): VerificationRuntimePort {
  const inspect = (): Result<readonly VerificationFact[]> => boundary('VerificationInspect', null, host.boundary, () =>
    verificationRows(take(spine.store.read()), host.boundary).map(row => ({ fact: row.fact, record: verificationRecordFrom(row.fact, host.boundary) })),
  );
  const inspectCurrent = () => boundary('VerificationCurrentInspect', null, host.boundary, () => {
    const snapshot = take(spine.store.readForProjection());
    ensure(snapshotCurrent(snapshot), 'verification projection snapshot became stale');
    return snapshot.entries.filter(entry => entry.fact.kind.startsWith('verification-')).map(entry => ({
      fact: entry.fact, record: verificationRecordFrom(entry.fact, host.boundary), taint: entry.taint, conflicts: entry.conflicts,
    }));
  });
  return Object.freeze({ owner: 'part-nine' as const,
    record<N extends VerificationRecordName>(name: N, input: unknown): Result<Extract<VerificationRecord, { type: N }>> {
      return boundary('VerificationRecord', input, host.boundary, () => {
        ensure(!host.current().stopped || name === 'VerificationAssessment' || name === 'FeedbackDisposition', 'stop inhibits new verification work');
        const candidate = take(decodeVerificationRecord(name, input, host.boundary));
        const existing = take(inspect()).find(row => row.record.type === name
          && (row.record.id === candidate.id || verificationLogicalKey(row.record) === verificationLogicalKey(candidate)));
        if (existing) {
          const compared = take(compareVerificationRecords(name, existing.record, candidate, host.boundary));
          ensure(compared.equal, compared.conflict?.detail ?? 'verification identity conflict');
          return existing.record as Extract<VerificationRecord, { type: N }>;
        }
        take(spine.append(candidate, candidate.predecessors));
        return candidate;
      });
    },
    inspect, inspectCurrent,
    due(now: Clock): Result<readonly VerificationDueItem[]> {
      return boundary('VerificationDue', now, host.boundary, () => {
        const rows = take(inspect()).map(row => row.record);
        return deriveVerificationDue(rows.filter((row): row is Extract<VerificationRecord, { type: 'VerificationPlan' }> => row.type === 'VerificationPlan'),
          rows.filter((row): row is Extract<VerificationRecord, { type: 'ProbeRecord' }> => row.type === 'ProbeRecord'), now);
      });
    },
    posture(planId: string, now: Clock): Result<GuardPostureView> {
      return boundary('VerificationPosture', { planId, now }, host.boundary, () => {
        const current = host.current(); const rows = take(inspectCurrent());
        const merged = mergeVerificationRecords(rows.map(row => row.record));
        ensure(merged.conflicts.length === 0, merged.conflicts[0]?.detail ?? 'verification history conflict');
        ensure(rows.every(row => row.conflicts.length === 0), 'verification projection contains immutable disagreement');
        const planRows = rows.filter((row): row is typeof row & { record: Extract<VerificationRecord, { type: 'VerificationPlan' }> } =>
          row.record.type === 'VerificationPlan' && row.record.id === planId);
        ensure(planRows.length === 1, 'verification plan missing or ambiguous');
        const plan = planRows[0]!;
        const probes = rows.filter((row): row is typeof row & { record: Extract<VerificationRecord, { type: 'ProbeRecord' }> } =>
          row.record.type === 'ProbeRecord').map(row => ({ probe: row.record,
          sourceStatus: row.taint.length || row.conflicts.length ? 'unavailable' as const : 'available' as const,
          bound: row.taint.length === 0 && row.conflicts.length === 0
            && probeBoundToCurrentEvidence(plan.record, row.record, now, current.evidence, current.decode, current.facts, host.boundary) }));
        return deriveGuardPosture(plan.record, probes, now, current.generation, plan.taint.length === 0 && plan.conflicts.length === 0);
      });
    },
  });
}
