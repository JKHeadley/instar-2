import { expect, it } from 'vitest';
import { admissionInterleaving } from './round16-fixture.js';

it('P12-NF-16 P12-NF-18 P12-NF-46 round16 admission-interleavings refuses the nested in-process flight before append', () => {
  for (const outerMode of ['long-poll', 'webhook'] as const) {
    const discovery = admissionInterleaving(outerMode, null, 'after');
    const target = discovery.trace.indexOf('assembly.record:AdapterConformance');
    expect(target, outerMode).toBeGreaterThan(-1);
    for (const phase of ['before', 'after'] as const) {
      const result = admissionInterleaving(outerMode, target, phase);
      expect(result.outer.kind, `${outerMode}/${phase}: outer`).toBe('Success');
      expect(result.nested?.kind, `${outerMode}/${phase}: nested`).toBe('Refused');
      if (result.nested?.kind === 'Refused') expect(result.nested.detail,
        `${outerMode}/${phase}: refusal`).toContain('already in flight');
      expect(result.records, `${outerMode}/${phase}: records`).toHaveLength(1);
      expect(result.records[0]?.record.type === 'AdapterConformance'
        ? result.records[0].record.mode : null, `${outerMode}/${phase}: mode`).toBe(outerMode);
    }
  }
});
