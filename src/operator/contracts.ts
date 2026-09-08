import type { Authorization, BoundaryContext, Clock, DecodeContext, FactEnvelopeReference, Hash, Json,
  Provenance, RegisterGenerationReference, Result, Revocation, Scope, StandingGrant, VerifiedPrincipal } from '../index.js';
import type { FactSnapshot } from '../facts/index.js';
import type { ExternalProtectionBrokerPort, VerificationRuntimePort } from '../verification/index.js';

export type OperatorAuthorityAct = Authorization | StandingGrant | Revocation;
export type AuthoritySurfaceAction = 'approve' | 'decline' | 'grant' | 'revoke' | 'waive' | 're-bind' |
  'change-protected-content' | 'authorize-irreversible';
export type BindingSurfaceAction = 'pair' | 'pre-bind' | 'transfer' | 'narrow' | 'widen' | 'revoke' | 'inspect';

export interface OperatorHistoryPort {
  readonly owner: 'part-two';
  current(): Result<FactSnapshot>;
  isCurrent(snapshot: FactSnapshot): Result<boolean>;
  decode(): DecodeContext;
  clock(): Clock;
  generation(): RegisterGenerationReference;
  expectedKind(reference: string): string | null;
}

export interface SurfaceChallenge {
  readonly id: string; readonly request: string; readonly requestDigest: Hash; readonly renderingDigest: Hash;
  readonly audience: string; readonly operator: string; readonly expiresAt: number; readonly singleUse: true;
}

export interface VerifiedSurfaceProof {
  readonly challenge: string; readonly principal: VerifiedPrincipal; readonly provenance: Provenance;
  readonly act: OperatorAuthorityAct | null;
}

export interface IndependentSurfaceVerifierPort {
  readonly owner: 'part-nine'; readonly administration: 'independent';
  issue(subject: Readonly<Omit<SurfaceChallenge, 'id'>>): Result<SurfaceChallenge>;
  verify(challenge: SurfaceChallenge, proof: string): Result<VerifiedSurfaceProof>;
}

// Consumer requirement for the missing Part Four owner seam. This is not a new
// authorization/decline record and has no constructor; Part Four must admit the
// existing Part One act and return its own fact reference.
export interface OperatorActIntakeConsumer {
  readonly owner: 'part-four';
  admit(input: Readonly<{ request: string; requestDigest: Hash; decision: 'approve' | 'decline';
    act: OperatorAuthorityAct | null; proof: Provenance; challenge: string;
    surface: string; generation: RegisterGenerationReference }>): Result<FactEnvelopeReference>;
}

// The independent brake is deliberately separate from authority completion.
// It consumes the same independently verified challenge proof, but can never
// carry an Authorization/StandingGrant/Revocation into the authority seam.
export interface OperatorEmergencyStopConsumer {
  readonly owner: 'part-four';
  stop(input: Readonly<{ principal: VerifiedPrincipal; scope: Scope; proof: Provenance; challenge: string;
    surface: string; generation: RegisterGenerationReference }>): Result<FactEnvelopeReference>;
}

export interface AuthorityRequestView {
  readonly fact: string; readonly requestId: string; readonly requestDigest: Hash;
  readonly action: string; readonly scope: Scope; readonly audience: string;
  readonly artifact: Hash; readonly base: string; readonly expiresAt: number;
  readonly approver: VerifiedPrincipal; readonly requestedBy: VerifiedPrincipal;
  readonly consequence: string; readonly reversibility: string; readonly blockedWork: string;
  readonly recurrence: readonly string[]; readonly currentGeneration: RegisterGenerationReference;
  readonly completeness: 'complete' | 'partial'; readonly missing: readonly string[];
  readonly primaryActions: readonly ['approve', 'decline'];
  readonly plainLanguageEffect: string;
  readonly requesterText: Readonly<{ label: 'UNTRUSTED REQUESTER TEXT'; text: string }>;
  readonly fieldsEditable: false;
  readonly phoneCapable: true;
}

export interface AuthorityQueueView {
  readonly rows: readonly AuthorityRequestView[]; readonly total: number; readonly coalescedNotifications: number;
  readonly boundedAt: number; readonly pullFirst: true;
}

export interface BindingView {
  readonly platform: string; readonly conversation: string; readonly platformIdentity: string;
  readonly operatorIdentity: string; readonly scope: Scope; readonly state: 'unbound' | 'bound' | 'stale' | 'conflict';
  readonly provenanceClass: 'verified' | 'channel-attested' | 'missing'; readonly bindingFact: string | null;
  readonly grantOrRevocation: string; readonly actions: readonly BindingSurfaceAction[];
  readonly competingClaims: readonly Readonly<{ fact: string; operator: string; provenance: string }>[];
  readonly credentialBindingCount: number; readonly exposesOtherConversations: false;
}

