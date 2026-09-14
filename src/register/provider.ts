import { consumeResult, decodeMeasurement } from '../index.js';
import type { Clock, DecodeContext, Json, Result, Scope } from '../index.js';
import { causalCone, decodeVersion, walkVersions } from '../facts/index.js';
import type { CausalFrontier, FactContext, FactEnvelope, FactSnapshot, FactStatus, FactStorePort, GovernedVersion,
  LandingReadPort } from '../facts/index.js';
import { foldProjection, readProjection } from '../projections/index.js';
import type { KnownLineage, ProjectedView, ProjectionDefinition } from '../projections/index.js';
import type { FactPositionVectorReference, FactReference, GenerationRecord, RegisterContext, SpineReadPort,
  VersionRowInput } from './types.js';
import type { WorkflowChecks } from './workflow.js';
import type { ShapeChangeBinding } from './shape-authority.js';
import type { CheckCatalog } from '../rulegraph/graph.js';
import { checked, encoding, exact, object, requireThat, take, text } from './boundary.js';
import { decodeGenerationRecord } from './generator.js';
import { decodeSemanticReviewRecord, semanticCoverage } from '../verification/index.js';

const REGISTER_VERSION_FACT = 'register-version-record';
const SHAPE_VERSION_FACT = 'register-shape-version-record';

/** Part Two owns every answer on this seam. Part Three has no local minting fallback. */
export interface PartTwoRegisterAuthorityPort {
  readonly owner: 'part-two';
  readonly verifyExtract: (rows: readonly VersionRowInput[], vector: FactPositionVectorReference,
    snapshot: FactSnapshot) => Result<FactPositionVectorReference>;
  readonly verifyShapeChange: (binding: ShapeChangeBinding, snapshot: FactSnapshot) => Result<FactReference>;
}
export interface PartTwoRegisterAuthorityOptions {
  readonly facts: FactContext;
  readonly scope: Scope;
  readonly landing: LandingReadPort;
  readonly context: RegisterContext;
}
export interface PartTwoRegisterHorizon {
  readonly lineages: Readonly<Record<string, KnownLineage>>;
  readonly stalenessBound: number;
}
export interface PartTwoRegisterProviderOptions {
  readonly store: FactStorePort;
  readonly authority: PartTwoRegisterAuthorityPort;
  readonly horizon: PartTwoRegisterHorizon;
  readonly context: RegisterContext;
  readonly types?: DecodeContext;
  readonly separations?: WorkflowChecks['separations'];
}
export type PartTwoRegisterProvider = SpineReadPort & Readonly<{
  verifyShapeChange(binding: ShapeChangeBinding): Result<FactReference>;
  resolveReference(reference: Readonly<{ provider: string; id: string; kind?: string }>): Result<boolean>;
  verifyRecord(reference: Readonly<{ id: string; kind: string }>, expected: unknown, now?: Clock): Result<boolean>;
  verifySemanticReview(review: CheckCatalog['semanticReviews'][number], now?: Clock): Result<boolean>;
  types?: DecodeContext;
  separations?: WorkflowChecks['separations'];
}>;

const producedAuthorities = new WeakSet<object>();

