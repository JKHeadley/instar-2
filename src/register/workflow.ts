import type { Clock, Scope, VerifiedPrincipal } from '../index.js';
import type { GeneratedRegister, RegisterContext, StandingContext, EnforcementBoundary, CheckRunRecord } from './types.js';
import type { ConstructObservation, GovernedStateObservation } from './governance.js';
import type { CheckCatalog } from '../rulegraph/graph.js';
import { checked, requireThat, take } from './boundary.js';
import { checkPairing, checkBoundaryCoverage, checkGovernedState, checkSeparation } from './governance.js';
import { buildRuleGraph, checkDeadlines } from '../rulegraph/graph.js';
import { boundaryRungs } from './rungs.js';
import { resolveTerms } from '../terms/resolver.js';

export interface WorkflowChecks {
  readonly mode: 'bootstrap' | 'normal';
  readonly branch: string; readonly runs: readonly CheckRunRecord[]; readonly catalog: CheckCatalog;
  readonly landedParts: readonly number[]; readonly now: Clock;
  readonly constructs: readonly ConstructObservation[]; readonly observations: readonly GovernedStateObservation[];
  readonly boundaries: readonly EnforcementBoundary[]; readonly claims: readonly { kind: string; complete: boolean }[];
  readonly separations: readonly { site: string; record: string; execution: StandingContext; writer: VerifiedPrincipal; scope: Scope; action: string }[];
  readonly bootstrapRules: readonly { number: number; declarationHash: string; owner: string }[];
}
export function runRegisterChecks(register: GeneratedRegister, checks: WorkflowChecks, context: RegisterContext) {
  return checked('RegisterWorkflowChecks', { register, checks }, context, () => {
    requireThat(checks.mode === 'bootstrap' || checks.mode === 'normal', 'unknown build mode');
    requireThat(checks.mode === 'bootstrap' || checks.bootstrapRules.length === 0, 'normal build cannot suspend policy prerequisites');
    requireThat(checks.mode !== 'bootstrap' || register.extract.rows.length === 0, 'bootstrap cannot reuse a committed extract');
    const pairing = take(checkPairing(register, checks.constructs, context));
    // Every kind has an enumeration boundary, not merely the author's claims.
    for (const kind of register.shape.kinds) requireThat(checks.claims.some(c => c.kind === kind.name), `P3-NF-29: missing enumeration claim ${kind.name}`);
    take(checkBoundaryCoverage(checks.boundaries, checks.claims, context));
    take(checkGovernedState(checks.observations, register, context));
    for (const { declaration: d } of register.entries) if (d.kind === 'blocking sites' && d.status === 'live') {
      for (const rung of boundaryRungs(d.requiredFacts)) if (rung.decidesAlone === 'governed-state') {
        const enforced = rung.enforces as { readonly record: string };
        const separation = checks.separations.find(s => s.site === d.id && s.record === enforced.record);
        requireThat(separation, `P3-NF-27: missing writer/executor standing evidence for ${d.id}`);
        requireThat(separation.execution.now.value === checks.now.value, 'standing check uses a different clock');
        take(checkSeparation(separation.execution, separation.writer, separation.scope, separation.action, context));
      }
    }
    const graph = take(buildRuleGraph(register, checks.branch, checks.runs, checks.catalog, context, checks.bootstrapRules));
    take(checkDeadlines(graph, register, checks.landedParts, checks.now, context));
    const terms = take(resolveTerms(register, context));
    return { graph, terms, pairing, authority: checks.mode === 'bootstrap' ? 'bootstrap-prerequisites' : 'checked-candidate' };
  });
}