export interface ProtectionReceiptView {
  readonly operation: string; readonly posture: 'protected' | 'unprotected'; readonly brokerReceipt: string | null;
  readonly effectiveDigest: Hash | null; readonly effectiveBase: string | null;
  readonly latestProbe: string | null; readonly witnessFresh: boolean; readonly isolationLive: boolean;
  readonly uncertainty: readonly string[];
}

export interface OperatorSurfacePort {
  readonly owner: 'part-eleven'; readonly id: string;
  render(request: string): Result<AuthorityRequestView>;
  pending(maxRows: number): Result<AuthorityQueueView>;
  challenge(request: string): Result<SurfaceChallenge>;
  confirm(input: Readonly<{ challenge: SurfaceChallenge; proof: string; decision: 'approve' | 'decline' }>): Result<FactEnvelopeReference>;
  binding(input: Readonly<{ adapter: string; conversation: string; platformIdentity: string; identityEpoch: string }>): Result<BindingView>;
  protection(operation: string, path: string): Result<ProtectionReceiptView>;
  stopChallenge(input: Readonly<{ operator: string; scope: Scope }>): Result<SurfaceChallenge>;
  stop(input: Readonly<{ challenge: SurfaceChallenge; proof: string; scope: Scope }>): Result<FactEnvelopeReference>;
}

export interface OperatorSurfaceComposition {
  readonly id: string; readonly boundary: BoundaryContext; readonly history: OperatorHistoryPort;
  readonly verifier: IndependentSurfaceVerifierPort; readonly intake: OperatorActIntakeConsumer | null;
  readonly emergencyStop: OperatorEmergencyStopConsumer | null;
  readonly broker: ExternalProtectionBrokerPort; readonly verification: VerificationRuntimePort;
  readonly requestKind: string; readonly terminalKinds: readonly string[];
  readonly bindingKind: 'conversation-binding'; readonly maxPending: number; readonly challengeLifetime: number;
  readonly witnessFreshness: number; readonly isolation: Readonly<{ owner: 'part-ten'; live(path: string): Result<boolean> }>;
}

export interface ReplaySample {
  readonly deployment: string; readonly cache: 'cold' | 'warm'; readonly facts: number; readonly bytes: number;
  readonly lineages: number; readonly generation: string; readonly started: number; readonly ended: number;
  readonly peakMemory: number; readonly resultDigest: Hash | null; readonly failures: readonly string[];
}
export interface ReplayAdmission {
  readonly eligible: boolean; readonly maximumDuration: number; readonly maximumMemory: number;
  readonly admissionDuration: number; readonly admissionMemory: number; readonly failures: readonly string[];
}

export type MinimalDependency = 'local-facts' | 'register' | 'identity-keys' | 'clock' | 'lease' | 'fence' |
  'replication-peer' | 'conversation-binding' | 'route' | 'delivery-evidence';
export interface MinimalPathState {
  readonly admitted: boolean; readonly missing: readonly MinimalDependency[]; readonly ordinaryUnavailable: readonly string[];
  readonly responseEligible: boolean; readonly preserved: boolean; readonly repairOwner: string;
  readonly maximumExposure: number; readonly replayCount: 0;
}

export interface FailureTraceInput {
  readonly trace: 'crash-after-effect' | 'duplicate-delivery' | 'cancellation-race' | 'stale-authority';
  readonly semanticIdentity: string; readonly digests: readonly string[]; readonly applications: number;
  readonly stopCausallyPrior: boolean; readonly owner: string; readonly outcome: 'happened' | 'did-not-happen' | 'uncertain' | 'missing';
  readonly authorityCurrent: boolean;
}
export interface FailureTraceResolution {
  readonly retry: false; readonly conflict: boolean; readonly state: 'settled' | 'owned-uncertain' | 'stopped' | 'authority-closed';
  readonly owner: string; readonly applications: number;
}

export interface SeamRow {
  readonly seam: string; readonly producer: string; readonly consumer: string; readonly record: string;
  readonly order: readonly string[]; readonly failDirection: string; readonly owner: string;
}

export interface ProtectedViewDependencies {
  readonly broker: ExternalProtectionBrokerPort; readonly verification: VerificationRuntimePort;
}

export interface SurfacePayloadEnvelope { readonly record: Json }
