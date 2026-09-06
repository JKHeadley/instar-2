import { canonical, consumeResult, defineDecoder, deriveThrough } from '../index.js';
import type { BoundaryContext, Json, Refused, Result } from '../index.js';

class Inherited extends Error { constructor(readonly refusal: Refused) { super(refusal.detail); } }
export function take<T>(r: Result<T>): T {
  return consumeResult(r, { Success: v => v, Refused: r => { throw new Inherited(r); } });
}
export function ensure(v: unknown, detail: string): asserts v { if (!v) throw new Error(detail); }
export const encoded = (v: unknown) => take(canonical(v));
export const json = (v: unknown): Json => JSON.parse(encoded(v).bytes) as Json;
export function freeze<T>(v: T): T {
  if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v;
}
export function boundary<T>(name: string, input: unknown, c: BoundaryContext, run: () => T): Result<T> {
  let inherited: Refused | undefined;
  const decoder = defineDecoder<T, BoundaryContext>({ name, owner: 'part-eight', currentVersion: 1,
    versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: () => {
      try { return { ok: true, value: run() }; }
      catch (e) { if (e instanceof Inherited) inherited = e.refusal;
        return { ok: false, detail: e instanceof Error ? e.message : 'effect boundary failed' }; }
    },
  }, c.preserved);
  const result = consumeResult(decoder, { Success: d => deriveThrough(d, { type: name, schemaVersion: 1, input }, c), Refused: r => r });
  return inherited ?? result;
}
