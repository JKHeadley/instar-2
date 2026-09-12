import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { clone, scheduledFixture, value } from './fixture.js';

const resultStatus = (result: unknown) => consumeResult(result as Parameters<typeof consumeResult>[0], {
  Success: () => 'accepted' as const, Refused: () => 'refused' as const,
});
const set = (input: unknown, path: readonly string[], value: unknown, remove = false) => {
  let target = input as Record<string, any>;
  for (const key of path.slice(0, -1)) target = target[key];
  if (remove) delete target[path.at(-1)!]; else target[path.at(-1)!] = value;
  return input;
};
const paths = (value: unknown, prefix: string[] = []): string[][] => Object.entries(value as object).flatMap(([key, item]) => [
  [...prefix, key], ...(item && typeof item === 'object' && !Array.isArray(item) ? paths(item, [...prefix, key]) : []),
]);

it('P15-NF-08 preserves the independent full manifest decoder mutation matrix as typed Results', () => {
  const f = scheduledFixture(); const port = createScheduledWorkPackagePort(); let cases = 0;
  const recurring = clone(f.manifest) as unknown as Record<string, any>; delete recurring.schedule.at;
  Object.assign(recurring.schedule, { kind: 'recurring', expression: '*/15 0 * * 0', timeZone: 'America/New_York' });
  const variants = [f.manifest, recurring, { ...clone(f.manifest), schemaVersion: 1 }, { ...clone(recurring), schemaVersion: 1 }];
  const enums: Record<string, readonly string[]> = { type: ['ScheduledWorkManifest'], 'schedule.kind': ['one-shot', 'recurring'],
    'admission.priority': ['low', 'maintenance', 'medium', 'high', 'critical'], 'admission.placement': ['global-once', 'every-eligible-machine'],
    'admission.catchUp': ['none', 'latest'], 'intelligence.supervision': ['tier0', 'tier1', 'tier2'],
    'intelligence.failureDirection': ['closed', 'open'], 'intelligence.postCompletionLearning': ['off', 'required'],
    'activation.rollout': ['dark', 'dry-run', 'active'] };
  const check = (id: string, expected: 'accepted' | 'refused', input: unknown) => {
    cases++; expect(resultStatus(port.decode(input, f.context)), id).toBe(expected);
  };
  for (const [variantIndex, manifest] of variants.entries()) {
    check(`variant-${variantIndex}/valid`, 'accepted', manifest);
    check(`variant-${variantIndex}/root-extra`, 'refused', { ...manifest, extra: 1 });
    for (const path of paths(manifest)) {
      const key = path.join('.'); const current = path.reduce((item: any, field) => item[field], manifest);
      check(`${variantIndex}/${key}/missing`, 'refused', set(clone(manifest), path, null, true));
      check(`${variantIndex}/${key}/wrong-type`, 'refused', set(clone(manifest), path, current && typeof current === 'object' ? 42 : []));
      if (current && typeof current === 'object' && !Array.isArray(current))
        check(`${variantIndex}/${key}/extra`, 'refused', set(clone(manifest), path, { ...current, extra: true }));
      if (typeof current === 'number') {
        for (const bad of [-1, Number.POSITIVE_INFINITY, Number.NaN]) check(`${variantIndex}/${key}/range-${bad}`, 'refused', set(clone(manifest), path, bad));
        if (key === 'schemaVersion') for (const bad of [0, 3, 999]) check(`${variantIndex}/${key}/unsupported-${bad}`, 'refused', set(clone(manifest), path, bad));
        else {
          const positive = key === 'admission.minimumMaintenanceShare' ? 0.2 : key === 'admission.classWeights.maintenance' ? 1 : 0;
          check(`${variantIndex}/${key}/boundary`, 'accepted', set(clone(manifest), path, positive));
        }
      }
      if (typeof current === 'string') check(`${variantIndex}/${key}/empty`, 'refused', set(clone(manifest), path, ''));
      if (['bounds.attempts', 'bounds.concurrency', 'bounds.notifications', 'admission.creditCap'].includes(key) || key.startsWith('admission.classWeights.'))
        for (const bad of [0.5, Number.MAX_SAFE_INTEGER + 1]) check(`${variantIndex}/${key}/integer-${bad}`, 'refused', set(clone(manifest), path, bad));
      if (key === 'admission.minimumMaintenanceShare') check(`${variantIndex}/${key}/over-one`, 'refused', set(clone(manifest), path, 1.001));
      if (enums[key] && key !== 'schedule.kind') for (const neighbor of enums[key])
        check(`${variantIndex}/${key}/neighbor-${neighbor}`, 'accepted', set(clone(manifest), path, neighbor));
      if (Array.isArray(current)) {
        check(`${variantIndex}/${key}/wrong-item`, 'refused', set(clone(manifest), path, [3]));
        check(`${variantIndex}/${key}/duplicate`, 'refused', set(clone(manifest), path, ['ref:a', 'ref:a']));
      }
    }
  }
  expect(cases).toBeGreaterThan(1_500);
  const decoded = value(port.decode(f.manifest, f.context)); let immutable = 0;
  for (const path of paths(decoded)) {
    const parent = path.slice(0, -1).reduce((item: any, field) => item[field], decoded as any);
    expect(() => { parent[path.at(-1)!] = null; }, path.join('.')).toThrow(); immutable++;
    const item = path.reduce((entry: any, field) => entry[field], decoded as any);
    if (Array.isArray(item)) { expect(() => item.push('mutation'), `${path.join('.')}[]`).toThrow(); immutable++; }
  }
  expect(immutable).toBe(100);
});
