import { ensure } from './boundary.js';
import { parseCronV1 } from './cron.js';
import type { NormalizedCronV1 } from './contracts.js';
import { canonicalInstant, parseRfc3339Offset } from './time.js';

const minuteMs = 60_000;
const dayMs = 86_400_000;

// Integer Gregorian conversion keeps the planner independent of ambient time.
function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yoe = adjustedYear - era * 400;
  const shiftedMonth = month + (month > 2 ? -3 : 9);
  const doy = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(days: number): { year: number; month: number; day: number } {
  const z = days + 719468; const era = Math.floor(z / 146097); const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  let year = yoe + era * 400; const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153); const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9); year += month <= 2 ? 1 : 0;
  return { year, month, day };
}

function canonicalMinute(instant: number): string {
  const { year, month, day } = civilFromDays(Math.floor(instant / dayMs));
  const minuteOfDay = Math.floor((instant % dayMs + dayMs) % dayMs / minuteMs);
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}:00Z`;
}

const firstInstant = daysFromCivil(0, 1, 1) * dayMs;
const afterLastInstant = daysFromCivil(10000, 1, 1) * dayMs;

function fields(formatter: Intl.DateTimeFormat, instant: number) {
  const parts = formatter.formatToParts(instant);
  const values = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
  // Intl labels astronomical year 0 as 1 BC (and year -1 as 2 BC).
  const year = parts.some(part => part.type === 'era' && part.value === 'BC') ? 1 - values.year! : values.year!;
  return { year, month: values.month!, day: values.day!, hour: values.hour!, minute: values.minute! };
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
    timeZone, era: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
}

function matchingDayInstant(cron: NormalizedCronV1, formatter: Intl.DateTimeFormat, day: number,
  cutoff: number, direction: 'next' | 'previous', inclusive = true): number | null {
  const dayNumber = Math.floor(day / dayMs);
  const civil = civilFromDays(dayNumber);
  if (civil.year < 0 || civil.year > 9999) return null;
  const weekday = ((dayNumber + 4) % 7 + 7) % 7;
  if (!dayAllowed(cron, civil.month, civil.day, weekday)) return null;
  // Probe both sides of a zone change, then choose the earlier UTC instant
  // for each repeated wall minute. Nonexistent wall minutes have no match.
  const offsets = new Set<number>();
  for (let hour = -36; hour <= 36; hour += 6) {
    const probe = day + hour * 3_600_000;
    const wall = fields(formatter, probe);
    const wallAsUtc = daysFromCivil(wall.year, wall.month, wall.day) * dayMs
      + wall.hour * 3_600_000 + wall.minute * minuteMs;
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
        if (candidate < firstInstant || candidate >= afterLastInstant) continue;
        const actual = fields(formatter, candidate);
        if (actual.year === civil.year && actual.month === civil.month
          && actual.day === civil.day && actual.hour === hour && actual.minute === minute
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
  return daysFromCivil(local.year, local.month, local.day) * dayMs;
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
    if (civilFromDays(Math.floor(day / dayMs)).year > 9999) return null;
    const earliest = matchingDayInstant(cron, formatter, day, fromMs, 'next', inclusive);
    if (earliest !== null) return canonicalMinute(earliest);
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
    if (civilFromDays(Math.floor(day / dayMs)).year < 0) return null;
    const latest = matchingDayInstant(cron, formatter, day, atMs, 'previous');
    if (latest !== null) return canonicalMinute(latest);
    day -= dayMs;
  }
  return null;
}

export function cronMatchesInstant(expression: string, timeZone: string, instant: string): boolean {
  const at = parseRfc3339Offset(instant);
  return nextCronInstant(expression, timeZone, at, true) === canonicalInstant(instant);
}
