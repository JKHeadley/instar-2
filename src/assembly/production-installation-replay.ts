// Read-only replay of Eleven's complete minimal plane at the opened source vector.
import type { BoundaryContext, Result } from '../index.js';
import { consumeResult } from '../index.js';
import { prepareSnapshot } from '../facts/index.js';
import type { FactContext, LineagePosition } from '../facts/index.js';
import { checkpoint, rebuildProjection, verifyRebuild } from '../projections/index.js';
import type { Checkpoint, ProjectionDefinition, ProjectionGeneration } from '../projections/index.js';
import { evaluateGenesisReplay, minimalPlaneProjections } from '../operator/index.js';
import { generationOf, readRegisterEntry } from '../register/index.js';
import type { InstallationRecordGeneration } from './installation-selection.js';
import { boundary, encoded, ensure, freeze, take } from './boundary.js';

export type InstallationReplayMode = 'cold' | 'warm';
export interface InstallationReplayProfile { readonly machine: string; readonly storageClass: string }
export interface InstallationReplaySample {
  readonly projection: string; readonly mode: InstallationReplayMode; readonly facts: number; readonly bytes: number;
  readonly lineages: number; readonly start: number; readonly end: number; readonly duration: number;
  readonly folded: number | null; readonly resultDigest: string | null; readonly vector: string | null; readonly failure: string | null;
}
export interface InstallationReplayWorkload {
  readonly mode: InstallationReplayMode; readonly start: number; readonly end: number; readonly peakMemory: number | null;
}
export interface InstallationReplayReport {
  readonly type: 'InstallationReplayReport'; readonly schemaVersion: 1;
  readonly profile: InstallationReplayProfile; readonly generation: string; readonly vector: string;
  readonly matrix: readonly InstallationReplayMode[]; readonly samples: readonly InstallationReplaySample[];
  readonly workloads: readonly InstallationReplayWorkload[]; readonly coverageFailures: readonly string[];
  readonly checkpointComparison: Readonly<Record<string, 'equal' | 'diverged' | 'not-compared'>>;
  readonly failures: number;
  readonly measuredBound: Readonly<{ duration: number; peakMemory: number; durationMargin: number; memoryMargin: number;
    admissionDuration: number; admissionMemory: number; budget: number; memoryBudget: number }> | null;
  readonly claim: 'measured' | 'withheld'; readonly withheldBecause: readonly string[];
}
export interface InstallationReplayInput {
  readonly profile: InstallationReplayProfile; readonly facts: FactContext; readonly generation: ProjectionGeneration;
  readonly source: InstallationRecordGeneration;
  readonly definitions: readonly ProjectionDefinition[]; readonly matrix: readonly InstallationReplayMode[];
  readonly budget: number; readonly memoryBudget?: number; readonly durationMargin?: number; readonly memoryMargin?: number;
  readonly clock: Readonly<{ owner: 'part-ten'; monotonic(): number }>;
  /** Host measurement of process peak bytes, including all six folds. A process lifetime high-water mark is conservative. */
  readonly memory?: Readonly<{ owner: 'part-ten'; peakBytes(): number }>;
}
type Outcome<T> = Readonly<{ value: T }> | Readonly<{ refusal: string }>;
const detail = <T>(result: Result<T>): Outcome<T> =>
  consumeResult<T, Outcome<T>>(result, { Success: value => ({ value }), Refused: refusal => ({ refusal: refusal.detail }) });
const point = (position: LineagePosition) => ({ epoch: position.epoch, position: position.position });
const compare = (a: LineagePosition, b: LineagePosition) => a.epoch - b.epoch || a.position - b.position;

