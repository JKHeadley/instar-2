import { ensure } from './boundary.js';

const rfc3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

function leap(year: number): boolean { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
function daysInMonth(year: number, month: number): number {
  return [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}
// Howard Hinnant's civil-date conversion, expressed without ambient Date/time.
function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yoe = adjustedYear - era * 400;
  const shiftedMonth = month + (month > 2 ? -3 : 9);
  const doy = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function parseRfc3339Offset(source: string): number {
  const match = rfc3339.exec(source); ensure(match, 'timestamp must be RFC 3339 with Z or numeric offset');
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const hour = Number(match[4]); const minute = Number(match[5]); const second = Number(match[6]);
  ensure(month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month), 'timestamp has invalid calendar date');
  ensure(hour <= 23 && minute <= 59 && second <= 59, 'timestamp has invalid clock value');
  const fraction = match[7] ?? '';
  ensure(fraction.length <= 3 || /^0*$/.test(fraction.slice(3)), 'timestamp precision is below milliseconds');
  const milliseconds = Number(fraction.slice(0, 3).padEnd(3, '0'));
  let offset = 0;
  if (match[8] !== 'Z') {
    const sign = match[8]![0] === '+' ? 1 : -1; const oh = Number(match[8]!.slice(1, 3)); const om = Number(match[8]!.slice(4, 6));
    ensure(oh <= 23 && om <= 59, 'timestamp has invalid numeric offset'); offset = sign * (oh * 60 + om);
  }
  const value = ((daysFromCivil(year, month, day) * 24 + hour) * 60 + minute - offset) * 60_000 + second * 1000 + milliseconds;
  ensure(Number.isSafeInteger(value), 'timestamp is outside safe clock range'); return value;
}

export function canonicalInstant(source: string): string {
  const value = parseRfc3339Offset(source);
  // Canonical occurrence identity is always RFC-3339-Z. This formatter is arithmetic,
  // not an ambient clock read.
  const days = Math.floor(value / 86_400_000); let remainder = value - days * 86_400_000;
  let z = days + 719468; const era = Math.floor(z / 146097); const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  let year = yoe + era * 400; const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153); const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9); year += month <= 2 ? 1 : 0;
  const hour = Math.floor(remainder / 3_600_000); remainder -= hour * 3_600_000;
  const minute = Math.floor(remainder / 60_000); remainder -= minute * 60_000;
  const second = Math.floor(remainder / 1000); const millisecond = remainder - second * 1000;
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${millisecond ? `.${pad(millisecond, 3)}` : ''}Z`;
}
