import { canonical, consumeResult, defineDecoder } from '../index.js';
import type { BoundaryContext, Json, Refused, Result } from '../index.js';

class NestedRefusal extends Error { constructor(readonly refusal: Refused) { super(refusal.detail); } }
export function take<T>(result: Result<T>): T {
  return consumeResult(result, { Success: v => v, Refused: r => { throw new NestedRefusal(r); } });
}
export function need(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export function object(v: Json | undefined): Record<string, Json> {
  need(v !== null && typeof v === 'object' && !Array.isArray(v), 'object required'); return v as Record<string, Json>;
}
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const encoded = (value: unknown) => take(canonical(value));
export const same = (left: unknown, right: unknown) => encoded(left).bytes === encoded(right).bytes;
export const json = (value: unknown): Json => JSON.parse(encoded(value).bytes) as Json;
export function boundary<T>(name: string, input: unknown, context: BoundaryContext, read: (input: Json) => T): Result<T> {
  let inherited: Refused | undefined;
  const definition = defineDecoder<T, BoundaryContext>({ owner: 'part-five', name, currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {}, decodeCurrent: value => {
      try { return { ok: true, value: freeze(read(object(value).input!)) }; }
      catch (error) { if (error instanceof NestedRefusal) inherited = error.refusal;
        return { ok: false, detail: error instanceof Error ? error.message : 'run graph input refused' }; }
    } }, context.preserved);
  const result = consumeResult(definition, { Refused: r => r, Success: d => d.decode({ type: name, schemaVersion: 1, input }, context) });
  return inherited ?? result;
}
