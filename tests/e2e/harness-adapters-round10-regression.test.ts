import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const runner = join(process.cwd(), 'node_modules/.bin/vite-node');
const worker = 'tests/harness-adapters/a2-round10-restart-worker.ts';

it('A2-E2E R10-F1 R10-F2 P13-NF-24 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 the reviewer 12-case process matrix retains confirmation after final fsync and restart', () => {
  let scenarios = 0;
  for (const style of ['late', 'facade'] as const) {
    for (const cut of ['normal', 'kill'] as const) {
      const directory = mkdtempSync(join(tmpdir(), `p13-a2-r10-${style}-${cut}-`));
      const seed = spawnSync(runner, [worker, 'seed', style, cut, directory, 'full'], {
        cwd: process.cwd(), encoding: 'utf8', timeout: 40_000,
      });
      expect(seed.signal, `${style}/${cut}: ${seed.stderr}`).toBe(cut === 'kill' ? 'SIGKILL' : null);
      expect(seed.status, `${style}/${cut}: ${seed.stderr}`).toBe(cut === 'kill' ? null : 0);

      for (const loss of ['full', 'probe', 'plan'] as const) {
        const recovered = spawnSync(runner, [worker, 'recover', style, cut, directory, loss], {
          cwd: process.cwd(), encoding: 'utf8', timeout: 40_000,
        });
        expect(recovered.status, `${style}/${cut}/${loss}: ${recovered.stderr}`).toBe(0);
        const result = JSON.parse(recovered.stdout);
        expect(result.ownerRead, `${style}/${cut}/${loss}`).toBe('Success');
        expect(result.before, `${style}/${cut}/${loss}`).toMatchObject({
          resume: { state: 'poisoned' },
          floorCount: 1,
        });
        expect(result.resume, `${style}/${cut}/${loss}`).toMatchObject({
          state: loss === 'full' ? 'poisoned' : 'unknown',
        });
        expect(result.reconnect, `${style}/${cut}/${loss}`)
          .toMatchObject({ disposition: 'refused', handle: null });
        scenarios++;
      }
    }
  }
  expect(scenarios).toBe(12);
}, 120_000);
