import type { BoundaryContext, Hash, Result } from '../index.js';
import type { ProjectionDefinition } from '../projections/index.js';
import { operatorBoundary, requireOperator } from './boundary.js';
import type { ReplayAdmission, ReplaySample } from './contracts.js';

export const minimalPlaneProjectionIds = Object.freeze(['minimal.intake-ledger', 'minimal.principal-binding',
  'minimal.run-view', 'minimal.outbound-obligation', 'minimal.authority-queue', 'minimal.guard-repair'] as const);

const NESTED = 'Owner record identity lives under `record`; part two\'s fold language addresses only top-level body fields.';
const RUN_KIND = 'Its top-level `run` field IS foldable; the exclusion is by declared source, not by the fold language.';
const RUN_KINDS = Object.freeze(['run-opening', 'run-transition', 'session-grounding']);
const ignore = (reason: string) => ({ kind: 'ignores' as const, reason });
const fold = (merge: 'set-union' | 'exclusive-singleton', identity: string, value: string) => ({ kind: 'folds' as const, merge, identity, value });

function defaultReason(kind: string, note: string): string {
  if (RUN_KINDS.includes(kind)) return `${note} ${RUN_KIND}`;
  if (/^(transport|judgment|effect)-/.test(kind)) return NESTED;
  return note;
}
function definition(id: string, stalenessBound: number, kinds: readonly string[], decisions: ProjectionDefinition['decisions'], note: string): ProjectionDefinition {
  return Object.freeze({ id, class: 'informational' as const, stalenessBound, retention: 'all-identities' as const,
    decisions: Object.freeze(Object.fromEntries(kinds.map(kind => [kind, decisions[kind] ?? ignore(defaultReason(kind, note))]))) });
}

export function minimalPlaneProjections(kinds: readonly string[], stalenessBound = 100_000): readonly ProjectionDefinition[] {
  const all = [...new Set(kinds)];
  return Object.freeze([
    definition('minimal.intake-ledger', stalenessBound, all, {
      'intake-receipt': fold('set-union', 'rawHash', 'adapter'), 'intake-resolved': fold('set-union', 'logicalId', 'principalId'),
      'intake-admitted': fold('exclusive-singleton', 'logicalId', 'receipt'), 'intake-held': fold('set-union', 'logicalId', 'reason'),
      'intake-expired': fold('set-union', 'hold', 'terminal'), 'intake-collapse': fold('set-union', 'logicalId', 'original'),
      'intake-mismatch': fold('set-union', 'logicalId', 'original'), 'intake-stop': fold('set-union', 'logicalId', 'principalId'),
      'intake-stop-signal': fold('set-union', 'logicalId', 'principalId'),
    }, 'Not receipt, dedup or admission state.'),
    definition('minimal.principal-binding', stalenessBound, all, {
      'genesis-grant': fold('set-union', 'grantId', 'principalId'), 'conversation-binding': fold('exclusive-singleton', 'channel', 'principalId'),
      'intake-resolved': fold('set-union', 'logicalId', 'binding'), 'intake-stop': fold('set-union', 'logicalId', 'binding'),
    }, 'Carries no grant, revocation, identity evidence or binding selection.'),
    definition('minimal.run-view', stalenessBound, all, {
      'slice-obligation': fold('exclusive-singleton', 'blocker', 'state'), 'intake-admitted': fold('set-union', 'logicalId', 'receipt'),
      'intake-stop': fold('set-union', 'logicalId', 'scope'),
    }, 'Not an open minimal-plane assignment, blocker, stop or recovery fact.'),
    definition('minimal.outbound-obligation', stalenessBound, all, {
      'slice-obligation': fold('exclusive-singleton', 'operation', 'state'), 'slice-delivery-evidence': fold('set-union', 'operation', 'stage'),
      'slice-reply-source': fold('set-union', 'semanticMessage', 'basis'),
    }, 'Not an outbound operation, settlement or delivery-evidence record.'),
    definition('minimal.authority-queue', stalenessBound, all, {
      'intake-held': fold('set-union', 'logicalId', 'reason'), 'conversation-binding': fold('set-union', 'channel', 'principalId'),
      'slice-obligation': fold('set-union', 'operation', 'owner'),
      'authorization-request': fold('exclusive-singleton', 'requestId', 'requestDigest'),
      'authorization-disposition': fold('set-union', 'request', 'disposition'),
      'intake-verified-act': fold('set-union', 'request', 'disposition'),
    }, 'Not an authorization request or disposition. The authority queue confers no authority.'),
    definition('minimal.guard-repair', stalenessBound, all, {
      'slice-obligation': fold('set-union', 'operation', 'owner'), 'slice-delivery-evidence': fold('set-union', 'operation', 'decisive'),
      'intake-expired': fold('set-union', 'hold', 'terminal'), 'intake-held': fold('set-union', 'logicalId', 'owner'),
    }, 'Not a required holder observation, source-availability report or owned repair obligation.'),
  ]);
}

