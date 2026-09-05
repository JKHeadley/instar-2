import type { Conflict, Inventory, Json, Outcome, Result } from '../types/values.js';
import type { DecodeContext } from '../types/ports.js';
import { consumeResult, refusal, success } from '../types/internal.js';
import { compare, compareHistorical } from '../types/operations.js';
import { sessionFor } from './session.js';
import { decode } from './decode.js';
import { canonicalText, snapshot } from './canonical.js';

export function rehydrateOutcome(input: unknown, context: DecodeContext): Result<Outcome> { return decode('Outcome', input, context); }
export function rehydrateResult<T>(input: unknown, context: DecodeContext, readPayload: (input: unknown) => Result<T>): Result<Result<T>> {
  try {
    return consumeResult(decode('Result', input, context), {
      Refused: r => r,
      Success: recorded => consumeResult<Json, Result<Result<T>>>(recorded, {
        Refused: r => success(r),
        Success: (payload, capacity) => consumeResult<T, Result<Result<T>>>(readPayload(payload), { Refused: r => r, Success: v => success(success(v, capacity)) }),
      }),
    });
  } catch { return refusal('recorded Result payload validation failed', context.preserved); }
}
export function rehydrateConflict(input: unknown, context: DecodeContext, sides: {
  left: DecodeContext; right: DecodeContext;
} = { left: context, right: context }): Result<Conflict> {
  try {
    const v = snapshot(input) as Record<string, Json>;
    if (v.type !== 'Conflict' || v.schemaVersion !== 1 || Object.keys(v).sort().join(',') !== 'fields,left,origins,right,schemaVersion,subject,type') return refusal('invalid serialized Conflict fields', context.preserved);
    const left = v.left as Record<string, Json>; const right = v.right as Record<string, Json>;
    if (!left || !right || left.type !== right.type || left.type === 'Conflict' || typeof left.type !== 'string') return refusal('invalid Conflict side types', context.preserved);
    const type = left.type as keyof Inventory;
    return consumeResult(decode(type, left, sides.left), { Refused: r => r, Success: a =>
      consumeResult(decode(type, right, sides.right), { Refused: r => r, Success: b =>
        consumeResult(decode('Scope', v.subject, context), { Refused: r => r, Success: subject =>
          consumeResult(sessionFor(context) ? compareHistorical(type, a, b, subject, context) : compare(type, a, b, 'identity', subject, context.preserved), { Refused: r => r, Success: conflict => {
            if (typeof conflict === 'boolean' || canonicalText(conflict) !== canonicalText(v)) return refusal('serialized conflict disagrees with derived conflict', context.preserved);
            return success(conflict);
          } }),
        }),
      }),
    });
  } catch { return refusal('malformed serialized Conflict', context.preserved); }
}
