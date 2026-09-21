// P1's historical wrappers retain validation identity without acquiring live standing.
import { readHistorical } from '../index.js';
import type { ConstitutionalValue, DecodeContext, HistoricalRead, Json, Result, StandingGrant, Revocation } from '../index.js';
import { boundary, encoding, fields, frozen, object, requireFact, same, string, take } from './boundary.js';
import { causalCone, causalStanding, migrateBody } from './admission.js';
import { decodeFrame, hashBytes, schemaFor } from './envelope.js';
import { snapshot } from '../decode/canonical.js';
import { contextBoundary } from './contracts.js';
import type { AuthorityTaint, FactContext, FactEnvelope } from './contracts.js';
import { decodeOwnedBody } from './owned.js';

export interface HistoricalBody {
  readonly fields: Readonly<Record<string, Json | HistoricalRead<ConstitutionalValue>>>;
  readonly taint: readonly AuthorityTaint[];
  readonly records: readonly HistoricalRead<ConstitutionalValue>[];
  readonly grants: readonly HistoricalRead<StandingGrant>[];
  readonly revocations: readonly HistoricalRead<Revocation>[];
}
type DecodedBody = { fingerprint: string; owners: FactContext['ownedBodies']; migrations: FactContext['migrations']; body: HistoricalBody };
// GRANT M3-E: a projection re-materializes envelope objects, so the record-object key alone misses
// on every read. A decoded body is findable by fact id and reused only when the candidate
// envelope's complete current canonical bytes EQUAL the bytes that were decoded — byte equality,
// never identity or an asserted id, establishes that it is the same signed envelope.
const decodedByContent = new Map<string, DecodedBody & { envelope: string }>();

