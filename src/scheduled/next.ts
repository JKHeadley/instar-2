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

/** The earliest matching UTC minute at or after `fromMs` (or strictly after it).
 * A repeated wall minute has one occurrence: its earlier UTC instant. */
export function nextCronInstant(expression: string, timeZone: string, fromMs: number,
  inclusive = false): string | null {
  ensure(Number.isSafeInteger(fromMs), 'next occurrence requires a whole-millisecond clock');
  const cron = parseCronV1(expression);
  const formatter = zoneFormatter(timeZone);
  const local = fields(formatter, fromMs);
  let day = parseRfc3339Offset(`${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}T00:00:00Z`);
  const limit = day + 366 * 8 * dayMs;
  while (day < limit) {
    const utc = fields(zoneFormatter('UTC'), day);
    if (utc.year > 9999) return null;
    const weekday = ((Math.floor(day / dayMs) + 4) % 7 + 7) % 7;
    if (dayAllowed(cron, utc.month, utc.day, weekday)) {
      // Offset probes bracket both sides of a seasonal change. Validate each
      // candidate against Intl; nonexistent wall minutes are discarded.
      const offsets = new Set<number>();
      for (let hour = -36; hour <= 36; hour += 6) {
        const probe = day + hour * 3_600_000;
        const wall = fields(formatter, probe);
        const wallAsUtc = parseRfc3339Offset(`${String(wall.year).padStart(4, '0')}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}T${String(wall.hour).padStart(2, '0')}:${String(wall.minute).padStart(2, '0')}:00Z`);
        offsets.add(wallAsUtc - Math.floor(probe / minuteMs) * minuteMs);
      }
      let earliest: number | null = null;
      for (const hour of cron.fields[1]) for (const minute of cron.fields[0]) {
        const wallMinute = day + hour * 3_600_000 + minute * minuteMs;
        let selected: number | null = null;
        for (const offset of offsets) {
          const candidate = wallMinute - offset;
          const actual = fields(formatter, candidate);
          if (actual.year === utc.year && actual.month === utc.month && actual.day === utc.day
            && actual.hour === hour && actual.minute === minute
            && (selected === null || candidate < selected)) selected = candidate;
        }
        if (selected !== null && (inclusive ? selected >= fromMs : selected > fromMs)
          && (earliest === null || selected < earliest)) earliest = selected;
      }
      if (earliest !== null) return canonicalInstant(new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).format(earliest).replace(' ', 'T') + 'Z');
    }
    day += dayMs;
  }
  return null;
}

export function cronMatchesInstant(expression: string, timeZone: string, instant: string): boolean {
  const at = parseRfc3339Offset(instant);
  return nextCronInstant(expression, timeZone, at, true) === canonicalInstant(instant);
}
