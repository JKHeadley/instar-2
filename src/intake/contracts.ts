import type { Authorization,CaptureInput,Clock,FactEnvelopeReference,Hash,Intent,Provenance,ProvenanceInput,
  RegisterGenerationReference,Result,Revocation,Scope,StandingGrant,VerifiedPrincipal } from '../index.js';
import type { FactContext,SegmentStoragePort } from '../facts/index.js';
import type { VerifiedRegister,RegisterContext } from '../register/index.js';
import type { ProjectionGeneration } from '../projections/index.js';

// The adapter supplies transport metadata, never fields extracted from message prose.
// Sender is always part of the dedup key, even for provider-global event ids.
export interface InboundRoute {
  readonly channel: string; readonly sender: string; readonly identityEpoch: string;
  readonly eventId: string|null;
}
export interface SenderEvidence {
  readonly provenance: ProvenanceInput;
  readonly principalId: string;
  readonly principalKind: 'person'|'agent'|'system';
  // Authenticated transport identities must match the route, including identity churn.
  readonly channel: string; readonly sender: string; readonly identityEpoch: string;
  /** Checked source and approval facts to retain in the admission's causal cone. */
  readonly authorityFacts?: Readonly<{ manifest: string; approvedAct: string }>;
}
export interface IntakeAdapterPort {
  readonly id: string;
  authenticate(raw: string,route: InboundRoute,at: Clock): Result<SenderEvidence>;
  // Translation only. The owner classifies this bounded data, not a callback's authority claim.
  parse(raw: string): unknown;
}
export interface IntakeCapturePort {
  readonly owner: 'part-ten';
  // Must return only after fsync-equivalent durability and update the context's capture index.
  preserve(raw: string,at: Clock): Result<CaptureInput>;
}
export interface IntakeDependencies {
  readonly adapter: IntakeAdapterPort;
  readonly capture: IntakeCapturePort;
  readonly storage: SegmentStoragePort;
  readonly context: () => FactContext;
  readonly author: { readonly machine: string; readonly principal: VerifiedPrincipal; readonly provenance: Provenance; readonly privateKey: string };
  readonly clock: () => Clock;
  // Supplied by loadRegister after extract, entering-force and currency checks.
  // A source replay or a structural cast cannot substitute for its runtime witness.
  readonly governance: { readonly register: VerifiedRegister; readonly context: RegisterContext };
  readonly scope: Scope;
  readonly workOwner: string;
  readonly holdMaxAge: number;
  readonly holdMaxActive: number;
  // Independently observed replication currency, owned by the assembly/replication provider.
  readonly dedupGeneration: () => ProjectionGeneration;
  readonly dedupStalenessBound: number;
}
export type IntakeDisposition=Readonly<
  |{ kind: 'admitted'; logicalId: string; lastInboundId: string; intent: Intent; fact: FactEnvelopeReference; owner: string; blockedOn: 'run-admission'; standing: 'requester'; boundOperator: boolean; flags: readonly 'cannot-decide'[] }
  |{ kind: 'duplicate'; logicalId: string; original: FactEnvelopeReference }
  |{ kind: 'stopped'; logicalId: string; fact: FactEnvelopeReference; scope: Scope; fencingOwner: 'part-six' }
  |{ kind: 'stop-signal'; logicalId: string; fact: FactEnvelopeReference; priority: 'highest'; halts: false }
>;
export type VerifiedAuthorityAct=Authorization|StandingGrant|Revocation;
export interface VerifiedActAdmission {
  readonly request: FactEnvelopeReference;
  readonly requestDigest: Hash;
  readonly decision: 'approve'|'decline';
  readonly act: VerifiedAuthorityAct|null;
  // Durable capture of the closed VerifiedActProofBundle. The bundle contains
  // independently signed P1 Provenance inputs for the challenge and act.
  readonly proof: CaptureInput;
  readonly surface: string;
  readonly generation: RegisterGenerationReference;
}
export type VerifiedActDisposition=Readonly<{
  readonly kind: 'approved'|'declined'|'emergency-stopped';
  readonly fact: FactEnvelopeReference;
}>;
export interface IntakePort {
  receive(raw: string,route: InboundRoute): Result<IntakeDisposition>;
  // Reprocess a durable receipt; route, bytes and original clock come from the ledger.
  recover(receiptId: string): Result<IntakeDisposition>;
  // A package-authenticated maintenance operation; the scheduler calls this same port.
  expireHolds(): Result<number>;
  // Separate from receive: requester prose can never enter this operation.
  admitVerifiedAct(input: VerifiedActAdmission): Result<VerifiedActDisposition>;
}
