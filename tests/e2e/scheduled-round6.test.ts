import { runChild } from './async-child.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P15-NF-07 P15-NF-08 P15-NF-10 P15-NF-17 P15-NF-19 round-six package decisions survive signed-history reconstruction', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'p15-round6-cuts-'));
  const run = async (mode: string) => (await runChild(process.execPath,
    ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory, mode],
    { encoding: 'utf8', timeout: 90000 }));
  try {
    const cut = (await run('round6-validation-seed-cut'));
    expect(cut.signal).toBe('SIGKILL');
    const recovered = (await run('round6-validation-recover'));
    expect(recovered.status, recovered.stderr).toBe(0);
    expect(JSON.parse(recovered.stdout)).toEqual({ retired: 'refused', support: 'accepted', doubled: ['refused', 'refused'] });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 90000);
