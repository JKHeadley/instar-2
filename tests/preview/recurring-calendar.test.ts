import { expect, it } from 'vitest';
import { latestRecurringDay, nextRecurringDay, parseDatedItem, selectDatedItems } from './dated-memory.js';

const zone = 'America/Los_Angeles';
const parse = (when: string, at = Date.UTC(2026, 8, 25, 14)) =>
  parseDatedItem('operator:1', `Tell me ${when} what needs attention`, when, at, zone);

it('resolves daily and weekday local schedules, keeping ambiguous times unresolved', () => {
  expect(parse('every morning at 8')).toMatchObject({ recurrence: 'daily', day: '2026-09-25', time: '08:00' });
  expect(parse('every day at 8 am')).toMatchObject({ recurrence: 'daily', day: '2026-09-25', time: '08:00' });
  expect(parse('every weekday at 8 am', Date.UTC(2026, 8, 25, 16)))
    .toMatchObject({ recurrence: 'weekdays', day: '2026-09-28', time: '08:00' });
  expect(parse('every day at 8').ambiguity).toBe('AM or PM unspecified');
  expect(parse('every day').ambiguity).toBe('recurring request needs a local time');
  expect(parse('every morning at 29').ambiguity).toBe('invalid time');
  expect(parse('every month at 8 am').ambiguity).toBe('date expression unresolved');
  expect(parse('tomorrow at 8 am').recurrence).toBeUndefined();
});

it('keeps occurrence identity on a local day through both DST transitions and skips weekends', () => {
  const daily = parse('every day at 1:30 am', Date.UTC(2026, 9, 30));
  expect(latestRecurringDay(daily, Date.UTC(2026, 10, 1, 8, 30))).toBe('2026-11-01');
  expect(latestRecurringDay(daily, Date.UTC(2026, 10, 1, 9, 30))).toBe('2026-11-01');
  expect(nextRecurringDay(daily, '2026-11-01')).toBe('2026-11-02');
  const gap = parse('every day at 2:30 am', Date.UTC(2026, 2, 6));
  expect(latestRecurringDay(gap, Date.UTC(2026, 2, 8, 9, 59))).toBe('2026-03-07');
  expect(latestRecurringDay(gap, Date.UTC(2026, 2, 8, 10))).toBe('2026-03-08');
  const weekday = parse('every weekday at 8 am');
  expect(nextRecurringDay(weekday, '2026-09-25')).toBe('2026-09-28');
  expect(latestRecurringDay(weekday, Date.UTC(2026, 8, 27, 19))).toBe('2026-09-25');
});

it('shows recurring dates in bounded calendar recall without losing the series', () => {
  const daily = parse('every morning at 8');
  const weekday = parse('every weekday at 8 am');
  const now = Date.UTC(2026, 8, 26, 19);
  expect(selectDatedItems([daily], 'tomorrow', now, zone).items[0])
    .toMatchObject({ day: '2026-09-27', recurrence: 'daily' });
  const selected = selectDatedItems([weekday], 'next week', now, zone);
  expect(selected.items.filter(item => item.day! >= '2026-09-28' && item.day! <= '2026-10-04')
    .map(item => item.day)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  expect(selectDatedItems([daily], 'next week', now, zone, 2).items).toHaveLength(2);
});
