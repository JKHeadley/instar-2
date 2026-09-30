// Rules 7/26/31/33/82/90; P2-NF-38..45, P2-NF-71. The verified spine read part three's
// register consumes: the canonical chain extraction, the entering-force lookup, and vector
// currency. Approval is the authority and is verified here as a recorded explicit yes;
// landing is only a locator. Every association is bound to the signed envelope that recorded
// its payload. Nothing here appends, approves, or mints a position.
import { isExplicitYes } from '../index.js';
import type { Clock, FactEnvelopeReference, Json, Result } from '../index.js';
import { boundary, encoding, integer, object, requireFact, string, take } from './boundary.js';
import type { ConflictClass, FactContext, FactEnvelope } from './contracts.js';
import { contextBoundary } from './contracts.js';
import { walkVersions } from './version-chain.js';
import type { GovernedVersion } from './version-chain.js';

/** A governing version as the spine holds it: the decoded version and the fact that appended it. */
export interface RecordedVersion { readonly factId: string; readonly version: GovernedVersion }
/** The explicit-yes record behind an approval: which fact recorded that `Authorization`. */
export interface RecordedApproval { readonly factId: string; readonly authorizationId: string }
/** An appended generation record (part three's shape), with the fact that appended it. */
export interface RecordedGeneration { readonly factId: string; readonly record: Json }
export interface GoverningSpine {
  /** The fact the empty position rests on: this installation's genesis. */
  readonly anchor: string;
  /** Recorded governing versions in spine order. Every prefix of this list is a position. */
  readonly versions: readonly RecordedVersion[];
  readonly approvals: readonly RecordedApproval[];
  readonly generations: readonly RecordedGeneration[];
  /** Declared bound on how far a consumed extract may trail the newest entering-force record. */
  readonly stalenessBoundMs: number;
}
export interface ChainExtraction {
  /** The fact-position vector this extraction is pinned at, derived from the included facts. */
  readonly vector: string;
  /** The fact envelope at that position — what verification of this extract rests on. */
  readonly position: string;
  /** The part-three `ChainExtract` shape, as data: the repository mirrors these bytes. */
  readonly extract: Json;
  /** Open governing forks. The incumbent stays in force; neither contender is extracted. */
  readonly conflicts: readonly ConflictClass[];
}
/** Structurally part three's `SpineReadPort`; the generation-record decoder is supplied. */
export interface RegisterSpinePort<R> {
  readonly owner: 'part-two';
  readonly verifyExtract: (extract: unknown) => Result<FactEnvelopeReference>;
  readonly enteringForce: (generation: unknown) => Result<R>;
  readonly isCurrent: (vector: unknown, now: Clock) => Result<boolean>;
}

/**
 * What a spine record's fact must carry: a `governing-record` envelope whose signed body
 * commits to the exact payload it recorded. A fact id alone proves nothing about a payload.
 */
