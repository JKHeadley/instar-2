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

  it('handles leap years and month ends in both directions', () => {
    expect(nextCronInstant('0 9 29 2 *', 'UTC', Date.parse('2000-02-28T00:00:00Z')))
      .toBe('2000-02-29T09:00:00Z');
    expect(nextCronInstant('0 9 29 2 *', 'UTC', Date.parse('2100-02-28T00:00:00Z')))
      .toBe('2104-02-29T09:00:00Z');
    expect(nextCronInstant('0 9 31 * *', 'UTC', Date.parse('2027-04-30T00:00:00Z')))
      .toBe('2027-05-31T09:00:00Z');
    expect(previousCronInstant('0 9 31 * *', 'UTC', Date.parse('2027-05-01T00:00:00Z')))
      .toBe('2027-03-31T09:00:00Z');
  });

  it('keeps four-digit year bounds and canonical UTC instants', () => {
    const first = Date.parse('0000-01-01T00:00:00Z');
    const last = Date.parse('9999-12-31T23:59:00Z');
    expect(nextCronInstant('0 0 * * *', 'UTC', first, true)).toBe('0000-01-01T00:00:00Z');
    expect(nextCronInstant('0 0 * * 6', 'UTC', first, true)).toBe('0000-01-01T00:00:00Z');
    expect(nextCronInstant('0 0 * * 0', 'UTC', first, true)).toBe('0000-01-02T00:00:00Z');
    expect(previousCronInstant('0 0 * * *', 'UTC', first)).toBe('0000-01-01T00:00:00Z');
    expect(previousCronInstant('59 23 * * *', 'UTC', first)).toBe(null);
    expect(nextCronInstant('59 23 * * *', 'UTC', last, true)).toBe('9999-12-31T23:59:00Z');
    expect(nextCronInstant('59 23 * * *', 'UTC', last)).toBe(null);
    expect(previousCronInstant('59 23 * * *', 'UTC', last)).toBe('9999-12-31T23:59:00Z');
    expect(nextCronInstant('0 0 * * *', 'Pacific/Kiritimati', Date.parse('9999-12-31T00:00:00Z')))
      .toBe(null);
    expect(previousCronInstant('0 0 * * *', 'Pacific/Kiritimati', last))
      .toBe('9999-12-30T10:00:00Z');
  });
});
