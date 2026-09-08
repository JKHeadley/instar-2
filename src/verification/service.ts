import { consumeResult } from '../index.js';
import type { Clock, Result } from '../index.js';
import { boundary, encoded, ensure, take } from './boundary.js';
import { compareVerificationRecords, decodeVerificationRecord, verificationLogicalKey, verificationRecordFrom, verificationRows } from './records.js';
import { deriveGuardPosture, deriveVerificationDue } from './runtime.js';
import type { GuardPostureView, VerificationDueItem, VerificationFact, VerificationHost,
  VerificationRecord, VerificationRecordName, VerificationRuntimePort, VerificationSpine } from './contracts.js';

export function createVerificationRuntime(host: VerificationHost, spine: VerificationSpine): VerificationRuntimePort {
  const inspect = (): Result<readonly VerificationFact[]> => boundary('VerificationInspect', null, host.boundary, () =>
    verificationRows(take(spine.store.read())).map(row => ({ fact: row.fact, record: verificationRecordFrom(row.fact) })),
  );
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
    inspect,
    due(now: Clock): Result<readonly VerificationDueItem[]> {
      return boundary('VerificationDue', now, host.boundary, () => {
        const rows = take(inspect()).map(row => row.record);
        return deriveVerificationDue(rows.filter((row): row is Extract<VerificationRecord, { type: 'VerificationPlan' }> => row.type === 'VerificationPlan'),
          rows.filter((row): row is Extract<VerificationRecord, { type: 'ProbeRecord' }> => row.type === 'ProbeRecord'), now);
      });
    },
    posture(planId: string, now: Clock): Result<GuardPostureView> {
      return boundary('VerificationPosture', { planId, now }, host.boundary, () => {
        const rows = take(inspect()).map(row => row.record);
        const plan = rows.find((row): row is Extract<VerificationRecord, { type: 'VerificationPlan' }> => row.type === 'VerificationPlan' && row.id === planId);
        ensure(plan, 'verification plan missing');
        return deriveGuardPosture(plan, rows.filter((row): row is Extract<VerificationRecord, { type: 'ProbeRecord' }> => row.type === 'ProbeRecord'), now);
      });
    },
  });
}