export const governingRecordKind = 'governing-record';
export type GoverningRecordRole = 'approval' | 'version' | 'generation';
export function governingRecordBody(role: GoverningRecordRole, payload: unknown): Json {
  return { role, hash: encoding(payload as Json).hash };
}
function recordedBy(byId: ReadonlyMap<string, FactEnvelope>, factId: unknown, role: GoverningRecordRole,
  payload: unknown, missing: string, code: 'integrity' | 'standing' = 'integrity'): void {
  const fact = typeof factId === 'string' ? byId.get(factId) : undefined;
  requireFact(fact, missing, code);
  requireFact(fact.kind === governingRecordKind
    && encoding(fact.body).bytes === encoding(governingRecordBody(role, payload)).bytes,
  `fact ${fact.id} does not record this ${role}`, 'integrity');
}
/** The empty position rests on this installation's genesis: the first fact of its segment. */
function genesisAnchor(spine: GoverningSpine, context: FactContext): string {
  const anchor = context.facts.find(f => f.id === string(spine.anchor, 'anchor'));
  requireFact(anchor && anchor.predecessors.inSegment === null && anchor.prevInSegment === context.genesis.hash,
    `spine anchor is not a recorded genesis fact: ${spine.anchor}`, 'integrity');
  return anchor.id;
}
/** A position names the exact facts it includes, so a vector cannot be asserted by a caller. */
export function positionVector(factIds: readonly string[]): string {
  return `vector:${encoding({ name: 'FactPositionVector', schemaVersion: 1, facts: factIds }).hash.slice(7)}`;
}
function retired(content: Json): boolean {
  return content !== null && typeof content === 'object' && !Array.isArray(content)
    && (content as Record<string, Json>).status === 'retired';
}
function positionOf(spine: GoverningSpine, context: FactContext, count: number): string {
  const anchor = genesisAnchor(spine, context);
  return count === 0 ? anchor : string(spine.versions[count - 1]!.factId, 'version.factId');
}
function extractionAt(spine: GoverningSpine, context: FactContext, count: number): ChainExtraction {
  requireFact(Number.isSafeInteger(count) && count >= 0 && count <= spine.versions.length, 'position outside the recorded spine');
  requireFact(integer(spine.stalenessBoundMs, 'stalenessBoundMs') >= 0, 'declared staleness bound required');
  const recorded = spine.versions.slice(0, count);
  const byId = new Map(context.facts.map(f => [f.id, f]));
  const approvals = new Map(spine.approvals.map(a => [a.authorizationId, a.factId]));
  const versions: GovernedVersion[] = [];
  for (const { factId, version } of recorded) {
    recordedBy(byId, factId, 'version', version, `version fact not recorded: ${factId}`);
    requireFact(byId.has(version.since), `entering-force fact not recorded: ${version.since}`, 'integrity');
    // Verify the state, not the symbol: a merge event and a channel-attested record are not a yes.
    const yes = version.approvedIn.explicitYes;
    requireFact(isExplicitYes(yes),
      `approvedIn must be a verified explicit yes, never a merge event: ${version.id}`, 'standing');
    recordedBy(byId, approvals.get(version.approvedIn.id), 'approval', version.approvedIn,
      `explicit-yes record not recorded for approval ${version.approvedIn.id}`, 'standing');
    requireFact(version.landedIn !== null, `register history needs a repository landing: ${version.id}`);
    // A replay recorded by a second fact is the same version: one history row, never zero.
    if (!versions.some(v => v.id === version.id)) versions.push(version);
  }
  // Every recorded version reaches the walker, so a changed same-id version is refused, not dropped.
  const walked = walkVersions(recorded.map(r => r.version));
  const resolve = (id: string) => walked.collapsed[id] ?? id;
  const retainedList = versions.filter(v => !Object.hasOwn(walked.collapsed, v.id));
  const retained = new Map(retainedList.map(v => [v.id, v]));
  const replaced = new Set(retainedList.flatMap(v => v.supersedes.map(resolve)));
  const included: GovernedVersion[] = [];
  for (const subject of new Set(retainedList.map(v => v.subject))) {
    const members = retainedList.filter(v => v.subject === subject);
    const heads = members.filter(v => !replaced.has(v.id));
    if (heads.length <= 1) { included.push(...members); continue; }
    // A fork degrades to the already-reviewed state: the incumbent and its ancestors only.
    const incumbent = walked.current.find(v => v.subject === subject);
    requireFact(incumbent, `fork over ${subject} has no reviewed incumbent`);
    const keep = new Map<string, GovernedVersion>();
    const walk = (v: GovernedVersion) => {
      if (keep.has(v.id)) return;
      keep.set(v.id, v);
      for (const parent of v.supersedes) walk(retained.get(resolve(parent))!);
    };
    walk(incumbent);
    included.push(...keep.values());
  }
  const ids = new Set(included.map(v => v.id));
  const supersededHere = new Set(included.flatMap(v => v.supersedes.map(resolve)));
  const rows = included.map(v => {
    const supersedes = v.supersedes.map(resolve);
    for (const parent of supersedes) requireFact(ids.has(parent), `extracted supersedes does not resolve: ${parent}`);
    return { id: v.subject, version: v.id,
      status: supersededHere.has(v.id) ? 'superseded' : retired(v.content) ? 'retired' : 'live',
      since: v.since, supersedes, approvedIn: { owner: 'part-two', name: 'FactEnvelope', id: approvals.get(v.approvedIn.id)! },
      landedIn: v.landedIn!, base: v.base, contentHash: v.contentHash };
  }).sort((a, b) => a.version < b.version ? -1 : a.version > b.version ? 1 : 0);
  const vector = positionVector(recorded.map(r => r.factId));
  return { vector, position: positionOf(spine, context, count), conflicts: walked.conflicts,
    extract: { type: 'ChainExtract', schemaVersion: 1,
      vector: { owner: 'part-two', name: 'FactPositionVector', id: vector }, rows } as unknown as Json };
}
/**
 * The actual extraction: the canonical chain extract the landing machinery mirrors beside the
 * register, derived from the verified spine rather than from git ancestry or a merge.
 */
