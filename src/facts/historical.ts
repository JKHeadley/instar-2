// P1's historical wrappers retain validation identity without acquiring live standing.
import { readHistorical } from '../index.js';
import type { ConstitutionalValue, DecodeContext, HistoricalRead, Json, Result } from '../index.js';
import { boundary, encoding, fields, object, requireFact, same, string, take } from './boundary.js';
import { causalCone, causalStanding, migrateBody } from './admission.js';
import { decodeFrame, hashBytes, schemaFor } from './envelope.js';
import { contextBoundary } from './contracts.js';
import type { AuthorityTaint, FactContext, FactEnvelope } from './contracts.js';

export interface HistoricalBody {
  readonly fields: Readonly<Record<string, Json | HistoricalRead<ConstitutionalValue>>>;
  readonly taint: readonly AuthorityTaint[];
}
export function decodeHistoricalBody(fact: FactEnvelope, context: FactContext, decoderContext: DecodeContext): Result<HistoricalBody> {
  return boundary('HistoricalFactBody', fact.body, contextBoundary(context), () => {
    const cache = new Map<string, HistoricalBody>();
    const issued = new Map<string, readonly HistoricalRead<ConstitutionalValue>[]>();
    const read = (record: FactEnvelope, c: DecodeContext): HistoricalBody => {
      const cached = cache.get(record.id); if (cached) return cached;
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
        if (field.kind === 'constitutional') {
          requireFact(same(value, object(record.body)[name]), 'constitutional migration must retain its signed field pin', 'integrity');
          const shape = object(value);
          const source = field.type === 'StandingGrant' || field.type === 'Revocation' ? shape.source
            : field.type === 'Authorization' ? shape.explicitYes : undefined;
          if (source !== undefined) requireFact(same(source, record.provenance), 'body authority provenance differs from fact provenance', 'standing');
          const result = take(readHistorical(field.type, value, { ...pin, path: ['body', name] }, hc));
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
      const result: HistoricalBody = { fields: out, taint: unavailable ? ['evidence-unavailable'] : [] };
      issued.set(record.id, own); cache.set(record.id, result); return result;
    };
    return read(fact, decoderContext);
  });
}
