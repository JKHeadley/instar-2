import { consumeResult, defineDecoder } from '../index.js';
import type { BoundaryContext, Refused, RefusalReason, Result } from '../index.js';

export class OperatorFailure extends Error {
  constructor(message: string, readonly reason: RefusalReason = 'integrity', readonly original?: Refused) { super(message); }
}

export function requireOperator(condition: unknown, detail: string, reason: RefusalReason = 'integrity'): asserts condition {
  if (!condition) throw new OperatorFailure(detail, reason);
}

export function take<T>(result: Result<T>): T {
  return consumeResult(result, { Success: value => value, Refused: refusal => { throw new OperatorFailure(refusal.detail, refusal.reason, refusal); } });
}

export function operatorBoundary<T>(name: string, context: BoundaryContext, run: () => T): Result<T> {
  let original: Refused | undefined;
  const decoder = defineDecoder<T, BoundaryContext>({
    name, owner: 'part-eleven', currentVersion: 1,
    versions: { 1: { validate: value => ({ ok: true, value }) } }, migrations: {},
    decodeCurrent: () => {
      try { return { ok: true, value: Object.freeze(run()) }; }
      catch (error) {
        if (error instanceof OperatorFailure) original = error.original;
        return { ok: false, reason: error instanceof OperatorFailure ? error.reason : 'integrity',
          detail: error instanceof Error ? error.message : 'part-eleven boundary failed' };
      }
    },
  }, context.preserved);
  return consumeResult(decoder, {
    Refused: refusal => refusal,
    Success: product => {
      const result = product.decode({ type: name, schemaVersion: 1 }, context);
      return consumeResult(result, { Success: () => result, Refused: refusal => original ?? refusal });
    },
  });
}
