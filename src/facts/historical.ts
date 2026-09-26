// P1's historical wrappers retain validation identity without acquiring live standing.
import { readHistorical } from '../index.js';
import type { ConstitutionalValue, DecodeContext, HistoricalRead, Json, Result, StandingGrant, Revocation } from '../index.js';
import { boundary, encoding, fields, frozen, object, requireFact, same, string, take } from './boundary.js';
import { causalCone, causalIndex, causalStanding, migrateBody } from './admission.js';
import type { CausalIndex } from './admission.js';
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
type DecodedBody = { fingerprint: string; owners: FactContext['ownedBodies']; migrations: FactContext['migrations']; body: HistoricalBody };
// GRANT M3-E: a projection re-materializes envelope objects, so the record-object key alone misses
// on every read. A decoded body is findable by fact id and reused only when the candidate
// envelope's complete current canonical bytes EQUAL the bytes that were decoded — byte equality,
// never identity or an asserted id, establishes that it is the same signed envelope.
const decodedByContent = new Map<string, DecodedBody & { envelope: string }>();
// One operation's shared, read-only view of one context: its causal index and, computed at most
// once, the encoding of its decode tables. Built by the operation that owns the context; never
// kept past it.
export interface HistoricalScope {
  readonly context: FactContext; readonly index: CausalIndex; tables?: string;
  positions?: { readonly grants: ReadonlyMap<object, number>; readonly revocations: ReadonlyMap<object, number> };
}
export function historicalScope(context: FactContext): HistoricalScope { return { context, index: causalIndex(context.facts) }; }
export function historicalAuthority(context: FactContext): FactContext {
  const historicalGrants = [...context.historicalGrants ?? []], historicalRevocations = [...context.historicalRevocations ?? []];
  const c = { ...context, historicalGrants, historicalRevocations };
  // Occam cut #4: the same stable history-size order (an ancestor always precedes its
  // descendant), with each size read by position once instead of walking two cones per
  // comparison. When some history can only be walked, the original comparator runs, with its refusals.
  const scope = historicalScope(c), index = scope.index;
  const ordered = context.facts.length < 2 || context.facts.every(f => index.frontierOf(f))
    ? context.facts.map(f => ({ f, n: index.coneSize(f) ?? 0 })).sort((a, b) => a.n - b.n).map(r => r.f)
    : [...context.facts].sort((a, b) => causalCone(a, context.facts).length - causalCone(b, context.facts).length);
  for (const fact of ordered) {
    const schema = schemaFor(c, fact.kind, fact.schemaVersion);
    if (!Object.values(schema.fields).some(f => f.kind === 'constitutional' && ['StandingGrant', 'Revocation'].includes(f.type))) continue;
    const body = take(decodeHistoricalBody(fact, c, causalStanding(fact, c, false, index).decode, scope));
    historicalGrants.push(...body.grants.map(grant => ({ factId: fact.id, grant })));
    historicalRevocations.push(...body.revocations.map(revocation => ({ factId: fact.id, revocation })));
  }
  return c;
}
export function decodeHistoricalBody(fact: FactEnvelope, context: FactContext, decoderContext: DecodeContext, operation?: HistoricalScope): Result<HistoricalBody> {
  return boundary('HistoricalFactBody', fact.body, contextBoundary(context), () => {
    const cache = new Map<string, HistoricalBody>();
    const issued = new Map<string, readonly HistoricalRead<ConstitutionalValue>[]>();
    // Occam cut #5: the memo key is the fact (id + exact bytes below) plus the context, encoded at
    // most once per operation, plus the history's identity: its chain-head contentHashes where the
    // index can answer by position, else the full contentHash list the walk yields (as before).
    const scope = operation?.context === context ? operation : historicalScope(context), causal = scope.index;
    const shared = (c: DecodeContext) => c.register === context.decode.register && c.captures === context.decode.captures
      && c.currentBase === context.decode.currentBase && c.artifact === context.decode.artifact && c.recordSubjects === context.decode.recordSubjects;
    const tables = (c: DecodeContext) => encoding({ register: c.register, captures: c.captures, captureStatuses: context.captures, schemas: context.schemas,
      currentBase: c.currentBase ?? null, artifact: c.artifact ?? null, subjects: c.recordSubjects ?? {}, keys: context.keys,
      grants: context.grants, revocations: context.revocations }).hash;
    // A decode context derived from this one carries the context's own grant/revocation objects:
    // those are named by their position in the (encoded) tables; anything else is encoded in full.
    const standing = (c: DecodeContext) => {
      const at = scope.positions ??= { grants: new Map(context.grants.map((r, i) => [r.grant, i])), revocations: new Map(context.revocations.map((r, i) => [r.revocation, i])) };
      const grants = (c.grants ?? []).map(g => at.grants.get(g)), revocations = (c.revocations ?? []).map(r => at.revocations.get(r));
      return [...grants, ...revocations].every(i => i !== undefined) ? `at:${encoding({ now: c.now ?? null, grants, revocations }).hash}`
        : `full:${encoding({ now: c.now ?? null, grants: c.grants ?? [], revocations: c.revocations ?? [] }).hash}`;
    };
    const read = (record: FactEnvelope, c: DecodeContext): HistoricalBody => {
      const cached = cache.get(record.id); if (cached) return cached;
      const heads = causal.coneHeads(record);
      const fingerprint = hashBytes(`${shared(c) ? scope.tables ??= tables(c) : tables(c)}|${standing(c)}|${
        heads ? `heads:${heads.join(',')}` : `cone:${causalCone(record, context.facts).map(f => f.contentHash).sort().join(',')}`}`);
      const byContent = decodedByContent.get(record.id);
      const reused = byContent?.envelope === encoding(record).bytes ? byContent : undefined;
      if (reused?.fingerprint === fingerprint && reused.owners === context.ownedBodies && reused.migrations === context.migrations) {
        cache.set(record.id, reused.body); issued.set(record.id, reused.body.records); return reused.body;
      }
      const history: HistoricalRead<ConstitutionalValue>[] = [];
      for (const ancestor of causalCone(record, context.facts)) {
        read(ancestor, causalStanding(ancestor, context, false, causal).decode);
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
