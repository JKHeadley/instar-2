// Later parts own their records/validators. P2 owns dispatch, signed pins and byte policy.
import { defineDecoder } from '../index.js';
import type { DecoderDefinition, Json, Result } from '../index.js';
import type { FactBoundary } from './boundary.js';
import { boundary, encoding, fields, integer, object, requireFact, string, take } from './boundary.js';
import { contextBoundary } from './contracts.js';
import type { AuthorityTaint, FactContext, FactEnvelope } from './contracts.js';

export type OwnedShape = Readonly<
  | { kind: 'text'; maxLength: number } | { kind: 'integer' } | { kind: 'boolean' }
  | { kind: 'capture' } | { kind: 'null' }
  | { kind: 'array'; maxLength: number; items: OwnedShape }
  | { kind: 'object'; fields: Readonly<Record<string, OwnedShape>>; optional?: readonly string[] }
>;
export interface OwnedBodyContext extends FactBoundary {
  readonly origin: FactEnvelope; readonly mode: 'origin' | 'historical'; readonly facts: FactContext;
  readonly markEvidenceUnavailable?: () => void;
}
class RegistrationIdentity { private readonly product!: void }
export interface OwnedBodyRegistration extends RegistrationIdentity { readonly owner: string; readonly name: string }
type Runner = (value: Json, fact: FactEnvelope, mode: 'origin' | 'historical', context: FactContext) => { value: Json; taint: readonly AuthorityTaint[] };
const registrations = new WeakMap<object, Runner>();
export function registerOwnedBody<T>(definition: DecoderDefinition<T, OwnedBodyContext>, policy: OwnedShape, context: FactBoundary): Result<OwnedBodyRegistration> {
  return boundary('OwnedBodyRegistration', null, context, () => {
    requireFact(/^part-(three|four|five|six|seven|eight|nine|ten|eleven)$/.test(definition.owner), 'owned body must name its later-part owner');
    const decoder = take(defineDecoder(definition, context.preserved));
    // Snapshot policy independently from caller mutations, just as P1 pins decoder callbacks.
    const shape: OwnedShape = JSON.parse(encoding(policy).bytes);
    const registration = { owner: decoder.owner, name: decoder.name } as unknown as OwnedBodyRegistration;
    registrations.set(registration, (value, origin, mode, facts) => {
      const taint = new Set<AuthorityTaint>();
      const markEvidenceUnavailable = (): void => {
        requireFact(mode === 'historical', 'owned evidence-unavailable taint is historical-only');
        taint.add('evidence-unavailable');
      };
      const check = (v: Json, s: OwnedShape): void => {
        if (s.kind === 'text') { integer(s.maxLength, 'text bound', 1); requireFact(typeof v === 'string' && v.length <= s.maxLength, 'owned text exceeds declared bound'); }
        else if (s.kind === 'integer') requireFact(typeof v === 'number' && Number.isSafeInteger(v), 'owned integer required');
        else if (s.kind === 'boolean') requireFact(typeof v === 'boolean', 'owned boolean required');
        else if (s.kind === 'null') requireFact(v === null, 'owned null required');
        else if (s.kind === 'array') { integer(s.maxLength, 'array bound', 1); requireFact(Array.isArray(v) && v.length <= s.maxLength, 'owned bounded array required'); v.forEach(v => check(v, s.items)); }
        else if (s.kind === 'object') { const record = object(v); fields(record, Object.keys(s.fields).filter(k => !s.optional?.includes(k)), s.optional); for (const [key, field] of Object.entries(s.fields)) if (record[key] !== undefined) check(record[key]!, field); }
        else if (s.kind === 'capture') {
          const ref = object(v); fields(ref, ['reference', 'hash']); const key = string(ref.reference, 'capture reference');
          const captured = facts.captures[key];
          requireFact(captured && captured.hash === ref.hash, 'owned capture metadata missing', 'integrity');
          if (captured.status !== 'available') { requireFact(mode === 'historical', 'owned capture unavailable at append', 'integrity'); taint.add('evidence-unavailable'); }
          else requireFact(captured.bytes !== null && encodingHash(captured.bytes) === ref.hash, 'owned capture bytes differ', 'integrity');
        } else requireFact(false, 'unknown owned field policy');
      };
      check(value, shape);
      const decoded = take(decoder.decode(value, { ...contextBoundary(facts), origin, mode, facts, markEvidenceUnavailable }));
      const result: Json = JSON.parse(encoding(decoded).bytes); check(result, shape);
      return { value: result, taint: [...taint] };
    });
    return registration;
  });
}
import { hashBytes as encodingHash } from './envelope.js';
export function decodeOwnedBody(owner: string, name: string, value: Json, fact: FactEnvelope, mode: 'origin' | 'historical', context: FactContext) {
  const candidates = (context.ownedBodies ?? []).filter(r => r.owner === owner && r.name === name);
  requireFact(candidates.length === 1, 'owned body registration missing or ambiguous');
  const run = registrations.get(candidates[0]!); requireFact(run, 'owned body registration was not validated');
  return run(value, fact, mode, context);
}
