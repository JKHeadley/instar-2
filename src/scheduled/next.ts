import { ensure } from './boundary.js';
import { parseCronV1 } from './cron.js';
import type { NormalizedCronV1 } from './contracts.js';
import { canonicalInstant, parseRfc3339Offset } from './time.js';

const minuteMs = 60_000;
const dayMs = 86_400_000;

function fields(formatter: Intl.DateTimeFormat, instant: number) {
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, Number(part.value)]));
  return { year: parts.year!, month: parts.month!, day: parts.day!, hour: parts.hour!, minute: parts.minute! };
}

function dayAllowed(cron: NormalizedCronV1, month: number, day: number, weekday: number): boolean {
  if (!cron.fields[3].includes(month)) return false;
  const dom = cron.fields[2].includes(day), dow = cron.fields[4].includes(weekday);
  if (cron.dayOfMonthUnrestricted) return dow;
  if (cron.dayOfWeekUnrestricted) return dom;
  return dom || dow;
}

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US-u-nu-latn', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
}

function matchingDayInstant(cron: NormalizedCronV1, formatter: Intl.DateTimeFormat, day: number,
  cutoff: number, direction: 'next' | 'previous', inclusive = true): number | null {
  const utc = new Date(day);
  const weekday = utc.getUTCDay();
  if (!dayAllowed(cron, utc.getUTCMonth() + 1, utc.getUTCDate(), weekday)) return null;
  // Probe both sides of a zone change, then choose the earlier UTC instant
  // for each repeated wall minute. Nonexistent wall minutes have no match.
  const offsets = new Set<number>();
  for (let hour = -36; hour <= 36; hour += 6) {
    const probe = day + hour * 3_600_000;
    const wall = fields(formatter, probe);
    const wallAsUtc = parseRfc3339Offset(`${String(wall.year).padStart(4, '0')}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}T${String(wall.hour).padStart(2, '0')}:${String(wall.minute).padStart(2, '0')}:00Z`);
    offsets.add(wallAsUtc - Math.floor(probe / minuteMs) * minuteMs);
  }
  const hours = cron.fields[1], minutes = cron.fields[0];
  for (let hi = direction === 'next' ? 0 : hours.length - 1;
    hi >= 0 && hi < hours.length; hi += direction === 'next' ? 1 : -1) {
    const hour = hours[hi]!;
    for (let mi = direction === 'next' ? 0 : minutes.length - 1;
      mi >= 0 && mi < minutes.length; mi += direction === 'next' ? 1 : -1) {
      const minute = minutes[mi]!;
      const wallMinute = day + hour * 3_600_000 + minute * minuteMs;
      let earliest: number | null = null;
      for (const offset of offsets) {
        const candidate = wallMinute - offset;
        const actual = fields(formatter, candidate);
        if (actual.year === utc.getUTCFullYear() && actual.month === utc.getUTCMonth() + 1
          && actual.day === utc.getUTCDate() && actual.hour === hour && actual.minute === minute
          && (earliest === null || candidate < earliest)) earliest = candidate;
      }
      if (earliest !== null && (direction === 'previous' ? earliest <= cutoff
        : inclusive ? earliest >= cutoff : earliest > cutoff)) return earliest;
    }
  }
  return null;
}

function localDay(formatter: Intl.DateTimeFormat, instant: number): number {
  const local = fields(formatter, instant);
  return parseRfc3339Offset(`${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}T00:00:00Z`);
}

/** The earliest matching UTC minute at or after `fromMs` (or strictly after it).
 * A repeated wall minute has one occurrence: its earlier UTC instant. */
export function nextCronInstant(expression: string, timeZone: string, fromMs: number,
  inclusive = false): string | null {
  ensure(Number.isSafeInteger(fromMs), 'next occurrence requires a whole-millisecond clock');
  const cron = parseCronV1(expression);
  const formatter = zoneFormatter(timeZone);
  let day = localDay(formatter, fromMs);
  const limit = day + 366 * 8 * dayMs;
  while (day < limit) {
    if (new Date(day).getUTCFullYear() > 9999) return null;
    const earliest = matchingDayInstant(cron, formatter, day, fromMs, 'next', inclusive);
    if (earliest !== null) return canonicalInstant(new Date(earliest).toISOString());
    day += dayMs;
  }
  return null;
}

/** The newest matching UTC minute at or before `atMs`, independent of job age. */
export function previousCronInstant(expression: string, timeZone: string, atMs: number): string | null {
  ensure(Number.isSafeInteger(atMs), 'previous occurrence requires a whole-millisecond clock');
  const cron = parseCronV1(expression);
  const formatter = zoneFormatter(timeZone);
  let day = localDay(formatter, atMs);
  const limit = day - 366 * 8 * dayMs;
  while (day > limit) {
    if (new Date(day).getUTCFullYear() < 0) return null;
    const latest = matchingDayInstant(cron, formatter, day, atMs, 'previous');
    if (latest !== null) return canonicalInstant(new Date(latest).toISOString());
    day -= dayMs;
  }
  return null;
}

export function cronMatchesInstant(expression: string, timeZone: string, instant: string): boolean {
  const at = parseRfc3339Offset(instant);
  return nextCronInstant(expression, timeZone, at, true) === canonicalInstant(instant);
}
