import type { Clock, Scope, VerifiedPrincipal } from '../index.js';
import type { GeneratedRegister, RegisterContext, StandingContext, EnforcementBoundary, CheckRunRecord } from './types.js';
import type { ConstructObservation, GovernedStateObservation } from './governance.js';
import type { CheckCatalog } from '../rulegraph/graph.js';
import { checked, requireThat, take } from './boundary.js';
import { checkPairing, checkBoundaryCoverage, checkGovernedState, checkGovernedStateSources, checkSeparation } from './governance.js';
import { buildRuleGraph, checkDeadlines } from '../rulegraph/graph.js';
import { boundaryRungs } from './rungs.js';
import { resolveTerms } from '../terms/resolver.js';

export interface WorkflowChecks {
  readonly mode: 'bootstrap' | 'normal' | 'replay';
  readonly branch: string; readonly runs: readonly CheckRunRecord[]; readonly catalog: CheckCatalog;
  readonly landedParts: readonly number[]; readonly now: Clock;
  readonly constructs: readonly ConstructObservation[]; readonly observations: readonly GovernedStateObservation[];
  readonly boundaries: readonly EnforcementBoundary[]; readonly claims: readonly { kind: string; complete: boolean }[];
  readonly separations: readonly { site: string; record: string; execution: StandingContext; writer: VerifiedPrincipal; scope: Scope; action: string }[];
  readonly bootstrapRules: readonly { number: number; declarationHash: string; owner: string }[];
}
export function runRegisterChecks(register: GeneratedRegister, checks: WorkflowChecks, context: RegisterContext) {
  return checked('RegisterWorkflowChecks', { register, checks }, context, () => {
    requireThat(['bootstrap', 'normal', 'replay'].includes(checks.mode), 'unknown build mode');
    requireThat(checks.mode !== 'normal' || checks.bootstrapRules.length === 0, 'normal build cannot suspend policy prerequisites');
    requireThat(checks.mode === 'normal' || register.extract.rows.length === 0, 'bootstrap/replay cannot reuse a committed extract');
    const pairing = take(checkPairing(register, checks.constructs, context));
    // Every kind has an enumeration boundary, not merely the author's claims.
    for (const kind of register.shape.kinds) requireThat(checks.claims.some(c => c.kind === kind.name), `P3-NF-29: missing enumeration claim ${kind.name}`);
    take(checkBoundaryCoverage(checks.boundaries, checks.claims, context));
    const replay = checks.mode === 'replay';
    // This extension is deliberately only the P5 governed-document seam. It is
    // not a general replay waiver for unapproved stores/policies/other owners.
    const sourceOnly = (record: string) => replay && record === 'rungraph.contract' && register.entries.some(e =>
      e.declaration.id === record && e.declaration.kind === 'governed documents'
      && e.declaration.requiredFacts.location === 'docs/09-the-run-graph.md');
    const authorityPrerequisites: { site: string; record: string; required: string }[] = [];
    take((replay ? checkGovernedStateSources : checkGovernedState)(checks.observations, register, context));
    if (replay) for (const { declaration: d } of register.entries.filter(e => e.declaration.kind === 'blocking sites'))
      for (const rung of boundaryRungs(d.requiredFacts)) if (rung.decidesAlone === 'governed-state') {
        const record = (rung.enforces as { record: string }).record;
        if (sourceOnly(record)) authorityPrerequisites.push({ site: d.id, record,
          required: 'verified enforced-record approval history and live writer/executor separation before entering force; replay is not runtime authority' });
        else requireThat(register.entries.some(e => e.declaration.id === record && !('state' in e.approvedIn)),
          `P3-NF-26: enforced record ${record} lacks approved history`);
      }
    for (const { declaration: d } of register.entries) if (d.kind === 'blocking sites' && d.status === 'live') {
      for (const rung of boundaryRungs(d.requiredFacts)) if (rung.decidesAlone === 'governed-state') {
        const enforced = rung.enforces as { readonly record: string };
        if (sourceOnly(enforced.record)) continue;
        const separation = checks.separations.find(s => s.site === d.id && s.record === enforced.record);
        requireThat(separation, `P3-NF-27: missing writer/executor standing evidence for ${d.id}`);
        requireThat(separation.execution.now.value === checks.now.value, 'standing check uses a different clock');
        take(checkSeparation(separation.execution, separation.writer, separation.scope, separation.action,
          { ...context, types: context.authorityTypes ?? context.types }));
      }
    }
    const graph = take(buildRuleGraph(register, checks.branch, checks.runs, checks.catalog, context, checks.bootstrapRules));
    take(checkDeadlines(graph, register, checks.landedParts, checks.now, context));
    const terms = take(resolveTerms(register, context));
    return { graph, terms, pairing, authorityPrerequisites,
      authority: replay ? 'shape-only' : checks.mode === 'bootstrap' ? 'bootstrap-prerequisites' : 'checked-candidate' };
  });
}