export function evaluateGenesisReplay(samples: readonly ReplaySample[], matrix: Readonly<Record<string, readonly ('cold' | 'warm')[]>>,
  startupBudget: number, durationMargin: number, memoryMargin: number, context: BoundaryContext,
  memoryBudget = Number.MAX_SAFE_INTEGER): Result<ReplayAdmission> {
  return operatorBoundary('MinimalPlaneGenesisAdmission', context, () => {
    const deployments = Object.entries(matrix);
    requireOperator(samples.length > 0 && deployments.length > 0 && deployments.every(([, caches]) => caches.length > 0
      && caches.includes('cold') && caches.includes('warm') && new Set(caches).size === caches.length
      && caches.every(cache => cache === 'cold' || cache === 'warm'))
      && Number.isSafeInteger(startupBudget) && startupBudget > 0 && Number.isSafeInteger(memoryBudget) && memoryBudget > 0
      && Number.isSafeInteger(durationMargin) && durationMargin >= 0 && Number.isSafeInteger(memoryMargin) && memoryMargin >= 0,
    'P11-NF-27/31: replay admission needs samples and finite budgets');
    const failures: string[] = [];
    for (const [deployment, cacheStates] of deployments) for (const cache of cacheStates) {
      const matches = samples.filter(sample => sample.deployment === deployment && sample.cache === cache);
      if (matches.length === 0) failures.push(`${deployment}:${cache}:missing`);
    }
    const digests = new Set<Hash>();
    const generations = new Set<string>(), populations = new Set<string>();
    for (const sample of samples) {
      if (!matrix[sample.deployment]?.includes(sample.cache)) failures.push(`${sample.deployment}:${sample.cache}:undeclared`);
      if (sample.failures.length) failures.push(...sample.failures.map(reason => `${sample.deployment}:${sample.cache}:${reason}`));
      if (!sample.resultDigest || !/^sha256:[a-f0-9]{64}$/.test(sample.resultDigest))
        failures.push(`${sample.deployment}:${sample.cache}:invalid-result-digest`);
      else digests.add(sample.resultDigest);
      if (!sample.generation.trim()) failures.push(`${sample.deployment}:${sample.cache}:missing-generation`);
      else generations.add(sample.generation);
      const duration = sample.ended - sample.started;
      if (![sample.started, sample.ended, duration, sample.peakMemory, sample.facts, sample.bytes, sample.lineages].every(Number.isFinite)
        || ![sample.peakMemory, sample.facts, sample.bytes, sample.lineages].every(Number.isSafeInteger)
        || sample.ended < sample.started || sample.facts < 0 || sample.bytes < 0 || sample.lineages <= 0 || sample.peakMemory < 0)
        failures.push(`${sample.deployment}:${sample.cache}:invalid-measurement`);
      populations.add(`${sample.facts}:${sample.bytes}:${sample.lineages}`);
    }
    if (digests.size > 1) failures.push('canonical-replay-divergence');
    if (generations.size > 1) failures.push('register-generation-divergence');
    if (populations.size > 1) failures.push('incomparable-replay-populations');
    const maximumDuration = Math.max(...samples.map(sample => sample.ended - sample.started));
    const maximumMemory = Math.max(...samples.map(sample => Number.isFinite(sample.peakMemory) ? sample.peakMemory : 0));
    const admissionDuration = maximumDuration + durationMargin, admissionMemory = maximumMemory + memoryMargin;
    if (admissionDuration > startupBudget) failures.push('startup-budget-exceeded');
    if (admissionMemory > memoryBudget) failures.push('memory-budget-exceeded');
    return Object.freeze({ eligible: failures.length === 0, maximumDuration, maximumMemory, admissionDuration, admissionMemory,
      failures: Object.freeze(failures.sort()) });
  });
}

export const NESTED_RECORD_REASON = NESTED;
export const RUN_KIND_REASON = RUN_KIND;
