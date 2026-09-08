import type { BoundaryContext, Result } from '../index.js';
import { operatorBoundary, requireOperator } from './boundary.js';
import type { FailureTraceInput, FailureTraceResolution, SeamRow } from './contracts.js';

export const operatorSeams: readonly SeamRow[] = Object.freeze([
  { seam: 'authorization-completion', producer: 'part-four', consumer: 'parts-eleven/four/eight/nine', record: 'exact request digest + existing act + broker journal',
    order: ['render', 'verified-act-through-intake', 'current-exact-validation', 'effect-or-broker', 'receipt'], failDirection: 'authority-closed; diagnosis/stop/request-open', owner: 'eleven/four/eight/nine' },
  { seam: 'conversation-binding', producer: 'genesis-or-verified-operator-act', consumer: 'part-four', record: 'existing grant/revocation facts at causal frontier',
    order: ['inspect', 'verify', 'append', 'fold', 'receipt'], failDirection: 'no-self-bind; conflict-freezes-new-authority-not-stop', owner: 'eleven/four/two' },
  { seam: 'minimal-plane', producer: 'source-parts-and-part-ten', consumer: 'live-responder-and-operator-views', record: 'spine at stated vector; projections disposable',
    order: ['verify-or-replay', 'compare', 'admit-dependencies', 'preserve', 'replicate(1)', 'serve-or-repair'], failDirection: 'mutation-closed; intake-preserved', owner: 'eleven/source-owners/ten' },
  { seam: 'vertical-slice', producer: 'parts-four-through-nine', consumer: 'part-ten-assembly-and-harness', record: 'causally linked facts + independent delivery evidence',
    order: ['preserve-authenticate', 'run', 'judgment', 'response-effect', 'verify', 'rebuild'], failDirection: 'effect-closed; input-and-repair-live', owner: 'transition-owners-plus-eleven-verdict' },
]);

export function validateSeamInventory(rows: readonly SeamRow[], context: BoundaryContext): Result<'complete'> {
  return operatorBoundary('OperatorSeamInventory', context, () => {
    requireOperator(rows.length === 4 && new Set(rows.map(row => row.seam)).size === 4, 'P11-NF-40: seam inventory is missing or duplicated');
    for (const row of rows) requireOperator(row.producer.trim().length > 0 && row.consumer.trim().length > 0 && row.record.trim().length > 0
      && row.order.length >= 4 && row.order.every(step => step.trim().length > 0) && row.failDirection.trim().length > 0 && row.owner.trim().length > 0,
    `P11-NF-40: incomplete seam row ${row.seam}`);
    return 'complete' as const;
  });
}

export function resolveFailureTrace(input: FailureTraceInput, context: BoundaryContext): Result<FailureTraceResolution> {
  return operatorBoundary('OperatorSharedFailureTrace', context, () => {
    requireOperator(input.owner.trim().length > 0 && input.semanticIdentity.trim().length > 0, 'P11-NF-41/42: trace requires identity and closure owner');
    const conflict = new Set(input.digests).size > 1;
    requireOperator(input.applications >= 0 && input.applications <= 1, 'P11-NF-42: duplicate external application');
    if (conflict) return Object.freeze({ retry: false as const, conflict: true, state: 'authority-closed' as const, owner: input.owner, applications: input.applications });
    if (input.trace === 'stale-authority' || !input.authorityCurrent)
      return Object.freeze({ retry: false as const, conflict: false, state: 'authority-closed' as const, owner: input.owner, applications: input.applications });
    if (input.trace === 'cancellation-race' && input.stopCausallyPrior)
      return Object.freeze({ retry: false as const, conflict: false, state: 'stopped' as const, owner: input.owner, applications: input.applications });
    if (input.outcome === 'happened' || input.outcome === 'did-not-happen')
      return Object.freeze({ retry: false as const, conflict: false, state: 'settled' as const, owner: input.owner, applications: input.applications });
    return Object.freeze({ retry: false as const, conflict: false, state: 'owned-uncertain' as const, owner: input.owner, applications: input.applications });
  });
}
