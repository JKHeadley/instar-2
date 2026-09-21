// P10-SI-22: the per-hold installation report. Every one of the twenty-five production holds is
// reported individually as held, prepared, fixture-admitted or admitted, with its owner and its
// evidence reference. "Prepared" requires a matching owner-validated configuration. "Admitted" requires current
// evidence issued by the hold's owner exists. They never merge: selection metadata alone, a
// fixture identity, a stale observation or a foreign owner's fact never reads admitted, and the
// report never converts installation metadata into a live-service claim.
import type { BoundaryContext, Result } from '../index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';
import { prepareSnapshot } from '../facts/index.js';
import type { FactContext } from '../facts/index.js';
import { decodeHistoricalInstallationSelection } from './installation-selection.js';
import type { InstallationRecordAdmission, InstallationRole } from './installation-selection.js';
import { productionMissingBindings } from './production-holds.js';

/** Contract §5: the bounded install supervisor Seven owns; no supervisor source is landed at this baseline. */
export const installationSupervisorHold = 'seven-bounded-install-supervisor';
export const installationReportHolds = Object.freeze([...productionMissingBindings, installationSupervisorHold] as const);
export type InstallationHold = (typeof installationReportHolds)[number];

/** The owner whose current evidence closes each hold. A row is never admitted by another owner's fact. */
export const installationHoldOwners: Readonly<Record<InstallationHold, string>> = Object.freeze({
  'independent-worker-protection': 'part-nine', 'replication-peer': 'part-two',
  'installation-trust-register-identity': 'part-three', 'independent-verification-clock': 'part-nine',
  'operator-surface-registration': 'part-eleven', 'independent-challenge-verifier': 'part-nine',
  'verified-act-intake-binding': 'part-four', 'minimal-plane-fold-bindings': 'part-eleven',
  'source-only-replay-admission': 'part-ten', 'minimal-responder-budget-admission': 'part-eleven',
  'live-dependency-admission': 'part-ten', 'conversation-binding-route': 'part-four',
  'prerequisite-lifecycle-controls': 'part-ten', 'platform-delivery-witness': 'part-nine',
  'assembly-manifest-admission': 'part-ten', 'adapter-conformance-evidence': 'part-ten',
  'worker-isolation-evidence': 'part-ten', 'storage-custody-admission': 'part-ten',
  'activation-probe-evidence': 'part-nine', 'activation-resource-reservation': 'part-six',
  'production-context-sampling': 'part-ten', 'run-governance-policy': 'part-five',
  'provider-settlement-witness': 'part-eight', 'conversation-driver': 'part-twelve',
  'seven-bounded-install-supervisor': 'part-seven',
});

export type InstallationHoldState = 'held' | 'prepared' | 'fixture-admitted' | 'admitted';
/** Untrusted lookup hints. These labels never establish owner issuance or close a predicate. */
export interface InstallationReportFact { readonly kind: string; readonly owner: string; readonly fixture: boolean; readonly current: boolean }
export interface InstallationReportFactsPort {
  readonly owner: 'part-ten'; lookup(reference: string): InstallationReportFact | null;
  readonly history?: FactContext; readonly admission?: InstallationRecordAdmission;
}
export interface InstallationHoldVerdict {
  readonly hold: string; readonly owner: string;
  /** Exact selection instance whose configuration is being inspected. */
  readonly subject?: string;
  /** The recorded configuration (a selection or direct owner record) for this hold, if any. */
  readonly prepared?: string;
  /** The owner's evidence that the hold is closed, if any. */
  readonly evidence?: string;
}
export interface InstallationHoldRow {
  readonly hold: InstallationHold; readonly owner: string; readonly state: InstallationHoldState;
  readonly prepared: string | null; readonly evidence: string | null; readonly reason: string;
}
export interface InstallationHoldReport {
  readonly type: 'InstallationHoldReport'; readonly schemaVersion: 1;
  readonly installation: string; readonly scope: string; readonly generation: string; readonly vector: string;
  readonly rows: readonly InstallationHoldRow[];
  readonly counts: Readonly<Record<InstallationHoldState, number>>;
  /** Installation metadata is never a live-service claim; switch-on is a separate owner verdict. */
  readonly live: false;
}
const preparationRoles: Partial<Record<InstallationHold, InstallationRole>> = {
  'operator-surface-registration': 'operator-surface', 'independent-challenge-verifier': 'challenge-verifier',
  'verified-act-intake-binding': 'verified-act-intake', 'minimal-plane-fold-bindings': 'minimal-plane-fold',
  'source-only-replay-admission': 'minimal-plane-replay', 'minimal-responder-budget-admission': 'minimal-responder',
  'independent-verification-clock': 'verification-clock', 'conversation-binding-route': 'conversation-route',
  'platform-delivery-witness': 'delivery-witness',
};

