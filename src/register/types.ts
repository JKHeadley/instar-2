import type { BoundaryContext, Clock, DecodeContext, Hash, Json, OwnedReference, Profile, ProfileExpression,
  Provenance, Result, Scope, StandingGrant, Revocation, VerifiedPrincipal } from '../index.js';
import type { FactSchema } from './fact-schema.js';

declare class RegisterBrand<N extends string> { private readonly registerValue: N; private constructor(); }
export type RegisterValue<N extends string> = RegisterBrand<N> & Readonly<{ type: N; schemaVersion: 1 }>;
export type Reference = RegisterValue<'Reference'> & Readonly<{ id: string; target: string }>;
export type FieldShape = Readonly<{ name: string; format: 'text' | 'number' | 'boolean' | 'array' | 'object' | 'scalar';
  required: boolean; values: readonly string[]; reference: boolean; terms: readonly string[]; schema?: FactSchema }>;
export type KindShape = Readonly<{ name: string; fields: readonly FieldShape[]; profile: boolean;
  holder: boolean; enforceable: readonly number[]; invariants: readonly string[] }>;
export type ShapeEntries = RegisterValue<'ShapeEntries'> & Readonly<{ kinds: readonly KindShape[];
  factSchemas: readonly Readonly<{ kind: string; owner: 'part-three'; bodyType: string; schemaVersion: 1;
    decoder: 'decodeGenerationRecord' | 'decodeCheckRun'; requiredFields: readonly string[] }>[];
  parts: readonly number[]; derivedFrom: Readonly<Record<'critical' | 'significant' | 'userFacing' | 'irreversible', ProfileExpression>> }>;
export type ShapeChangeEntry = Readonly<{
  operation: 'add' | 'remove' | 'replace'; path: string; before?: Json; after?: Json;
}>;
export type OwnerReferenceEnrollment = Readonly<{
  part: number; owner: string; manifest: Readonly<{ path: string; hash: Hash }>;
}>;
export type ShapeChangeDocument = RegisterValue<'ShapeChangeDocument'> & Readonly<{
  id: string; parent: Hash; candidateShape: Hash; changes: readonly ShapeChangeEntry[];
  ownerReferences: readonly OwnerReferenceEnrollment[]; approvedIn: FactReference;
}>;
export type CanFailEvidence = Readonly<{ kind: 'fixture' | 'probe' | 'sentinel'; id: string; stage: string }>;
export type Hold = Readonly<{ rule: number }> & (
  | Readonly<{ class: 'held'; evidence: CanFailEvidence; semanticallyReviewed: string }>
  | Readonly<{ class: 'partial'; portion: string; remainder: string; evidence: CanFailEvidence }>
  | Readonly<{ class: 'deferred'; part: number; ceiling: number; owner: string; overdueAction: string }>
);
export type Declaration = RegisterValue<'Declaration'> & Readonly<{
  id: string; kind: string; status: 'live' | 'dark' | 'soaking' | 'retired'; requiredFacts: Readonly<Record<string, Json>>;
  profile?: Profile; standards: readonly number[]; holds: readonly Hold[];
  declaredBy: Readonly<{ path: string; symbol: string }>;
  family?: Readonly<{ source: string; mode: 'commit-extract' }>;
}>;
// These are import points, NOT competing definitions of part-two facts or vectors.
export type FactPositionVectorReference = OwnedReference<'part-two', 'FactPositionVector'>;
export type VersionChainReference = OwnedReference<'part-two', 'VersionChain'>;
export type FactReference = OwnedReference<'part-two', 'FactEnvelope'>;
export interface VersionRowInput {
  readonly id: string; readonly version: string; readonly status: 'live' | 'retired' | 'superseded';
  readonly since: string; readonly supersedes: readonly string[]; readonly approvedIn: FactReference;
  readonly landedIn: string; readonly base: string; readonly contentHash: Hash;
}
export type ChainExtract = RegisterValue<'ChainExtract'> & Readonly<{
  vector: FactPositionVectorReference; rows: readonly VersionRowInput[];
}>;
export type PendingLanding = Readonly<{ state: 'pending-landing' }>;
export type RegisterEntry = Readonly<{ declaration: Declaration; owner: string; since: string | PendingLanding;
  supersedes: readonly string[]; approvedIn: FactReference | PendingLanding; landedIn: string | PendingLanding;
  base: string; history: readonly VersionRowInput[] }>;
export type GeneratedRegister = RegisterValue<'GeneratedRegister'> & Readonly<{
  commit: string; extract: ChainExtract; shape: ShapeEntries; entries: readonly RegisterEntry[];
  authority: 'shape-only';
}>;
declare class VerifiedConsumption { private readonly verifiedConsumption: true; private constructor(); }
export type VerifiedRegister = GeneratedRegister & VerifiedConsumption;
export type RegisterGeneration = RegisterValue<'RegisterGeneration'> & Readonly<{ id: Hash; commit: string;
  vector: FactPositionVectorReference }>;
export type GenerationRecord = RegisterValue<'GenerationRecord'> & Readonly<{
  generation: RegisterGeneration; at: Clock;
}>;
export type CheckRunRecord = RegisterValue<'CheckRunRecord'> & Readonly<{
  id: string; commit: string; branch: string; providerRun: string; outcome: 'passed' | 'failed' | 'incomplete';
  fixtures: readonly Readonly<{ id: string; stage: string; outcome: 'passed' | 'failed' | 'incomplete' }>[]; at: Clock;
}>;
export interface RegisterContext extends BoundaryContext {
  readonly references?: readonly Readonly<{ provider: string; id: string; kind?: string }>[];
  readonly authorityTypes?: DecodeContext;
  readonly types: DecodeContext;
  readonly shape: ShapeEntries;
  readonly provenance: Provenance;
  readonly source: Readonly<{ path: string; symbol: string }>;
}
export interface SpineReadPort {
  readonly owner: 'part-two';
  // Provider verifies canonical extract rows against its verified spine at this vector.
  readonly verifyExtract: (extract: ChainExtract) => Result<FactReference | FactPositionVectorReference>;
  readonly enteringForce: (generation: RegisterGeneration) => Result<GenerationRecord>;
  // Applies part-two vector/unknown-lineage and declared-staleness-bound semantics.
  readonly isCurrent: (vector: FactPositionVectorReference, now: Clock) => Result<boolean>;
  // Production owners may provide a live recheck for already-decoded pages.
  readonly revalidateLoaded?: (extract: ChainExtract, generation: RegisterGeneration, now: Clock) => Result<boolean>;
}
export interface StandingContext {
  readonly principal: VerifiedPrincipal; readonly grants: readonly StandingGrant[];
  readonly revocations: readonly Revocation[]; readonly scope: Scope; readonly now: Clock;
}
export interface EnforcementBoundary {
  readonly kind: string; readonly language: string; readonly impossible: readonly string[];
  readonly swept: readonly string[]; readonly residual: readonly string[];
}
