// P10-SI-22: the per-hold installation report. Every one of the twenty-five production holds is
// reported individually as held, prepared, fixture-admitted or admitted, with its owner and its
// evidence reference. "Prepared" means the configuration record exists. "Admitted" means current
// evidence issued by the hold's owner exists. They never merge: selection metadata alone, a
// fixture identity, a stale observation or a foreign owner's fact never reads admitted, and the
// report never converts installation metadata into a live-service claim.
import type { BoundaryContext, Result } from '../index.js';
import { boundary, ensure, freeze } from './boundary.js';
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
/** What the opened root says about one referenced fact. Supplied by the read-only inspection, never by the caller's claim. */
export interface InstallationReportFact { readonly kind: string; readonly owner: string; readonly fixture: boolean; readonly current: boolean }
export interface InstallationReportFactsPort { readonly owner: 'part-ten'; lookup(reference: string): InstallationReportFact | null }
export interface InstallationHoldVerdict {
  readonly hold: string; readonly owner: string;
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
const configurationKinds: readonly string[] = ['assembly-InstallationSelection', 'assembly-ProductionSignerReference',
  'rungraph-installed-governance-reference', 'assembly-ProductionInstallation'];

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
      if (verdict.prepared !== undefined) {
        const fact = input.facts.lookup(verdict.prepared);
        ensure(fact, `report: prepared record is not in the opened root: ${hold}`);
        ensure(configurationKinds.includes(fact.kind) || fact.owner === owner, `report: prepared reference is not a configuration or owner record: ${hold}`);
        prepared = verdict.prepared;
      }
      if (verdict.evidence === undefined) return prepared ? row('prepared', 'configuration recorded; owner evidence absent', prepared, null)
        : row('held', 'owner verdict carries neither configuration nor evidence', null, null);
      const evidence = input.facts.lookup(verdict.evidence);
      ensure(evidence, `report: evidence is not in the opened root: ${hold}`);
      // P10-SI-13/22: selection metadata, the prepared record itself, or another owner's fact never admits.
      ensure(verdict.evidence !== verdict.prepared && !configurationKinds.includes(evidence.kind),
        `report: selection metadata cannot admit ${hold}`);
      ensure(evidence.owner === owner, `report: evidence for ${hold} is not issued by ${owner}`);
      if (!evidence.current) return row(prepared ? 'prepared' : 'held', 'owner evidence is stale', prepared, verdict.evidence);
      return evidence.fixture ? row('fixture-admitted', 'fixture owner evidence; not installed evidence', prepared, verdict.evidence)
        : row('admitted', 'current owner evidence', prepared, verdict.evidence);
    });
    const counts = { held: 0, prepared: 0, 'fixture-admitted': 0, admitted: 0 };
    for (const row of rows) counts[row.state]++;
    return freeze({ type: 'InstallationHoldReport' as const, schemaVersion: 1 as const, installation: input.installation, scope: input.scope,
      generation: input.generation, vector: input.vector, rows, counts, live: false as const });
  });
}
