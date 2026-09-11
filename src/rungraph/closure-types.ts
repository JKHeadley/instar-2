import type {
  Clock, FactEnvelopeReference, LeaseReference, Measurement, OwnedReference, Result, Scope,
} from '../index.js';
import type { AppendReceipt, FactEnvelope } from '../facts/index.js';
import type {
  ConstitutionalReference, PrincipalReference, Run, RunExit, RunGraphDependencies,
  RunGraphPort, RunOwnedRecordReference, RunStep, UnreachableRunExit,
} from './types.js';

declare class RunClosureBrand<N extends string> { private readonly runClosureValue: N; private constructor(); }
type ClosureRecord<N extends string> = RunClosureBrand<N> & Readonly<{
  type: N;
  schemaVersion: 1;
  id: string;
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

/** Backward-compatible name retained for callers from the pre-grant review rounds. */
export type RunExitAny = RunExit;
export type RunClosureRecord = ExhaustionRecord | UnreachableRunExit;

export type RunClosureGraphDependencies = RunGraphDependencies;

export type RunClosureGraphPort = Omit<RunGraphPort, 'readExit'> & import('./types.js').RunExitReadPort<RunExit> & {
  recordExhaustion(input: unknown, ownership: LeaseReference): Result<FactEnvelope>;
  recordUnreachableExit(input: unknown, ownership: LeaseReference): Result<FactEnvelope>;
  readExitAny(run: OwnedReference<'part-five', 'Run'>): Result<Readonly<{
    fact: FactEnvelopeReference;
    exit: RunExit;
  }>>;
};

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
