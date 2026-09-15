import { expect, it } from 'vitest';
import { admissionInterleaving } from './round16-fixture.js';

it('P12-NF-16 P12-NF-18 P12-NF-46 round16 admission-interleavings covers every synchronous dependency boundary', () => {
  for (const outerMode of ['long-poll', 'webhook'] as const) {
    const discovery = admissionInterleaving(outerMode, null, 'after');
    expect(discovery.outer.kind, `${outerMode}: control`).toBe('Success');
    for (let target = 0; target < discovery.trace.length; target++) {
      for (const phase of ['before', 'after'] as const) {
        const result = admissionInterleaving(outerMode, target, phase);
        const label = `${outerMode}/${phase}/${target}:${discovery.trace[target]}`;
        expect(result.fired, label).toBe(true);
        expect(result.outer.kind, `${label}: outer`).toBe('Success');
        expect(result.nested?.kind, `${label}: nested`).toBe('Refused');
        expect(result.records, `${label}: records`).toHaveLength(1);
        expect(result.winnerMode, `${label}: winner`).toBe(outerMode);
        expect(result.readmission?.kind, `${label}: readmission`).toBe('Success');
        expect(result.intakeKind, `${label}: intake`).toBe('Success');
      }
    }
  }
}, 60_000);