export function extractGovernedChain(spine: GoverningSpine, context: FactContext,
  through: number = spine.versions.length): Result<ChainExtraction> {
  return boundary('ChainExtraction', null, contextBoundary(context), () => extractionAt(spine, context, through));
}
function anchorOf(record: Json) {
  const r = object(record);
  requireFact(r.type === 'GenerationRecord' && r.schemaVersion === 1, 'expected a recorded generation record');
  const generation = object(r.generation!);
  requireFact(generation.type === 'RegisterGeneration' && generation.schemaVersion === 1, 'expected a recorded register generation');
  const vector = object(generation.vector!);
  requireFact(vector.owner === 'part-two' && vector.name === 'FactPositionVector', 'generation must name a part-two vector');
  return { generation: r.generation!, vector: string(vector.id, 'generation.vector.id'), at: integer(object(r.at!).value, 'record.at.value') };
}
/**
 * The register/landing provider's read side. Every answer is derived from recorded facts; a
 * question the spine cannot answer from them is refused, never softened into a yes.
 */
export function createRegisterSpine<R>(spine: GoverningSpine, context: FactContext,
  decodeRecord: (record: Json) => Result<R>): RegisterSpinePort<R> {
  const byId = new Map(context.facts.map(f => [f.id, f]));
  const recordedGeneration = (g: RecordedGeneration) =>
    recordedBy(byId, g.factId, 'generation', g.record, `generation fact not recorded: ${g.factId}`);
  const positions = () => {
    const found = new Map<string, number>();
    for (let n = spine.versions.length; n >= 0; n--) found.set(positionVector(spine.versions.slice(0, n).map(r => r.factId)), n);
    return found;
  };
  const anchors = () => spine.generations.map(g => { recordedGeneration(g); return anchorOf(g.record); });
  return {
    owner: 'part-two',
    verifyExtract: extract => boundary('ExtractVerification', null, contextBoundary(context), () => {
      const supplied = object(extract as Json);
      const id = string(object(supplied.vector!).id, 'extract.vector.id');
      const count = positions().get(id);
      requireFact(count !== undefined, 'extract vector names no recorded spine position', 'integrity');
      const derived = extractionAt(spine, context, count);
      requireFact(encoding(supplied).bytes === encoding(derived.extract).bytes,
        'extract differs from the verified chain at its own position', 'integrity');
      return { owner: 'part-two', name: 'FactEnvelope', id: derived.position } as FactEnvelopeReference;
    }),
    enteringForce: generation => boundary('EnteringForceLookup', null, contextBoundary(context), () => {
      const wanted = encoding(generation).bytes;
      const matched = spine.generations.filter(g => encoding(anchorOf(g.record).generation).bytes === wanted);
      requireFact(matched.length > 0, 'no entering-force record anchors this generation', 'integrity');
      requireFact(new Set(matched.map(g => encoding(g.record).bytes)).size === 1,
        'conflicting entering-force records for one generation', 'integrity');
      const found = matched[0]!;
      recordedGeneration(found);
      return take(decodeRecord(found.record));
    }),
    isCurrent: (vector, now) => boundary('ExtractCurrency', null, contextBoundary(context), () => {
      const v = object(vector as Json);
      requireFact(v.owner === 'part-two' && v.name === 'FactPositionVector', 'expected a part-two fact-position vector');
      const id = string(v.id, 'vector.id');
      const records = anchors();
      requireFact(records.length > 0, 'the spine holds no entering-force record', 'integrity');
      const pinned = records.filter(r => r.vector === id);
      requireFact(pinned.length > 0, 'extract vector matches no recorded entering-force position', 'integrity');
      const at = pinned.reduce((a, b) => b.at > a.at ? b : a).at;
      const newest = records.reduce((a, b) => b.at > a.at ? b : a).at;
      requireFact(now.value >= at, 'extract position is newer than the consuming clock', 'integrity');
      return newest - at <= spine.stalenessBoundMs;
    }),
  };
}
