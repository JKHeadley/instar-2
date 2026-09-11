import type { Clock, DecodeContext, Json, Result } from '../index.js';
import type { FactSnapshot, FactStatus, FactStorePort } from '../facts/index.js';
import { foldProjection, readProjection } from '../projections/index.js';
import type { KnownLineage, ProjectionDefinition } from '../projections/index.js';
import type { FactReference, GenerationRecord, RegisterContext, SpineReadPort } from './types.js';
import type { WorkflowChecks } from './workflow.js';
import type { ShapeChangeBinding } from './shape-authority.js';
import { checked, encoding, object, requireThat, take } from './boundary.js';
import { decodeGenerationRecord } from './generator.js';

export interface PartTwoRegisterHorizon {
  readonly lineages: Readonly<Record<string, KnownLineage>>;
  readonly stalenessBound: number;
}
export interface PartTwoRegisterProviderOptions {
  readonly store: FactStorePort;
  readonly horizon: PartTwoRegisterHorizon;
  readonly context: RegisterContext;
  readonly types?: DecodeContext;
  readonly separations?: WorkflowChecks['separations'];
}
export type PartTwoRegisterProvider = SpineReadPort & Readonly<{
  verifyShapeChange(binding: ShapeChangeBinding): Result<FactReference>;
  resolveReference(reference: Readonly<{ provider: string; id: string }>): Result<boolean>;
  types?: DecodeContext;
  separations?: WorkflowChecks['separations'];
}>;

function healthy(status: FactStatus): boolean { return status.taint.length === 0 && status.conflicts.length === 0; }
function projection(snapshot: FactSnapshot, horizon: PartTwoRegisterHorizon, context: RegisterContext) {
  const kinds = [...new Set(snapshot.entries.map(status => status.fact.kind))].sort();
  const definition: ProjectionDefinition = { id: 'part-three.register-authority', class: 'authority-answering',
    stalenessBound: horizon.stalenessBound, retention: 'all-identities',
    decisions: Object.fromEntries(kinds.map(kind => [kind, { kind: 'ignores', reason: 'register provider resolves signed records directly' }])) };
  const view = take(foldProjection(definition, snapshot, { reference: context.types.register.generation, kinds, lineages: horizon.lineages }, context));
  return { definition, view };
}
function vector(snapshot: FactSnapshot, horizon: PartTwoRegisterHorizon, context: RegisterContext) {
  const { view } = projection(snapshot, horizon, context);
  const body = { type: 'FactPositionVector', schemaVersion: 1, foldedThrough: view.foldedThrough, knownLineages: view.knownLineages };
  return { owner: 'part-two' as const, name: 'FactPositionVector' as const, id: encoding(body).hash };
}
function current(snapshot: FactSnapshot, horizon: PartTwoRegisterHorizon, now: Clock, context: RegisterContext): boolean {
  try {
    const { definition, view } = projection(snapshot, horizon, context);
    if (Object.keys(view.foldedThrough).some(machine => !Object.hasOwn(horizon.lineages, machine))) return false;
    take(readProjection(view, definition, now, context)); return true;
  } catch { return false; }
}
function factReference(status: FactStatus): FactReference {
  return { owner: 'part-two', name: 'FactEnvelope', id: status.fact.id };
}
function bodyMatches(status: FactStatus, kind: string, expected: Json): boolean {
  return healthy(status) && status.fact.kind === kind && encoding(recordBody(status)).bytes === encoding(expected).bytes;
}
function recordBody(status: FactStatus): Json {
  if (status.body && typeof status.body === 'object' && !Array.isArray(status.body)) {
    const body = status.body as Readonly<Record<string, Json>>;
    if (Object.keys(body).length === 1 && Object.hasOwn(body, 'record')) return body.record!;
  }
  return status.body;
}

// This adapter never accepts authority facts, vectors, or freshness booleans
// from workflow JSON. Every answer is re-derived from the current verified
// FactStore projection and the P2 known-lineage horizon at the call boundary.
export function createPartTwoRegisterProvider(options: PartTwoRegisterProviderOptions): PartTwoRegisterProvider {
  const read = () => take(options.store.readForProjection());
  const provider: PartTwoRegisterProvider = {
    owner: 'part-two',
    ...(options.types ? { types: options.types } : {}),
    ...(options.separations ? { separations: options.separations } : {}),
    verifyExtract: extract => checked<FactReference, RegisterContext>('PartTwoRegisterExtractVerification', extract, options.context, () => {
      const snapshot = read();
      requireThat(encoding(extract.vector).bytes === encoding(vector(snapshot, options.horizon, options.context)).bytes, 'P3-NF-23: extract vector is not the current verified P2 vector');
      const expected = { type: 'ChainExtractRecord', schemaVersion: 1, extract } as unknown as Json;
      const matches = snapshot.entries.filter(status => bodyMatches(status, 'chain-extract-record', expected));
      requireThat(matches.length === 1, 'P3-NF-23: extract has no unique current Part Two record');
      return factReference(matches[0]!);
    }),
    enteringForce: generation => checked<GenerationRecord, RegisterContext>('PartTwoRegisterEnteringForce', generation, options.context, () => {
      const snapshot = read();
      const matches = snapshot.entries.filter(status => healthy(status) && status.fact.kind === 'generation-record').flatMap(status => {
        try {
          const record = take(decodeGenerationRecord(recordBody(status), options.context));
          return encoding(record.generation).bytes === encoding(generation).bytes ? [record] : [];
        } catch { return []; }
      });
      requireThat(matches.length === 1, 'P3-NF-21: generation has no unique entering-force fact in the Part Two store');
      return matches[0]!;
    }),
    isCurrent: (reference, now) => checked<boolean, RegisterContext>('PartTwoRegisterCurrency', { reference, now }, options.context, () => {
      const snapshot = read();
      return encoding(reference).bytes === encoding(vector(snapshot, options.horizon, options.context)).bytes
        && current(snapshot, options.horizon, now, options.context);
    }),
    verifyShapeChange: binding => checked<FactReference, RegisterContext>('PartTwoShapeChangeApproval', binding, options.context, () => {
      const snapshot = read();
      const expected = { type: 'ShapeChangeApproval', schemaVersion: 1, binding } as unknown as Json;
      const matches = snapshot.entries.filter(status => status.fact.id === binding.approval.id
        && bodyMatches(status, 'shape-change-approval', expected));
      requireThat(matches.length === 1, 'P3-NF-09: no current Part Two approval binds this exact shape-change document');
      return factReference(matches[0]!);
    }),
    resolveReference: reference => checked<boolean, RegisterContext>('PartTwoRegisterReference', reference, options.context, () => {
      const status = read().entries.find(status => status.fact.id === reference.id);
      return !!status && healthy(status);
    }),
  };
  return Object.freeze(provider);
}
