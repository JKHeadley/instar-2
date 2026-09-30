import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runChildAsync } from './transport-loop-a1-child.js';

const runChild = (mode: string, directory: string) => runChildAsync(
  [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config',
    'tests/fixtures/transport-loop-a1-repair19-e2e.config.mjs', '--reporter=dot'],
  { ...process.env, SLB_A1_REPAIR19_E2E_MODE: mode, SLB_A1_REPAIR19_E2E_DIR: directory }, 90_000);

it('SLB-A1-REPAIR19-E2E-123 V15 V17 replays complete retention and an expired exact close retry in fresh processes', async () => {
  for (const scenario of ['v15', 'v17']) {
    const directory = mkdtempSync(join(tmpdir(), `transport-loop-a1-repair19-${scenario}-`));
    const producer = await runChild(`produce-${scenario}`, directory);
    expect(producer.status, `${producer.stdout}\n${producer.stderr}`).toBe(0);
    const recovery = await runChild(`recover-${scenario}`, directory);
    expect(recovery.status, `${recovery.stdout}\n${recovery.stderr}`).toBe(0);
  }
}, 180_000);
