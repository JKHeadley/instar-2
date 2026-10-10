/** Calendar interpretation for the preview's operator-authored dated clauses. */
export interface DatedItem { source: string; quote: string; when: string; zone: string;
  day?: string; time?: string; ambiguity?: string; repeat?: 'weekly'; recurrence?: 'daily' | 'weekdays';
  /** The verified operator explicitly asked to be reminded: the scoped grant for this one send. */
  remind?: true }

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

/** Date phrases parseDatedItem reads. */
const DATE_PHRASE = /\b(?:today|tomorrow|(?:(?:this|next|every)\s+)?(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{4}-\d{1,2}-\d{1,2})(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b/giu;
/** A model may restate the operator's date phrase as an absolute date ("2026-09-29 09:03
 * America/Los_Angeles") instead of copying it. The runner then reads the operator's own phrase,
 * only when the quote holds exactly one, and only when it resolves to exactly the restated day
 * (and time, when given) in this zone. Any disagreement stays unverified. */
export function restatedDatePhrase(quote: string, when: string, at: number, zone: string): string | undefined {
  const found = [...quote.matchAll(DATE_PHRASE)].map(match => match[0]);
  const restated = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2})(?:\s*(am|pm))?)?(?:\s+([A-Za-z_]+\/[A-Za-z_]+))?$/iu.exec(when.trim());
  if (found.length !== 1 || !restated || restated[5] !== undefined && restated[5] !== zone) return undefined;
  const item = parseDatedItem('restated', quote, found[0]!, at, zone);
  if (item.ambiguity !== undefined || item.day !== restated[1]) return undefined;
  if (restated[2] !== undefined) {
    const hour = Number(restated[2]), meridiem = restated[4]?.toLowerCase();
    if (meridiem && (hour < 1 || hour > 12)) return undefined;
    const clock = `${String(meridiem ? hour % 12 + (meridiem === 'pm' ? 12 : 0) : hour).padStart(2, '0')}:${restated[3]}`;
    if (item.time !== clock) return undefined;
  }
  return found[0];
}

export function parseDatedItem(source: string, quote: string, when: string, at: number, zone: string): DatedItem {
  // Validation and interpretation happen once, before the encrypted answer frame is appended.
  const today = localParts(at, zone), localToday = dayKey(today.year, today.month, today.day);
  let day: string | undefined, ambiguity: string | undefined;
  const phrase = when.trim();
  const expression = phrase.replace(/\.$/u, '');
  const timed = /^(.+?)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/iu.exec(expression);
  const date = timed?.[1] ?? expression;
  const recurrence = /^(?:every day|daily|every morning)$/iu.test(date) ? 'daily' as const
    : /^(?:every weekday|weekdays)$/iu.test(date) ? 'weekdays' as const : undefined;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/u.exec(date);
  const named = /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/iu.exec(date);
  const weekday = /^(?:(this|next|every)\s+)?(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/iu.exec(date);
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
    if (weekday[1]?.toLowerCase() === 'this') ambiguity = 'this weekday has more than one common reading';
    const target = weekdays.findIndex(value => value.toLowerCase() === weekday[2]!.toLowerCase());
    const current = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
    // "Next Friday" is Friday of the next Monday-Sunday calendar week in the operator zone.
    const ahead = weekday[1]?.toLowerCase() === 'next'
      ? (7 - (current + 6) % 7) + (target + 6) % 7
      : (target - current + 7) % 7;
    if (ahead === 0 && !weekday[1]) ambiguity = 'weekday could mean today or next week';
    if (!ambiguity) {
      const value = new Date(Date.UTC(today.year, today.month - 1, today.day + ahead));
      day = dayKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
    }
  } else if (/^tomorrow$/iu.test(date)) {
    const value = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
    day = dayKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  } else if (/^today$/iu.test(date)) day = localToday;
  else if (recurrence) day = localToday;
  else ambiguity = 'date expression unresolved';
  let time: string | undefined;
  if (timed) {
    const hour = Number(timed[2]), minute = Number(timed[3] ?? 0);
    const meridiem = timed[4]?.toLowerCase() ?? (/^every morning$/iu.test(date) ? 'am' : undefined);
    if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) ambiguity = 'invalid time';
    else if (meridiem) time = `${String(hour % 12 + (meridiem === 'pm' ? 12 : 0)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    else if (timed[3] && (hour === 0 || hour > 12)) time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    else ambiguity = ambiguity ?? 'AM or PM unspecified';
  }
  if (recurrence && !timed) ambiguity = 'recurring request needs a local time';
  if (recurrence && day && time && !ambiguity) {
    const clock = `${String(today.hour).padStart(2, '0')}:${String(today.minute).padStart(2, '0')}`;
    if (time <= clock) day = addDay(day, 1);
    day = eligibleRecurringDay(day, recurrence, 1);
  }
  return { source, quote, when: phrase, zone, ...(recurrence ? { recurrence } : {}), ...(day ? { day } : {}), ...(time ? { time } : {}),
    ...(weekday?.[1]?.toLowerCase() === 'every' && day ? { repeat: 'weekly' as const } : {}),
    ...(ambiguity ? { ambiguity } : {}) };
}

export function dueState(item: DatedItem, now: number): 'upcoming' | 'due' | 'overdue' | 'ambiguous' {
  if (!item.day) return 'ambiguous';
  const local = localParts(now, item.zone), today = dayKey(local.year, local.month, local.day);
  if (item.repeat === 'weekly' && item.day <= today) {
    const elapsed = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${item.day}T00:00:00Z`)) / 86_400_000);
    if (elapsed % 7 !== 0) return 'upcoming';
    if (item.time && !item.ambiguity && item.time < `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`) return 'overdue';
    return 'due';
  }
  if (item.day < today) return 'overdue';
  if (item.day > today) return 'upcoming';
  if (item.time && !item.ambiguity && item.time < `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`) return 'overdue';
  return 'due';
}