// GRANT M3-E: the memo fingerprint keeps the exact canonical bytes of its composite input, but a
// component object that is runtime-verified deep-frozen (and so can never change) is encoded once
// and reused by identity. Everything mutable is still walked and encoded on every read, with the
// same structural rejections canonical snapshotting applies (prototype, accessor, symbol, sparse
// array, cycle, depth, non-finite number). Verification of immutability is itself sound to cache:
// a deep-frozen object graph cannot acquire, lose or replace any node afterwards.
const verifiedFrozen = new WeakSet<object>();
const frozenTexts = new WeakMap<object, { depth: number; text: string }>();
function deepFrozen(value: object, seen: Set<object>): boolean {
  if (verifiedFrozen.has(value)) return true;
  if (!Object.isFrozen(value) || seen.has(value)) return false;
  seen.add(value);
  const every = Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor => 'value' in descriptor
    && (descriptor.value === null || typeof descriptor.value !== 'object' || deepFrozen(descriptor.value, seen)));
  seen.delete(value);
  if (every) verifiedFrozen.add(value);
  return every;
}
function encodeJson(value: Json): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(encodeJson).join(',')}]`;
  const record = value as Record<string, Json>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${encodeJson(record[key]!)}`).join(',')}}`;
}
function amortizedText(input: unknown, seen: Set<object>, depth: number): string {
  if (depth > 64) throw new Error('input exceeds 64 levels');
  if (input === null || typeof input === 'string' || typeof input === 'boolean') return JSON.stringify(input);
  if (typeof input === 'number' && Number.isFinite(input)) return JSON.stringify(Object.is(input, -0) ? 0 : input);
  if (!input || typeof input !== 'object') throw new Error('input is not finite JSON data');
  if (deepFrozen(input, new Set())) {
    const known = frozenTexts.get(input);
    if (known && known.depth >= depth) return known.text;
    const text = encodeJson(snapshot(input, seen, depth));
    frozenTexts.set(input, { depth, text });
    return text;
  }
  if (seen.has(input)) throw new Error('cyclic input');
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) throw new Error('non-data prototype');
  seen.add(input);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).some(k => typeof k !== 'string')) throw new Error('symbol field');
  const parts: string[] = [];
  const keys = Object.keys(descriptors).sort();
  for (const key of keys) {
    if (Array.isArray(input) && key === 'length') continue;
    const descriptor = descriptors[key]!;
    if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('accessor or hidden field');
    parts.push(Array.isArray(input) ? amortizedText(descriptor.value, seen, depth + 1) : `${JSON.stringify(key)}:${amortizedText(descriptor.value, seen, depth + 1)}`);
  }
  seen.delete(input);
  if (Array.isArray(input)) {
    const indexKeys = keys.filter(key => key !== 'length');
    if (indexKeys.length !== input.length || indexKeys.some((key, i) => !(String(i) in descriptors))) throw new Error('sparse or extended array');
    return `[${Array.from({ length: input.length }, (_, i) => parts[indexKeys.indexOf(String(i))]!).join(',')}]`;
  }
  return `{${parts.join(',')}}`;
}
function memoFingerprint(composite: object): string { return hashBytes(amortizedText(composite, new Set(), 0)); }
export function historicalAuthority(context: FactContext): FactContext {
  const historicalGrants = [...context.historicalGrants ?? []], historicalRevocations = [...context.historicalRevocations ?? []];
  const c = { ...context, historicalGrants, historicalRevocations };
  for (const fact of [...context.facts].sort((a, b) => causalCone(a, context.facts).length - causalCone(b, context.facts).length)) {
    const schema = schemaFor(c, fact.kind, fact.schemaVersion);
    if (!Object.values(schema.fields).some(f => f.kind === 'constitutional' && ['StandingGrant', 'Revocation'].includes(f.type))) continue;
    const body = take(decodeHistoricalBody(fact, c, causalStanding(fact, c, false).decode));
    historicalGrants.push(...body.grants.map(grant => ({ factId: fact.id, grant })));
    historicalRevocations.push(...body.revocations.map(revocation => ({ factId: fact.id, revocation })));
  }
  return c;
}
export function decodeHistoricalBody(fact: FactEnvelope, context: FactContext, decoderContext: DecodeContext): Result<HistoricalBody> {
  return boundary('HistoricalFactBody', fact.body, contextBoundary(context), () => {
    const cache = new Map<string, HistoricalBody>();
    const issued = new Map<string, readonly HistoricalRead<ConstitutionalValue>[]>();
    const read = (record: FactEnvelope, c: DecodeContext): HistoricalBody => {
      const cached = cache.get(record.id); if (cached) return cached;
      const fingerprint = memoFingerprint({ register: c.register, captures: c.captures, captureStatuses: context.captures, schemas: context.schemas,
        now: c.now ?? null, currentBase: c.currentBase ?? null, artifact: c.artifact ?? null, subjects: c.recordSubjects ?? {},
        grants: c.grants ?? [], revocations: c.revocations ?? [], keys: context.keys,
        cone: causalCone(record, context.facts).map(f => f.contentHash).sort() });
      const byContent = decodedByContent.get(record.id);
      const reused = byContent?.envelope === encoding(record).bytes ? byContent : undefined;
      if (reused?.fingerprint === fingerprint && reused.owners === context.ownedBodies && reused.migrations === context.migrations) {
        cache.set(record.id, reused.body); issued.set(record.id, reused.body.records); return reused.body;
      }
      const history: HistoricalRead<ConstitutionalValue>[] = [];
      for (const ancestor of causalCone(record, context.facts)) {
        read(ancestor, causalStanding(ancestor, context, false).decode);
        history.push(...issued.get(ancestor.id)!);
      }
      const checked = take(decodeFrame(record, context)), bytes = encoding(record).bytes, reference = `origin:${record.id}`;
      const captures = { ...c.captures, [reference]: bytes };
      const captureStatuses = Object.fromEntries(Object.entries(context.captures).map(([ref, capture]) => {
        if (capture.status !== 'available') delete captures[ref];
        else {
          requireFact(capture.bytes !== null && hashBytes(capture.bytes) === capture.hash, 'historical capture hash mismatch', 'integrity');
          captures[ref] = capture.bytes;
        }
        return [ref, capture.status];
      }));
      const hc = { ...c, captures, captureStatuses, history };
      const pin = { origin: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: record.id },
        capture: { reference, hash: hashBytes(bytes) }, machineKeyId: checked.keyId, path: [] as string[] };
      const out: Record<string, Json | HistoricalRead<ConstitutionalValue>> = {};
      const own: HistoricalRead<ConstitutionalValue>[] = [];
      const grants: HistoricalRead<StandingGrant>[] = [], revocations: HistoricalRead<Revocation>[] = [];
      let unavailable = false;
      for (const [type, path] of [['VerifiedPrincipal', 'principal'], ['Provenance', 'provenance']] as const) {
        const identity = take(readHistorical(type, record[path], { ...pin, path: [path] }, hc));
        history.push(identity); unavailable ||= identity.unavailableCaptures.length > 0;
      }
      const migrated = migrateBody(record, context, record.body);
      const schema = schemaFor(context, record.kind, migrated.version), body = object(migrated.body);
      fields(body, Object.keys(schema.fields).filter(k => !schema.optional?.includes(k)), schema.optional);
      for (const [name, field] of Object.entries(schema.fields)) {
        const value = body[name]; if (value === undefined && schema.optional?.includes(name)) continue;
        requireFact(value !== undefined, `missing body field ${name}`);
        if (field.kind === 'owned') {
          requireFact(same(value, object(record.body)[name]), 'owned body migration must retain its signed field pin');
          const decoded = decodeOwnedBody(field.owner, field.name, value, record, 'historical', context);
          out[name] = decoded.value; unavailable ||= decoded.taint.includes('evidence-unavailable'); continue;
        }
        if (field.kind === 'constitutional') {
          requireFact(same(value, object(record.body)[name]), 'constitutional migration must retain its signed field pin', 'integrity');
          const shape = object(value);
          const source = field.type === 'StandingGrant' || field.type === 'Revocation' ? shape.source
            : field.type === 'Authorization' ? shape.explicitYes : undefined;
          if (source !== undefined) requireFact(same(source, record.provenance), 'body authority provenance differs from fact provenance', 'standing');
          const fieldPin = { ...pin, path: ['body', name] };
          let result: HistoricalRead<ConstitutionalValue>;
          if (field.type === 'StandingGrant') { const grant = take(readHistorical('StandingGrant', value, fieldPin, hc)); grants.push(grant); result = grant; }
          else if (field.type === 'Revocation') { const revocation = take(readHistorical('Revocation', value, fieldPin, hc)); revocations.push(revocation); result = revocation; }
          else result = take(readHistorical(field.type, value, fieldPin, hc));
          own.push(result); history.push(result); out[name] = result;
          unavailable ||= result.unavailableCaptures.length > 0;
        } else {
          if (field.kind === 'text') requireFact(typeof value === 'string' && value.length <= field.maxLength, `${name}: text exceeds declared bound`);
          if (field.kind === 'integer') requireFact(typeof value === 'number' && Number.isSafeInteger(value), `${name}: integer required`);
          if (field.kind === 'exact') requireFact(typeof value === 'string' && /^-?(0|[1-9][0-9]*)$/.test(value), `${name}: exact integer minor units required`);
          if (field.kind === 'boolean') requireFact(typeof value === 'boolean', `${name}: boolean required`);
          if (field.kind === 'reference') string(value, name);
          if (field.kind === 'capture') {
            const ref = object(value); fields(ref, ['reference', 'hash']);
            const captured = context.captures[string(ref.reference, name)];
            requireFact(captured && captured.hash === ref.hash, 'historical capture metadata missing', 'integrity');
            unavailable ||= captured.status !== 'available';
          }
          out[name] = value;
        }
      }
      const result: HistoricalBody = { fields: out, records: own, grants, revocations, taint: unavailable ? ['evidence-unavailable'] : [] };
      issued.set(record.id, own); cache.set(record.id, result);
      const decoded: DecodedBody = { fingerprint, owners: context.ownedBodies, migrations: context.migrations, body: frozen(result) };
      decodedByContent.set(record.id, { ...decoded, envelope: encoding(record).bytes }); return result;
    };
    return read(fact, decoderContext);
  });
}