export function replayInstallationProjections(input: InstallationReplayInput, context: BoundaryContext): Result<InstallationReplayReport> {
  return boundary('InstallationReplay', null, context, () => {
    ensure(input.profile?.machine && input.profile.storageClass, 'replay: one named machine and storage class required');
    ensure(input.clock?.owner === 'part-ten' && typeof input.clock.monotonic === 'function', 'replay: monotonic clock required');
    ensure(Number.isSafeInteger(input.budget) && input.budget > 0, 'replay: finite positive startup budget required');
    ensure(Array.isArray(input.matrix) && input.matrix.length >= 2 && input.matrix.length <= 8
      && input.matrix.every(mode => mode === 'cold' || mode === 'warm') && input.matrix[0] === 'cold' && input.matrix.includes('warm'),
    'replay: a finite matrix starting cold and including warm is required');
    ensure(input.source, 'replay: verified source register required');
    take(readRegisterEntry('rungraph.contract', input.source.register, input.source.context));
    const generation = freeze(JSON.parse(encoded(input.generation).bytes) as ProjectionGeneration);
    ensure(generation.reference.id === take(generationOf(input.source.register, input.source.context)).id
      && encoded(generation.reference).bytes === encoded(input.facts.decode.register.generation).bytes,
    'replay: generation differs from verified source context');
    const kinds = [...new Set(input.facts.schemas.map(schema => schema.kind))].sort();
    ensure(encoded([...generation.kinds].sort()).bytes === encoded(kinds).bytes, 'replay: kinds differ from source context');
    const definitions = minimalPlaneProjections(generation.kinds);
    ensure(input.definitions.length === definitions.length && definitions.every(definition =>
      input.definitions.filter(candidate => encoded(candidate).bytes === encoded(definition).bytes).length === 1),
    'replay: exactly the six enumerated authorized minimal-plane folds are required');
    const factBoundary: BoundaryContext = { site: input.facts.site, preserved: input.facts.preserved, register: input.facts.decode.register };
    const snapshot = take(prepareSnapshot(input.facts.facts, input.facts));
    const coverageFailures: string[] = [];
    const actual: Record<string, LineagePosition> = {};
    for (const { fact } of snapshot.entries) if (!actual[fact.machine] || compare(fact.segment, actual[fact.machine]!) > 0)
      actual[fact.machine] = point(fact.segment);
    // The context's retained frontier cannot be shortened by a caller's generation. Null heads
    // explicitly denote empty lineages; they are valid only when both source and snapshot are empty.
    const required = new Set([...Object.keys(generation.lineages), ...Object.keys(input.facts.folded),
      ...input.facts.keys.map(key => key.machine), ...Object.keys(actual)]);
    for (const machine of required) {
      const known = generation.lineages[machine], retained = input.facts.folded[machine], observed = actual[machine];
      if (!known) { coverageFailures.push(`${machine}: missing known lineage`); continue; }
      const head = known.head;
      if (head === null) {
        if (retained || observed) coverageFailures.push(`${machine}: nonempty lineage declared empty`);
        continue;
      }
      if (!Number.isSafeInteger(head.epoch) || head.epoch < 0 || !Number.isSafeInteger(head.position) || head.position < 0)
        coverageFailures.push(`${machine}: invalid declared head`);
      else if (!observed) coverageFailures.push(`${machine}: omitted nonempty lineage`);
      else if (compare(observed, head) !== 0) coverageFailures.push(`${machine}: snapshot does not reach exact declared head`);
      if (retained && compare(head, retained) < 0) coverageFailures.push(`${machine}: declared head shortens source frontier`);
    }
    const vector = encoded(actual).hash;
    const bytes = snapshot.entries.reduce((sum, row) => sum + encoded(row.fact).bytes.length, 0), lineages = required.size;
    const samples: InstallationReplaySample[] = [], workloads: InstallationReplayWorkload[] = [];
    const comparison: Record<string, 'equal' | 'diverged' | 'not-compared'> = {};
    const genesis = new Map<string, Checkpoint>();
    for (const definition of definitions) comparison[definition.id] = 'not-compared';
    for (const mode of input.matrix) {
      const workloadStart = input.clock.monotonic();
      for (const definition of definitions) {
        const start = input.clock.monotonic(), prior = genesis.get(definition.id);
        const rebuilt = detail(rebuildProjection(definition, snapshot, generation, factBoundary, mode === 'warm' && prior ? [prior] : []));
        const end = input.clock.monotonic();
        ensure(Number.isFinite(start) && Number.isFinite(end) && end >= start, 'replay: monotonic readings went backwards');
        const base = { projection: definition.id, mode, facts: snapshot.entries.length, bytes, lineages, start, end, duration: end - start };
        if ('refusal' in rebuilt) { samples.push({ ...base, folded: null, resultDigest: null, vector: null, failure: rebuilt.refusal }); continue; }
        const saved = checkpoint(rebuilt.value.view);
        if (mode === 'cold' && !prior) genesis.set(definition.id, saved);
        else if (prior) {
          const same = detail(verifyRebuild(prior, saved, factBoundary));
          comparison[definition.id] = 'value' in same && comparison[definition.id] !== 'diverged' ? 'equal' : 'diverged';
        }
        samples.push({ ...base, folded: rebuilt.value.folded, resultDigest: saved.hash, vector: encoded(saved.vector).hash, failure: null });
      }
      const end = input.clock.monotonic();
      ensure(Number.isFinite(workloadStart) && Number.isFinite(end) && end >= workloadStart, 'replay: monotonic workload readings went backwards');
      let peakMemory: number | null = null;
      if (input.memory?.owner === 'part-ten' && typeof input.memory.peakBytes === 'function') {
        try { const measured = input.memory.peakBytes(); if (Number.isSafeInteger(measured) && measured >= 0) peakMemory = measured; } catch { /* absent measurement withholds */ }
      }
      workloads.push({ mode, start: workloadStart, end, peakMemory });
    }
    const withheld = [...coverageFailures];
    const failures = samples.filter(sample => sample.failure !== null).length + coverageFailures.length;
    if (samples.some(sample => sample.failure !== null)) withheld.push('rebuild sample(s) failed');
    for (const [id, verdict] of Object.entries(comparison)) if (verdict !== 'equal') withheld.push(`${id}: genesis and checkpoint ${verdict}`);
    if (workloads.some(workload => workload.peakMemory === null)) withheld.push('required peak-memory measurement absent');
    const { durationMargin, memoryMargin, memoryBudget } = input;
    if (!Number.isSafeInteger(durationMargin) || durationMargin! < 0 || !Number.isSafeInteger(memoryMargin) || memoryMargin! < 0
      || !Number.isSafeInteger(memoryBudget) || memoryBudget! <= 0) withheld.push('explicit finite admission margins and memory budget required');
    let measuredBound: InstallationReplayReport['measuredBound'] = null;
    if (!withheld.length) {
      const admission = take(evaluateGenesisReplay(workloads.map((workload, index) => ({ deployment: 'installation', cache: workload.mode,
        facts: snapshot.entries.length, bytes, lineages, generation: generation.reference.id, started: workload.start, ended: workload.end,
        peakMemory: workload.peakMemory!, resultDigest: encoded(samples.slice(index * 6, (index + 1) * 6)
          .map(sample => [sample.projection, sample.resultDigest, sample.vector])).hash, failures: [] })),
      { installation: [...new Set(input.matrix)] }, input.budget, durationMargin!, memoryMargin!, context, memoryBudget!));
      withheld.push(...admission.failures);
      if (admission.eligible) measuredBound = { duration: admission.maximumDuration, peakMemory: admission.maximumMemory,
        durationMargin: durationMargin!, memoryMargin: memoryMargin!, admissionDuration: admission.admissionDuration,
        admissionMemory: admission.admissionMemory, budget: input.budget, memoryBudget: memoryBudget! };
    }
    return freeze({ type: 'InstallationReplayReport' as const, schemaVersion: 1 as const, profile: { ...input.profile },
      generation: generation.reference.id, vector, matrix: [...input.matrix], samples, workloads, coverageFailures,
      checkpointComparison: comparison, failures, measuredBound, claim: measuredBound ? 'measured' as const : 'withheld' as const, withheldBecause: withheld });
  });
}
