import type { Decision, OwnedReference, Result } from '../index.js';
import type { FactStatus } from '../facts/index.js';
import type { BenchmarkRecord, BenchmarkRunRecord, BenchmarkScenario, Capture, JudgmentBenchmarkReadPort, JudgmentFact, JudgmentRecord, JudgmentRequest, JudgmentResolution, JudgmentSpine } from './contracts.js';
import type { BoundaryContext } from '../index.js';
import { boundary, ensure, freeze, take } from './boundary.js';

const typeOf = (status: FactStatus): JudgmentRecord | undefined => {
  if (!status.fact.kind.startsWith('judgment-')) return undefined;
  return (status.body as { readonly record?: JudgmentRecord }).record;
};

export function createJudgmentBenchmarkReadPort(spine: JudgmentSpine, context: BoundaryContext): JudgmentBenchmarkReadPort {
  const read = () => take(spine.store.readForProjection()).entries;
  const clean = (status: FactStatus): void => ensure(status.taint.length === 0 && status.conflicts.length === 0,
    'judgment benchmark source tainted or conflicted');
  const checked = <T>(name: string, run: () => T): Result<T> => boundary(name, null, context, run);
  const statusFor = (entries: readonly FactStatus[], id: string, type: JudgmentRecord['type']): FactStatus | undefined =>
    entries.find(entry => entry.fact.id === id && typeOf(entry)?.type === type);
  const cleanDependencies = (status: FactStatus, entries: readonly FactStatus[], visited = new Set<string>()): void => {
    if (visited.has(status.fact.id)) return;
    visited.add(status.fact.id); clean(status);
    const record = typeOf(status);
    const dependency = (id: string, type: JudgmentRecord['type']): FactStatus => {
      const found = statusFor(entries, id, type); ensure(found, `${type} dependency absent`); return found;
    };
    if (record?.type === 'BenchmarkRecord') {
      cleanDependencies(dependency(record.request.id, 'JudgmentRequest'), entries, visited);
      cleanDependencies(dependency(record.resolution.id, 'JudgmentResolution'), entries, visited);
      record.attempts.forEach(attempt => cleanDependencies(dependency(attempt.id, 'JudgmentAttemptRecord'), entries, visited));
    } else if (record?.type === 'BenchmarkScenario') {
      cleanDependencies(dependency(record.source.id, 'BenchmarkRecord'), entries, visited);
    } else if (record?.type === 'BenchmarkRunRecord') {
      record.scenarios.forEach(scenario => cleanDependencies(dependency(scenario.scenario.id, 'BenchmarkScenario'), entries, visited));
    }
  };
  const exact = (reference: OwnedReference<'part-seven', BenchmarkRecord['type'] | BenchmarkScenario['type'] | BenchmarkRunRecord['type']>,
    type: BenchmarkRecord['type'] | BenchmarkScenario['type'] | BenchmarkRunRecord['type'], entries: readonly FactStatus[]): BenchmarkRecord | BenchmarkScenario | BenchmarkRunRecord => {
    ensure(reference.owner === 'part-seven' && reference.name === type && reference.id.length > 0, `${type} owner/reference mismatch`);
    const status = statusFor(entries, reference.id, type);
    ensure(status, `${type} absent`); cleanDependencies(status, entries);
    return freeze(typeOf(status) as BenchmarkRecord | BenchmarkScenario | BenchmarkRunRecord);
  };
  return Object.freeze({ owner: 'part-seven' as const,
    readRecord: (id: OwnedReference<'part-seven', 'BenchmarkRecord'>) => checked('JudgmentBenchmarkRecordRead', () => exact(id, 'BenchmarkRecord', read()) as BenchmarkRecord),
    readScenario: (id: OwnedReference<'part-seven', 'BenchmarkScenario'>) => checked('JudgmentBenchmarkScenarioRead', () => exact(id, 'BenchmarkScenario', read()) as BenchmarkScenario),
    readRun: (id: OwnedReference<'part-seven', 'BenchmarkRunRecord'>) => checked('JudgmentBenchmarkRunRead', () => exact(id, 'BenchmarkRunRecord', read()) as BenchmarkRunRecord),
    readManifest: (requestReference: OwnedReference<'part-seven', 'JudgmentRequest'>) => checked('JudgmentBenchmarkManifestRead', () => {
      ensure(requestReference.owner === 'part-seven' && requestReference.name === 'JudgmentRequest' && requestReference.id.length > 0,
        'JudgmentRequest owner/reference mismatch');
      const entries = read();
      const requestStatus = entries.find(entry => entry.fact.id === requestReference.id && typeOf(entry)?.type === 'JudgmentRequest');
      ensure(requestStatus, 'JudgmentRequest absent'); clean(requestStatus);
      const request = typeOf(requestStatus) as JudgmentRequest;
      const neighbors = entries.filter(entry => {
        const record = typeOf(entry); return record && 'request' in record && typeof record.request === 'string' && record.request === request.id;
      });
      neighbors.forEach(clean);
      const resolutionStatus = neighbors.find(entry => typeOf(entry)?.type === 'JudgmentResolution');
      const resolution = resolutionStatus ? typeOf(resolutionStatus) as JudgmentResolution : null;
      const decision = resolutionStatus ? ((resolutionStatus.body as { readonly decision?: Decision }).decision ?? null) : null;
      const captureReferences: Capture[] = [request.question, request.context, request.submitted];
      for (const entry of neighbors) {
        const record = typeOf(entry); if (record?.type === 'JudgmentAttemptRecord' && record.receipt) captureReferences.push(record.receipt);
      }
      const unique = [...new Map(captureReferences.map(capture => [`${capture.reference}:${capture.hash}`, capture])).values()];
      return freeze({ request, resolution, decision,
        conclusionEvidence: decision ? [...decision.conclusion.evidence] : [],
        reasonEvidence: decision ? [...decision.reason.evidence] : [], captureReferences: unique });
    }),
  });
}
