import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

const runChild = (mode: string, directory: string) => spawnSync(process.execPath,
  [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config',
    'tests/fixtures/transport-loop-a1-repair18-e2e.config.mjs', '--reporter=dot'], {
    encoding: 'utf8', timeout: 90_000,
    env: { ...process.env, SLB_A1_REPAIR18_E2E_MODE: mode, SLB_A1_REPAIR18_E2E_DIR: directory },
  });

it('SLB-A1-REPAIR18-E2E-118 V11 V12 V17 replays late closure and partial-only retention in fresh processes', () => {
  for (const scenario of ['late', 'partial']) {
    const directory = mkdtempSync(join(tmpdir(), `transport-loop-a1-repair18-${scenario}-`));
    const producer = runChild(`produce-${scenario}`, directory);
    expect(producer.status, `${producer.stdout}\n${producer.stderr}`).toBe(0);
    const recovery = runChild(`recover-${scenario}`, directory);
    expect(recovery.status, `${recovery.stdout}\n${recovery.stderr}`).toBe(0);
  }
}, 180_000);
