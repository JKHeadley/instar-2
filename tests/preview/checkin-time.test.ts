import { expect, it } from 'vitest';
import { requestedTimeReached, type DatedItem } from './dated-memory.js';

const instant = Date.parse('2026-10-14T19:13:37.767Z');
const item: DatedItem = { source: 'one', quote: 'Please remind me in one minute.', when: 'in one minute',
  zone: 'America/Los_Angeles', day: '2026-10-14', time: '12:13',
  resolution: { at: instant - 60_000, instant: new Date(instant).toISOString() } };

it('compares exact persisted instants at both edges, even when the clock goes backward', () => {
  for (const [now, due] of [[instant - 1, false], [instant, true], [instant + 1, true], [instant - 1, false]] as const)
    expect(requestedTimeReached(item, now)).toBe(due);
  expect(requestedTimeReached({ ...item, resolution: { at: instant, instant: 'invalid' } }, instant)).toBe(false);
  expect(requestedTimeReached(item, NaN)).toBe(false);
  expect(requestedTimeReached({ ...item, ambiguity: 'unsettled' }, instant)).toBe(false);
  const { day: _day, ...undated } = item;
  expect(requestedTimeReached(undated, instant)).toBe(false);
});

it('retains local-calendar scheduling for legacy and recurring records, including the day-only default', () => {
  const localMinute = Date.parse('2026-10-14T19:13:00Z');
  const { resolution: _resolution, ...legacy } = item;
  expect(requestedTimeReached(legacy, localMinute - 1)).toBe(false);
  expect(requestedTimeReached(legacy, localMinute)).toBe(true);
  const next = { ...item, recurrence: 'daily' as const, day: '2026-10-15' };
  expect(requestedTimeReached(next, instant)).toBe(false);
  expect(requestedTimeReached(next, localMinute + 86_400_000)).toBe(true);
  const { time: _time, ...dayOnly } = legacy;
  expect(requestedTimeReached(dayOnly, Date.parse('2026-10-14T15:59:59.999Z'))).toBe(false);
  expect(requestedTimeReached(dayOnly, Date.parse('2026-10-14T16:00:00Z'))).toBe(true);
});