function healthy(status: FactStatus): boolean { return status.taint.length === 0 && status.conflicts.length === 0; }
function projection(snapshot: FactSnapshot, horizon: PartTwoRegisterHorizon, context: RegisterContext) {
  const kinds = [...new Set(snapshot.entries.map(status => status.fact.kind))].sort();
  const definition: ProjectionDefinition = { id: 'part-three.register-authority', class: 'authority-answering',
    stalenessBound: horizon.stalenessBound, retention: 'all-identities',
    decisions: Object.fromEntries(kinds.map(kind => [kind, { kind: 'ignores', reason: 'Part Two authority ports resolve the signed record' }])) };
  const view = take(foldProjection(definition, snapshot, { reference: context.types.register.generation, kinds, lineages: horizon.lineages }, context));
  requireThat(view.taint.length === 0 && view.conflicts.length === 0, 'Part Two authority snapshot is tainted or conflicted');
  return { definition, view };
}
function retracted(id: string, snapshot: FactSnapshot, view: ProjectedView, visiting = new Set<string>()): boolean {
  requireThat(!visiting.has(id), 'retraction cycle');
  const next = new Set(visiting).add(id);
  return view.retractions.some(retractionId => {
    const status = snapshot.entries.find(row => row.fact.id === retractionId);
    if (!status || !healthy(status)) return false;
    return object(status.body).target === id && !retracted(retractionId, snapshot, view, next);
  });
}
function active(status: FactStatus, snapshot: FactSnapshot, view: ProjectedView): boolean {
  if (!healthy(status) || retracted(status.fact.id, snapshot, view)
    || view.corrections.some(row => row.original === status.fact.id)) return false;
  const target = object(status.body).corrects;
  return typeof target !== 'string' || view.corrections.some(row => row.original === target && row.replacement === status.fact.id);
}
function activeStatus(id: string, snapshot: FactSnapshot, view: ProjectedView): FactStatus {
  const matches = snapshot.entries.filter(status => status.fact.id === id && active(status, snapshot, view));
  requireThat(matches.length === 1, `Part Two record ${id} is absent, retracted, corrected, conflicted, or duplicated`);
  return matches[0]!;
}
function exactFactReference(reference: FactReference, field: string): void {
  const value = object(reference); exact(value, ['owner', 'name', 'id']);
  requireThat(value.owner === 'part-two' && value.name === 'FactEnvelope', `${field} must be a part-two FactEnvelope`);
  text(value.id, `${field}.id`);
}
function recordBody(status: FactStatus): Json {
  if (status.body && typeof status.body === 'object' && !Array.isArray(status.body)) {
    const body = status.body as Readonly<Record<string, Json>>;
    if (Object.keys(body).length === 1 && Object.hasOwn(body, 'record')) return body.record!;
  }
  return status.body;
}

function evidenceUseClock(supplied: Clock | undefined, options: PartTwoRegisterProviderOptions): Clock | undefined {
  return supplied ?? options.types?.now ?? options.context.authorityTypes?.now ?? options.context.types.now;
}

function projectionUseClock(options: PartTwoRegisterProviderOptions, snapshot: FactSnapshot): Clock {
  const supplied = evidenceUseClock(undefined, options);
  if (supplied !== undefined)
    return take(decodeMeasurement('clock', supplied, options.types ?? options.context.types));
  const template = [...snapshot.entries].sort((a, b) => b.fact.at.value - a.fact.at.value)[0]?.fact.at;
  requireThat(template !== undefined, 'Part Two reference currentness requires an observed owner clock');
  const observed = Object.values(options.horizon.lineages).map(lineage => lineage.observedAt)
    .filter((value): value is number => value !== null && Number.isSafeInteger(value));
  const value = observed.length > 0 ? Math.max(...observed) : template.value;
  return take(decodeMeasurement('clock', { ...template, value, at: value }, options.types ?? options.context.types));
}

function witnessFor(reference: FactPositionVectorReference, snapshot: FactSnapshot): Readonly<{
  fact: FactEnvelope; ids: ReadonlySet<string>; frontier: CausalFrontier;
}> {
  const raw = object(reference); exact(raw, ['owner', 'name', 'id']);
  requireThat(raw.owner === 'part-two' && raw.name === 'FactPositionVector',
    'P3-NF-23: malformed FactPositionVector reference');
  const id = text(raw.id, 'vector.id');
  const matches = snapshot.entries.filter(status => status.fact.id === id && healthy(status));
  requireThat(matches.length === 1,
    'P3-NF-23: FactPositionVector does not name one admitted Part Two position witness');
  const fact = matches[0]!.fact;
  const facts = snapshot.entries.map(status => status.fact);
  const cone = [...causalCone(fact, facts), fact];
  const frontier: Record<string, { epoch: number; position: number }> = {};
  for (const row of cone) {
    const current = frontier[row.machine];
    if (!current || row.segment.epoch > current.epoch
      || row.segment.epoch === current.epoch && row.segment.position > current.position)
      frontier[row.machine] = { epoch: row.segment.epoch, position: row.segment.position };
  }
  return { fact, ids: new Set(cone.map(row => row.id)), frontier };
}

