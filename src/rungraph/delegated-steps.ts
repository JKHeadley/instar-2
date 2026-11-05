/** Canonical Five proposal issuer for delegated work. The installed work owner
 * supplies existing operation and completion references, never Run transitions.
 * Five still admits every proposal; Six/Eight/Nine consume its exact evidence. */
import { decode } from '../index.js';
import type { Clock, FactEnvelopeReference, LeaseReference, Result } from '../index.js';
import type { DelegationContract } from './delegation.js';
import type { WorkerOutcome } from './agent-transport.js';
import type { DelegatedRunProposals } from './delegated-authority.js';
import type { ConstitutionalReference, RunDecodeContext, RunGraphDependencies, RunGraphPort, RunView } from './types.js';
import { constitutional } from './records.js';
import { boundary, freeze, need, same, take } from './boundary.js';

export interface DelegatedWorkReferences {
  /** Existing Ten placement; Six independently resolves the worker. */
  placement(contract: DelegationContract, run: RunView): Result<LeaseReference>;
  /** Existing Eight preparation, after grounding's context delivery settles. */
  plan(contract: DelegationContract, run: RunView, grounding: import('../facts/index.js').FactEnvelope): Result<Readonly<{
    ownership: LeaseReference;
    operation: import('./types.js').RunStep['operation'];
    reservation: import('./types.js').RunStep['allocation']['reservation'];
  }>>;
  /** Seven/Eight preparation after Five has admitted the pending step. */
  prepare?(contract: DelegationContract, run: RunView): Result<void>;
  /** Read the existing Eight settlement and a P1 Outcome field. Unknown stays
   * pending; a caller cannot replace Eight's independent readRunSettlement. */
  settlement(contract: DelegationContract, run: RunView): Result<Readonly<{
    fact: FactEnvelopeReference; outcome: ConstitutionalReference<'Outcome'>;
  }>>;
  /** Ten's existing recorded output and Nine's check. No inferred success. */
  completion(contract: DelegationContract, run: RunView): Result<Readonly<{
    result: ConstitutionalReference<'Result'>; check: FactEnvelopeReference;
    evidence: readonly ConstitutionalReference<'Evidence'>[];
  }> | null>;
}

export function createDelegatedRunSteps(input: Readonly<{
  graph: RunGraphPort; admission: RunGraphDependencies['admission']; work: DelegatedWorkReferences;
  context(): RunDecodeContext; clock(): Clock;
}>): Pick<DelegatedRunProposals, 'start' | 'prepare' | 'close' | 'recover'> {
  const base = (run: RunView, ownership: LeaseReference) => ({ type: 'RunTransition', schemaVersion: 1,
    run: run.run.id, expected: run.head, responsible: run.run.owner, standing: run.run.opening, ownership,
    generation: run.run.generation, at: input.clock(), nextWake: run.run.nextWake });
  const readOutcome = (run: RunView, result: ConstitutionalReference<'Result'>): WorkerOutcome => {
    const c = input.context();
    const fact = c.facts.facts.find(row => row.id === result.fact.id);
    need(fact && fact.predecessors.required.includes(run.run.opening.id),
      'delegated completion must name its actual Four cause');
    const value = take(take(decode('Result', constitutional(result, 'Result', c).view, c.types)));
    need(value !== null && typeof value === 'object' && !Array.isArray(value), 'closed delegated outcome required');
    const output = value as Record<string, unknown>;
    need(['completed', 'failed', 'refused', 'cancelled'].includes(String(output.terminal))
      && typeof output.result === 'string'
      && Object.keys(output).every(key => ['terminal', 'result', 'effects', 'evidence'].includes(key))
      && [output.effects, output.evidence].every(items => items === undefined
        || Array.isArray(items) && items.every(item => typeof item === 'string')),
    'closed delegated outcome differs');
    return output as WorkerOutcome;
  };
  const ownership = (run: RunView): LeaseReference => {
    if (run.pending[0]) return run.pending[0].ownership;
    const rows = input.context().facts.facts.filter(row => row.kind === 'run-transition'
      && (row.body as { run?: string }).run === run.run.id);
    const record = (rows.at(-1)?.body as { record?: { ownership?: LeaseReference } } | undefined)?.record;
    need(record?.ownership, 'delegated completion has no admitted execution ownership');
    return record.ownership;
  };
  return freeze({
    ...(input.work.prepare ? { prepare: input.work.prepare } : {}),
    start: (contract, run) => boundary('DelegatedStepProposal', contract, input.context(), () => {
      const lease = take(input.work.placement(contract, run));
      const execution = take(input.admission.execution(run.run.id, lease));
      const ground = take(input.graph.ground(run.run.id, execution.worker, execution.harness, 'start', lease));
      const plan = take(input.work.plan(contract, run, ground));
      need(same(plan.ownership, lease), 'delegated preparation changed worker ownership');
      const grounding = (ground.body as { record: { step?: string; intake: FactEnvelopeReference } }).record;
      need(grounding.step, 'delegated work requires actual production grounding step');
      const step = { type: 'RunStep', schemaVersion: 1, id: grounding.step, run: run.run.id,
        expected: run.head, kind: 'effect', operation: plan.operation, evidence: [], directives: run.run.directives,
        authorizations: [], allocation: { budget: run.run.budget.id, reservation: plan.reservation },
        ownership: plan.ownership, resultDestination: run.run.resultDestination, generation: run.run.generation };
      return { ...base(run, plan.ownership), id: `start:${contract.id}`, trigger: grounding.intake,
        kind: 'start', from: run.state, to: 'running', grounding: { owner: 'part-two', name: 'FactEnvelope', id: ground.id },
        blockedOn: { kind: 'step', reference: step.id, owner: run.run.owner,
          nextObservation: run.run.budget.safetyCeiling }, step };
    }),
    recover: (contract, run) => boundary('DelegatedCompletionRead', contract, input.context(), () => {
      const completion = take(input.work.completion(contract, run));
      return completion === null ? null : readOutcome(run, completion.result);
    }),
    close: (contract, run, outcome) => boundary('DelegatedClosureProposal', contract, input.context(), () => {
      const lease = ownership(run);
      if (run.pending.length > 0) {
        need(run.pending.length === 1, 'delegated settlement must select exactly one pending step');
        const settlement = take(input.work.settlement(contract, run));
        return { ...base(run, lease), id: `observe:${contract.id}`, trigger: settlement.fact,
          kind: 'observe', from: run.state, to: 'ready', affectedStep: run.pending[0]!.id,
          outcome: settlement.outcome, settlement: settlement.fact, blockedOn: { kind: 'nothing' } };
      }
      const completion = take(input.work.completion(contract, run));
      need(completion && same(readOutcome(run, completion.result), outcome), 'exact recorded delegated result unavailable');
      need(run.state === 'ready' || run.state === 'closing', 'delegated exit cannot skip pending work');
      const phase = run.state === 'closing' ? 'close' : 'propose-exit';
      return { ...base(run, lease), id: `${phase}:${contract.id}`, trigger: completion.check,
        kind: phase, from: run.state, to: phase === 'close' ? 'completed' : 'closing', blockedOn: { kind: 'nothing' },
        exit: { type: 'RunExit', schemaVersion: 1, id: `${phase}:exit:${contract.id}`, run: run.run.id,
          expected: run.head, proposer: run.run.owner, standing: run.run.opening, frontier: run.source.foldedThrough,
          at: input.clock(), kind: 'completed', exitTest: run.run.exitTest, ...completion,
          settledOperations: run.settled } };
    }),
  });
}
