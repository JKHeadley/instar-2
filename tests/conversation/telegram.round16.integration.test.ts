import { expect, it } from 'vitest';
import { admissionInterleaving } from './round16-fixture.js';

it('P12-NF-16 P12-NF-18 P12-NF-46 round16 admission-interleavings retains one usable mode and permits unchanged reconstruction', () => {
  for (const outerMode of ['long-poll', 'webhook'] as const) {
    const discovery = admissionInterleaving(outerMode, null, 'after');
    const target = discovery.trace.indexOf('assembly.record:AdapterConformance');
    const result = admissionInterleaving(outerMode, target, 'before');
    expect(result.fired, outerMode).toBe(true);
    expect(result.winnerMode, outerMode).toBe(outerMode);
    expect(result.intakeKind, outerMode).toBe('Success');
    expect(result.readmission?.kind, outerMode).toBe('Success');
    expect(new Set(result.records.map(row => row.record.type === 'AdapterConformance'
      ? row.record.mode : '')), outerMode).toEqual(new Set([outerMode]));
    expect(result.records.every(row => row.taint.length === 0 && row.conflicts.length === 0), outerMode).toBe(true);
  }
});
