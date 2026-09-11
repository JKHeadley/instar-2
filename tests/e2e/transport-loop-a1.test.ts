import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('SLB-A1-E2E-91 rebuilds the one A1 breaker episode in a fresh process', () => {
  const directory = mkdtempSync(join(tmpdir(), 'transport-loop-a1-e2e-'));
  const vitest = resolve('node_modules/vitest/vitest.mjs');
  for (const mode of ['produce', 'recover']) {
    const run = spawnSync(process.execPath, [vitest, 'run', '--config',
      'tests/fixtures/transport-loop-a1-e2e.config.mjs', '--reporter=verbose'], {
      encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, SLB_A1_E2E_MODE: mode, SLB_A1_E2E_DIR: directory },
    });
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  }
}, 130_000);
