import type { Capacity, Refused, RefusalReason, Result, Scope, Success } from './values.js';
const issued = new WeakSet<object>();
const subjects = new WeakMap<object, Scope>();
export function bindRecordSubject(record: object, scope: Scope): void { subjects.set(record, scope); }
export function recordSubject(record: object): Scope | undefined { return subjects.get(record); }
// Not exported by the package. Only decoders and pure derivations may use this factory.
export function seal<T>(value: object, live = true): T {
  function freeze(item: object): void {
    for (const child of Object.values(item)) if (child && typeof child === 'object' && !Object.isFrozen(child)) freeze(child);
    Object.freeze(item);
  }
  freeze(value);
  if (live) issued.add(value);
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
