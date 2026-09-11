import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createScheduledWorkPackagePort, importLegacyScheduledJob, normalizeCronV1, parseRfc3339Offset } from '../../src/scheduled/index.js';
import { clone, scheduledFixture, value } from './fixture.js';

function refusal<T>(result: ReturnType<ReturnType<typeof createScheduledWorkPackagePort>['decode']>): string {
  return consumeResult(result, { Success: () => '', Refused: item => item.detail });
}

describe('Part Fifteen package-local records and operations', () => {
  it('P15-NF-01 P15-NF-08 P15-NF-11 decodes one closed complete manifest without a new core record', () => {
    const f = scheduledFixture(); const port = createScheduledWorkPackagePort(); const decoded = value(port.decode(f.manifest, f.context));
    expect(decoded.bounds.tokens).toBe(0); expect(decoded.bounds.money).toBe(0); expect(Object.isFrozen(decoded)).toBe(true);
    const unknown = { ...clone(f.manifest), hiddenAuthority: 'yes' };
    expect(refusal(port.decode(unknown, f.context))).toContain('unexpected field');
    const missing = clone(f.manifest) as unknown as Record<string, unknown>;
    delete (missing.bounds as Record<string, unknown>).concurrency;
    expect(refusal(port.decode(missing, f.context))).toContain('missing required field');
  });

  it('P15-NF-08 canonical identity compares decoded bytes and is insensitive to caller key order', () => {
    const f = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const reversed = Object.fromEntries(Object.entries(clone(f.manifest)).reverse());
    expect(value(port.compare(f.manifest, reversed, f.context))).toBe('equal');
    const historical = { ...clone(f.manifest), schemaVersion: 1 };
    expect(value(port.decode(historical, f.context)).schemaVersion).toBe(2);
    expect(value(port.compare(f.manifest, historical, f.context))).toBe('equal');
    expect(value(port.identity(f.manifest, f.context)).canonicalHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    (reversed.identity as Record<string, unknown>).jobId = 'job:other';
    expect(value(port.compare(f.manifest, reversed, f.context))).toBe('different');
  });

  it('P15-NF-09 P15-SLICE-A-CRON normalizes exact cron-v1 sets and refuses ambiguous or out-of-domain grammar', () => {
    const f = scheduledFixture(); const valid = value(normalizeCronV1('*/15 0 1-31 1-12 0-6', f.context));
    expect(valid.expression).toBe('0,15,30,45 0 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31 1,2,3,4,5,6,7,8,9,10,11,12 0,1,2,3,4,5,6');
    expect(valid.dayOfMonthUnrestricted).toBe(true); expect(valid.dayOfWeekUnrestricted).toBe(true);
    for (const expression of ['0 0 * * 7', '0 0 * * */0', '0 0 * * 5/2', '0 0 * * 5-2', '0 0 * * 0,,1', '0 0 * * 0 extra'])
      expect(consumeResult(normalizeCronV1(expression, f.context), { Success: () => '', Refused: item => item.detail })).not.toBe('');
    expect(value(normalizeCronV1('00 0 * * 0', f.context)).expression).toMatch(/^0 /);
    expect(value(normalizeCronV1('*/01 0 * * 0', f.context)).fields[0]).toHaveLength(60);
    expect(value(normalizeCronV1('10-20/05 0 * * 0', f.context)).fields[0]).toEqual([10, 15, 20]);
    expect(refusal(normalizeCronV1(['0 0 * * 0'], f.context) as ReturnType<ReturnType<typeof createScheduledWorkPackagePort>['decode']>)).toContain('must be text');
  });

  it('P15-SLICE-A-ABSOLUTE-TIME parses offset instants without ambient time', () => {
    expect(parseRfc3339Offset('2027-01-01T01:30:00+01:30')).toBe(parseRfc3339Offset('2027-01-01T00:00:00Z'));
    expect(parseRfc3339Offset('2027-01-01T00:00:00.0000Z')).toBe(parseRfc3339Offset('2027-01-01T00:00:00Z'));
    expect(() => parseRfc3339Offset('2027-02-29T00:00:00Z')).toThrow('invalid calendar date');
  });

  it('P15-NF-51 refuses ambiguous or incomplete legacy source without starting an authority', () => {
    const f = scheduledFixture();
    expect(refusal(importLegacyScheduledJob('{"slug":"first","slug":"second"}', f.context) as ReturnType<ReturnType<typeof createScheduledWorkPackagePort>['decode']>)).toContain('repeats member');
    expect(refusal(importLegacyScheduledJob('{}', f.context) as ReturnType<ReturnType<typeof createScheduledWorkPackagePort>['decode']>)).toContain('missing or unexpected');
  });
});
