import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P15-NF-03 P15-NF-07 P15-NF-08 P15-NF-10 P15-NF-17 P15-NF-19 round-eight validation survives reconstruction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p15-round8-cuts-'));
  const run = (mode: string) => spawnSync(process.execPath,
    ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory, mode],
    { encoding: 'utf8', timeout: 30_000 });
  try {
    const cut = run('round8-validation-seed-cut');
    expect(cut.signal).toBe('SIGKILL');
    const recovered = run('round8-validation-recover');
    expect(recovered.status, recovered.stderr).toBe(0);
    const proof = JSON.parse(recovered.stdout);
    expect(proof.dependencies).toEqual({ none: 'accepted', missing: 'refused', matching: 'accepted',
      'wrong-digest': 'refused', self: 'refused' });
    expect(proof.resources).toEqual({ support: 'accepted', 'second-manifest': 'refused',
      'missing-bytes': 'refused', 'changed-bytes': 'refused' });
    expect(proof.activity).toEqual({ recorded: 'refused', staged: 'refused', active: 'refused',
      retired: 'refused', inhibited: 'refused' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
