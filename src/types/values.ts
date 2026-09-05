// Part one, rules 13, 28, 40, 42, 90: nominal immutable values, no public constructors.
declare class ConstitutionalBrand<N extends string> {
  private readonly constitutional: N;
  private constructor();
}
export type Value<N extends string> = ConstitutionalBrand<N> & Readonly<{ type: N; schemaVersion: 1 }>;
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export type PrincipalKind = 'person' | 'agent' | 'system';
export type Hash = `sha256:${string}`;
export type Measurement<S extends string = string> = Value<'Measurement'> & Readonly<{
  subject: { kind: S; instance: string }; value: number; unit: string;
  at: S extends 'clock' ? number : string extends S ? number | Measurement<'clock'> : Measurement<'clock'>; by: string;
}>;
export type Clock = Measurement<'clock'>;
export type Provenance = Value<'Provenance'> & Readonly<{
  adapter: string; method: string; record: { reference: string; hash: Hash };
  verifiedAt: Clock; machine: string; class: 'verified' | 'channel-attested';
  authenticated: { principal: { id: string; kind: PrincipalKind }; recordType: string; payload: Json };
}>;
export type VerifiedPrincipal = Value<'VerifiedPrincipal'> & Readonly<{
  id: string; kind: PrincipalKind; provenance: Provenance;
}>;
export type Scope = Value<'Scope'> & (
  | Readonly<{ kind: 'organization' }>
  | Readonly<{ kind: 'conversation' | 'project' | 'repository' | 'artifact' | 'actions' | 'machine'; members: readonly string[] }>
);
export type StandingGrant = Value<'StandingGrant'> & Readonly<{
  id: string; grantee: VerifiedPrincipal; scope: Scope;
  grantor: { kind: 'org-intent'; documentVersion: string; approvedIn: string }
    | { kind: 'principal'; who: VerifiedPrincipal; authorization: string };
  source: Provenance; issuedAt: Clock; expiresAt?: number;
}> & (
  | Readonly<{ standing: 'operator'; actions?: never }>
  | Readonly<{ standing: 'delegate'; actions: readonly string[] }>
);
export type Revocation = Value<'Revocation'> & Readonly<{
  id: string; grantId: string; by: VerifiedPrincipal; at: Clock; reason: string; source: Provenance;
}>;
export type Intent = Value<'Intent'> & Readonly<{
  id: string; principal: VerifiedPrincipal; receivedAt: Clock; via: string;
  raw: Hash; ask: Json; under: readonly string[];
}>;
export type VerifiedIntent = Intent;
export type Directive = Value<'Directive'> & Readonly<{
  id: string; principal: VerifiedPrincipal; scope: Scope; statement: string; issuedAt: Clock;
  supersedes?: string;
  closedBy?: { kind: 'Superseded'; by: string } | { kind: 'Completed'; evidence: readonly string[] };
}>;
export type Capacity = Readonly<{ kind: 'none' } | { kind: 'applied'; bound: string; action: string }>;
export type RefusalReason = 'standing' | 'decode' | 'floor' | 'stale-base' | 'lease' | 'budget-exhausted' | 'integrity' | 'policy';
export type Success<T> = Value<'Result'> & Readonly<{ kind: 'Success'; value: T; capacity: Capacity }>;
export type Refused = Value<'Result'> & Readonly<{
  kind: 'Refused'; reason: RefusalReason; detail: string; site: string;
  failDirection: 'open' | 'closed'; preserved: string;
}>;
export type Result<T> = Success<T> | Refused;
export type Profile = Value<'Profile'> & Readonly<{
  consequence: 'none' | 'attention' | 'data' | 'money' | 'identity' | 'control' | 'security' | 'external';
  reversibility: 'reversible' | 'costly' | 'irreversible';
  reach: 'internal' | 'agent' | 'user' | 'operator' | 'world';
  surface: 'none' | 'chat' | 'dashboard' | 'link' | 'device';
  repeats: { kind: 'no' } | { kind: 'unbounded' } | { kind: 'bounded'; by: string };
}>;
export type Claim = Readonly<{ subject: string; predicate: string; value: Json }>;
export type Strength = 'proof' | 'observation' | 'attestation' | 'inference';
export type Evidence = Value<'Evidence'> & Readonly<{
  id: string; claim: Claim; source: string | VerifiedPrincipal; observedAt: Clock;
  freshFor: number; capture: { hash: Hash; reference: string }; strength: Strength;
}>;
export type ActionFloor = Value<'ActionFloor'> & Readonly<{ actions: readonly string[]; default: string }>;
declare class ClaimRole<R extends string> {
  private readonly role: R;
  private constructor();
}
export type DecisionClaim<R extends 'conclusion' | 'reason'> = ClaimRole<R> & Claim & Readonly<{
  evidence: readonly string[];
}>;
export type Decision = Value<'Decision'> & Readonly<{
  id: string; at: Clock;
  by: VerifiedPrincipal | { judgment: string; model: string; route: string };
  conclusion: DecisionClaim<'conclusion'>; reason: DecisionClaim<'reason'>;
  floor?: { allowed: ActionFloor; chosen: string }; standsOn: readonly string[];
}>;
export type Authorization = Value<'Authorization'> & Readonly<{
  id: string; at: Clock; approver: VerifiedPrincipal; under: string;
  action: { kind: string; scope: Scope }; artifact: Hash; base: string;
  kind: { kind: 'approval' } | { kind: 'grant' } | { kind: 'waiver'; rule: string };
  requestedBy: VerifiedPrincipal; explicitYes: Provenance; requestDigest: Hash;
}>;
export type Outcome = Value<'Outcome'> & Readonly<{
  kind: 'happened' | 'did-not-happen' | 'uncertain'; evidence: readonly string[];
}>;
export type SecretRef = Value<'SecretRef'> & Readonly<{ vault: string; name: string }>;
export type Conflict = Value<'Conflict'> & Readonly<{
  left: ConstitutionalValue; right: ConstitutionalValue; origins: readonly [string, string];
  fields: readonly string[]; subject: Scope;
}>;
export type UnresolvedInput = Value<'UnresolvedInput'> & Readonly<{
  raw: Hash; channel: string; at: Clock; reason: string;
}>;
export interface Inventory {
  VerifiedPrincipal: VerifiedPrincipal; StandingGrant: StandingGrant; Revocation: Revocation;
  Intent: Intent; Directive: Directive; Result: Result<Json>; Measurement: Measurement;
  Profile: Profile; Evidence: Evidence; Decision: Decision; Authorization: Authorization;
  Scope: Scope; ActionFloor: ActionFloor; Outcome: Outcome; SecretRef: SecretRef;
  Provenance: Provenance; Conflict: Conflict; UnresolvedInput: UnresolvedInput;
}
export type ConstitutionalValue = Inventory[keyof Inventory];
