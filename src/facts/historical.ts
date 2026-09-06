// P1's historical wrappers retain validation identity without acquiring live standing.
import { readHistorical } from '../index.js';
import type { ConstitutionalValue, DecodeContext, HistoricalRead, Json, Result, StandingGrant, Revocation } from '../index.js';
import { boundary, encoding, fields, frozen, object, requireFact, same, string, take } from './boundary.js';
import { causalCone, causalStanding, migrateBody } from './admission.js';
import { decodeFrame, hashBytes, schemaFor } from './envelope.js';
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
const decodedBodies = new WeakMap<object, { fingerprint: string; owners: FactContext['ownedBodies']; migrations: FactContext['migrations']; body: HistoricalBody }>();
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
      const fingerprint = encoding({ register: c.register, captures: c.captures, captureStatuses: context.captures, schemas: context.schemas,
        now: c.now ?? null, currentBase: c.currentBase ?? null, artifact: c.artifact ?? null, subjects: c.recordSubjects ?? {},
        grants: c.grants ?? [], revocations: c.revocations ?? [], keys: context.keys,
        cone: causalCone(record, context.facts).map(f => f.contentHash).sort() }).hash;
      const reused = decodedBodies.get(record);
      if (reused?.fingerprint === fingerprint && reused.owners === context.ownedBodies && reused.migrations === context.migrations) { cache.set(record.id, reused.body); issued.set(record.id, reused.body.records); return reused.body; }
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
      issued.set(record.id, own); cache.set(record.id, result); decodedBodies.set(record, { fingerprint, owners: context.ownedBodies, migrations: context.migrations, body: frozen(result) }); return result;
    };
    return read(fact, decoderContext);
  });
}
