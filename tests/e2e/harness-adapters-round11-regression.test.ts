import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const runner = join(process.cwd(), 'node_modules/.bin/vite-node');
const worker = 'tests/harness-adapters/a2-round11-omitted-natural-worker.ts';

it('A2-E2E R11-F1-OMITTED-NATURAL P13-NF-24 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 final fsync and normal/SIGKILL restart retain owner-only poison uncertainty', () => {
  let scenarios = 0;
  for (const cut of ['normal', 'kill'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r11-omitted-natural-${cut}-`));
    const seed = spawnSync(runner, [worker, 'seed', cut, directory, 'full'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 40_000,
    });
    expect(seed.signal, `${cut}: ${seed.stderr}`).toBe(cut === 'kill' ? 'SIGKILL' : null);
    expect(seed.status, `${cut}: ${seed.stderr}`).toBe(cut === 'kill' ? null : 0);

    for (const loss of ['full', 'probe', 'plan'] as const) {
      const recovered = spawnSync(runner, [worker, 'recover', cut, directory, loss], {
        cwd: process.cwd(), encoding: 'utf8', timeout: 40_000,
      });
      expect(recovered.status, `${cut}/${loss}: ${recovered.stderr}`).toBe(0);
      const result = JSON.parse(recovered.stdout);
      expect(result.ownerRead, `${cut}/${loss}`).toBe('Success');
      expect(result.before, `${cut}/${loss}`).toMatchObject({
        resume: { state: 'poisoned' },
        floorCount: 1,
        candidateCount: 1,
        blockedLocalAppend: true,
      });
      expect(result.resume, `${cut}/${loss}`).toMatchObject({
        state: loss === 'full' ? 'poisoned' : 'unknown',
      });
      expect(result.reconnect, `${cut}/${loss}`)
        .toMatchObject({ disposition: 'refused', handle: null });
      scenarios++;
    }
  }
  expect(scenarios).toBe(6);
}, 120_000);
