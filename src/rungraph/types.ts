import type { BoundaryContext, Clock, ConversationBindingReference, DecodeContext, FactEnvelopeReference,
  Hash, LeaseReference, Measurement, Outcome, OwnedReference, RegisterGenerationReference, Result, Scope } from '../index.js';
import type { AppendReceipt, CausalFrontier, ConflictClass, DurabilityState, FactContext, FactEnvelope, FactStorePort } from '../facts/index.js';
import type { ProjectionGeneration, ProjectedView } from '../projections/index.js';

declare class RunBrand<N extends string> { private readonly runValue: N; private constructor(); }
type RecordValue<N extends string> = RunBrand<N> & Readonly<{ type: N; schemaVersion: 1; id: string }>;
// References identify owner-admitted records; they never confer the referenced authority.
export type ConstitutionalReference<N extends string> = Readonly<{ type: N; id: string; fact: FactEnvelopeReference; field: string }>;
export type PrincipalReference = ConstitutionalReference<'VerifiedPrincipal'>;
export type RunWake = Readonly<{ owner: PrincipalReference; at: Clock; reason: string }>;
export type RunBlockedOn = Readonly<{ kind: 'nothing' }> | Readonly<{
  kind: 'step' | 'recovery' | 'resource' | 'stop' | 'evidence'; reference: string; owner: PrincipalReference; nextObservation: Clock;
}>;
export type RunDestination = Readonly<{ binding: ConversationBindingReference; route: FactEnvelopeReference }>;
export type RunExitTest = Readonly<{ check: string; version: string; subject: string; acceptance: Hash; evidenceKinds: readonly string[]; freshFor: number }>;
export type RunBudget = RecordValue<'RunBudget'> & Readonly<{
  bounds: readonly string[]; resources: readonly Measurement[]; maxWorkers: number; maxProcesses: number;
  maxOutstanding: number; maxChildren: number; maxDepth: number; maxAttempts: number;
  repetitionPolicy: OwnedReference<'part-six', 'LoopPolicy'>; safetyCeiling: Clock; exhaustedOwner: PrincipalReference;
}>;
export type Run = RecordValue<'Run'> & Readonly<{
  opening: FactEnvelopeReference; intent: ConstitutionalReference<'Intent'>; directives: readonly ConstitutionalReference<'Directive'>[];
  owner: PrincipalReference; scope: Scope; authority: Readonly<{ resolution: FactEnvelopeReference; grants: readonly ConstitutionalReference<'StandingGrant'>[] }>;
  exitTest: RunExitTest; budget: RunBudget; cadence: Readonly<{ bound: string; milliseconds: number }>;
  nextWake: RunWake; blockedOn: RunBlockedOn; resultDestination: RunDestination;
  generation: RegisterGenerationReference; createdAt: Clock; depth: 1;
}>;
export type RunStep = RecordValue<'RunStep'> & Readonly<{
  run: string; expected: string; kind: 'compute' | 'effect' | 'ground' | 'evaluate-exit';
  operation: Readonly<{ key: string; digest: Hash; classification: FactEnvelopeReference }>;
  evidence: readonly FactEnvelopeReference[]; directives: readonly ConstitutionalReference<'Directive'>[];
  authorizations: readonly ConstitutionalReference<'Authorization'>[];
  allocation: Readonly<{ budget: string; reservation: OwnedReference<'part-six', 'ResourceReservation'> }>;
  ownership: LeaseReference; resultDestination: RunDestination; generation: RegisterGenerationReference;
}>;
export type RunState = 'ready' | 'running' | 'waiting' | 'recovering' | 'halted' | 'closing' | 'completed' | 'unreachable' | 'cancelled';
export type RunExit = RecordValue<'RunExit'> & Readonly<{
  run: string; expected: string; proposer: PrincipalReference; standing: FactEnvelopeReference;
  frontier: CausalFrontier; at: Clock; kind: 'completed'; exitTest: RunExitTest;
  check: FactEnvelopeReference; evidence: readonly ConstitutionalReference<'Evidence'>[];
  result: ConstitutionalReference<'Result'>; settledOperations: readonly string[];
}>;
export type SessionGrounding = RecordValue<'SessionGrounding'> & Readonly<{
  run: string; expected: string; worker: string; harness: string; reason: 'start' | 'recovery' | 'resume';
  at: Clock; previousActivity: Clock; elapsed: Measurement<'elapsed-time'>;
  principal: PrincipalReference; intake: FactEnvelopeReference; binding: ConversationBindingReference;
  directives: readonly ConstitutionalReference<'Directive'>[]; generation: RegisterGenerationReference;
  frontier: CausalFrontier; knownLineages: readonly string[]; threshold: number;
  // This slice loads full messages, never summaries. Every item is delivered and hash-checked.
  messages: readonly Readonly<{ fact: FactEnvelopeReference; sequence: number; capture: string; hash: Hash }>[];
  lastInbound: FactEnvelopeReference; pendingOperations: readonly string[]; children: readonly string[]; receipts: readonly string[];
  briefingClasses: readonly string[]; consumption: FactEnvelopeReference;
}>;
export type RunTransition = RecordValue<'RunTransition'> & Readonly<{
  run: string; expected: string; trigger: FactEnvelopeReference;
  kind: 'start' | 'observe' | 'recover' | 'stop' | 'resume' | 'propose-exit' | 'close'; from: RunState; to: RunState;
  responsible: PrincipalReference; standing: FactEnvelopeReference; ownership: LeaseReference;
  generation: RegisterGenerationReference; at: Clock; blockedOn: RunBlockedOn; nextWake: RunWake;
  step?: RunStep; grounding?: FactEnvelopeReference; affectedStep?: string;
  outcome?: ConstitutionalReference<'Outcome'>; settlement?: FactEnvelopeReference; exit?: RunExit;
}>;
export type RunRecord = Run | RunTransition | SessionGrounding;
export interface RunDecodeContext extends BoundaryContext {
  readonly types: DecodeContext; readonly facts: FactContext; readonly stimulusKinds: readonly string[];
  readonly evidenceSources: Readonly<{ settlement: string; exit: string }>;
}
export interface RunView {
  readonly run: Run; readonly state: RunState; readonly head: string;
  readonly pending: readonly RunStep[]; readonly settled: readonly string[]; readonly usedKeys: readonly string[];
  readonly blockedOn: RunBlockedOn; readonly nextWake: RunWake; readonly source: ProjectedView;
  readonly conflicts: readonly ConflictClass[];
}
// Six realizes exclusion AT the append boundary, not a preflight boolean. The
// callback must execute once under the current fence and expected-head CAS. A
// refusal/throw after durable commit may lose an ACK, never erase the fact.
export interface RunAdmissionPort {
  readonly owner: 'part-six';
  // Read-only witness check against six's durable admission ledger. Historical
  // acceptance is not a live lease check and must remain readable after takeover.
  verify(record: FactEnvelopeReference): Result<FactEnvelopeReference>;
  create(opening: FactEnvelopeReference, run: string, append: () => Result<AppendReceipt>): Result<AppendReceipt>;
  commit(request: Readonly<{ run: string; expected: string; ownership: LeaseReference; generation: RegisterGenerationReference;
    operation: string; digest: Hash; durability: DurabilityState }>, append: () => Result<AppendReceipt>): Result<AppendReceipt>;
}
export interface RunReplayPort {
  verify(fact: FactEnvelope, record: RunRecord, before: RunView | null): Result<FactEnvelopeReference>;
}
export interface RunWriterPort {
  readonly owner: 'part-ten';
  append(kind: string, run: string, record: RunRecord, required: readonly string[]): Result<AppendReceipt>;
}
export interface GroundingReadPort {
  readonly owner: 'part-ten';
  // Must measure NOW and deliver the enumerated bytes to this worker before return.
  read(request: Readonly<{ run: RunView; worker: string; harness: string; reason: SessionGrounding['reason'] }>): Result<unknown>;
}
export interface RunGraphDependencies {
  readonly context: RunDecodeContext; readonly store: FactStorePort; readonly writer: RunWriterPort;
  readonly admission: RunAdmissionPort; readonly grounding: GroundingReadPort;
  readonly settlement: Readonly<{ owner: 'part-eight'; read(reference: FactEnvelopeReference, step: RunStep): Result<{
    readonly record: FactEnvelopeReference; readonly outcome: Outcome; readonly claimClosed: boolean; readonly chargeSettled: boolean;
  }> }>;
  readonly control: Readonly<{ owner: 'part-four'; verify(kind: 'stop' | 'resume', fact: FactEnvelopeReference, run: Run): Result<FactEnvelopeReference> }>;
  readonly exitCheck: Readonly<{ owner: 'part-nine'; verify(exit: RunExit, run: Run, now: Clock): Result<FactEnvelopeReference> }>;
  readonly groundingPolicy: Readonly<{ entry: string; threshold: number; maxAge: number; briefingClasses: readonly string[] }>;
  readonly generation: () => ProjectionGeneration; readonly clock: () => Clock;
}
export interface RunGraphPort {
  open(input: unknown): Result<RunView>;
  read(run: string): Result<RunView>;
  ground(run: string, worker: string, harness: string, reason: SessionGrounding['reason'], ownership: LeaseReference): Result<FactEnvelope>;
  transition(input: unknown): Result<RunView>;
}
