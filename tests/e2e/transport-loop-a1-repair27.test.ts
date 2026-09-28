import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runChildAsync } from './transport-loop-a1-child.js';

const runChild = (mode: 'produce' | 'recover', directory: string) => runChildAsync(
  [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config',
    'tests/fixtures/transport-loop-a1-repair27-e2e.config.mjs', '--reporter=dot'],
  { ...process.env, SLB_A1_REPAIR27_E2E_MODE: mode, SLB_A1_REPAIR27_E2E_DIR: directory }, 90_000);

it('SLB-A1-COMMAND-RESTART-144 V25 preserves original schedule and admission results in a fresh process', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'transport-loop-a1-repair27-'));
  const producer = await runChild('produce', directory);
  expect(producer.status, `${producer.stdout}\n${producer.stderr}`).toBe(0);
  const recovery = await runChild('recover', directory);
  expect(recovery.status, `${recovery.stdout}\n${recovery.stderr}`).toBe(0);
}, 180_000);
