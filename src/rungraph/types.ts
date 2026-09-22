import { productionGraphScope } from '../assembly/grounding-capability.js';
import type { BoundaryContext, Clock, ConversationBindingReference, DecodeContext, FactEnvelopeReference,
  Hash, LeaseReference, Measurement, Outcome, OwnedReference, RegisterGenerationReference, Result, Scope } from '../index.js';
import type { AppendReceipt, CausalFrontier, ConflictClass, DurabilityState, FactContext, FactEnvelope, FactStorePort } from '../facts/index.js';
import type { ProjectionGeneration, ProjectedView } from '../projections/index.js';
import type { RegisterContext, VerifiedRegister } from '../register/index.js';
import type { AssemblyHistoryReadPort } from '../assembly/contracts.js';
import type { FenceToken } from '../transport/index.js';

declare class RunBrand<N extends string> { private readonly runValue: N; private constructor(); }
type RecordValue<N extends string, V extends number = 1> = RunBrand<N> & Readonly<{ type: N; schemaVersion: V; id: string }>;
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
  allocation: Readonly<{ budget: string; reservation: OwnedReference<'part-six', 'AdmissionReservation'> }>;
  ownership: LeaseReference; resultDestination: RunDestination; generation: RegisterGenerationReference;
}>;
export type RunState = 'ready' | 'running' | 'waiting' | 'recovering' | 'halted' | 'closing' | 'completed' | 'unreachable' | 'cancelled';
export type CompletedRunExit = RecordValue<'RunExit'> & Readonly<{
  run: string; expected: string; proposer: PrincipalReference; standing: FactEnvelopeReference;
  frontier: CausalFrontier; at: Clock; kind: 'completed'; exitTest: RunExitTest;
  check: FactEnvelopeReference; evidence: readonly ConstitutionalReference<'Evidence'>[];
  result: ConstitutionalReference<'Result'>; settledOperations: readonly string[];
}>;
/** A reference to a record admitted through Part Five's additive owner boundary. */
export type RunOwnedRecordReference<N extends 'Run' | 'RunStep' | 'ExhaustionRecord' | 'UnreachableRunExit'> = Readonly<{
  owner: 'part-five';
  name: N;
  id: string;
  fact: FactEnvelopeReference;
}>;
export type UnreachableRunExit = RecordValue<'UnreachableRunExit'> & Readonly<{
  run: string;
  expected: string;
  proposer: PrincipalReference;
  standing: FactEnvelopeReference;
  frontier: CausalFrontier;
  at: Clock;
  kind: 'unreachable';
  phase: 'proposal' | 'close';
  proposal?: RunOwnedRecordReference<'UnreachableRunExit'>;
  exhaustion: RunOwnedRecordReference<'ExhaustionRecord'>;
  unsatisfiedClauses: readonly string[];
  externalDependency: Readonly<{ owner: PrincipalReference; action: string; scope: Scope }>;
  recheck: Readonly<{ at: Clock; owner: PrincipalReference; obligation: FactEnvelopeReference }>;
  settledOperations: readonly string[];
}>;
/** The granted public exit is closed over the original completed and additive unreachable arms. */
export type RunExit = CompletedRunExit | UnreachableRunExit;
export type SessionGrounding = RecordValue<'SessionGrounding', 2> & Readonly<{
  run: string; expected: string; worker: string; harness: string; reason: 'start' | 'recovery' | 'resume';
  /** Required by the production context-delivery arm; omitted only by the flat compatibility arm. */
  step?: string; incarnation?: string; contextDeliveryReason?: 'initial' | 'live-input' | 'compaction';
  ownership: LeaseReference; executionContext: FactEnvelopeReference;
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
  outcome?: ConstitutionalReference<'Outcome'>; settlement?: FactEnvelopeReference; exit?: CompletedRunExit;
}>;
export type RunRecord = Run | RunTransition | SessionGrounding;
export interface RunDecodeContext extends BoundaryContext {
  readonly types: DecodeContext; readonly facts: FactContext; readonly stimulusKinds: readonly string[];
  readonly evidenceSources: Readonly<{ settlement: string; exit: string }>;
  // Installation-owned resolution of P4's opaque accountable work-owner keys.
  // Values are references to P1-verified records, not self-asserted identities.
  readonly intakeOwners?: Readonly<Record<string, PrincipalReference>>;
}
export interface RunView {
  readonly run: Run; readonly state: RunState; readonly head: string;
  readonly pending: readonly RunStep[]; readonly settled: readonly string[]; readonly usedKeys: readonly string[];
  readonly blockedOn: RunBlockedOn; readonly nextWake: RunWake; readonly source: ProjectedView;
  readonly conflicts: readonly ConflictClass[];
  readonly identities: readonly Readonly<{ type: string; id: string; hash: Hash; facts: readonly string[] }>[];
}
// This is the run consumer's demanded observation, not a new six-owned record.
export type RunExecutionObservation = Readonly<{ worker: string; harness: string; ownership: LeaseReference; context: FactEnvelopeReference }>;
// Six realizes exclusion AT the append boundary, not a preflight boolean. The
// callback must execute once under the current fence and expected-head CAS. A
// refusal/throw after durable commit may lose an ACK, never erase the fact.
export interface RunAdmissionPort {
  readonly owner: 'part-six';
  // Resolve the executing worker from independently verified placement/ownership,
  // never from a caller-supplied worker string. Called inside fenced admission.
  execution(run: string, ownership: LeaseReference): Result<RunExecutionObservation>;
  reservation(reference: OwnedReference<'part-six', 'AdmissionReservation'>, step: RunStep): Result<FactEnvelopeReference>;
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
  /** Reader mode declaration; production boot separately requires genuine owner-issued factory provenance. */
  readonly production?: true;
  // Must measure NOW and deliver the enumerated bytes to this worker before return.
  read(request: Readonly<{ run: RunView; worker: string; harness: string; reason: SessionGrounding['reason']; execution: RunExecutionObservation;
    /** Per-call identity supplied by Five. It is never stored and cannot be replayed. */
    invocation?: object }>): Result<unknown>;
}

