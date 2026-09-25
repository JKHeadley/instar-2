export type ProviderFailureClass = 'limit' | 'policy' | 'timeout' | 'transport' | 'unknown';
export type ProviderFailure = Readonly<{ failureClass: ProviderFailureClass; resetHint: string | null; resetAt: number | null }>;

/** Only a failed result frame may supply a reason. Never return provider prose. */
export function classifyProviderFailure(input: Readonly<{
  code: number | null; limited: boolean; stdout: string; now: number;
  localClockResetAt?: (hour: number, minute: number, now: number) => number;
  calendarResetAt?: (month: number, day: number, hour: number, minute: number, zone: string, now: number) => number;
}>): ProviderFailure {
  const result = (failureClass: ProviderFailureClass, resetHint: string | null = null,
    resetAt: number | null = null): ProviderFailure => ({ failureClass, resetHint, resetAt });
  if (input.limited) return result('timeout');
  let frame: unknown;
  try { frame = JSON.parse(input.stdout); } catch { return result(input.code === 0 ? 'unknown' : 'transport'); }
  if (!frame || typeof frame !== 'object' || !('type' in frame) || !('is_error' in frame)
    || frame.type !== 'result' || frame.is_error !== true)
    return result(input.code === 0 ? 'unknown' : 'transport');
  const fields = frame as Record<string, unknown>;
  const detail = [fields.subtype, fields.result, fields.error].filter(value => typeof value === 'string').join(' ').slice(0, 8192);
  if (/usage.policy|usage policy|content.policy|content policy|acceptable use|policy violation/i.test(detail)) return result('policy');
  if (/you'?ve (?:hit|reached) your (?:weekly|session|usage|5.hour) limit|(?:weekly|session|usage|5.hour) limit reached|\blimit\b[^\n]{0,60}\bresets?\b/i.test(detail)) {
    const relative = /resets?\s+(?:in\s+)?(\d{1,3})\s*(minutes?|mins?|hours?|hrs?|m|h)\b/i.exec(detail);
    if (relative) {
      const count = Number(relative[1]);
      const milliseconds = count * (/^h/i.test(relative[2]!) ? 3600000 : 60000);
      return result('limit', null, milliseconds > 0 && Number.isSafeInteger(input.now + milliseconds) ? input.now + milliseconds : null);
    }
    const calendar = /resets?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(([A-Za-z_]+\/[A-Za-z_]+)\)/i.exec(detail);
    if (calendar) {
      const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
        .indexOf(calendar[1]!.toLowerCase()) + 1;
      const day = Number(calendar[2]), hour = Number(calendar[3]), minute = Number(calendar[4] ?? '0');
      if (day >= 1 && day <= 31 && hour >= 1 && hour <= 12 && minute <= 59) {
        const hour24 = hour % 12 + (calendar[5]!.toLowerCase() === 'pm' ? 12 : 0);
        let resetAt: number | null = null;
        try { resetAt = input.calendarResetAt?.(month, day, hour24, minute, calendar[6]!, input.now) ?? null; }
        catch { /* Invalid or unavailable host time zone leaves a bounded default hold. */ }
        const validReset = resetAt !== null && Number.isSafeInteger(resetAt) && resetAt > input.now;
        return result('limit', validReset
          ? `${calendar[1]} ${day} at ${hour}:${String(minute).padStart(2, '0')}${calendar[5]!.toLowerCase()} (${calendar[6]})`
          : null, validReset ? resetAt : null);
      }
    }
    const clock = /resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(detail);
    if (clock) {
      const hour = Number(clock[1]), minute = Number(clock[2] ?? '0');
      if (hour >= 1 && hour <= 12 && minute <= 59) {
        const hour24 = hour % 12 + (clock[3]!.toLowerCase() === 'pm' ? 12 : 0);
        const resetAt = input.localClockResetAt?.(hour24, minute, input.now) ?? null;
        return result('limit', `${hour}:${String(minute).padStart(2, '0')}${clock[3]!.toLowerCase()}`,
          resetAt !== null && Number.isSafeInteger(resetAt) && resetAt > input.now ? resetAt : null);
      }
    }
    return result('limit');
  }
  if (/timed?\s*out|timeout/i.test(detail)) return result('timeout');
  return result('unknown');
}
