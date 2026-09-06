// Part two, rules 4/42/69: extension values enter through part one's total boundary.
import { canonical, consumeResult, defineDecoder } from '../index.js';
import type { BoundaryContext, Json, RefusalReason, Result, Validation } from '../index.js';

export type FactBoundary = BoundaryContext;
export class InvalidFact extends Error {
  constructor(message: string, readonly reason: RefusalReason = 'decode') { super(message); }
}
export function requireFact(condition: unknown, message: string, reason: RefusalReason = 'decode'): asserts condition {
  if (!condition) throw new InvalidFact(message, reason);
}
export function object(input: Json): Record<string, Json> {
  requireFact(input !== null && typeof input === 'object' && !Array.isArray(input), 'expected object');
  return input as Record<string, Json>;
}
export function string(input: Json | undefined, field: string): string {
  requireFact(typeof input === 'string' && input.length > 0, `${field}: required nonempty string`); return input;
}
export function integer(input: Json | undefined, field: string, minimum = 0): number {
  requireFact(typeof input === 'number' && Number.isSafeInteger(input) && input >= minimum, `${field}: invalid integer`); return input;
}
export function strings(input: Json | undefined, field: string): readonly string[] {
  requireFact(Array.isArray(input), `${field}: required list`);
  const result = input.map(v => string(v, field));
  requireFact(new Set(result).size === result.length, `${field}: duplicate reference`); return result;
}
export function fields(input: Record<string, Json>, required: readonly string[], optional: readonly string[] = []): void {
  requireFact(required.every(k => Object.hasOwn(input, k)), 'missing required field');
  requireFact(Object.keys(input).every(k => required.includes(k) || optional.includes(k)), 'unknown field');
}
export function take<T>(result: Result<T>): T {
  return consumeResult(result, { Success: v => v, Refused: r => { throw new InvalidFact(r.detail, r.reason); } });
}
export function encoding(input: unknown): { bytes: string; hash: `sha256:${string}` } { return take(canonical(input)); }
export function same(a: unknown, b: unknown): boolean { return encoding(a).bytes === encoding(b).bytes; }
export function frozen<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}
export function boundary<T>(name: string, input: unknown, context: FactBoundary,
  validate: (input: Json) => T): Result<T> {
  const run = (input: Json): Validation<T> => {
    try { return { ok: true, value: frozen(validate(input)) }; }
    catch (e) { return { ok: false, detail: e instanceof Error ? e.message : 'invalid data', reason: e instanceof InvalidFact ? e.reason : 'decode' }; }
  };
  return consumeResult(defineDecoder<T, FactBoundary>({
    name, owner: 'part-two', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
    decodeCurrent: value => run(object(value).input ?? null),
  }, context.preserved), { Refused: r => r, Success: decoder => decoder.decode({ type: name, schemaVersion: 1, input }, context) });
}
