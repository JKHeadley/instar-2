export type ProviderFailureClass = 'limit' | 'policy' | 'timeout' | 'transport' | 'unknown';
export type ProviderFailure = Readonly<{ failureClass: ProviderFailureClass; resetHint: string | null; resetAt: number | null }>;

/** Only a failed result frame may supply a reason. Never return provider prose. */
export function classifyProviderFailure(input: Readonly<{
  code: number | null; limited: boolean; stdout: string; now: number;
}>): ProviderFailure {
  const result = (failureClass: ProviderFailureClass, resetHint: string | null = null,
    resetAt: number | null = null): ProviderFailure => ({ failureClass, resetHint, resetAt });
  if (input.limited) return result('timeout');
  let frame: any;
  try { frame = JSON.parse(input.stdout); } catch { return result(input.code === 0 ? 'unknown' : 'transport'); }
  if (!frame || frame.type !== 'result' || frame.is_error !== true)
    return result(input.code === 0 ? 'unknown' : 'transport');
  const detail = [frame.subtype, frame.result, frame.error].filter(value => typeof value === 'string').join(' ').slice(0, 8192);
  if (/usage.policy|usage policy|content.policy|content policy|acceptable use|policy violation/i.test(detail)) return result('policy');
  if (/you'?ve (?:hit|reached) your (?:session|usage|5.hour) limit|(?:session|usage|5.hour) limit reached|\blimit\b[^.\n]{0,30}\bresets?\b/i.test(detail)) {
    const relative = /resets?\s+(?:in\s+)?(\d{1,3})\s*(minutes?|mins?|hours?|hrs?|m|h)\b/i.exec(detail);
    if (relative) {
      const count = Number(relative[1]);
      const milliseconds = count * (/^h/i.test(relative[2]!) ? 3600000 : 60000);
      return result('limit', null, milliseconds > 0 && milliseconds <= 18000000 ? input.now + milliseconds : null);
    }
    const clock = /resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(detail);
    if (clock) {
      const hour = Number(clock[1]), minute = Number(clock[2] ?? '0');
      if (hour >= 1 && hour <= 12 && minute <= 59) {
        const candidate = new Date(input.now);
        candidate.setHours(hour % 12 + (clock[3]!.toLowerCase() === 'pm' ? 12 : 0), minute, 0, 0);
        if (candidate.getTime() <= input.now) candidate.setDate(candidate.getDate() + 1);
        return result('limit', `${hour}:${String(minute).padStart(2, '0')}${clock[3]!.toLowerCase()}`, candidate.getTime());
      }
    }
    return result('limit');
  }
  if (/timed?\s*out|timeout/i.test(detail)) return result('timeout');
  return result('unknown');
}
