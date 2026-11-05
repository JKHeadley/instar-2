/** The delegated model path reuses the installed Seven policy and Eight provider
 * doorway. Preview and preparation share one issuer; no route, approval or bound
 * is invented here. Completion still needs the configured Ten/Nine records. */
import type { ProviderJudgmentDependencies, ProviderQuestionInput } from '../judgment/index.js';
import type { DelegatedAsyncWorker, DelegatedRunProposals, DelegatedWorkReferences, RunGraphPort } from '../rungraph/index.js';
import type { FenceToken, TransportAuthority } from '../transport/index.js';
import type { EffectDoorway, EffectSettlement } from '../effects/index.js';
import type { ProductionProviderOwners } from './production-provider-owners.js';
import { offerEnvelope } from '../rungraph/index.js';
import { consumeResult } from '../index.js';
import { boundary, ensure, take } from './boundary.js';

export interface DelegatedProviderPolicy {
  readonly definition: string;
  readonly verificationOwner: string;
  /** The existing Ten context reader, including its grounding thresholds. */
  context: (contract: Parameters<DelegatedWorkReferences['plan']>[0], run: Parameters<DelegatedWorkReferences['plan']>[1]) => string;
  evidence: (contract: Parameters<DelegatedWorkReferences['plan']>[0], run: Parameters<DelegatedWorkReferences['plan']>[1]) => readonly string[];
}

export function createDelegatedProviderWork(input: Readonly<{
  policy: DelegatedProviderPolicy; work: Pick<DelegatedWorkReferences, 'placement' | 'completion'>;
  provider: ProductionProviderOwners; judgment: Omit<ProviderJudgmentDependencies, 'runs'>;
  graph: RunGraphPort; effect: EffectDoorway; transport: TransportAuthority<EffectSettlement>; fence(): FenceToken;
}>) {
  const p = input.judgment, { seven, eight } = input.provider;
  const facts = () => take(p.store.read());
  const question = (contract: Parameters<DelegatedWorkReferences['plan']>[0], run: Parameters<DelegatedWorkReferences['plan']>[1], step: string): ProviderQuestionInput => ({
    id: `delegated-question:${contract.id}`, run: { owner: 'part-five', name: 'Run', id: run.run.id }, step, ordinal: 0,
    semanticMessage: `threadline:${offerEnvelope(contract).key}`, question: contract.task.question,
    context: input.policy.context(contract, run), evidence: input.policy.evidence(contract, run),
    deadline: Math.min(contract.expiresAt, run.run.createdAt.value + p.timeout),
  });
  const request = (run: string) => {
    const rows = facts();
    const matches = rows.filter(row => row.kind === 'effect-provider-ProviderEffectRequest'
      && (row.body as { record?: { run?: string } }).record?.run === run);
    ensure(matches.length === 1, 'delegated provider requires one exact request');
    return (matches[0]!.body as unknown as { record: import('../effects/provider-path.js').ProviderEffectRequest }).record;
  };
  const operation = (run: string) => {
    const q = request(run);
    const row = take(input.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation'
      && row.record.request === q.id && row.record.run === run && row.record.digest === q.digest).at(-1);
    ensure(row?.record.type === 'AdmissionReservation', 'delegated provider reservation absent');
    return { q, row, reservation: row.record };
  };
  const settle = (run: string) => {
    const { q, reservation } = operation(run);
    const assessment = take(eight.assess(reservation.operation));
    const settlement = take(eight.settle(reservation.operation, assessment));
    take(input.transport.settle(input.fence(), settlement));
    take(seven.resolve(q.payload.request, settlement, input.fence()));
    const fact = facts().find(row => row.kind === 'effect-provider-ProviderEffectSettlement'
      && (row.body as { record?: { id?: string } }).record?.id === settlement.id);
    ensure(fact, 'delegated provider settlement fact absent');
    return { fact: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: fact.id },
      outcome: { type: 'Outcome' as const, id: `outcome:${fact.id}`,
        fact: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: fact.id }, field: 'outcome' } };
  };
  const work: DelegatedWorkReferences = {
    ...input.work,
    plan: (contract, run, grounding) => boundary('DelegatedProviderPlan', contract, p.boundary, () => {
      const ground = (grounding.body as { record: { step?: string; ownership: import('../index.js').LeaseReference } }).record;
      ensure(ground.step, 'delegated provider requires the actual Ten step');
      const execution = facts().filter(row => row.kind === 'assembly-HarnessLaunchSpec'
        && (row.body as { record?: { run?: string } }).record?.run === run.run.id).at(-1);
      const references = (execution?.body as { record?: { resourceReferences?: readonly string[] } } | undefined)?.record?.resourceReferences;
      ensure(references?.length === 1, 'delegated provider requires exact admitted worker allocation');
      const q = question(contract, run, ground.step), preview = take(seven.preview(q));
      const groundingOperation = (execution?.body as { record?: { processOperation?: string } } | undefined)?.record?.processOperation;
      ensure(groundingOperation, 'delegated provider requires its actual grounding operation');
      // Context delivery is an effect too. Seven cannot spend the worker's
      // remaining allocation until Eight/Nine and Six settle that exact input.
      take(input.transport.settle(input.fence(), take(input.effect.settle(groundingOperation))));
      return { ownership: ground.ownership, operation: { key: q.semanticMessage, digest: preview.digest,
        classification: run.run.opening }, reservation: { owner: 'part-six', name: 'AdmissionReservation', id: references[0]! } };
    }),
    prepare: (contract, run) => boundary('DelegatedProviderPrepare', contract, p.boundary, () => {
      ensure(run.pending.length === 1, 'delegated provider requires one Five pending step');
      const prepared = take(seven.prepare(question(contract, run, run.pending[0]!.id), input.fence()));
      const obligation = take(input.transport.inspect()).filter(row => row.record.type === 'LoopRecord'
        && row.record.run === run.run.id).at(-1);
      ensure(obligation, 'delegated provider requires its existing Six recovery obligation');
      take(eight.prepare({ prepared, definition: input.policy.definition, verificationOwner: input.policy.verificationOwner,
        resultDestination: run.run.opening.id, obligation: obligation.fact.id }, input.fence()));
    }),
    settlement: (_contract, run) => boundary('DelegatedProviderSettlement', { run: run.run.id }, p.boundary, () => settle(run.run.id)),
  };
  const worker = (recover: NonNullable<DelegatedRunProposals['recover']>): DelegatedAsyncWorker => async (contract, authorization) => {
    const { q, row, reservation } = operation(authorization.localRun);
    ensure(row.fact.id === authorization.reservation && reservation.state === 'prepared', 'delegated provider reservation changed');
    const dispatched = consumeResult(await eight.dispatch(q, input.fence()), { Success: () => true, Refused: () => false });
    if (!dispatched) return null;
    // Any missing observation, independent assessment or accounting throws back
    // to the owned endpoint; it cannot produce a terminal envelope or retry.
    return consumeResult(boundary('DelegatedProviderCollection', { run: authorization.localRun }, p.boundary, () => {
      settle(authorization.localRun);
      return take(recover(contract, take(input.graph.read(authorization.localRun))));
    }), { Success: value => value, Refused: () => null });
  };
  return Object.freeze({ work, worker });
}
