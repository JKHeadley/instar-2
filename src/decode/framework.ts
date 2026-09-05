import type { Capacity, Json, RefusalReason, Result } from '../types/values.js';
import type { DecodeContext } from '../types/ports.js';
import { errorDetail, refusal, success } from '../types/internal.js';
import { snapshot } from './canonical.js';
import { schemaRegistry } from './schema.js';

// Schema callbacks belong to the extending part. These are validation input contracts,
// not constitutional values and not a new arm of Result. The framework alone emits Result.
export type Validation<T> = Readonly<{ ok: true; value: T }> | Readonly<{
  ok: false; detail: string; reason?: RefusalReason;
}>;
export interface BoundaryContext {
  readonly preserved: string;
  readonly site: string;
  readonly register: Pick<DecodeContext['register'], 'generation' | 'sites' | 'entries'>;
}
export interface VersionDecoder<C> {
  readonly validate: (input: Json, context: C) => Validation<Json>;
}
export interface DecoderDefinition<T, C extends BoundaryContext> {
  readonly name: string;
  readonly owner: string;
  readonly currentVersion: number;
  readonly versions: Readonly<Record<number, VersionDecoder<C>>>;
  // Key N migrates validated version N into N+1. No gaps or in-place upgrades.
  readonly migrations: Readonly<Record<number, (input: Json, context: C) => Json>>;
  readonly decodeCurrent: (input: Json, context: C) => Validation<T>;
}
export interface VersionedDecoder<T, C extends BoundaryContext> {
  readonly name: string;
  readonly owner: string;
  readonly currentVersion: number;
  readonly decode: (input: unknown, context: C) => Result<T>;
}
// Shared by constitutional and extension decoders; deliberately absent from package exports.
export function runBoundary<T>(input: unknown, context: { readonly preserved: string },
  validate: (shape: Json, original: unknown, fail: (detail: string, reason?: RefusalReason) => Result<never>) => Result<T>,
  metadata?: BoundaryContext): Result<T> {
  let preserved = 'input://caller';
  let site = 'types.decode'; let direction: 'open' | 'closed' = 'closed';
  const fail = (detail: string, reason: RefusalReason = 'decode') => refusal(detail, preserved, reason, site, direction);
  try {
    const reference = context.preserved;
    if (typeof reference !== 'string' || !reference) return refusal('preserved: expected nonempty input reference', preserved);
    preserved = reference;
    // Pin metadata before even snapshotting malformed input. Only a validated
    // registered site may replace the explicit conservative fallback.
    if (metadata !== undefined) {
      const requested = metadata.site; const register = metadata.register;
      if (typeof requested !== 'string' || !requested || register.generation.owner !== 'part-three'
        || typeof register.generation.id !== 'string' || !register.generation.id || !Object.hasOwn(register.sites, requested))
        return fail('boundary requires registered site and generation');
      const declared = register.sites[requested];
      if (declared !== 'open' && declared !== 'closed') return fail('boundary requires registered fail direction');
      site = requested; direction = declared;
    }
    return validate(snapshot(input), input, fail);
  } catch (error) { return fail(errorDetail(error)); }
}
export function defineDecoder<T, C extends BoundaryContext>(definition: DecoderDefinition<T, C>, preserved: string): Result<VersionedDecoder<T, C>> {
  try {
    if (!definition.name || !definition.owner || Object.hasOwn(schemaRegistry, definition.name)) return refusal('extension cannot claim a constitutional inventory name', preserved);
    const n = definition.currentVersion;
    if (!Number.isSafeInteger(n) || n < 1 || n > 1024) return refusal('invalid current schema version', preserved);
    const versions = Object.freeze({ ...definition.versions }); const migrations = Object.freeze({ ...definition.migrations });
    for (let v = 1; v <= n; v++) if (!versions[v] || typeof versions[v]!.validate !== 'function' || (v < n && typeof migrations[v] !== 'function'))
      return refusal(`schema ${definition.name}: missing validator or migration from version ${v}`, preserved);
    if (Object.keys(versions).length !== n || Object.keys(migrations).length !== n - 1 || typeof definition.decodeCurrent !== 'function') return refusal('schema has extra versions, migrations, or no current decoder', preserved);
    // Copy functions and metadata now: a caller cannot mutate registration after validation.
    const validators = Object.freeze(Object.fromEntries(Object.entries(versions).map(([v, decoder]) => [v, decoder.validate])));
    const current = definition.decodeCurrent; const name = definition.name; const owner = definition.owner;
    return success(Object.freeze({ name, owner, currentVersion: n,
      decode(input: unknown, context: C): Result<T> {
        return runBoundary(input, context, (initial, _original, fail) => {
          let shape = initial;
          const versionOf = (value: Json, expected?: number): number => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('versioned input must be an object');
            const object = value as Record<string, Json>;
            const v = object.schemaVersion;
            if (object.type !== name || typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > n || (expected !== undefined && v !== expected)) throw new Error('type or schema version unknown; migration must advance exactly once');
            return v;
          };
          let version = versionOf(shape);
          for (;;) {
            const checked = validators[version]!(shape, context);
            if (!checked.ok) return fail(checked.detail, checked.reason);
            shape = snapshot(checked.value); versionOf(shape, version);
            if (version === n) break;
            shape = snapshot(migrations[version]!(shape, context)); versionOf(shape, ++version);
          }
          const decoded = current(shape, context);
          return decoded.ok ? success(decoded.value) : fail(decoded.detail, decoded.reason);
        }, context);
      },
    }));
  } catch { return refusal('malformed decoder definition', preserved); }
}

// Later parts validate their own derived output here without recreating Success/Refused.
// This invokes the registered decoder, so it is not a public unchecked Success constructor.
export function deriveThrough<T, C extends BoundaryContext>(decoder: VersionedDecoder<T, C>, input: unknown, context: C): Result<T> {
  return runBoundary(input, context, (_shape, original) => decoder.decode(original, context), context);
}
