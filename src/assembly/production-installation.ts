import { decode } from '../index.js';
import type { BoundaryContext, Clock, DecodeContext, Result, Scope, SecretRef, VerifiedPrincipal } from '../index.js';
import { authorAndAppend, registerOwnedBody } from '../facts/index.js';
import type { FactContext, FactEnvelope, FactSchema, FactStorePort, OwnedBodyRegistration, OwnedShape } from '../facts/index.js';
import { boundary, encoded, ensure, freeze, json, take } from './boundary.js';

export interface ProductionInstallation {
  readonly type: 'ProductionInstallation';
  readonly schemaVersion: 1;
  readonly id: string;
  readonly generation: string;
  readonly botDeclaration: string;
  readonly providerRoute: string;
  readonly machineIdentity: string;
  readonly storageRoot: string;
  readonly botCredential: SecretRef;
  readonly providerCredential: SecretRef;
  readonly storageCredential: SecretRef;
}

const text: OwnedShape = { kind: 'text', maxLength: 4096 };
const secret: OwnedShape = { kind: 'object', fields: {
  type: text, schemaVersion: { kind: 'integer' }, vault: text, name: text,
} };
const shape = { kind: 'object', fields: {
  type: text, schemaVersion: { kind: 'integer' }, id: text, generation: text,
  botDeclaration: text, providerRoute: text, machineIdentity: text, storageRoot: text,
  botCredential: secret, providerCredential: secret, storageCredential: secret,
} } satisfies OwnedShape;
const decoded = new WeakSet<object>();

export function decodeProductionInstallation(input: unknown,
  context: DecodeContext & BoundaryContext): Result<ProductionInstallation> {
  return boundary('ProductionInstallation', input, context, () => {
    const value = JSON.parse(encoded(input).bytes) as ProductionInstallation;
    ensure(value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).sort().join(',') === Object.keys(shape.fields).sort().join(','),
      'installation: closed immutable record required');
    ensure(value.type === 'ProductionInstallation' && value.schemaVersion === 1,
      'installation: unsupported record version');
    for (const name of ['id', 'generation', 'botDeclaration', 'providerRoute', 'machineIdentity', 'storageRoot'] as const)
      ensure(typeof value[name] === 'string' && value[name].trim().length > 0 && value[name].length <= 4096,
        `installation: missing ${name}`);
    ensure(value.generation === context.register.generation.id, 'register: stale installation generation');
    for (const name of ['id', 'botDeclaration', 'providerRoute', 'machineIdentity'] as const)
      ensure(context.register.entries.includes(value[name]), `installation: unregistered ${name}`);
    ensure(value.storageRoot.startsWith('/') && (value.storageRoot === '/'
      || value.storageRoot.slice(1).split('/').every(part => part !== '' && part !== '.' && part !== '..')),
      'storage-root: canonical absolute directory required');
    const result = freeze({ ...value,
      botCredential: take(decode('SecretRef', value.botCredential, context)),
      providerCredential: take(decode('SecretRef', value.providerCredential, context)),
      storageCredential: take(decode('SecretRef', value.storageCredential, context)),
    });
    decoded.add(result);
    return result;
  });
}

export function isProductionInstallation(value: ProductionInstallation): boolean {
  return decoded.has(value);
}

export function productionInstallationSchemas(scope: Scope): readonly FactSchema[] {
  return Object.freeze([{ kind: 'assembly-ProductionInstallation', version: 1,
    fields: { record: { kind: 'owned' as const, owner: 'part-ten', name: 'ProductionInstallation' } },
    machineScope: 'shared' as const, standing: 'operator' as const, action: 'work', scope,
    causallyBound: true, requiredReferences: [], authority: 'none' as const }]);
}

export function registerProductionInstallationBody(context: DecodeContext & BoundaryContext): Result<OwnedBodyRegistration> {
  return registerOwnedBody({ name: 'ProductionInstallation', owner: 'part-ten', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
    decodeCurrent: value => {
      try { return { ok: true, value: take(decodeProductionInstallation(value, context)) }; }
      catch (error) { return { ok: false, detail: error instanceof Error ? error.message : 'installation refused' }; }
    },
  }, shape, context);
}

/** The Part Two operator-standing schema admits the installation. Reusing its
 * identity cannot silently replace bindings, even across process restarts. */
export function recordProductionInstallation(input: Readonly<{ record: unknown; context: FactContext;
  boundary: DecodeContext & BoundaryContext; store: FactStorePort; privateKey: string;
  principal: VerifiedPrincipal; at: Clock; required: readonly string[] }>): Result<FactEnvelope> {
  return boundary('RecordProductionInstallation', null, input.boundary, () => {
    const record = take(decodeProductionInstallation(input.record, input.boundary));
    const matches = take(input.store.readForProjection()).entries.filter(row =>
      row.fact.kind === 'assembly-ProductionInstallation'
      && (row.fact.body as { record?: { id?: string } }).record?.id === record.id);
    ensure(matches.length <= 1, 'installation: ambiguous immutable identity');
    if (matches[0]) {
      ensure(!matches[0].taint.length && !matches[0].conflicts.length, 'installation: unavailable signed configuration');
      ensure(encoded(matches[0].fact.body).bytes === encoded({ record }).bytes, 'installation: immutable binding conflict');
      return matches[0].fact;
    }
    return take(authorAndAppend({ kind: 'assembly-ProductionInstallation', schemaVersion: 1,
      machine: record.machineIdentity, principal: json(input.principal), provenance: json(input.principal.provenance),
      at: json(input.at), body: json({ record }), required: input.required }, input.context, input.store, input.privateKey)).fact;
  });
}
