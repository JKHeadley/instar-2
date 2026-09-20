// Source-only replay of the six minimal-plane folds over the opened installation root (contract §5,
// docs/15 §4). It reads facts and the pinned generation only: no switch-on, no provider, no Telegram,
// no history write. Every sample of the finite cold/warm matrix is kept, failures included. The
// genesis rebuild and the checkpoint rebuild must byte-match at the same vector. A bound is claimed
// only from measured successful samples; a configured target, an estimate or a partial matrix never
// populates it, and any failure, divergence or over-budget sample withholds the claim.
import type { BoundaryContext, Result } from '../index.js';
import { consumeResult } from '../index.js';
import { prepareSnapshot } from '../facts/index.js';
import type { FactContext } from '../facts/index.js';
import { checkpoint, rebuildProjection, verifyRebuild } from '../projections/index.js';
import type { Checkpoint, ProjectionDefinition, ProjectionGeneration } from '../projections/index.js';
import { minimalPlaneProjections } from '../operator/index.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

export type InstallationReplayMode = 'cold' | 'warm';
export interface InstallationReplayProfile { readonly machine: string; readonly storageClass: string }
export interface InstallationReplaySample {
  readonly projection: string; readonly mode: InstallationReplayMode; readonly facts: number; readonly bytes: number;
  readonly lineages: number; readonly start: number; readonly end: number; readonly duration: number;
  readonly folded: number | null; readonly resultDigest: string | null; readonly vector: string | null; readonly failure: string | null;
}
export interface InstallationReplayReport {
  readonly type: 'InstallationReplayReport'; readonly schemaVersion: 1;
  readonly profile: InstallationReplayProfile; readonly generation: string; readonly matrix: readonly InstallationReplayMode[];
  readonly samples: readonly InstallationReplaySample[];
  readonly checkpointComparison: Readonly<Record<string, 'equal' | 'diverged' | 'not-compared'>>;
  readonly failures: number;
  /** The maximum successful wall duration across the whole matrix, or null when the claim is withheld. */
  readonly measuredBound: Readonly<{ duration: number; budget: number }> | null;
  readonly claim: 'measured' | 'withheld'; readonly withheldBecause: readonly string[];
}
export interface InstallationReplayInput {
  readonly profile: InstallationReplayProfile; readonly facts: FactContext; readonly generation: ProjectionGeneration;
  readonly definitions: readonly ProjectionDefinition[]; readonly matrix: readonly InstallationReplayMode[];
  /** The finite startup budget for this deployment class, in the clock's units. It bounds the claim; it is never the measurement. */
  readonly budget: number;
  readonly clock: Readonly<{ owner: 'part-ten'; monotonic(): number }>;
}
type Outcome<T> = Readonly<{ value: T }> | Readonly<{ refusal: string }>;
const detail = <T>(result: Result<T>): Outcome<T> =>
  consumeResult<T, Outcome<T>>(result, { Success: value => ({ value }), Refused: refusal => ({ refusal: refusal.detail }) });

export function replayInstallationProjections(input: InstallationReplayInput, context: BoundaryContext): Result<InstallationReplayReport> {
  return boundary('InstallationReplay', null, context, () => {
    ensure(input.profile?.machine && input.profile.storageClass, 'replay: one named machine and storage class required');
    ensure(input.clock?.owner === 'part-ten' && typeof input.clock.monotonic === 'function', 'replay: monotonic clock required');
    ensure(Number.isSafeInteger(input.budget) && input.budget > 0, 'replay: finite positive startup budget required');
    ensure(Array.isArray(input.matrix) && input.matrix.length >= 2 && input.matrix.length <= 8
      && input.matrix.every(mode => mode === 'cold' || mode === 'warm') && input.matrix[0] === 'cold' && input.matrix.includes('warm'),
    'replay: a finite matrix starting cold and including warm is required');
    const required = minimalPlaneProjections(input.generation.kinds).map(definition => definition.id);
    ensure(input.definitions.length === required.length && required.every(id => input.definitions.filter(d => d.id === id).length === 1),
      'replay: exactly the six enumerated minimal-plane folds are required');
    // Two's folds run at the fact boundary of the opened root's own context.
    const factBoundary: BoundaryContext = { site: input.facts.site, preserved: input.facts.preserved, register: input.facts.decode.register };
    const snapshot = take(prepareSnapshot(input.facts.facts, input.facts));
    const bytes = input.facts.facts.reduce((sum, fact) => sum + encoded(fact).bytes.length, 0);
    const lineages = Object.keys(input.generation.lineages).length;
    const samples: InstallationReplaySample[] = [];
    const comparison: Record<string, 'equal' | 'diverged' | 'not-compared'> = {};
    for (const definition of input.definitions) {
      let genesis: Checkpoint | undefined; comparison[definition.id] = 'not-compared';
      for (const mode of input.matrix) {
        const start = input.clock.monotonic();
        const rebuilt = detail(rebuildProjection(definition, snapshot, input.generation, factBoundary, mode === 'warm' && genesis ? [genesis] : []));
        const end = input.clock.monotonic();
        ensure(Number.isFinite(start) && Number.isFinite(end) && end >= start, 'replay: monotonic readings went backwards');
        const base = { projection: definition.id, mode, facts: input.facts.facts.length, bytes, lineages, start, end, duration: end - start };
        if ('refusal' in rebuilt) { samples.push({ ...base, folded: null, resultDigest: null, vector: null, failure: rebuilt.refusal }); continue; }
        const saved = checkpoint(rebuilt.value.view);
        if (mode === 'cold' && !genesis) genesis = saved;
        else if (genesis) {
          const same = detail(verifyRebuild(genesis, saved, factBoundary));
          comparison[definition.id] = 'value' in same && comparison[definition.id] !== 'diverged' ? 'equal' : 'diverged';
        }
        samples.push({ ...base, folded: rebuilt.value.folded, resultDigest: saved.hash, vector: encoded(saved.vector).hash, failure: null });
      }
    }
    const withheld: string[] = [];
    const failures = samples.filter(sample => sample.failure !== null).length;
    if (failures) withheld.push(`${failures} sample(s) failed`);
    for (const [id, verdict] of Object.entries(comparison)) if (verdict !== 'equal') withheld.push(`${id}: genesis and checkpoint ${verdict}`);
    const slow = samples.filter(sample => sample.failure === null && sample.duration > input.budget);
    if (slow.length) withheld.push(`${slow.length} sample(s) exceeded the startup budget`);
    if (samples.some(sample => sample.failure === null && sample.lineages === 0)) withheld.push('no known lineage in the pinned generation');
    const claim = withheld.length === 0 ? 'measured' as const : 'withheld' as const;
    return freeze({ type: 'InstallationReplayReport' as const, schemaVersion: 1 as const, profile: input.profile,
      generation: input.generation.reference.id, matrix: [...input.matrix], samples, checkpointComparison: comparison, failures,
      measuredBound: claim === 'measured' ? { duration: Math.max(...samples.map(sample => sample.duration)), budget: input.budget } : null,
      claim, withheldBecause: withheld });
  });
}
