import type { BoundaryContext, Result } from '../index.js';
import { operatorBoundary, requireOperator } from './boundary.js';
import type { FailureTraceInput, FailureTraceResolution, SeamRow } from './contracts.js';

const failureTraceKinds = Object.freeze<readonly FailureTraceInput['trace'][]>([
  'crash-after-effect', 'duplicate-delivery', 'cancellation-race', 'stale-authority',
]);
const failureTraceOutcomes = Object.freeze<readonly FailureTraceInput['outcome'][]>([
  'happened', 'did-not-happen', 'uncertain', 'missing',
]);
const payloadDigestPattern = /^sha256:[a-f0-9]{64}$/;

function decodeFailureTrace(input: unknown): FailureTraceInput {
  requireOperator(typeof input === 'object' && input !== null && !Array.isArray(input),
    'P11-NF-41/42: shared failure trace must be a record');
  const candidate = input as Record<string, unknown>;
  requireOperator(typeof candidate.trace === 'string'
    && failureTraceKinds.includes(candidate.trace as FailureTraceInput['trace']),
  'P11-NF-41/42: unknown trace kind');
  requireOperator(typeof candidate.outcome === 'string'
    && failureTraceOutcomes.includes(candidate.outcome as FailureTraceInput['outcome']),
  'P11-NF-41/42: unknown trace outcome');
  requireOperator(typeof candidate.semanticIdentity === 'string' && candidate.semanticIdentity.trim().length > 0
    && typeof candidate.owner === 'string' && candidate.owner.trim().length > 0,
  'P11-NF-41/42: trace requires identity and closure owner');
  requireOperator(Array.isArray(candidate.digests) && candidate.digests.length > 0
    && candidate.digests.every(digest => typeof digest === 'string' && payloadDigestPattern.test(digest)),
  'P11-NF-42: trace requires SHA-256 payload digests');
  requireOperator(Number.isSafeInteger(candidate.applications)
    && (candidate.applications as number) >= 0 && (candidate.applications as number) <= 1,
  'P11-NF-42: application count must be a safe integer between zero and one');
  requireOperator(typeof candidate.stopCausallyPrior === 'boolean' && typeof candidate.authorityCurrent === 'boolean',
    'P11-NF-41/42: trace requires causal-stop and authority-current observations');

  const decoded = candidate as unknown as FailureTraceInput;
  requireOperator(decoded.outcome !== 'happened' || decoded.applications === 1,
    'P11-NF-42: application outcome contradicts the application count');
  requireOperator(decoded.outcome !== 'did-not-happen' || decoded.applications === 0,
    'P11-NF-42: decisive non-occurrence contradicts an observed application');
  return decoded;
}

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
    requireOperator(operatorSeams.every(expected => rows.some(row => row.seam === expected.seam)),
      'P11-NF-40: seam inventory does not name the four required seams');
    for (const row of rows) requireOperator(row.producer.trim().length > 0 && row.consumer.trim().length > 0 && row.record.trim().length > 0
      && row.order.length >= 4 && row.order.every(step => step.trim().length > 0) && row.failDirection.trim().length > 0 && row.owner.trim().length > 0,
    `P11-NF-40: incomplete seam row ${row.seam}`);
    for (const expected of operatorSeams) {
      const row = rows.find(candidate => candidate.seam === expected.seam)!;
      for (const field of ['producer', 'consumer', 'record', 'failDirection', 'owner'] as const)
        requireOperator(row[field] === expected[field],
          `P11-NF-40/41: incomplete seam row ${row.seam}.${field}`);
      requireOperator(row.order.length === expected.order.length
        && row.order.every((step, index) => step === expected.order[index]),
      `P11-NF-40/41: incomplete seam row ${row.seam}.order`);
    }
    return 'complete' as const;
  });
}

export function resolveFailureTrace(input: FailureTraceInput, context: BoundaryContext): Result<FailureTraceResolution> {
  return operatorBoundary('OperatorSharedFailureTrace', context, () => {
    const trace = decodeFailureTrace(input);
    const conflict = new Set(trace.digests).size > 1;
    if (conflict) return Object.freeze({ retry: false as const, conflict: true, state: 'authority-closed' as const, owner: trace.owner, applications: trace.applications });
    if (trace.trace === 'stale-authority' || !trace.authorityCurrent)
      return Object.freeze({ retry: false as const, conflict: false, state: 'authority-closed' as const, owner: trace.owner, applications: trace.applications });
    if (trace.trace === 'cancellation-race' && trace.stopCausallyPrior)
      return Object.freeze({ retry: false as const, conflict: false, state: 'stopped' as const, owner: trace.owner, applications: trace.applications });
    if (trace.outcome === 'happened' || trace.outcome === 'did-not-happen')
      return Object.freeze({ retry: false as const, conflict: false, state: 'settled' as const, owner: trace.owner, applications: trace.applications });
    return Object.freeze({ retry: false as const, conflict: false, state: 'owned-uncertain' as const, owner: trace.owner, applications: trace.applications });
  });
}
