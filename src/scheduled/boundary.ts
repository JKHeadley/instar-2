import { canonical, consumeResult, defineDecoder, deriveThrough } from '../index.js';
import type { BoundaryContext, Refused, Result } from '../index.js';

class Inherited extends Error {
  constructor(readonly refusal: Refused) { super(refusal.detail); }
}

export function take<T>(result: Result<T>): T {
  return consumeResult(result, {
    Success: value => value,
    Refused: refusal => { throw new Inherited(refusal); },
  });
}

export function ensure(value: unknown, detail: string): asserts value {
  if (!value) throw new Error(detail);
}

export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function boundary<T>(name: string, input: unknown, context: BoundaryContext, run: () => T): Result<T> {
  let inherited: Refused | undefined;
  const definition = defineDecoder<T, BoundaryContext>({
    name,
    owner: 'part-fifteen',
    currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } },
    migrations: {},
    decodeCurrent: () => {
      try { return { ok: true, value: freeze(run()) }; }
      catch (error) {
        if (error instanceof Inherited) inherited = error.refusal;
        return { ok: false, detail: error instanceof Error ? error.message : 'scheduled-work boundary failed' };
      }
    },
  }, context.preserved);
  const result = consumeResult(definition, {
    // Keep the caller value inside the framework-owned snapshot. Unsupported
    // JSON values are therefore converted to the same typed refusal as every
    // other decoder boundary instead of escaping before deriveThrough runs.
    Success: decoder => deriveThrough(decoder, { type: name, schemaVersion: 1, input }, context),
    Refused: refusal => refusal,
  });
  return inherited ?? result;
}
