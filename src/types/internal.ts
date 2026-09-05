import type { Capacity, Refused, RefusalReason, Result, Success } from './values.js';
const issued = new WeakSet<object>();
// Not exported by the package. Only decoders and pure derivations may use this factory.
export function seal<T>(value: object): T {
  function freeze(item: object): void {
    for (const child of Object.values(item)) if (child && typeof child === 'object' && !Object.isFrozen(child)) freeze(child);
    Object.freeze(item);
  }
  freeze(value);
  issued.add(value);
  return value as T;
}
export function trusted(value: unknown, type: string): boolean {
  return !!value && typeof value === 'object' && issued.has(value) && (value as { type?: unknown }).type === type;
}
export function errorDetail(error: unknown): string {
  try { return error instanceof Error && typeof error.message === 'string' ? error.message : 'malformed input or decoding context'; }
  catch { return 'malformed input or decoding context'; }
}
export function success<T>(value: T, capacity: Capacity = { kind: 'none' }): Success<T> {
  return seal({ type: 'Result', schemaVersion: 1, kind: 'Success', value, capacity });
}
export function refusal(detail: string, preserved: string, reason: RefusalReason = 'decode', site = 'types.decode', failDirection: 'open' | 'closed' = 'closed'): Refused {
  return seal({ type: 'Result', schemaVersion: 1, kind: 'Refused', reason, detail, site, failDirection, preserved });
}
export function consumeResult<T, R>(result: Result<T>, handlers: { Success: (value: T, capacity: Capacity) => R; Refused: (refused: Refused) => R }): R {
  return result.kind === 'Success' ? handlers.Success(result.value, result.capacity) : handlers.Refused(result);
}
