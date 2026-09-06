import { canonical, consumeResult, defineDecoder, deriveThrough } from '../index.js';
import type { BoundaryContext, Json, Refused, Result } from '../index.js';

class Inherited extends Error { constructor(readonly refusal: Refused) { super(refusal.detail); } }
export function take<T>(result: Result<T>): T {
  return consumeResult(result, { Success: v => v, Refused: r => { throw new Inherited(r); } });
}
export function ensure(test: unknown, detail: string): asserts test { if (!test) throw new Error(detail); }
export const encoded = (v: unknown) => take(canonical(v));
export const json = (v: unknown): Json => JSON.parse(encoded(v).bytes) as Json;
export function freeze<T>(v: T): T {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v;
}
export function boundary<T>(name: string, input: unknown, context: BoundaryContext, run: (v: Json) => T): Result<T> {
  let inherited: Refused | undefined;
  const decoder = defineDecoder<T, BoundaryContext>({ name, owner: 'part-six', currentVersion: 1,
    versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: v => {
      try { return { ok: true, value: run((v as Record<string, Json>).input!) }; }
      catch (error) { if (error instanceof Inherited) inherited = error.refusal;
        return { ok: false, detail: error instanceof Error ? error.message : 'transport boundary failed' }; }
    },
  }, context.preserved);
  const result = consumeResult(decoder, { Success: d => deriveThrough(d, { type: name, schemaVersion: 1, input }, context), Refused: r => r });
  return inherited ?? result;
}
