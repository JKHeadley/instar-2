import type {
  Clock, FactEnvelopeReference, Hash, LeaseReference, Measurement, OwnedReference,
  Result, Scope,
} from '../index.js';
import type { AppendReceipt, CausalFrontier, FactEnvelope } from '../facts/index.js';
import type {
  ConstitutionalReference, PrincipalReference, Run, RunExit, RunGraphDependencies,
  RunGraphPort, RunStep,
} from './types.js';

declare class RunClosureBrand<N extends string> { private readonly runClosureValue: N; private constructor(); }
type ClosureRecord<N extends string> = RunClosureBrand<N> & Readonly<{
  type: N;
  schemaVersion: 1;
  id: string;
}>;

/** A reference to a record admitted through Part Five's additive owner boundary. */
export type RunOwnedRecordReference<N extends 'Run' | 'RunStep' | 'SessionGrounding' | 'ExhaustionRecord' | 'ContinuityAccounting' | 'UnreachableRunExit'> = Readonly<{
  owner: 'part-five';
  name: N;
  id: string;
  fact: FactEnvelopeReference;
}>;

export type ExhaustionAvenue = Readonly<{
  id: string;
  evidence: readonly FactEnvelopeReference[];
}> & (
  | Readonly<{ disposition: 'tried'; step: RunOwnedRecordReference<'RunStep'>; outcome: ConstitutionalReference<'Outcome'> }>
  | Readonly<{ disposition: 'outside-standing'; constraint: FactEnvelopeReference }>
  | Readonly<{ disposition: 'inapplicable'; decision: ConstitutionalReference<'Decision'> }>
);

export type ExhaustionRecord = ClosureRecord<'ExhaustionRecord'> & Readonly<{
  run: string;
  expected: string;
  blocker: FactEnvelopeReference;
  at: Clock;
  basis: 'bounded-investigation';
  scope: Scope;
  grants: readonly ConstitutionalReference<'StandingGrant'>[];
  capabilityReads: readonly FactEnvelopeReference[];
  identityReads: readonly FactEnvelopeReference[];
  goal: string;
  avenues: readonly ExhaustionAvenue[];
  avenueSetDecisions: readonly ConstitutionalReference<'Decision'>[];
  resources: readonly Measurement[];
  dependencies: readonly FactEnvelopeReference[];
  outsideAction: Readonly<{ owner: PrincipalReference; action: string; scope: Scope }>;
  conclusion: ConstitutionalReference<'Decision'>;
  reason: ConstitutionalReference<'Decision'>;
  recheck: Readonly<{ at: Clock; owner: PrincipalReference; obligation: FactEnvelopeReference }>;
}>;

export type ContinuityDisposition =
  | Readonly<{ kind: 'addressed'; work: FactEnvelopeReference; result: ConstitutionalReference<'Result'> }>
  | Readonly<{ kind: 'superseded'; input: FactEnvelopeReference; directive: ConstitutionalReference<'Directive'> }>
  | Readonly<{ kind: 'pending'; work: FactEnvelopeReference; reason: string }>;

export type ContinuityAccounting = ClosureRecord<'ContinuityAccounting'> & Readonly<{
  run: string;
  expected: string;
  grounding: RunOwnedRecordReference<'SessionGrounding'>;
  prePauseInbound: FactEnvelopeReference;
  prePauseCapture: Readonly<{ reference: string; hash: Hash; status: 'available' | 'unavailable' }>;
  firstReply: Readonly<{ operation: string; digest: Hash }>;
  disclosure: FactEnvelopeReference;
  disposition: ContinuityDisposition;
}>;

/**
 * The unreachable arm is an additive record kind. It never enters the legacy
 * RunExit or RunTransition decoders, so their accepted values and refusals stay
 * byte-identical to main.
 */
export type UnreachableRunExit = ClosureRecord<'UnreachableRunExit'> & Readonly<{
  run: string;
  expected: string;
  proposer: PrincipalReference;
  standing: FactEnvelopeReference;
  frontier: CausalFrontier;
  at: Clock;
  phase: 'proposal' | 'close';
  proposal?: RunOwnedRecordReference<'UnreachableRunExit'>;
  exhaustion: RunOwnedRecordReference<'ExhaustionRecord'>;
  unsatisfiedClauses: readonly string[];
  externalDependency: Readonly<{ owner: PrincipalReference; action: string; scope: Scope }>;
  recheck: Readonly<{ at: Clock; owner: PrincipalReference; obligation: FactEnvelopeReference }>;
  settledOperations: readonly string[];
}>;

export type RunExitAny = RunExit | UnreachableRunExit;
export type CompletedRunExit = RunExit;
export type RunClosureRecord = ExhaustionRecord | ContinuityAccounting | UnreachableRunExit;

export type RunClosureGraphDependencies = RunGraphDependencies & Readonly<{
  continuitySend: Readonly<{
    owner: 'part-eight';
    verify(send: FactEnvelopeReference, accounting: ContinuityAccounting): Result<FactEnvelopeReference>;
  }>;
}>;

export interface RunClosureGraphPort extends RunGraphPort {
  recordExhaustion(input: unknown, ownership: LeaseReference): Result<FactEnvelope>;
  recordContinuity(input: unknown, ownership: LeaseReference): Result<FactEnvelope>;
  recordUnreachableExit(input: unknown, ownership: LeaseReference): Result<FactEnvelope>;
  readExitAny(run: OwnedReference<'part-five', 'Run'>): Result<Readonly<{
    fact: FactEnvelopeReference;
    exit: RunExitAny;
  }>>;
  verifyContinuitySend(accounting: RunOwnedRecordReference<'ContinuityAccounting'>,
    send: FactEnvelopeReference): Result<FactEnvelopeReference>;
}

export type ClosureAppend = Readonly<{
  kind: string;
  run: string;
  record: RunClosureRecord;
  required: readonly string[];
  receipt: AppendReceipt;
}>;

export type ClosureRunSnapshot = Readonly<{
  run: Run;
  head: string;
  pending: readonly RunStep[];
}>;
