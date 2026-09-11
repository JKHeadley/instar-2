// @ts-nocheck -- the test deliberately replaces the public provider operation with a refusal.
import { expect, it } from 'vitest';
import { consumeResult, decode } from '../../src/index.js';
import { productionOperatorSlice } from '../operator/production-slice-fixture.js';

it('V93 P11-NF-43 P11-NF-49 required replay-provider refusal cannot be bypassed by internal rebuilding', async () => {
  const f = productionOperatorSlice();
  let calls = 0;
  f.production.replay.rebuild = () => {
    calls++;
    return decode('Scope', { type: 'Scope', schemaVersion: 1, kind: 'project', members: [] }, f.operator.context.decode);
  };
  expect(consumeResult(f.runtime.coordinator.handles.replay.rebuild(), { Success: () => true, Refused: () => false })).toBe(false);
  calls = 0;
  await expect(f.runtime.drive()).rejects.toThrow();
  expect(calls).toBeGreaterThan(0);
}, 300_000);

it('V94 P11-NF-43 P11-NF-49 source-only replay delegating to the real source rebuild keeps the slice accepted', async () => {
  const f = productionOperatorSlice();
  f.production.replay.rebuild = () => f.assembly.success(f.runtime.rebuildAll());
  const report = await f.runtime.drive();
  expect(report.rebuilds).toHaveLength(6);
  expect(report.rebuilds.every(row => row.equal === 'equal')).toBe(true);
  expect(report.externalApplications).toHaveLength(1);
}, 300_000);