/** A day-only item is eligible while its local calendar day intersects the next
 * 48 hours. A settled hour is compared as an instant, including a zone offset
 * change inside the window. Unresolved dates and hours cannot be promised. */
export function withinNext48Hours(item: DatedItem, now: number): boolean {
  if (!item.day || item.ambiguity && item.ambiguity !== 'AM or PM unspecified' || !Number.isFinite(now)) return false;
  const end = now + 48 * 60 * 60 * 1000;
  const localDay = (at: number) => {
    const parts = localParts(at, item.zone);
    return dayKey(parts.year, parts.month, parts.day);
  };
  if (!item.time) return item.day >= localDay(now) && item.day <= localDay(end);
  const [year, month, day] = item.day.split('-').map(Number);
  const [hour, minute] = item.time.split(':').map(Number);
  const wall = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  // Both offsets are considered when a daylight-saving transition repeats an hour.
  const offset = (at: number) => {
    const value = new Intl.DateTimeFormat('en-US', { timeZone: item.zone,
      timeZoneName: 'shortOffset' }).formatToParts(at).find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
    const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/u.exec(value);
    if (!match) throw Error('preview dated memory: zone offset unavailable');
    return (match[1] === '-' ? -1 : 1) * (Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)) * 60000;
  };
  return [offset(now), offset(end)].some(value => {
    const at = wall - value;
    const parts = localParts(at, item.zone);
    return at >= now && at <= end && dayKey(parts.year, parts.month, parts.day) === item.day
      && parts.hour === hour && parts.minute === minute;
  });
}

const addDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
  .toISOString().slice(0, 10);
const localDay = (at: number, zone: string) => {
  const local = localParts(at, zone);
  return dayKey(local.year, local.month, local.day);
};

/** Convert an exact source-zone wall time for travel queries; a DST gap stays on its source day. */
const queryDay = (item: DatedItem, zone: string) => {
  if (!item.day || !item.time || item.ambiguity || item.zone === zone) return item.day;
  const target = Date.parse(`${item.day}T${item.time}:00Z`);
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = localParts(instant, item.zone);
    const shown = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    instant += target - shown;
  }
  const source = localParts(instant, item.zone);
  if (dayKey(source.year, source.month, source.day) !== item.day
    || `${String(source.hour).padStart(2, '0')}:${String(source.minute).padStart(2, '0')}` !== item.time)
    return item.day;
  return localDay(instant, zone);
};

/** This is a packet-selection hint. The model still interprets the question. */
export function datedQuestionWindow(question: string, now: number, zone: string) {
  const local = localParts(now, zone), today = dayKey(local.year, local.month, local.day);
  const starts: string[] = [], ends: string[] = [];
  if (/\btoday\b/iu.test(question)) { starts.push(today); ends.push(today); }
  if (/\btomorrow\b/iu.test(question)) { starts.push(addDay(today, 1)); ends.push(addDay(today, 1)); }
  if (/\bnext week\b/iu.test(question)) {
    const weekday = new Date(Date.parse(`${today}T00:00:00Z`)).getUTCDay();
    const monday = addDay(today, 8 - (weekday || 7));
    starts.push(monday); ends.push(addDay(monday, 6));
  }
  if (!starts.length) return undefined;
  return { start: starts.sort()[0]!, end: ends.sort().at(-1)!, zone };
}

