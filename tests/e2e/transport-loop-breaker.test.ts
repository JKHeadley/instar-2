import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it('SLB-E2E-12 P6-NF-18 P6-NF-20 P6-NF-33 P6-NF-34 P6-NF-36 fresh process rebuilds owner-witnessed loop and missed-range state from Part Two', () => {
  const vitest = resolve('node_modules/vitest/vitest.mjs');
  const child = spawnSync(process.execPath, [vitest, 'run', '--config',
    'tests/fixtures/transport-loop-e2e.config.mjs', '--reporter=verbose'],
  { encoding: 'utf8', timeout: 60000 });
  expect(child.status, `${child.stdout}\n${child.stderr}`).toBe(0);
  expect(child.stdout).toContain('fresh process loop replay');
  expect(child.stdout).toContain('fresh process missed-range replay');
}, 70000);
