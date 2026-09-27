/** Calendar interpretation for the preview's operator-authored dated clauses. */
export interface DatedItem { source: string; quote: string; when: string; zone: string;
  day?: string; time?: string; ambiguity?: string }

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
const dayKey = (year: number, month: number, day: number) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const validDay = (year: number, month: number, day: number) => {
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() + 1 === month && value.getUTCDate() === day;
};
export function localParts(at: number, zone: string) {
  const fields = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const part = (type: string) => Number(fields.find(field => field.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute') };
}

export function parseDatedItem(source: string, quote: string, when: string, at: number, zone: string): DatedItem {
  // Validation and interpretation happen once, before the encrypted answer frame is appended.
  const today = localParts(at, zone), localToday = dayKey(today.year, today.month, today.day);
  let day: string | undefined, ambiguity: string | undefined;
  const phrase = when.trim();
  const expression = phrase.replace(/\.$/u, '');
  const timed = /^(.+?)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/iu.exec(expression);
  const date = timed?.[1] ?? expression;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/u.exec(date);
  const named = /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/iu.exec(date);
  const weekday = /^(?:(this|next)\s+)?(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/iu.exec(date);
  if (/\b(?:or|between|through)\b/iu.test(date)) ambiguity = 'multiple possible dates';
  else if (iso) {
    const year = Number(iso[1]), month = Number(iso[2]), date = Number(iso[3]);
    if (validDay(year, month, date)) day = dayKey(year, month, date); else ambiguity = 'invalid calendar date';
  } else if (named) {
    const month = months.findIndex(value => value.toLowerCase().startsWith(named[1]!.slice(0, 3).toLowerCase())) + 1;
    const date = Number(named[2]);
    let year = named[3] ? Number(named[3]) : today.year;
    if (!named[3] && dayKey(year, month, date) < localToday) year++;
    if (validDay(year, month, date)) day = dayKey(year, month, date); else ambiguity = 'invalid calendar date';
  } else if (weekday) {
    if (weekday[1]) ambiguity = 'this/next weekday has more than one common reading';
    const target = weekdays.findIndex(value => value.toLowerCase() === weekday[2]!.toLowerCase());
    const current = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
    let ahead = (target - current + 7) % 7;
    if (ahead === 0 && !weekday[1]) ambiguity = 'weekday could mean today or next week';
    if (!ambiguity) {
      const value = new Date(Date.UTC(today.year, today.month - 1, today.day + ahead));
      day = dayKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
    }
  } else if (/^tomorrow$/iu.test(date)) {
    const value = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
    day = dayKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  } else if (/^today$/iu.test(date)) day = localToday;
  else ambiguity = 'date expression unresolved';
  let time: string | undefined;
  if (timed) {
    const hour = Number(timed[2]), minute = Number(timed[3] ?? 0);
    const meridiem = timed[4]?.toLowerCase();
    if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) ambiguity = 'invalid time';
    else if (meridiem) time = `${String(hour % 12 + (meridiem === 'pm' ? 12 : 0)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    else if (timed[3] && (hour === 0 || hour > 12)) time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    else ambiguity = ambiguity ?? 'AM or PM unspecified';
  }
  return { source, quote, when: phrase, zone, ...(day ? { day } : {}), ...(time ? { time } : {}),
    ...(ambiguity ? { ambiguity } : {}) };
}

export function dueState(item: DatedItem, now: number): 'upcoming' | 'due' | 'overdue' | 'ambiguous' {
  if (!item.day) return 'ambiguous';
  const local = localParts(now, item.zone), today = dayKey(local.year, local.month, local.day);
  if (item.day < today) return 'overdue';
  if (item.day > today) return 'upcoming';
  if (item.time && !item.ambiguity && item.time < `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`) return 'overdue';
  return 'due';
}
