// P3-NF-02/03/05/08/20: every P3 boundary uses part one's extension framework.
import { canonical, consumeResult, defineDecoder, deriveThrough } from '../index.js';
import type { BoundaryContext, Json, Refused, Result, Validation } from '../index.js';

class NestedRefusal extends Error {
  constructor(readonly refusal: Refused) { super(refusal.detail); }
}

export function take<T>(result: Result<T>): T {
  return consumeResult(result, { Success: value => value, Refused: refusal => { throw new NestedRefusal(refusal); } });
}
export function requireThat(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}
export function object(input: Json): Record<string, Json> {
  requireThat(input !== null && typeof input === 'object' && !Array.isArray(input), 'expected object');
  return input as Record<string, Json>;
}
export function text(input: Json | undefined, field: string): string {
  requireThat(typeof input === 'string' && input.length > 0, `${field}: expected nonempty string`);
  return input;
}
export function number(input: Json | undefined, field: string): number {
  requireThat(typeof input === 'number' && Number.isFinite(input), `${field}: expected finite number`);
  return input;
}
export function list(input: Json | undefined, field: string): readonly Json[] {
  requireThat(Array.isArray(input), `${field}: expected array`); return input;
}
export function strings(input: Json | undefined, field: string): readonly string[] {
  return list(input, field).map(v => text(v, field));
}
export function exact(input: Record<string, Json>, allowed: readonly string[]): void {
  for (const key of Object.keys(input)) requireThat(allowed.includes(key), `undeclared field: ${key}`);
}
export function frozen<T>(value: T): T {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) frozen(item); Object.freeze(value); }
  return value;
}
export const encoding = (input: unknown) => take(canonical(input));
export function validated<T, C extends BoundaryContext>(name: string, input: unknown, context: C,
  read: (input: Record<string, Json>, context: C) => T): Result<T> {
  // The caller chooses a P3-owned schema; versioning, hostile-input snapshotting,
  // preservation and Result construction remain in defineDecoder, never duplicated here.
  let inherited: Refused | undefined;
  const definition = defineDecoder<T, C>({ name, owner: 'part-three', currentVersion: 1,
    versions: { 1: { validate: (input: Json): Validation<Json> => ({ ok: true, value: input }) } },
    migrations: {}, decodeCurrent: (shape, ctx) => {
      try { return { ok: true, value: frozen(read(object(shape), ctx)) }; }
      catch (error) {
        if (error instanceof NestedRefusal) inherited = error.refusal;
        return { ok: false, detail: error instanceof Error ? error.message : 'P3 validation failed' };
      }
    },
  }, context.preserved);
  const result = consumeResult(definition, { Success: decoder => deriveThrough(decoder, input, context), Refused: refusal => refusal });
  return inherited ?? result;
}
export function checked<T, C extends BoundaryContext>(name: string, input: unknown, context: C,
  read: (input: Json, context: C) => T): Result<T> {
  return validated(name, { type: name, schemaVersion: 1, input }, context, (shape, ctx) => read(shape.input!, ctx));
}
