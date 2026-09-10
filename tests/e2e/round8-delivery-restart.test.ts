import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error The process-spawn boundary is executable JavaScript by design.
import { spawnBoot } from '../../scripts/slice-execution.mjs';

it('R8-F3 rereview6 V91 R10 rereview8 V94 process cut after Part Nine delivery record recovers the same witnessed outcome', async () => {
  const home = mkdtempSync(join(tmpdir(), 'p11-r8-v91-'));
  const worker = join(process.cwd(), 'scripts/slice-delivery-restart-worker.mjs');
  const first = await spawnBoot([worker, home]);
  expect(first.signal).toBe('SIGKILL');
  const cut = JSON.parse(readFileSync(join(home, 'independent-cut.json'), 'utf8'));
  expect(cut.applications).toBe(1);
  const second = await spawnBoot([worker, home]);
  expect(second.status, second.stderr).toBe(0);
  const report = JSON.parse(readFileSync(join(home, 'final-report.json'), 'utf8'));
  expect(report.independentlyWitnessedResult.stage).toBe('service-applied');
  expect(report.externalApplications).toHaveLength(1);
  expect(report.outbound.operation).toBe(cut.operation);
  expect(report.rebuilds.every((row: { equal: string }) => row.equal === 'equal')).toBe(true);
}, 300_000);
