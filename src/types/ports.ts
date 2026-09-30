import type { Authorization, Clock, Directive, Evidence, Hash, Provenance, Revocation, Scope, StandingGrant, VerifiedPrincipal } from './values.js';

// Consumer-side import points only. The provider owns the actual records and their admission.
export type OwnedReference<Owner extends string, Name extends string> = Readonly<{ owner: Owner; name: Name; id: string }>;
export type FactEnvelopeReference = OwnedReference<'part-two', 'FactEnvelope'>;
export type RegisterGenerationReference = OwnedReference<'part-three', 'RegisterGeneration'>;
export type ConversationBindingReference = OwnedReference<'part-four', 'ConversationBinding'>;
export type RunReference = OwnedReference<'part-five', 'Run'>;
export type LeaseReference = OwnedReference<'part-six', 'Lease'>;
export type JudgmentRequestReference = OwnedReference<'part-seven', 'JudgmentRequest'>;

/**
 * The one-use admission of an account-assented yes (Purpose, "the agent never administers its own
 * safeguards"; Part One `account-assented`). Issued only by the explicit-yes producer after it has
 * checked the recorded request, the P-02 record, the reply/head relationship, the lifetime and prior
 * platform-id consumption; Part One seals it, so a caller cannot construct one.
 */
export type AccountAssentAdmission = Readonly<{
  type: 'AccountAssentAdmission'; reference: string; recordHash: Hash;
  requestId: string; requestDigest: Hash; authorizationId: string;
}>;

export type RegisteredKeyInput = Readonly<{
  readonly methods: readonly string[];
  readonly adapters: readonly string[];
  readonly owner?: string;
}> & (Readonly<{ algorithm: 'ed25519'; publicKey: string }> | Readonly<{ algorithm: 'hmac-sha256'; verificationKey: Uint8Array }>);
export type AuthenticationEvidenceInput =
  | Readonly<{ kind: 'signature'; keyId: string; signature: string }>
  | Readonly<{ kind: 'channel' | 'fetched-record'; authenticated: boolean }>;
export interface CaptureInput { readonly reference: string; readonly hash: Hash }
export type ContentHashInput = Hash;
export interface ClockInput {
  readonly type: 'Measurement'; readonly schemaVersion: 1;
  readonly subject: { readonly kind: 'clock'; readonly instance: string };
  readonly value: number; readonly unit: 'unix-ms'; readonly at: number; readonly by: string;
}
export interface ProvenanceInput {
  readonly type: 'Provenance'; readonly schemaVersion: 1;
  readonly adapter: string; readonly method: string; readonly record: CaptureInput;
  readonly verifiedAt: Clock | ClockInput; readonly machine: string;
  readonly evidence: AuthenticationEvidenceInput;
}

export interface RegisterReadPort {
  readonly generation: RegisterGenerationReference;
  readonly entries: readonly string[];
  readonly producers: readonly string[];
  readonly methods: readonly string[];
  readonly actions: Readonly<Record<string, { readonly protected: boolean; readonly repository: boolean }>>;
  readonly subjects: Readonly<Record<string, readonly string[]>>;
  readonly sites: Readonly<Record<string, 'open' | 'closed'>>;
  readonly keys: Readonly<Record<string, RegisteredKeyInput>>;
  readonly allowRedelegation: boolean;
  readonly conflictStanding: Readonly<{ ordinary: 'delegate' | 'operator'; authority: 'operator' }>;
}
export interface DecodeContext {
  readonly register: RegisterReadPort;
  // The adapter stores input/captures before invoking the pure decoder.
  readonly preserved: string;
  readonly captures: Readonly<Record<string, string>>;
  // Admission supplies these from its scoped causal records, independently of a Conflict body.
  // Keys are canonical hashes of constitutional records that have no intrinsic Scope.
  readonly recordSubjects?: Readonly<Record<string, Scope>>;
  readonly provenance?: Provenance;
  readonly principals?: readonly VerifiedPrincipal[];
  readonly grants?: readonly StandingGrant[];
  readonly revocations?: readonly Revocation[];
  readonly authorizations?: readonly Authorization[];
  // Admissions the explicit-yes producer issued; an account-assent record without one is channel-attested.
  readonly accountAssent?: readonly AccountAssentAdmission[];
  readonly directives?: readonly Directive[];
  readonly evidence?: readonly Evidence[];
  readonly currentBase?: string;
  readonly artifact?: Hash;
  readonly now?: Clock;
  readonly actAt?: Clock;
  readonly binding?: Readonly<{
    reference: ConversationBindingReference; source: Provenance;
    principalId: string; channel: string; grantId: string; scope: Scope;
  }>;
}