function versionContext(options: PartTwoRegisterAuthorityOptions, snapshot: FactSnapshot): FactContext {
  // The store snapshot is the current record. Context-carried facts are decode
  // dependencies only and may not substitute for a missing/truncated store row.
  return { ...options.facts, facts: snapshot.entries.map(status => status.fact) };
}
function decodeVersions(kind: typeof REGISTER_VERSION_FACT | typeof SHAPE_VERSION_FACT,
  options: PartTwoRegisterAuthorityOptions, snapshot: FactSnapshot, ids?: ReadonlySet<string>): readonly GovernedVersion[] {
  const context = versionContext(options, snapshot);
  const { view } = projection(snapshot, {
    lineages: Object.fromEntries([...new Set(snapshot.entries.map(status => status.fact.machine))]
      .map(machine => [machine, { head: null, observedAt: null, closed: true }])),
    stalenessBound: 1,
  }, options.context);
  const inputs = snapshot.entries.filter(status => status.fact.kind === kind && active(status, snapshot, view)
    && (!ids || ids.has(status.fact.id))).map(status => {
      const body = recordBody(status);
      if (typeof body !== 'string') return body;
      try { return JSON.parse(body) as Json; } catch { return body; }
    });
  const pending = [...inputs].sort((a, b) => encoding(a).bytes < encoding(b).bytes ? -1 : 1);
  const decoded: GovernedVersion[] = [];
  while (pending.length) {
    let progressed = false;
    for (let i = 0; i < pending.length;) {
      const result = consumeResult(decodeVersion(pending[i], context, options.scope, decoded, options.landing), {
        Success: value => value,
        Refused: () => undefined,
      });
      if (result) { decoded.push(result); pending.splice(i, 1); progressed = true; }
      else i++;
    }
    if (!progressed) take(decodeVersion(pending[0], context, options.scope, decoded, options.landing));
  }
  const walked = walkVersions(decoded);
  requireThat(walked.conflicts.length === 0, 'Part Two governed-version history is conflicted');
  // Keep the complete owner-decoded history here. Part Two's walker resolves
  // references through replay aliases; removing an alias before a later walk
  // turns a valid successor that names it into a false chain gap.
  return decoded;
}

function replayAliases(versions: readonly GovernedVersion[], duplicates: ReadonlySet<string>): ReadonlyMap<string, string> {
  const aliases = new Map<string, string>();
  const canonical: GovernedVersion[] = [];
  for (const version of [...versions].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    if (!duplicates.has(version.id)) { canonical.push(version); continue; }
    const original = canonical.find(row => row.subject === version.subject && row.contentHash === version.contentHash
      && row.approvedIn.id === version.approvedIn.id
      && encoding(row.supersedes).bytes === encoding(version.supersedes).bytes);
    requireThat(original !== undefined, `Part Two replay ${version.id} has no canonical identity`);
    aliases.set(version.id, original.id);
  }
  return aliases;
}

function reaches(actual: CausalFrontier, required: CausalFrontier): boolean {
  return Object.entries(required).every(([machine, position]) => {
    const held = actual[machine];
    return held !== undefined && (held.epoch > position.epoch
      || held.epoch === position.epoch && held.position >= position.position);
  });
}

function generationRecords(snapshot: FactSnapshot, view: ProjectedView, context: RegisterContext): readonly GenerationRecord[] {
  return snapshot.entries.filter(status => active(status, snapshot, view) && status.fact.kind === 'generation-record').flatMap(status => {
    try { return [take(decodeGenerationRecord(recordBody(status), context))]; }
    catch { return []; }
  });
}

