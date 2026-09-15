import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

const runner = join(process.cwd(), 'node_modules/.bin/vite-node');
const worker = 'tests/harness-adapters/a2-round9-poison-prefix-cut-worker.ts';

it('A2-E2E A2-R7-01 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 normal exit and SIGKILL after final fsync never promote confirmed poison from an older Nine prefix', () => {
  let scenarios = 0;
  for (const cut of ['normal', 'killed'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r9-prefix-${cut}-`));
    const seed = spawnSync(runner, [worker, 'seed', cut, directory, 'control'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
    });
    expect(seed.signal, seed.stderr).toBe(cut === 'killed' ? 'SIGKILL' : null);
    expect(seed.status, seed.stderr).toBe(cut === 'killed' ? null : 0);

    for (const loss of ['control', 'probe-prefix', 'plan-prefix'] as const) {
      const recovered = spawnSync(runner, [worker, 'recover', cut, directory, loss], {
        cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
      });
      expect(recovered.status, `${cut}/${loss}: ${recovered.stderr}`).toBe(0);
      const result = JSON.parse(recovered.stdout);
      expect(result.ownerReadKind, `${cut}/${loss}`).toBe('Success');
      expect(result.after, `${cut}/${loss}`).toMatchObject({
        state: loss === 'control' ? 'poisoned' : 'unknown',
      });
      expect(result.reconnect, `${cut}/${loss}`)
        .toMatchObject({ disposition: 'refused', handle: null });
      scenarios++;
    }
  }
  expect(scenarios).toBe(6);
}, 60_000);

it('A2-E2E A2-R7-01-BOUNDARIES P13-NF-24 P13-NF-28 P13-NF-38 P13-NF-51 every Part Two validation-floor append cut remains persistently unknown under an older Nine prefix', () => {
  const boundaries = ['lock', 'open:1', 'write', 'fsync:1', 'close:1', 'rename',
    'open:2', 'fsync:2', 'close:2'];
  let scenarios = 0;
  for (const boundary of boundaries) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r9-floor-${boundary.replace(':', '-')}-`));
    const seed = spawnSync(runner, [worker, 'seed', `boundary-${boundary}`, directory, 'control'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
    });
    expect(seed.signal, `${boundary}: ${seed.stderr}`).toBe('SIGKILL');
    const recovered = spawnSync(runner, [worker, 'recover', `boundary-${boundary}`, directory, 'probe-prefix'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
    });
    expect(recovered.status, boundary).toBe(1);
    expect(recovered.stderr, boundary).toContain('Part Two harness state append is uncertain');
    scenarios++;
  }
  expect(scenarios).toBe(9);
}, 90_000);
