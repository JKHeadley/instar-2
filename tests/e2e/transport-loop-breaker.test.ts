import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('SLB-E2E-12 P6-NF-18 P6-NF-20 P6-NF-33 P6-NF-34 P6-NF-36 fresh process rebuilds owner-witnessed loop state from Part Two', () => {
  const vitest = resolve('node_modules/vitest/vitest.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'transport-loop-e2e-'));
  const run = (mode: string) => spawnSync(process.execPath, [vitest, 'run', '--config',
    'tests/fixtures/transport-loop-e2e.config.mjs', '--reporter=verbose'], { encoding: 'utf8', timeout: 60000,
    env: { ...process.env, SLB_E2E_MODE: mode, SLB_E2E_DIR: directory } });
  const producer = run('produce');
  expect(producer.status, `${producer.stdout}\n${producer.stderr}`).toBe(0);
  const recovery = run('recover');
  expect(recovery.status, `${recovery.stdout}\n${recovery.stderr}`).toBe(0);
  expect(producer.stdout).toContain('producer persists an owner-witnessed loop');
  expect(recovery.stdout).toContain('new process reconstructs producer state');
}, 70000);

it('SLB-E2E-REPAIR9-73 V01 V02 reconstructs cross-clock budget evidence and a later breaker cycle in fresh processes', () => {
  const vitest = resolve('node_modules/vitest/vitest.mjs');
  const run = (mode: string, directory: string) => spawnSync(process.execPath, [vitest, 'run', '--config',
    'tests/fixtures/transport-loop-e2e.config.mjs', '--reporter=verbose'], { encoding: 'utf8', timeout: 60000,
    env: { ...process.env, SLB_E2E_MODE: mode, SLB_E2E_DIR: directory } });
  for (const scenario of ['budget', 'cycle']) {
    const directory = mkdtempSync(join(tmpdir(), `transport-loop-repair9-${scenario}-`));
    for (const phase of ['produce', 'recover']) {
      const result = run(`repair9-${scenario}-${phase}`, directory);
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }
  }
}, 140000);

it('SLB-E2E-RESOURCE-80 V16 reconstructs exact shared resource admission and refuses inflation', () => {
  const vitest = resolve('node_modules/vitest/vitest.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'transport-loop-repair10-resource-'));
  const run = (mode: string) => spawnSync(process.execPath, [vitest, 'run', '--config',
    'tests/fixtures/transport-loop-e2e.config.mjs', '--reporter=verbose'], { encoding: 'utf8', timeout: 60000,
    env: { ...process.env, SLB_E2E_MODE: mode, SLB_E2E_DIR: directory } });
  for (const phase of ['produce', 'recover']) {
    const result = run(`repair10-resource-${phase}`);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  }
}, 70000);
