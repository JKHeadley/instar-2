/** Delegated work uses the installation's existing Eight doorway and Six
 * accounting. Unknown execution is observation-only; no replacement dispatch. */
import { consumeResult } from '../index.js';
import type { FenceToken, TransportAuthority } from '../transport/index.js';
import type { EffectDoorway, EffectSettlement } from '../effects/index.js';
import type { DelegatedAsyncWorker, DelegatedRunProposals, RunGraphPort } from '../rungraph/index.js';
import { ensure, take } from './boundary.js';

export function createProductionDelegatedWorker(input: Readonly<{
  graph: RunGraphPort; effect: EffectDoorway; transport: TransportAuthority<EffectSettlement>;
  fence(): FenceToken;
  recover: NonNullable<DelegatedRunProposals['recover']>;
}>): DelegatedAsyncWorker {
  return async (contract, authorization) => {
    let run = take(input.graph.read(authorization.localRun));
    ensure(run.state === 'running' && run.pending.length === 1, 'delegated worker requires one admitted step');
    const step = run.pending[0]!;
    const reservations = take(input.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
      && row.record.semanticMessage === step.operation.key && row.record.run === run.run.id);
    const reservation = reservations.at(-1);
    ensure(reservation?.record.type === 'AdmissionReservation' && reservation.fact.id === authorization.reservation
      && reservation.record.state === 'prepared' && reservation.record.run === run.run.id
      && reservation.record.digest === step.operation.digest, 'delegated worker reservation changed');
    const requestId = reservation.record.request;
    const rows = take(input.effect.inspect());
    const request = rows.find(row => row.record.type === 'EffectRequest'
      && row.record.id === requestId)?.record;
    ensure(request?.type === 'EffectRequest' && request.run === run.run.id
      && request.semanticMessage === step.operation.key && request.digest === step.operation.digest,
    'delegated worker requires the actual prepared Eight request');
    take(input.effect.dispatch(request, input.fence()));
    // Unavailable independent evidence retains both the edge and its resource
    // exposure. A later pass may settle it, but never execute it again.
    const settlement = consumeResult(input.effect.settle(reservation.record.operation),
      { Success: value => value, Refused: () => null });
    if (!settlement) return null;
    take(input.transport.settle(input.fence(), settlement));
    run = take(input.graph.read(run.run.id));
    return take(input.recover(contract, run));
  };
}
