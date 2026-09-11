import { consumeResult, decodeMeasurement } from '../index.js';
import type { Clock, DecodeContext, Json, Result } from '../index.js';
import type { FactSnapshot, FactStatus, FactStorePort } from '../facts/index.js';
import { foldProjection, readProjection } from '../projections/index.js';
import type { KnownLineage, ProjectedView, ProjectionDefinition } from '../projections/index.js';
import type { FactPositionVectorReference, FactReference, GenerationRecord, RegisterContext, SpineReadPort,
  VersionRowInput } from './types.js';
import type { WorkflowChecks } from './workflow.js';
import type { ShapeChangeBinding } from './shape-authority.js';
import { checked, encoding, exact, object, requireThat, take, text } from './boundary.js';
import { decodeGenerationRecord } from './generator.js';

/** Part Two owns every answer on this seam. Part Three has no local minting fallback. */
export interface PartTwoRegisterAuthorityPort {
  readonly owner: 'part-two';
  readonly vector: FactPositionVectorReference;
  readonly verifyVersionRow: (row: VersionRowInput, snapshot: FactSnapshot) => Result<Readonly<{
    since: FactReference; approval: FactReference; landing: FactReference;
  }>>;
  readonly verifyShapeChange: (binding: ShapeChangeBinding, snapshot: FactSnapshot) => Result<FactReference>;
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
  types?: DecodeContext;
  separations?: WorkflowChecks['separations'];
}>;

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
  return healthy(status) && !retracted(status.fact.id, snapshot, view)
    && !view.corrections.some(row => row.original === status.fact.id);
}
function activeStatus(id: string, snapshot: FactSnapshot, view: ProjectedView): FactStatus {
  const matches = snapshot.entries.filter(status => status.fact.id === id && active(status, snapshot, view));
  requireThat(matches.length === 1, `Part Two record ${id} is absent, retracted, corrected, conflicted, or duplicated`);
  return matches[0]!;
}
function factReference(status: FactStatus): FactReference {
  return { owner: 'part-two', name: 'FactEnvelope', id: status.fact.id };
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
// Every call re-reads the verified FactStore. Workflow JSON can therefore
// neither assert authority nor keep a once-verified answer alive after repair.
export function createPartTwoRegisterProvider(options: PartTwoRegisterProviderOptions): PartTwoRegisterProvider {
  requireThat(options.authority.owner === 'part-two', 'register authority seam must be owned by part two');
  requireThat(options.authority.vector.owner === 'part-two' && options.authority.vector.name === 'FactPositionVector'
    && options.authority.vector.id.length > 0, 'Part Two must supply its own FactPositionVector reference');
  requireThat(Number.isFinite(options.horizon.stalenessBound) && options.horizon.stalenessBound > 0,
    'Part Two register horizon needs a positive staleness bound');
  const read = () => take(options.store.readForProjection());
  let provider: PartTwoRegisterProvider;
  provider = {
    owner: 'part-two',
    ...(options.types ? { types: options.types } : {}),
    ...(options.separations ? { separations: options.separations } : {}),
    verifyExtract: extract => checked<FactPositionVectorReference, RegisterContext>('PartTwoRegisterExtractVerification', extract, options.context, () => {
      const snapshot = read(); const { view } = projection(snapshot, options.horizon, options.context);
      requireThat(encoding(extract.vector).bytes === encoding(options.authority.vector).bytes,
        'P3-NF-23: extract vector is not the current owner-produced P2 vector');
      for (const row of extract.rows) {
        const witnesses = take(options.authority.verifyVersionRow(row, snapshot));
        exactFactReference(witnesses.since, 'version-row since witness');
        exactFactReference(witnesses.approval, 'version-row approval witness');
        exactFactReference(witnesses.landing, 'version-row landing witness');
        exactFactReference(row.approvedIn, 'extract approval');
        requireThat(row.since === witnesses.since.id && row.approvedIn.id === witnesses.approval.id
          && row.landedIn === witnesses.landing.id, 'P3-NF-23: Part Two witnesses differ from the extract row');
        for (const witness of [witnesses.since, witnesses.approval, witnesses.landing]) activeStatus(witness.id, snapshot, view);
      }
      return options.authority.vector;
    }),
    enteringForce: generation => checked<GenerationRecord, RegisterContext>('PartTwoRegisterEnteringForce', generation, options.context, () => {
      const snapshot = read(); const { view } = projection(snapshot, options.horizon, options.context);
      const matches = snapshot.entries.filter(status => active(status, snapshot, view) && status.fact.kind === 'generation-record').flatMap(status => {
        try {
          const record = take(decodeGenerationRecord(recordBody(status), options.context));
          return encoding(record.generation).bytes === encoding(generation).bytes ? [record] : [];
        } catch { return []; }
      });
      requireThat(matches.length === 1, 'P3-NF-21: generation has no unique current entering-force fact in the Part Two store');
      return matches[0]!;
    }),
    isCurrent: (reference, now) => checked<boolean, RegisterContext>('PartTwoRegisterCurrency', { reference, now }, options.context, raw => {
      const input = object(raw); const clock = take(decodeMeasurement('clock', input.now, options.types ?? options.context.types));
      const supplied = object(input.reference!); exact(supplied, ['owner', 'name', 'id']);
      requireThat(supplied.owner === 'part-two' && supplied.name === 'FactPositionVector' && typeof supplied.id === 'string' && supplied.id.length > 0,
        'P3-NF-23: malformed FactPositionVector reference');
      const snapshot = read(); const { definition, view } = projection(snapshot, options.horizon, options.context);
      if (encoding(reference).bytes !== encoding(options.authority.vector).bytes) return false;
      return consumeResult(readProjection(view, definition, clock, options.context), {
        Success: answer => answer.stale.length === 0,
        Refused: () => false,
      });
    }),
    revalidateLoaded: (extract, generation, now) => checked<boolean, RegisterContext>('PartTwoLoadedRegisterRevalidation',
      { extract, generation, now }, options.context, () => {
        take(provider.verifyExtract(extract)); take(provider.enteringForce(generation));
        requireThat(take(provider.isCurrent(extract.vector, now)), 'loaded register vector is no longer current');
        return true;
      }),
    verifyShapeChange: binding => checked<FactReference, RegisterContext>('PartTwoShapeChangeApproval', binding, options.context, () => {
      const snapshot = read(); const { view } = projection(snapshot, options.horizon, options.context);
      requireThat(binding.approval !== undefined, 'P3-NF-09: governed shape change requires a Part Two approval reference');
      exactFactReference(binding.approval, 'shape approval');
      const approval = take(options.authority.verifyShapeChange(binding, snapshot)); exactFactReference(approval, 'shape approval witness');
      requireThat(encoding(approval).bytes === encoding(binding.approval).bytes,
        'P3-NF-09: Part Two approval resolver returned a different record');
      return factReference(activeStatus(approval.id, snapshot, view));
    }),
    resolveReference: reference => checked<boolean, RegisterContext>('PartTwoRegisterReference', reference, options.context, raw => {
      const requested = object(raw); exact(requested, ['provider', 'id', 'kind']);
      requireThat(requested.provider === 'record', 'external reference namespace is not the Part Two record provider');
      const id = text(requested.id, 'reference.id');
      const snapshot = read(); const { view } = projection(snapshot, options.horizon, options.context);
      const status = activeStatus(id, snapshot, view);
      if (requested.kind !== undefined) requireThat(status.fact.kind === text(requested.kind, 'reference.kind'), 'record reference kind differs');
      return true;
    }),
  };
  return Object.freeze(provider);
}
