// Private validation sessions let historical invariants compose without issuing live authority.
import type { DecodeContext } from '../types/ports.js';
import type { Clock, Hash } from '../types/values.js';
import { seal, trusted } from '../types/internal.js';
export type CaptureStatus = 'available' | 'tombstoned' | 'expired' | 'missing';
export interface HistoricalSession {
  readonly issued: WeakSet<object>;
  readonly unavailable: Map<string, { reference: string; hash: Hash; status: Exclude<CaptureStatus, 'available'> }>;
  readonly statuses: Readonly<Record<string, CaptureStatus>>;
  readonly now?: Clock;
}
const sessions = new WeakMap<DecodeContext, HistoricalSession>();
export function inSession(context: DecodeContext, session: HistoricalSession): DecodeContext { sessions.set(context, session); return context; }
export function sessionFor(context: DecodeContext): HistoricalSession | undefined { return sessions.get(context); }
export function childContext(context: DecodeContext, fields: Partial<DecodeContext>): DecodeContext {
  const child = { ...context, ...fields }; const session = sessionFor(context);
  return session ? inSession(child, session) : child;
}
export function sealInContext<T>(value: object, context: DecodeContext): T {
  const session = sessionFor(context); const result = seal<T>(value, !session);
  session?.issued.add(value); return result;
}
export function trustedIn(context: DecodeContext, value: unknown, type: string): boolean {
  return trusted(value, type) || (!!value && typeof value === 'object' && sessionFor(context)?.issued.has(value) === true && (value as { type?: unknown }).type === type);
}
export function authorityTime(context: DecodeContext, liveTime: Clock): Clock {
  const session = sessionFor(context);
  if (!session) return liveTime;
  if (!session.now) throw new Error('historical standing requires an explicit causal clock proof');
  return session.now;
}
