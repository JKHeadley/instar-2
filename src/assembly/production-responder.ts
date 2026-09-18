import type { BoundaryContext } from '../index.js';
import type { FactStorePort } from '../facts/index.js';
import type { RunGraphPort } from '../rungraph/index.js';
import { evaluateMinimalPath, minimalResponse } from '../operator/index.js';
import type { MinimalDependency } from '../operator/index.js';
import type { AssemblyMinimalResponderPort } from './contracts.js';
import { boundary, ensure, take } from './boundary.js';

const issued = new WeakSet<object>();
export const isProductionMinimalResponder = (port: object): boolean => issued.has(port);

/** Eleven speaks only for preserved Four input after Five accepted Seven's
 * actual resolution. A provider response alone is never an accepted answer. */
export function createProductionMinimalResponder(input: Readonly<{
  id: string; budgets: AssemblyMinimalResponderPort['budgets']; repairOwner: string;
  store: FactStorePort; runs: RunGraphPort; context: BoundaryContext;
  dependencies(): Readonly<Record<MinimalDependency, boolean>>;
}>): AssemblyMinimalResponderPort {
  const configured = Object.freeze({ ...input });
  const port: AssemblyMinimalResponderPort = Object.freeze({ owner: 'part-eleven' as const, id: configured.id,
    budgets: Object.freeze({ ...configured.budgets }),
    respond: (candidate: unknown) => boundary('ProductionMinimalResponder', null, configured.context, () => {
      ensure(candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate),
        'minimal-responder: intake, run and accepted answer references required');
      const request = candidate as Record<string, unknown>;
      ensure(Object.keys(request).sort().join(',') === 'answer,intake,run'
        && ['answer', 'intake', 'run'].every(key => typeof request[key] === 'string' && String(request[key]).length > 0),
      'minimal-responder: closed owner reference request required');
      const view = take(configured.runs.read(request.run as string));
      const snapshot = take(configured.store.readForProjection());
      const clean = (id: unknown, kind: string) => snapshot.entries.find(row => row.fact.id === id
        && row.fact.kind === kind && !row.taint.length && !row.conflicts.length)?.fact;
      ensure(clean(request.intake, 'intake-admitted'), 'minimal-responder: preserved Four input unavailable');
      const answer = clean(request.answer, 'judgment-provider-ProviderJudgmentResolution');
      ensure(answer, 'minimal-responder: Seven answer unavailable');
      ensure(view.run.opening.id === request.intake && view.conflicts.length === 0
        && view.pending.length === 0 && view.state === 'ready', 'minimal-responder: Five has not accepted this input');
      ensure(snapshot.entries.some(row => row.fact.kind === 'run-transition'
        && !row.taint.length && !row.conflicts.length && (() => {
          const record = (row.fact.body as { record?: { id?: string; trigger?: { id?: string }; run?: string } }).record;
          return record?.id === view.head && record.run === request.run && record.trigger?.id === answer.id;
        })()), 'minimal-responder: current Five head does not accept this Seven answer');
      const state = take(evaluateMinimalPath({ admitted: configured.dependencies(), ordinaryUnavailable: [],
        inputPreserved: true, repairOwner: configured.repairOwner, maximumExposure: configured.budgets.effect }, configured.context));
      return take(minimalResponse(state, { attributable: true, pending: [], blocked: [], uncertain: [],
        emergencyStop: false }, configured.context));
    }),
  });
  issued.add(port); return port;
}
