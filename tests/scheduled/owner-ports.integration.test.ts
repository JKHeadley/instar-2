import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeScheduledCapacityMeasurement, readScheduledBusinessDisposition } from '../../src/scheduled/index.js';
import { scheduledFixture } from './fixture.js';
import { closeUnreachable } from '../rungraph/closure-fixtures.js';
import { setup, value } from '../rungraph/fixtures.js';

describe('Part Fifteen consumes landed owner ports without replacing authority', () => {
  it('P15-NF-06 only a Part Five terminal exit supplies the durable business disposition', () => {
    const f = closeUnreachable();
    expect(value(f.graph.read(f.id)).state).toBe('unreachable');
    expect(value(readScheduledBusinessDisposition(f.graph, { owner: 'part-five', name: 'Run', id: f.id })).exit.kind).toBe('unreachable');
    for (const falseOutcome of [
      { type: 'spawn', id: f.id }, { type: 'queue', id: f.id }, { type: 'Lease', id: f.id }, { type: 'receipt', id: f.id },
    ]) expect(consumeResult(readScheduledBusinessDisposition(f.graph, falseOutcome), { Success: () => 'accepted', Refused: () => 'refused' })).toBe('refused');
  });

  it('P15-NF-22 ignores a mutable Run view and reconstructs current state through RunGraphPort', () => {
    const f = setup(); const opened = value(f.graph.open(f.run));
    const forged = JSON.parse(JSON.stringify(opened)) as { state: string; head: string };
    forged.state = 'completed'; forged.head = 'forged:last-run';
    const reread = value(f.graph.read(f.id));
    expect(reread.state).toBe('ready'); expect(reread.head).not.toBe(forged.head);
  });

  it('P15-NF-38 P15-NF-45 limits local evidence to signed Part Five retention and closure reads', () => {
    const open = setup(); value(open.graph.open(open.run));
    expect(value(open.graph.read(open.id)).state).toBe('ready');
    expect(consumeResult(open.graph.readExit({ owner: 'part-five', name: 'Run', id: open.id }),
      { Success: () => 'accepted', Refused: () => 'refused' })).toBe('refused');
    const terminal = closeUnreachable();
    const first = value(readScheduledBusinessDisposition(terminal.graph,
      { owner: 'part-five', name: 'Run', id: terminal.id }));
    const second = value(readScheduledBusinessDisposition(terminal.graph,
      { owner: 'part-five', name: 'Run', id: terminal.id }));
    expect(first).toEqual(second); expect(first.exit.kind).toBe('unreachable');
  });

  it('P15-NF-29 refuses malformed or foreign capacity measurements through Part One', () => {
    const f = scheduledFixture(); const context = { ...f.core.ctx, site: 'types.decode', register: { ...f.core.ctx.register,
      entries: [...f.core.ctx.register.entries, 'account:a', 'account:b'],
      subjects: { ...f.core.ctx.register.subjects, 'quota-utilization': ['percent'] } } };
    const actAt = f.core.clock(1_000_000); const measurement = { type: 'Measurement', schemaVersion: 1, subject: { kind: 'quota-utilization', instance: 'account:a' },
      value: 50, unit: 'percent', at: f.core.clock(100), by: 'probe' };
    expect(consumeResult(decodeScheduledCapacityMeasurement('quota-utilization', 'account:a', measurement, { ...context, actAt }),
      { Success: () => 'accepted', Refused: () => 'refused' })).toBe('accepted');
    for (const malformed of [
      { ...measurement, value: Number.NaN }, { ...measurement, value: -1 }, { ...measurement, value: 101 }, { ...measurement, value: '50' }, { ...measurement, by: 'unregistered' },
      { ...measurement, subject: { ...measurement.subject, instance: 'account:b' } }, { ...measurement, configuredTarget: 50 },
      { ...measurement, at: f.core.clock(0) },
    ]) expect(consumeResult(decodeScheduledCapacityMeasurement('quota-utilization', 'account:a', malformed, { ...context, actAt }),
      { Success: () => 'accepted', Refused: () => 'refused' })).toBe('refused');
    expect(consumeResult(decodeScheduledCapacityMeasurement('quota-utilization', 'account:a', measurement, context),
      { Success: () => 'accepted', Refused: () => 'refused' })).toBe('refused');
  });
});
