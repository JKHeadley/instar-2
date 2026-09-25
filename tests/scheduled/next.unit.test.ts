import { describe, expect, it } from 'vitest';
import { nextCronInstant } from '../../src/scheduled/index.js';
import { previousCronInstant } from '../../src/scheduled/next.js';

describe('next recurring occurrence', () => {
  it('combines restricted day of month and day of week by OR', () => {
    expect(nextCronInstant('0 9 13 * 1', 'UTC', Date.UTC(2027, 0, 1)))
      .toBe('2027-01-04T09:00:00Z');
    expect(nextCronInstant('0 9 13 * 1', 'UTC', Date.UTC(2027, 0, 11, 9)))
      .toBe('2027-01-13T09:00:00Z');
  });

  it('skips a nonexistent spring wall time', () => {
    expect(nextCronInstant('30 2 * * *', 'America/New_York', Date.UTC(2027, 2, 13)))
      .toBe('2027-03-13T07:30:00Z');
    expect(nextCronInstant('30 2 * * *', 'America/New_York', Date.UTC(2027, 2, 14)))
      .toBe('2027-03-15T06:30:00Z');
  });

  it('takes only the earlier repeated fall wall time', () => {
    expect(nextCronInstant('30 1 * * *', 'America/New_York', Date.UTC(2027, 10, 7)))
      .toBe('2027-11-07T05:30:00Z');
    expect(nextCronInstant('30 1 * * *', 'America/New_York', Date.UTC(2027, 10, 7, 5, 30)))
      .toBe('2027-11-08T06:30:00Z');
    expect(previousCronInstant('30 1 * * *', 'America/New_York', Date.UTC(2027, 10, 7, 6, 30)))
      .toBe('2027-11-07T05:30:00Z');
  });

  it('finds the last valid wall minute before a spring gap', () => {
    expect(previousCronInstant('30 2 * * *', 'America/New_York', Date.UTC(2027, 2, 14, 8)))
      .toBe('2027-03-13T07:30:00Z');
  });
});
