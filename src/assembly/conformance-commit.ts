import { canonical } from '../index.js';
import type { BoundaryContext, Result } from '../index.js';
import type { AdapterConformance, AssemblyRuntimePort, CurrentAssemblyFact } from './contracts.js';
import { assemblyIdentity } from './records.js';
import { boundary, ensure, take } from './boundary.js';

function rowsForAdapter(rows: readonly CurrentAssemblyFact[], adapter: string) {
  return rows.filter((row): row is typeof row & { record: AdapterConformance } =>
    row.record.type === 'AdapterConformance' && row.record.adapter === adapter);
}

function exactFacts(rows: readonly CurrentAssemblyFact[], adapter: string): readonly string[] {
  return rowsForAdapter(rows, adapter).map(row => row.fact.id).sort();
}

function sameFacts(left: readonly string[], right: readonly string[]): boolean {
  return take(canonical([...left].sort())).bytes === take(canonical([...right].sort())).bytes;
}

export interface AdapterConformanceCommitFrontier {
  readonly adapter: string;
  readonly facts: readonly string[];
}

export interface AdapterConformanceCommitPort {
  readonly owner: 'part-ten';
  commit(input: Readonly<{
    frontier: AdapterConformanceCommitFrontier;
    record: unknown;
  }>): Result<AdapterConformance>;
}

/**
 * Additive Part Ten port for an adapter admission's compare-and-set append.
 *
 * The existing AssemblyRuntimePort remains unchanged. This port composes its
 * public inspect/record/inspect primitives into one owner boundary: reject a stale
 * adapter frontier before append, then prove that the appended conformance is
 * the only successor before returning it to the caller.
 */
export function createAdapterConformanceCommitPort(
  runtime: AssemblyRuntimePort,
  context: BoundaryContext,
): AdapterConformanceCommitPort {
  ensure(runtime.owner === 'part-ten', 'adapter conformance commit requires the Part Ten assembly runtime');
  return Object.freeze({ owner: 'part-ten' as const,
    commit(input: Readonly<{ frontier: Readonly<{ adapter: string; facts: readonly string[] }>; record: unknown }>) {
      return boundary('AdapterConformanceCommit', input, context, () => {
        const adapter = input.frontier.adapter;
        ensure(typeof adapter === 'string' && adapter.trim().length > 0,
          'adapter conformance commit requires a nonempty adapter identity');
        ensure(new Set(input.frontier.facts).size === input.frontier.facts.length
          && input.frontier.facts.every(fact => typeof fact === 'string' && fact.trim().length > 0),
        'adapter conformance commit frontier is malformed');

        const before = take(runtime.inspectCurrent());
        const beforeFacts = exactFacts(before, adapter);
        ensure(sameFacts(beforeFacts, input.frontier.facts),
          'adapter conformance commit frontier changed before append');

        const candidate = take(runtime.record('AdapterConformance', input.record));
        ensure(candidate.adapter === adapter,
          'adapter conformance commit record differs from its named frontier');

        const after = take(runtime.inspectCurrent());
        const afterRows = rowsForAdapter(after, adapter);
        const additions = afterRows.filter(row => !beforeFacts.includes(row.fact.id));
        const candidateHash = assemblyIdentity(candidate).canonicalHash;
        const existed = rowsForAdapter(before, adapter)
          .some(row => assemblyIdentity(row.record).canonicalHash === candidateHash);
        ensure(additions.length === (existed ? 0 : 1)
          && (existed || assemblyIdentity(additions[0]!.record).canonicalHash === candidateHash)
          && (existed || afterRows.at(-1)?.fact.id === additions[0]!.fact.id),
        'adapter conformance append was not the immediate successor of its expected frontier');
        return candidate;
      });
    },
  });
}