export function selectDatedItems(items: readonly DatedItem[], question: string, now: number, zone: string, limit = 32) {
  const window = datedQuestionWindow(question, now, zone);
  const today = localDay(now, zone);
  const candidates: Array<DatedItem & { state: ReturnType<typeof dueState>; queryDay?: string }> = [];
  for (const item of items) {
    if (!item.day) {
      candidates.push({ ...item, state: 'ambiguous' });
      continue;
    }
    if (item.repeat === 'weekly' || item.recurrence) {
      const first = window ? addDay(window.start, -2) : localDay(now, item.zone);
      const interval = item.recurrence ? 1 : 7;
      const elapsed = Math.max(0, Math.ceil((Date.parse(`${first}T00:00:00Z`) - Date.parse(`${item.day}T00:00:00Z`)) / (interval * 86_400_000)));
      const end = window ? addDay(window.end, 2) : item.day > addDay(first, 6) ? item.day : addDay(first, 6);
      for (let day = addDay(item.day, elapsed * interval); day <= end; day = addDay(day, interval)) {
        if (item.recurrence && eligibleRecurringDay(day, item.recurrence, 1) !== day) continue;
        const { repeat: _repeat, ...once } = item;
        const occurrence = { ...once, day }, shownDay = queryDay(occurrence, zone);
        if (day >= first)
          candidates.push({ ...item, day, ...(shownDay && shownDay !== day ? { queryDay: shownDay } : {}),
            state: dueState(occurrence, now) });
      }
    } else {
      const shownDay = queryDay(item, zone);
      candidates.push({ ...item, ...(shownDay && shownDay !== item.day ? { queryDay: shownDay } : {}),
        state: dueState(item, now) });
    }
  }
  candidates.sort((a, b) => {
    if (window) {
      const rank = (item: typeof a) => {
        const day = item.queryDay ?? item.day;
        if (!day) return [2, Number.MAX_SAFE_INTEGER, 0] as const;
        if (day >= window.start && day <= window.end) return [0, 0, 0] as const;
        const after = day > window.end;
        const edge = after ? window.end : window.start;
        return [1, Math.abs(Date.parse(`${day}T00:00:00Z`) - Date.parse(`${edge}T00:00:00Z`)), after ? 0 : 1] as const;
      };
      const left = rank(a), right = rank(b);
      return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
        || (a.queryDay ?? a.day ?? '').localeCompare(b.queryDay ?? b.day ?? '')
        || (a.time ?? '').localeCompare(b.time ?? '') || a.source.localeCompare(b.source);
    }
    const distance = (item: typeof a) => item.day
      ? Math.abs(Date.parse(`${item.queryDay ?? item.day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) : Number.MAX_SAFE_INTEGER;
    return distance(a) - distance(b) || (a.day ?? '').localeCompare(b.day ?? '') || a.source.localeCompare(b.source);
  });
  if (!window) return { items: candidates.slice(0, limit), omitted: Math.max(0, candidates.length - limit), window };
  const inWindow = (item: (typeof candidates)[number]) => {
    const day = item.queryDay ?? item.day;
    return day !== undefined && day >= window.start && day <= window.end;
  };
  const matched = candidates.filter(inWindow), fallback = candidates.filter(item => !inWindow(item));
  const shown = matched.slice(0, Math.max(0, limit));
  const fallbackLimit = Math.min(4, fallback.length, Math.max(0, limit - shown.length));
  const selected = [...shown, ...fallback.slice(0, fallbackLimit)];
  return { items: selected, omitted: Math.max(0, candidates.length - selected.length), window };
}

/** Calendar arithmetic, never 24-hour delays: DST cannot create a second occurrence on one local day. */
const eligibleRecurringDay = (day: string, recurrence: 'daily' | 'weekdays', direction: 1 | -1) => {
  if (recurrence === 'daily') return day;
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? addDay(day, direction === 1 ? 1 : -2)
    : weekday === 6 ? addDay(day, direction === 1 ? 2 : -1) : day;
};
export const nextRecurringDay = (item: DatedItem, after: string) =>
  eligibleRecurringDay(addDay(after, 1), item.recurrence!, 1);
/** Collapse downtime to the most recent due local occurrence; never enumerate a backlog. */
export const latestRecurringDay = (item: DatedItem, now: number) => {
  const parts = localParts(now, item.zone);
  let day = dayKey(parts.year, parts.month, parts.day);
  const clock = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  if (clock < item.time!) day = addDay(day, -1);
  day = eligibleRecurringDay(day, item.recurrence!, -1);
  return day < item.day! ? item.day! : day;
};
