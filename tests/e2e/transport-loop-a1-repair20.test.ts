import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

const runChild = (mode: 'produce' | 'recover', directory: string) => spawnSync(process.execPath,
  [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config',
    'tests/fixtures/transport-loop-a1-repair20-e2e.config.mjs', '--reporter=dot'], {
    encoding: 'utf8',
    timeout: 90_000,
    env: { ...process.env, SLB_A1_REPAIR20_E2E_MODE: mode, SLB_A1_REPAIR20_E2E_DIR: directory },
  });

it('SLB-A1-ORDINARY-REPLAY-E2E-128 V31 returns an ordinary durable close after lost acknowledgment and expiry in a fresh process', () => {
  const directory = mkdtempSync(join(tmpdir(), 'transport-loop-a1-repair20-'));
  const producer = runChild('produce', directory);
  expect(producer.status, `${producer.stdout}\n${producer.stderr}`).toBe(0);
  const recovery = runChild('recover', directory);
  expect(recovery.status, `${recovery.stdout}\n${recovery.stderr}`).toBe(0);
}, 180_000);