export function reportInstallationHolds(input: Readonly<{ installation: string; scope: string; generation: string; vector: string;
  verdicts: readonly InstallationHoldVerdict[]; facts: InstallationReportFactsPort }>, context: BoundaryContext): Result<InstallationHoldReport> {
  return boundary('InstallationHoldReport', null, context, () => {
    for (const field of ['installation', 'scope', 'generation', 'vector'] as const)
      ensure(typeof input[field] === 'string' && input[field].length > 0, `report: ${field} required`);
    ensure(input.facts?.owner === 'part-ten' && typeof input.facts.lookup === 'function', 'report: opened-root fact lookup required');
    const known = new Set<string>(installationReportHolds), seen = new Set<string>();
    for (const verdict of input.verdicts) {
      ensure(known.has(verdict.hold), `report: unknown hold ${verdict.hold}`);
      ensure(!seen.has(verdict.hold), `report: duplicate verdict for ${verdict.hold}`); seen.add(verdict.hold);
      ensure(verdict.owner === installationHoldOwners[verdict.hold as InstallationHold], `report: wrong owner verdict for ${verdict.hold}`);
    }
    const rows = installationReportHolds.map((hold): InstallationHoldRow => {
      const owner = installationHoldOwners[hold], verdict = input.verdicts.find(row => row.hold === hold);
      const row = (state: InstallationHoldState, reason: string, prepared: string | null, evidence: string | null): InstallationHoldRow =>
        ({ hold, owner, state, prepared, evidence, reason });
      if (!verdict) return row('held', 'no owner verdict', null, null);
      let prepared: string | null = null;
      if (verdict.prepared !== undefined && input.facts.history && input.facts.admission) {
        const history = input.facts.history, admission = input.facts.admission;
        const snapshot = take(prepareSnapshot(history.facts, history));
        const vector: Record<string, { epoch: number; position: number }> = {};
        for (const { fact } of snapshot.entries) {
          const prior = vector[fact.machine], position = fact.segment;
          if (!prior || position.epoch > prior.epoch || position.epoch === prior.epoch && position.position > prior.position)
            vector[fact.machine] = { epoch: position.epoch, position: position.position };
        }
        ensure(input.vector === encoded(vector).hash && input.generation === history.decode.register.generation.id,
          'report: source vector or generation differs');
        const matches = snapshot.entries.filter(entry => entry.fact.id === verdict.prepared);
        ensure(matches.length === 1 && !matches[0]!.taint.length && !matches[0]!.conflicts.length,
          'report: prepared reference unavailable or conflicted');
        const fact = matches[0]!.fact;
        if (fact.kind === 'assembly-InstallationSelection') {
          // Invoke Ten's actual owner decoder even if the host installed a lookalike registration.
          const record = take(decodeHistoricalInstallationSelection((fact.body as { record?: unknown }).record,
            { ...admission.boundary, origin: fact, mode: 'historical', facts: history }, admission));
          ensure(record.installation === input.installation && record.scope === input.scope && record.generation === input.generation
            && record.role === preparationRoles[hold] && record.instance === verdict.subject && record.owner === owner,
          'report: configuration role or subject differs from hold');
          prepared = fact.id;
        }
      }
      // No landed public owner port validates current predicate/subject-bound evidence for this
      // report. In particular GrowthObservation is not a replay verdict, a Nine clock is not a
      // challenge-verifier verdict, and Seven has no supervisor issuer. Preserve the hold instead
      // of upgrading labels (including copied current/fixture flags) into provenance or admission.
      return row(prepared ? 'prepared' : 'held', verdict.evidence === undefined
        ? prepared ? 'configuration recorded; owner evidence absent' : 'owner-validated configuration unavailable'
        : 'predicate-bound current owner evidence unavailable; admission held', prepared, verdict.evidence ?? null);
    });
    const counts = { held: 0, prepared: 0, 'fixture-admitted': 0, admitted: 0 };
    for (const row of rows) counts[row.state]++;
    return freeze({ type: 'InstallationHoldReport' as const, schemaVersion: 1 as const, installation: input.installation, scope: input.scope,
      generation: input.generation, vector: input.vector, rows, counts, live: false as const });
  });
}
