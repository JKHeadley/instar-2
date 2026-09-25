// Part twenty-one (recall doorway, draft): values enter and leave through part one's total boundary.
import { canonical, consumeResult, defineDecoder, deriveThrough } from '../index.js';
import type { BoundaryContext, Json, Refused, RefusalReason, Result } from '../index.js';

export class RecallRefusal extends Error {
  constructor(message: string, readonly reason: RefusalReason = 'decode') { super(message); }
}
class Inherited extends Error { constructor(readonly refusal: Refused) { super(refusal.detail); } }
export function take<T>(result: Result<T>): T {
  return consumeResult(result, { Success: v => v, Refused: r => { throw new Inherited(r); } });
}
export function ensure(test: unknown, detail: string, reason: RefusalReason = 'decode'): asserts test {
  if (!test) throw new RecallRefusal(detail, reason);
}
export const encoded = (v: unknown) => take(canonical(v));
export function freeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
}
/** Runs `run` inside a part-one decoder so every outcome is a sealed Result. A refusal
 * inherited from another owner (store, envelope) is returned unchanged, not rewrapped. */
export function boundary<T>(name: string, input: unknown, c: BoundaryContext, run: (v: Json) => T): Result<T> {
  let inherited: Refused | undefined;
  const decoder = take(defineDecoder<T, BoundaryContext>({ name, owner: 'part-twenty-one', currentVersion: 1,
    versions: { 1: { validate: v => ({ ok: true, value: v }) } }, migrations: {},
    decodeCurrent: v => {
      try { return { ok: true, value: freeze(run((v as Record<string, Json>).input ?? null)) }; }
      catch (error) {
        if (error instanceof Inherited) inherited = error.refusal;
        return { ok: false, detail: error instanceof Error ? error.message : 'recall boundary failed',
          reason: error instanceof RecallRefusal ? error.reason : 'decode' };
      }
    },
  }, c.preserved));
  const result = deriveThrough(decoder, { type: name, schemaVersion: 1, input }, c);
  return inherited ?? result;
}
