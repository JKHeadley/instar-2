// Adapted from Instar 1.x a8af8bff7ffd78dcdb2e032b216d22274141c44e,
// src/monitoring/delivery-failure-sentinel/recovery-policy.ts §3c.
// Rules 42, 55, 63, 116: retain the tuned bounds; the journal and its existing
// dispatch owner carry state. HTTP success is not receipt evidence in 2.0.
import type { SendOutcome } from './outbound-provenance.js';
export const BACKOFF_SCHEDULE_MS: readonly number[] = [
  30_000, 60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000,
  30 * 60_000, 60 * 60_000, 2 * 60 * 60_000, 4 * 60 * 60_000,
];
export const TTL_MS = 24 * 60 * 60_000;
export const MAX_ATTEMPTS = BACKOFF_SCHEDULE_MS.length;
export function recoveryDelay(outcome: SendOutcome, attempts: number, firstAt: number, now: number): number | null {
  if (!Number.isSafeInteger(attempts) || attempts < 0
    || !Number.isSafeInteger(firstAt) || !Number.isSafeInteger(now) || now < firstAt || now - firstAt >= TTL_MS) return null;
  if (outcome.kind !== 'not-sent' && !(outcome.kind === 'refused' && Number.isSafeInteger(outcome.retryAfterMs) && outcome.retryAfterMs! > 0)) return null;
  // The inherited rate-limit path does not consume a regular backoff slot.
  if (outcome.kind === 'not-sent' && (attempts < 1 || attempts >= MAX_ATTEMPTS)) return null;
  const delay = outcome.kind === 'refused' ? outcome.retryAfterMs! : BACKOFF_SCHEDULE_MS[attempts - 1]!;
  // A server-directed wait beyond the TTL expires without an early send.
  return Math.min(delay, TTL_MS - (now - firstAt));
}