const declaredProductionGroundingReaders = new WeakSet<object>();

/** Runtime provenance for the Ten factory and the Five graph it actually binds.
 * The stored grounding remains pure data; only this process-local construction
 * proof selects the production composition arm. */
export function registerProductionGroundingReader<T extends GroundingReadPort>(reader: T): T {
  declaredProductionGroundingReaders.add(reader);
  return reader;
}
export function isProductionGroundingReader(reader: GroundingReadPort): boolean {
  return declaredProductionGroundingReaders.has(reader);
}
export function registerProductionGroundedGraph<T extends RunGraphPort>(graph: T): T {
  return graph;
}
export function isProductionGroundedRunGraph(graph: RunGraphPort, scope?: string): boolean {
  const granted = productionGraphScope(graph);
  return granted !== undefined && (scope === undefined || granted === scope);
}

/** Retained inert declaration for compatibility. Only the connected Ten
 * factory can bind current graph provenance; this function grants nothing. */
export function issueProductionGroundedGraph<T extends RunGraphPort>(graph: T, scope: string | undefined): T {
  if (!scope) return graph;
  return graph;
}
export interface RunGovernance {
  readonly register: VerifiedRegister;
  readonly context: RegisterContext;
  readonly capture: Readonly<{ owner: 'part-two'; preserve(input: unknown): Result<string> }>;
}
export interface RunGraphDependencies {
  readonly governance: RunGovernance;
  readonly context: RunDecodeContext; readonly store: FactStorePort; readonly writer: RunWriterPort;
  readonly admission: RunAdmissionPort; readonly grounding: GroundingReadPort;
  /** Mandatory whenever grounding.production is true; omitted by legacy isolated fixtures. */
  readonly assemblyHistory?: AssemblyHistoryReadPort;
  readonly settlement: Readonly<{ owner: 'part-eight'; read(reference: FactEnvelopeReference, step: RunStep): Result<{
    readonly record: FactEnvelopeReference; readonly outcome: Outcome; readonly claimClosed: boolean; readonly chargeSettled: boolean;
  }> }>;
  readonly control: Readonly<{ owner: 'part-four'; verify(kind: 'stop' | 'resume', fact: FactEnvelopeReference, run: Run): Result<FactEnvelopeReference> }>;
  readonly exitCheck: Readonly<{ owner: 'part-nine'; verify(exit: CompletedRunExit, run: Run, now: Clock): Result<FactEnvelopeReference> }>;
  readonly groundingPolicy: Readonly<{ entry: string; threshold: number; maxAge: number; briefingClasses: readonly string[] }>;
  readonly generation: () => ProjectionGeneration; readonly clock: () => Clock;
  readonly acceptedAnswer?: AcceptedProviderAnswerReadPort;
}
export interface AcceptedProviderAnswerView {
  readonly acceptance: OwnedReference<'part-seven', 'ProviderAnswerAcceptance'>;
  readonly acceptanceFact: FactEnvelopeReference; readonly answer: string; readonly answerDigest: Hash;
  readonly originalRun: string; readonly predecessor: string; readonly obligation: string;
  readonly chargeSettled: boolean; readonly retainedExposure: number; readonly maximumCharge: number;
  readonly required: readonly string[];
}
export interface AcceptedProviderAnswerReadPort {
  readonly owner: 'part-eight';
  consumeAcceptedProviderAnswer<T>(reference: OwnedReference<'part-seven', 'ProviderAnswerAcceptance'>,
    consumer: (view: AcceptedProviderAnswerView) => T): Result<T>;
}
export interface AcceptedProviderReplyInput {
  readonly acceptance: OwnedReference<'part-seven', 'ProviderAnswerAcceptance'>;
  readonly originalRun: string; readonly expected: string; readonly obligation: FactEnvelopeReference;
  readonly standing: FactEnvelopeReference; readonly ownership: LeaseReference; readonly fence: FenceToken;
  readonly reply: unknown;
}
export interface RunExitReadPort<E extends RunExit = RunExit> {
  readonly owner: 'part-five';
  readExit(run: OwnedReference<'part-five', 'Run'>): Result<Readonly<{
    fact: FactEnvelopeReference;
    exit: E;
  }>>;
}
export interface RunGraphPort extends RunExitReadPort<CompletedRunExit> {
  open(input: unknown): Result<RunView>;
  openAcceptedProviderReply(input: AcceptedProviderReplyInput): Result<RunView>;
  read(run: string): Result<RunView>;
  ground(run: string, worker: string, harness: string, reason: SessionGrounding['reason'], ownership: LeaseReference): Result<FactEnvelope>;
  transition(input: unknown): Result<RunView>;
}
