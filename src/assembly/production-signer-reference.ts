import { decode } from '../index.js';
import type { Result, Scope, SecretRef } from '../index.js';
import { authorAndAppend, decodeEnvelope, registerOwnedBody } from '../facts/index.js';
import type { FactEnvelope, FactSchema, OwnedBodyContext, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';
import { historicalReuseKey, installationRecordAuthor, installationRecordBasis } from './installation-selection.js';
import type { InstallationRecordAdmission, InstallationRecordWriter } from './installation-selection.js';
import { isVerifiedProductionBootstrap } from './production-installation-loader.js';
import type { VerifiedProductionBootstrap } from './production-installation-loader.js';

export interface ProductionSignerReference {
  readonly type: 'ProductionSignerReference'; readonly schemaVersion: 1; readonly id: string;
  readonly installation: string; readonly machine: string; readonly signer: SecretRef;
  readonly keySet: string; readonly generation: string; readonly bootstrapDigest: string;
}
export interface ProductionSignerAdmission extends InstallationRecordAdmission {
  readonly bootstrap: VerifiedProductionBootstrap;
}
const text: OwnedShape = { kind: 'text', maxLength: 4096 };
const shape = { kind: 'object', fields: {
  type: text, schemaVersion: { kind: 'integer' }, id: text, installation: text, machine: text,
  signer: { kind: 'object', fields: { type: text, schemaVersion: { kind: 'integer' }, vault: text, name: text } },
  keySet: text, generation: text, bootstrapDigest: text,
} } satisfies OwnedShape;
const active = new WeakMap<ProductionSignerAdmission, string>();
function closed(input: unknown, admission: ProductionSignerAdmission): ProductionSignerReference {
  ensure(isVerifiedProductionBootstrap(admission.bootstrap), 'signer: independently verified external bootstrap required');
  const record = JSON.parse(encoded(input).bytes) as ProductionSignerReference;
  ensure(record && typeof record === 'object' && !Array.isArray(record)
    && Object.keys(record).sort().join(',') === Object.keys(shape.fields).sort().join(','), 'signer: closed reference required');
  ensure(record.type === 'ProductionSignerReference' && record.schemaVersion === 1, 'signer: type/version');
  for (const field of ['id', 'installation', 'machine', 'keySet', 'generation', 'bootstrapDigest'] as const)
    ensure(typeof record[field] === 'string' && record[field].length > 0 && record[field].length <= 4096, `signer: invalid ${field}`);
  const signer = take(decode('SecretRef', record.signer, admission.boundary));
  const { id, ...fields } = record;
  ensure(id === encoded(fields).hash, 'signer: immutable digest differs');
  const bootstrap = admission.bootstrap.package;
  ensure(record.installation === bootstrap.installation && record.machine === bootstrap.machine
    && record.generation === bootstrap.generation && record.keySet === bootstrap.key.id
    && record.bootstrapDigest === admission.bootstrap.digest && encoded(signer).bytes === encoded(bootstrap.signer).bytes,
  'signer: immutable external bootstrap binding differs');
  return freeze({ ...record, signer });
}
const historicalSigners = new WeakMap<ProductionSignerAdmission, Map<string, ProductionSignerReference>>();
function validate(input: unknown, context: OwnedBodyContext, admission: ProductionSignerAdmission): ProductionSignerReference {
  if (context.mode === 'origin') {
    // Guard first: an inactive origin attempt refuses before any expensive basis preparation.
    ensure(active.get(admission) === encoded(closed(input, admission)).hash, 'signer: active owner admission guard required');
    return validateFresh(input, context, admission);
  }
  ensure(isVerifiedProductionBootstrap(admission.bootstrap), 'signer: independently verified external bootstrap required');
  // GRANT M3-E: complete-input reuse key (see installation-selection.ts); the bootstrap identity is part of it.
  const key = historicalReuseKey('assembly-ProductionSignerReference', input, context, admission, { digest: admission.bootstrap.digest, package: admission.bootstrap.package });
  const memo = historicalSigners.get(admission) ?? new Map<string, ProductionSignerReference>();
  historicalSigners.set(admission, memo);
  const cached = key ? memo.get(key) : undefined; if (cached) return cached;
  const record = validateFresh(input, context, admission); if (key) memo.set(key, record); return record;
}
function validateFresh(input: unknown, context: OwnedBodyContext, admission: ProductionSignerAdmission): ProductionSignerReference {
  const record = closed(input, admission);
  ensure(context.origin.kind === 'assembly-ProductionSignerReference', 'signer: wrong fact kind');
  installationRecordBasis(record, admission, context.facts, context.origin);
  ensure(admission.packageRecords.some(candidate => encoded(candidate).bytes === encoded(record).bytes),
    'signer: reference is outside independently approved package');
  ensure(context.facts.genesis.hash === admission.bootstrap.package.genesisHash, 'signer: bootstrap genesis differs');
  const keys = context.facts.keys.filter(key => key.id === record.keySet);
  ensure(keys.length === 1 && encoded(keys[0]).bytes === encoded(admission.bootstrap.package.key).bytes,
    'signer: Two approved key-set history differs from external bootstrap');
  // Two checks both the signature and the selected key's exact segment range.
  take(decodeEnvelope(context.origin, { ...context.facts, keys }, 'replication'));
  if (context.mode === 'origin') {
    ensure(active.get(admission) === encoded(record).hash, 'signer: active owner admission guard required');
    ensure(context.facts.decode.register.generation.id === record.generation, 'signer: stale generation');
  }
  return record;
}
export function decodeProductionSignerReferenceAtOrigin(input: unknown, context: OwnedBodyContext,
  admission: ProductionSignerAdmission): Result<ProductionSignerReference> {
  return boundary('ProductionSignerReferenceOrigin', input, admission.boundary, () => {
    ensure(context.mode === 'origin', 'signer: origin mode required'); return validate(input, context, admission);
  });
}
export function decodeHistoricalProductionSignerReference(input: unknown, context: OwnedBodyContext,
  admission: ProductionSignerAdmission): Result<ProductionSignerReference> {
  return boundary('ProductionSignerReferenceHistorical', input, admission.boundary, () => {
    ensure(context.mode === 'historical', 'signer: historical mode required'); return validate(input, context, admission);
  });
}
export function productionSignerReferenceSchemas(scope: Scope): readonly FactSchema[] {
  return [{ kind: 'assembly-ProductionSignerReference', version: 1,
    fields: { record: { kind: 'owned', owner: 'part-ten', name: 'ProductionSignerReference' } },
    machineScope: 'shared', standing: 'delegate', action: 'work', scope, causallyBound: true, requiredReferences: [], authority: 'none' }];
}
export function registerProductionSignerReferenceBody(admission: ProductionSignerAdmission): Result<OwnedBodyRegistration> {
  return registerOwnedBody({ name: 'ProductionSignerReference', owner: 'part-ten', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {}, decodeCurrent: (value, context) => {
      try { return { ok: true, value: take((context.mode === 'origin' ? decodeProductionSignerReferenceAtOrigin
        : decodeHistoricalProductionSignerReference)(value, context, admission)) }; }
      catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'signer reference refused' }; }
    } }, shape, admission.boundary);
}
export function recordProductionSignerReference(input: unknown,
  writer: InstallationRecordWriter & Readonly<{ admission: ProductionSignerAdmission }>): Result<FactEnvelope> {
  return boundary('RecordProductionSignerReference', input, writer.admission.boundary, () => {
    const record = closed(input, writer.admission), facts = { ...writer.context, facts: take(writer.store.read()) };
    const basis = installationRecordBasis(record, writer.admission, facts);
    ensure(record.generation === writer.context.decode.register.generation.id, 'signer: stale current generation');
    ensure(writer.admission.packageRecords.some(candidate => encoded(candidate).bytes === encoded(record).bytes),
      'signer: record outside approved package');
    installationRecordAuthor('assembly-ProductionSignerReference', record, writer, basis);
    const rows = basis.snapshot.entries.filter(row => row.fact.kind === 'assembly-ProductionSignerReference').filter(row => {
      const prior = (row.fact.body as { record?: ProductionSignerReference }).record;
      return prior?.id === record.id || prior?.installation === record.installation
        && prior.machine === record.machine && prior.generation === record.generation;
    });
    ensure(rows.length <= 1 && rows.every(row => !row.taint.length && !row.conflicts.length
      && encoded(row.fact.body).bytes === encoded({ record }).bytes), 'signer: immutable conflict inhibits scope');
    if (rows[0]) return rows[0].fact;
    active.set(writer.admission, encoded(record).hash);
    try { return take(authorAndAppend({ kind: 'assembly-ProductionSignerReference', schemaVersion: 1, machine: record.machine,
      principal: json(writer.principal), provenance: json(writer.principal.provenance), at: json(writer.at), body: json({ record }),
      required: [...basis.required, ...writer.context.grants.filter(row => row.grant.grantee.id === writer.principal.id).map(row => row.factId)] }, writer.context, writer.store, writer.privateKey)).fact; }
    finally { active.delete(writer.admission); }
  });
}
