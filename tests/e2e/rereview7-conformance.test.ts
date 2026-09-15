import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { productionOperatorSlice } from '../operator/production-slice-fixture.js';
// @ts-expect-error The process-spawn boundary is executable JavaScript by design.
import { spawnBoot } from '../../scripts/slice-execution.mjs';

beforeEach(() => new Promise<void>(resolve => setImmediate(resolve)));

it('R9-F1 V64/V67 live production re-resolution preserves input and owns an outage without dispatch', async () => {
  const stale = productionOperatorSlice(), admit = stale.production.dependencyAdmission.admit;
  stale.production.dependencyAdmission.admit = (input => {
    const result = admit(input);
    return input.name === 'route' ? stale.assembly.success({ ...value(result), current: false }) : result;
  }) as typeof admit;
  const staleReport = await stale.runtime.drive();
  expect(stale.runtime.service.journal().applications).toHaveLength(0);
  expect(staleReport.preservedInput).toBeTruthy();
  expect(staleReport.obligations).toContainEqual(expect.objectContaining({ state: 'owned-pending-prerequisite-outage', owner: 'part-ten' }));
  expect(staleReport.independentlyWitnessedResult.stage).toBe('not-reached');

  const missing = productionOperatorSlice();
  const route = (missing.assembly.raw as { kind?: string }[]).findIndex(row => row.kind === 'conversation-route');
  expect(route).toBeGreaterThanOrEqual(0);
  missing.assembly.raw.splice(route, 1);
  const missingReport = await missing.runtime.drive();
  expect(missing.runtime.service.journal().applications).toHaveLength(0);
  expect(missingReport.preservedInput).toBeTruthy();
  expect(missingReport.obligations).toContainEqual(expect.objectContaining({ state: 'owned-pending-prerequisite-outage', owner: 'part-ten' }));
  expect(missingReport.independentlyWitnessedResult.stage).toBe('not-reached');
}, 120_000);

it('V71 process kill after durable Part Nine record restarts through real public assembly to the same witnessed result', async () => {
  const home = mkdtempSync(join(tmpdir(), 'p11-r9-v71-'));
  const worker = join(process.cwd(), 'scripts/slice-delivery-restart-worker.mjs');
  const first = await spawnBoot([worker, home]);
  expect(first.signal, first.stderr).toBe('SIGKILL');
  const cut = JSON.parse(readFileSync(join(home, 'independent-cut.json'), 'utf8'));
  expect(cut.applications).toBe(1);
  const next = await spawnBoot([worker, home]);
  expect(next.status, next.stderr).toBe(0);
  const report = JSON.parse(readFileSync(join(home, 'final-report.json'), 'utf8'));
  expect(report.externalApplications).toHaveLength(1);
  expect(report.outbound.operation).toBe(cut.operation);
  expect(report.independentlyWitnessedResult.stage).toBe('service-applied');
  expect(report.rebuilds).toHaveLength(6);
  expect(report.rebuilds.every((row: { equal: string }) => row.equal === 'equal')).toBe(true);
}, 300_000);
