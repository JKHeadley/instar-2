import { localParts } from './dated-memory.js';

/** Calendar windows for direct requests to recap a period. Day keys are read in
 * the installed zone, so a daylight-saving change cannot shift a week's edge. */
export function requestedPeriod(message: string, now: number, zone: string): { from: string; through: string; zone: string } | null {
  if (!/\b(?:what did we|what have we|what did i|summari[sz]e|summary|recap|talked about|discussed)\b/iu.test(message)) return null;
  const local = localParts(now, zone);
  const today = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const key = (day: Date) => day.toISOString().slice(0, 10);
  const shifted = (day: Date, count: number) => new Date(day.getTime() + count * 86_400_000);
  const text = message.toLowerCase();
  const absolute = /\b(20\d{2}-\d{2}-\d{2})\s+(?:to|through)\s+(20\d{2}-\d{2}-\d{2})\b/u.exec(text);
  const relative = [...text.matchAll(/\b(?:this|last) (?:week|month)\b|\b(?:today|yesterday)\b|\b(?:past|last) \d{1,2} days?\b/gu)];
  if (relative.length + Number(absolute !== null) !== 1) return null;
  if (absolute) {
    const start = new Date(`${absolute[1]}T00:00:00Z`), end = new Date(`${absolute[2]}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || key(start) !== absolute[1]
      || key(end) !== absolute[2] || end.getTime() < start.getTime()
      || end.getTime() - start.getTime() >= 31 * 86_400_000) return null;
    return { from: absolute[1]!, through: absolute[2]!, zone };
  }
  let from: Date, through = today;
  if (/\b(?:this|last) week\b/u.test(text)) {
    const monday = shifted(today, -((today.getUTCDay() + 6) % 7));
    from = /\blast week\b/u.test(text) ? shifted(monday, -7) : monday;
    if (/\blast week\b/u.test(text)) through = shifted(monday, -1);
  } else if (/\b(?:this|last) month\b/u.test(text)) {
    const previous = /\blast month\b/u.test(text);
    from = new Date(Date.UTC(local.year, local.month - (previous ? 2 : 1), 1));
    if (previous) through = shifted(new Date(Date.UTC(local.year, local.month - 1, 1)), -1);
  } else if (/\byesterday\b/u.test(text)) from = through = shifted(today, -1);
  else if (/\btoday\b/u.test(text)) from = today;
  else {
    const past = /\b(?:past|last) (\d{1,2}) days?\b/u.exec(text);
    if (!past || Number(past[1]) < 1 || Number(past[1]) > 31) return null;
    from = shifted(today, 1 - Number(past[1]));
  }
  return { from: key(from), through: key(through), zone };
}

export function inRequestedPeriod(at: number | null, period: { from: string; through: string; zone: string }): boolean {
  if (at === null) return false;
  const parts = localParts(at, period.zone);
  const day = `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  return day >= period.from && day <= period.through;
}
