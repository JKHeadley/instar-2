import type { Clock, Conflict, DecodeContext, Hash, HistoricalRead, HistoricalShape, Inventory, Json, Provenance, Revocation, Scope, StandingGrant, VerifiedPrincipal } from '../index.js';

export interface SegmentPosition { readonly machine: string; readonly epoch: number; readonly position: number }
export interface LineagePosition { readonly epoch: number; readonly position: number }
export type CausalFrontier = Readonly<Record<string, LineagePosition>>;
export interface Predecessors { readonly inSegment: string | null; readonly frontier: CausalFrontier; readonly required: readonly string[] }
declare const envelopeBrand: unique symbol;
// HistoricalShape deliberately has no live principal/provenance brand. The wire decoder does
// not grant authority; live author admission and the origin-pinned read are distinct doors.
export interface FactEnvelope {
  readonly [envelopeBrand]: true;
  readonly type: 'FactEnvelope'; readonly envelopeVersion: 1;
  readonly id: string; readonly kind: string; readonly schemaVersion: number;
  readonly at: Clock; readonly foldKeyInstant: string; readonly machine: string;
  readonly principal: HistoricalShape<VerifiedPrincipal>; readonly provenance: HistoricalShape<Provenance>;
  readonly segment: SegmentPosition; readonly prevInSegment: Hash; readonly predecessors: Predecessors;
  readonly body: Json; readonly contentHash: Hash; readonly signature: string;
}
export type DurabilityState = Readonly<{ kind: 'local-durable' } | { kind: 'replicated'; peers: readonly string[]; n: number }>;
export type CaptureStatus = 'available' | 'tombstoned' | 'expired' | 'missing';
export type AuthorityTaint = 'provisional' | 'contested' | 'evidence-unavailable';
export interface ConflictClass {
  readonly key: string;
  readonly kind: 'immutable-disagreement' | 'pending-expired' | 'compromised-key' | 'version-fork' | 'revocation-conflict' | 'concurrent-correction' | 'aggregate-breach' | 'poison-fact';
  readonly facts: readonly string[]; readonly detail: string;
  readonly constitutional?: Conflict;
}
export interface MachineKey {
  readonly id: string; readonly machine: string; readonly publicKey: string;
  readonly from: LineagePosition; readonly through?: LineagePosition; readonly compromisedAt?: LineagePosition;
}
export type FieldSchema = Readonly<
  | { kind: 'text'; maxLength: number }
  | { kind: 'integer' }
  | { kind: 'exact'; unit: string }
  | { kind: 'boolean' }
  | { kind: 'reference' }
  | { kind: 'capture' }
  | { kind: 'constitutional'; type: keyof Inventory }
  | { kind: 'owned'; owner: string; name: string }
>;
export interface FactSchema {
  readonly kind: string; readonly version: number; readonly fields: Readonly<Record<string, FieldSchema>>;
  readonly optional?: readonly string[]; readonly machineScope: 'shared';
  readonly standing: 'requester' | 'delegate' | 'operator'; readonly action: string;
  readonly scope: Scope; readonly causallyBound: boolean; readonly requiredReferences: readonly string[];
  readonly authority: 'none' | 'directive' | 'conferring';
}
export interface CapturedContent { readonly hash: Hash; readonly bytes: string | null; readonly status: CaptureStatus; readonly byteLength: number }
export interface RecordedGrant { readonly factId: string; readonly grant: StandingGrant }
export interface RecordedRevocation { readonly factId: string; readonly revocation: Revocation }
export interface TimeAnchor { readonly factId: string; readonly clock: Clock }
export interface FactContext {
  readonly site: string; readonly preserved: string; readonly decode: DecodeContext;
  readonly schemas: readonly FactSchema[]; readonly keys: readonly MachineKey[];
  readonly facts: readonly FactEnvelope[];
  readonly grants: readonly RecordedGrant[]; readonly revocations: readonly RecordedRevocation[];
  readonly historicalGrants?: readonly { readonly factId: string; readonly grant: HistoricalRead<StandingGrant> }[];
  readonly historicalRevocations?: readonly { readonly factId: string; readonly revocation: HistoricalRead<Revocation> }[];
  // Pinned installation data; governance of this trust root is the minimal-plane owner's port.
  readonly genesis: { readonly hash: Hash; readonly clock: Clock };
  readonly timeAnchors: readonly TimeAnchor[];
  readonly captures: Readonly<Record<string, CapturedContent>>;
  readonly folded: CausalFrontier;
  readonly migrations?: readonly { readonly kind: string; readonly from: number; readonly to: number; readonly migrate: (body: Json) => Json }[];
  readonly ownedBodies?: readonly import('./owned.js').OwnedBodyRegistration[];
}
export function contextBoundary(context: FactContext) {
  return { site: context.site, preserved: context.preserved, register: context.decode.register };
}
