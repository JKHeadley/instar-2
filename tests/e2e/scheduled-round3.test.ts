import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P15-NF-08 P15-NF-16 P15-NF-17 P15-NF-51 lifecycle proof crosses real killed-process package and import boundaries', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p15-round4-cuts-'));
  const run = (mode: string) => spawnSync(process.execPath,
    ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory, mode],
    { encoding: 'utf8', timeout: 30_000 });
  try {
    const packageCut = run('round4-conflicts-seed-cut');
    expect(packageCut.signal).toBe('SIGKILL');
    const packageRecovery = run('round4-conflicts-recover');
    expect(packageRecovery.status, packageRecovery.stderr).toBe(0);
    expect(JSON.parse(packageRecovery.stdout)).toEqual({
      cross: ['refused', 'refused'], same: ['refused', 'refused'],
    });

    const importCut = run('legacy-learning-seed-cut');
    expect(importCut.signal).toBe('SIGKILL');
    const importRecovery = run('legacy-recover');
    expect(importRecovery.status, importRecovery.stderr).toBe(0);
    expect(JSON.parse(importRecovery.stdout)).toMatchObject({
      postCompletionLearning: 'required', livingSkills: { enabled: true }, integrationGate: true,
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
