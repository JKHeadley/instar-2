import { describe, expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { canonicalInstant, createScheduledWorkPackagePort, decodeScheduledCapacityMeasurement,
  normalizeCronV1, SCHEDULED_MANIFEST_LIMITS, validateRfc3339Offset } from '../../src/scheduled/index.js';
import { clone, scheduledFixture, value } from './fixture.js';

const status = <T>(result: import('../../src/index.js').Result<T>) => consumeResult(result, {
  Success: () => 'accepted' as const, Refused: () => 'refused' as const,
});

function recurringManifest() {
  const f = scheduledFixture(); const manifest = clone(f.manifest) as any;
  manifest.schedule = { ...manifest.schedule, kind: 'recurring', expression: '* * * * *', timeZone: 'UTC' };
  delete manifest.schedule.at;
  return { f, manifest };
}

function padToBytes(manifest: any, target: number): void {
  const fields: Array<[string, string]> = [['identity', 'displayName'], ['identity', 'accountableOwner'],
    ['work', 'resultDestination'], ['work', 'groundingContract'], ['authority', 'systemPrincipal'],
    ['authority', 'standingGrant'], ['authority', 'scope'], ['intelligence', 'route'],
    ['intelligence', 'floor'], ['intelligence', 'profile']];
  for (const [group, key] of fields) {
    const needed = target - value(canonical(manifest)).bytes.length;
    if (needed <= 0) break;
    const current = manifest[group][key] as string;
    manifest[group][key] = current + 'x'.repeat(Math.min(SCHEDULED_MANIFEST_LIMITS.textBytes - current.length, needed));
  }
  expect(value(canonical(manifest)).bytes).toHaveLength(target);
}

describe('Part Fifteen round-five canonical data boundaries', () => {
  it('P15-NF-29 preserves Part One refusal when capacity and action clocks have different subjects', () => {
    const f = scheduledFixture(); const action = f.core.clock(1_000); const foreign = {
      ...clone(f.core.clock(100)), subject: { kind: 'clock', instance: 'clock:other' },
    };
    const context = { ...f.core.ctx, site: 'types.decode', actAt: action, register: { ...f.core.ctx.register,
      entries: [...f.core.ctx.register.entries, 'account:a', 'clock:other'],
      subjects: { ...f.core.ctx.register.subjects, 'quota-utilization': ['percent'] } } };
    const measurement = { type: 'Measurement', schemaVersion: 1, subject: { kind: 'quota-utilization', instance: 'account:a' },
      value: 50, unit: 'percent', at: foreign, by: 'probe' };
    expect(status(decodeScheduledCapacityMeasurement('quota-utilization', 'account:a', measurement, context))).toBe('refused');
    expect(status(decodeScheduledCapacityMeasurement('quota-utilization', 'account:a',
      { ...measurement, at: f.core.clock(100) }, context))).toBe('accepted');
  });

  it('P15-NF-08 bounds the admitted canonical manifest after cron normalization and preserves the exact limit', () => {
    const { f, manifest } = recurringManifest(); const port = createScheduledWorkPackagePort();
    const normalized = value(normalizeCronV1(manifest.schedule.expression, f.context)).expression;
    const expansionBytes = Buffer.byteLength(normalized) - Buffer.byteLength(manifest.schedule.expression);
    const oversized = clone(manifest); padToBytes(oversized, SCHEDULED_MANIFEST_LIMITS.manifestBytes);
    expect(status(port.decode(oversized, f.context))).toBe('refused');

    const exact = clone(manifest); padToBytes(exact, SCHEDULED_MANIFEST_LIMITS.manifestBytes - expansionBytes);
    const decoded = value(port.decode(exact, f.context));
    expect(value(canonical(decoded)).bytes).toHaveLength(SCHEDULED_MANIFEST_LIMITS.manifestBytes);
    expect(value(port.decode(decoded, f.context))).toEqual(decoded);
  });

  it('P15-NF-08 refuses offset timestamps whose UTC identity escapes the four-digit RFC 3339 language', () => {
    const f = scheduledFixture(); const port = createScheduledWorkPackagePort();
    for (const timestamp of ['0000-01-01T00:00:00+01:00', '9999-12-31T23:59:59-01:00']) {
      const manifest = clone(f.manifest) as any;
      manifest.schedule.at = timestamp; manifest.schedule.activationInstant = timestamp;
      expect(status(port.decode(manifest, f.context))).toBe('refused');
      expect(() => canonicalInstant(timestamp)).toThrow('four-digit RFC 3339 year range');
    }
    const ordinary = '2027-01-01T01:30:00+01:30';
    expect(canonicalInstant(ordinary)).toBe('2027-01-01T00:00:00Z');
    expect(() => validateRfc3339Offset(canonicalInstant(ordinary))).not.toThrow();
  });
});
