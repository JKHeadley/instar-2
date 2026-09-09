import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('SLB-E2E-12 P6-NF-18 P6-NF-20 P6-NF-33 P6-NF-34 P6-NF-36 fresh process rebuilds owner-witnessed loop and missed-range state from Part Two', () => {
  const vitest = resolve('node_modules/vitest/vitest.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'transport-loop-e2e-'));
  const run = (mode: string, reference = '') => spawnSync(process.execPath, [vitest, 'run', '--config',
    'tests/fixtures/transport-loop-e2e.config.mjs', '--reporter=verbose'], { encoding: 'utf8', timeout: 60000,
    env: { ...process.env, SLB_E2E_MODE: mode, SLB_E2E_DIR: directory, SLB_E2E_REF: reference } });
  const producer = run('produce');
  expect(producer.status, `${producer.stdout}\n${producer.stderr}`).toBe(0);
  const reference = producer.stdout.match(/SLB_E2E_REF=(missed:sha256:[a-f0-9]{64})/)?.[1];
  expect(reference).toBeTruthy();
  const recovery = run('recover', reference!);
  expect(recovery.status, `${recovery.stdout}\n${recovery.stderr}`).toBe(0);
  expect(producer.stdout).toContain('producer persists owner-witnessed loop and missed range');
  expect(recovery.stdout).toContain('new process reconstructs producer state');
}, 70000);
