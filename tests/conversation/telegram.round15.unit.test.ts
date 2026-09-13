import { expect, it } from 'vitest';
import { captureReadOverlap } from './round15-fixture.js';

it('P12-NF-16 P12-NF-18 P12-NF-46 round15 fresh-capture-overlap-confirmation admits exactly one Telegram mode', () => {
  for (const outerMode of ['long-poll', 'webhook'] as const) {
    const result = captureReadOverlap(outerMode);
    expect(result.outer.kind, outerMode).toBe('Success');
    expect(result.nested?.kind, outerMode).toBe('Refused');
    expect(result.trace, outerMode).toContain('competing-admission:Refused');
    expect(new Set(result.records.map(row => row.record.type === 'AdapterConformance' ? row.record.mode : '')).size,
      outerMode).toBe(1);
    expect(result.records.every(row => row.taint.length === 0 && row.conflicts.length === 0), outerMode).toBe(true);
  }
});
