import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P15-NF-07 P15-NF-08 P15-NF-10 P15-NF-17 P15-NF-19 round-six package decisions survive signed-history reconstruction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p15-round6-cuts-'));
  const run = (mode: string) => spawnSync(process.execPath,
    ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory, mode],
    { encoding: 'utf8', timeout: 30_000 });
  try {
    const cut = run('round6-validation-seed-cut');
    expect(cut.signal).toBe('SIGKILL');
    const recovered = run('round6-validation-recover');
    expect(recovered.status, recovered.stderr).toBe(0);
    expect(JSON.parse(recovered.stdout)).toEqual({ retired: 'refused', support: 'refused', doubled: ['refused', 'refused'] });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