/** The normal provider accepts only this landed Part Two version-chain adapter. */
export function createPartTwoRegisterAuthority(options: PartTwoRegisterAuthorityOptions): PartTwoRegisterAuthorityPort {
  const authority: PartTwoRegisterAuthorityPort = Object.freeze({
    owner: 'part-two',
    verifyExtract: (rows: readonly VersionRowInput[], vector: FactPositionVectorReference, snapshot: FactSnapshot) => checked<FactPositionVectorReference, RegisterContext>('PartTwoVersionExtract', { rows, vector }, options.context, raw => {
      const input = object(raw); const capturedRows = input.rows as unknown as readonly VersionRowInput[];
      const capturedVector = input.vector as unknown as FactPositionVectorReference;
      const witness = witnessFor(capturedVector, snapshot);
      const versions = decodeVersions(REGISTER_VERSION_FACT, options, snapshot, witness.ids);
      const walked = walkVersions(versions);
      const duplicates = new Set(walked.duplicates);
      const aliases = replayAliases(versions, duplicates);
      const current = new Set(walked.current.map(v => v.id));
      const expected = versions.filter(version => !duplicates.has(version.id)).map(version => {
        const content = object(version.content); const declared = content.status;
        requireThat(typeof declared === 'string', 'governed register content needs its declaration status');
        requireThat(version.landedIn !== null, 'register version requires its verified repository landing');
        return { id: version.subject, version: version.id,
          status: current.has(version.id) ? (declared === 'retired' ? 'retired' : 'live') : 'superseded',
          since: version.since, supersedes: version.supersedes.map(id => aliases.get(id) ?? id),
          approvedIn: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: version.approvedIn.id },
          landedIn: version.landedIn, base: version.base, contentHash: version.contentHash };
      }).sort((a, b) => a.version < b.version ? -1 : a.version > b.version ? 1 : 0);
      requireThat(encoding(capturedRows).bytes === encoding(expected).bytes,
        'P3-NF-23: extract is not the complete current Part Two version-chain answer');
      return capturedVector;
    }),
    verifyShapeChange: (binding: ShapeChangeBinding, snapshot: FactSnapshot) => checked<FactReference, RegisterContext>('PartTwoShapeVersion', binding, options.context, raw => {
      const captured = raw as unknown as ShapeChangeBinding;
      requireThat(captured.approval !== undefined, 'P3-NF-09: governed shape change requires approval');
      const versions = decodeVersions(SHAPE_VERSION_FACT, options, snapshot);
      const current = walkVersions(versions).current.filter(version => encoding(version.content).bytes === encoding(captured).bytes
        && version.approvedIn.id === captured.approval!.id);
      requireThat(current.length === 1, 'P3-NF-09: no unique current governed version approves this exact shape change');
      return { owner: 'part-two', name: 'FactEnvelope', id: current[0]!.approvedIn.id };
    }),
  });
  producedAuthorities.add(authority); return authority;
}
// Every call re-reads the verified FactStore. Workflow JSON can therefore
// neither assert authority nor keep a once-verified answer alive after repair.
export function createPartTwoRegisterProvider(options: PartTwoRegisterProviderOptions): PartTwoRegisterProvider {
  requireThat(producedAuthorities.has(options.authority),
    'normal register authority must come from createPartTwoRegisterAuthority and the landed Part Two version-chain decoder');
  requireThat(options.authority.owner === 'part-two', 'register authority seam must be owned by part two');
  requireThat(Number.isFinite(options.horizon.stalenessBound) && options.horizon.stalenessBound > 0,
    'Part Two register horizon needs a positive staleness bound');
  const read = () => take(options.store.readForProjection());
  let provider: PartTwoRegisterProvider;
  provider = {
    owner: 'part-two',
    ...(options.types ? { types: options.types } : {}),
    ...(options.separations ? { separations: options.separations } : {}),
    verifyExtract: extract => checked<FactPositionVectorReference, RegisterContext>('PartTwoRegisterExtractVerification', extract, options.context, raw => {
      const captured = raw as unknown as typeof extract;
      const snapshot = read(); projection(snapshot, options.horizon, options.context);
      witnessFor(captured.vector, snapshot);
      const answer = take(options.authority.verifyExtract(captured.rows, captured.vector, snapshot));
      requireThat(encoding(answer).bytes === encoding(captured.vector).bytes,
        'P3-NF-23: Part Two extract resolver returned a different vector');
      return answer;
    }),
    enteringForce: generation => checked<GenerationRecord, RegisterContext>('PartTwoRegisterEnteringForce', generation, options.context, raw => {
      const captured = raw as unknown as typeof generation;
      const snapshot = read(); const { view } = projection(snapshot, options.horizon, options.context);
      const matches = generationRecords(snapshot, view, options.context)
        .filter(record => record.generation.id === captured.id);
      const values = new Map(matches.map(record => [encoding(record).bytes, record]));
      requireThat(values.size === 1,
        'P3-NF-21: generation has no unique current entering-force fact; no single consistent value exists in the Part Two store');
      const witnessed = [...values.values()][0]!;
      requireThat(encoding(witnessed.generation).bytes === encoding(captured).bytes,
        'P3-NF-21: entering-force identity names a different generation');
      return witnessed;
    }),
    isCurrent: (reference, now) => checked<boolean, RegisterContext>('PartTwoRegisterCurrency', { reference, now }, options.context, raw => {
      const input = object(raw); const clock = take(decodeMeasurement('clock', input.now, options.types ?? options.context.types));
      const supplied = object(input.reference!); exact(supplied, ['owner', 'name', 'id']);
      requireThat(supplied.owner === 'part-two' && supplied.name === 'FactPositionVector' && typeof supplied.id === 'string' && supplied.id.length > 0,
        'P3-NF-23: malformed FactPositionVector reference');
      const snapshot = read(); const { definition, view } = projection(snapshot, options.horizon, options.context);
      const witness = witnessFor(input.reference as unknown as FactPositionVectorReference, snapshot);
      return consumeResult(readProjection(view, definition, clock, options.context), {
        Success: answer => answer.stale.length === 0
          && consumeResult(readProjection(view, definition, clock, options.context, witness.frontier), {
            Success: () => true, Refused: () => false,
          })
          // A fresh replica does not make every historical extract current.
          // Once an entering-force record's freshness window expires, the
          // requested horizon must reach the vector carried by that record.
          && generationRecords(snapshot, view, options.context).every(record =>
            clock.value - record.at.value <= options.horizon.stalenessBound
            || reaches(witness.frontier, witnessFor(record.generation.vector, snapshot).frontier)),
        Refused: () => false,
      });
    }),
    revalidateLoaded: (extract, generation, now) => checked<boolean, RegisterContext>('PartTwoLoadedRegisterRevalidation',
      { extract, generation, now }, options.context, raw => {
        const input = object(raw); const capturedExtract = input.extract as unknown as typeof extract;
        const capturedGeneration = input.generation as unknown as typeof generation;
        const capturedNow = input.now as unknown as Clock;
        take(provider.verifyExtract(capturedExtract)); take(provider.enteringForce(capturedGeneration));
        requireThat(take(provider.isCurrent(capturedExtract.vector, capturedNow)), 'loaded register vector is no longer current');
        return true;
      }),
    verifyShapeChange: binding => checked<FactReference, RegisterContext>('PartTwoShapeChangeApproval', binding, options.context, raw => {
      const captured = raw as unknown as ShapeChangeBinding;
      const snapshot = read(); projection(snapshot, options.horizon, options.context);
      requireThat(captured.approval !== undefined, 'P3-NF-09: governed shape change requires a Part Two approval reference');
      exactFactReference(captured.approval, 'shape approval');
      const approval = take(options.authority.verifyShapeChange(captured, snapshot)); exactFactReference(approval, 'shape approval witness');
      requireThat(encoding(approval).bytes === encoding(captured.approval).bytes,
        'P3-NF-09: Part Two approval resolver returned a different record');
      return approval;
    }),
    resolveReference: reference => checked<boolean, RegisterContext>('PartTwoRegisterReference', reference, options.context, raw => {
      const requested = object(raw); exact(requested, ['provider', 'id', 'kind']);
      requireThat(requested.provider === 'record', 'external reference namespace is not the Part Two record provider');
      const id = text(requested.id, 'reference.id');
      const snapshot = read(); const { definition, view } = projection(snapshot, options.horizon, options.context);
      const clock = projectionUseClock(options, snapshot);
      take(readProjection(view, definition, clock, options.context));
      const status = activeStatus(id, snapshot, view);
      if (requested.kind !== undefined) requireThat(status.fact.kind === text(requested.kind, 'reference.kind'), 'record reference kind differs');
      return true;
    }),
    verifyRecord: (reference, expected, now) => checked<boolean, RegisterContext>('PartTwoRegisterRecord',
      { reference, expected, now: evidenceUseClock(now, options) }, options.context, raw => {
      const input = object(raw); const requested = object(input.reference!); exact(requested, ['id', 'kind']);
      const id = text(requested.id, 'reference.id'), kind = text(requested.kind, 'reference.kind');
      const clock = take(decodeMeasurement('clock', input.now, options.types ?? options.context.types));
      const snapshot = read(); const { definition, view } = projection(snapshot, options.horizon, options.context);
      take(readProjection(view, definition, clock, options.context));
      const matches = snapshot.entries.filter(status => active(status, snapshot, view)
        && status.fact.kind === kind
        && (status.fact.id === id || (() => {
          const body = recordBody(status);
          if (body === null || typeof body !== 'object' || Array.isArray(body)) return false;
          const record = body as Readonly<Record<string, Json>>;
          return Object.hasOwn(record, 'id') && record.id === id;
        })()));
      const values = new Map(matches.map(status => {
        const body = recordBody(status); return [encoding(body).bytes, body];
      }));
      requireThat(values.size === 1,
        `Part Two record ${id} is absent, retracted, corrected, conflicted, duplicated, or has inconsistent owned values`);
      requireThat(encoding([...values.values()][0]).bytes === encoding(input.expected).bytes,
        `Part Two record ${id} differs from workflow evidence`);
      return true;
    }),
    verifySemanticReview: (review, now) => checked<boolean, RegisterContext>('PartTwoSemanticReview',
      { review, now: evidenceUseClock(now, options) }, options.context, raw => {
      const input = object(raw); const captured = object(input.review!);
      exact(captured, ['holder', 'rule', 'generation', 'subjectHash', 'record']);
      const holder = text(captured.holder, 'review.holder');
      const rule = captured.rule; requireThat(typeof rule === 'number' && Number.isSafeInteger(rule) && rule > 0,
        'review.rule: expected positive integer');
      const generation = text(captured.generation, 'review.generation');
      const subjectHash = text(captured.subjectHash, 'review.subjectHash');
      const reviewRecord = text(captured.record, 'review.record');
      const clock = take(decodeMeasurement('clock', input.now, options.types ?? options.context.types));
      const snapshot = read(); const { definition, view } = projection(snapshot, options.horizon, options.context);
      take(readProjection(view, definition, clock, options.context));
      const status = activeStatus(reviewRecord, snapshot, view);
      requireThat(status.fact.kind === 'verification-SemanticReviewRecord', 'semantic review reference kind differs');
      const record = take(decodeSemanticReviewRecord(recordBody(status), options.context));
      const edge = `rule:${rule}->${holder}`;
      requireThat(record.generation === generation && record.edge === edge
        && record.holderHash === subjectHash,
      'signed semantic review does not bind this exact holder/rule/generation/subject');
      const answer = semanticCoverage([{ edge, generation, firstSeen: 0 }],
        [record], { snapshot })[0];
      requireThat(answer?.reviewed === true && answer.verdict === 'adequate',
        'Part Nine reports this semantic review incomplete or non-current');
      return true;
    }),
  };
  return Object.freeze(provider);
}
