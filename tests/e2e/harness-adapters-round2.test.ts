import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('REVIEW-F10 durable write-ahead custody survives actual SIGKILL cuts without repeating launch, delivery, or progress', () => {
  const worker = join(process.cwd(), 'node_modules/.bin/vite-node');
  const cases = [
    'after-journal-before-driver',
    'after-driver-before-handle',
    'after-handle-before-finish',
    'after-observed',
    'after-delivery',
    'after-progress',
  ];
  for (const cut of cases) {
    const directory = mkdtempSync(join(tmpdir(), `p13-round2-${cut}-`));
    const seed = spawnSync(worker, ['tests/harness-adapters/round2-cut-worker.ts', 'seed', cut, directory], { encoding: 'utf8' });
    expect(seed.signal).toBe('SIGKILL');
    const recovered = spawnSync(worker, ['tests/harness-adapters/round2-cut-worker.ts', 'recover', cut, directory], { encoding: 'utf8' });
    expect(recovered.status, recovered.stderr).toBe(0);
    const trace = readFileSync(join(directory, 'trace.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const launches = trace.filter(row => row.driverCall === 'launch');
    const deliveries = trace.filter(row => row.driverCall === 'deliver');
    if (cut === 'after-journal-before-driver') expect(launches).toHaveLength(0);
    else if (cut === 'after-progress') expect(launches).toHaveLength(0);
    else expect(launches).toHaveLength(1);
    expect(deliveries).toHaveLength(cut === 'after-delivery' ? 1 : 0);
    if (cut === 'after-progress') expect(trace.at(-1)).toMatchObject({ mode: 'recover', progressDisposition: 'duplicate', progress: false });
    else if (cut === 'after-delivery') expect(trace.at(-1)).toMatchObject({ mode: 'recover', deliveryPhase: 'uncertain' });
    else expect(trace.at(-1)).toMatchObject({ mode: 'recover', launchPhase: 'uncertain' });
  }
}, 60_000);
