import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P15-NF-03 P15-NF-07 P15-NF-08 P15-NF-10 round-seven owner boundaries survive reconstruction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p15-round7-cuts-'));
  const run = (mode: string) => spawnSync(process.execPath,
    ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory, mode],
    { encoding: 'utf8', timeout: 30_000 });
  try {
    const cut = run('round7-validation-seed-cut');
    expect(cut.signal).toBe('SIGKILL');
    const recovered = run('round7-validation-recover');
    expect(recovered.status, recovered.stderr).toBe(0);
    const proof = JSON.parse(recovered.stdout);
    expect(Object.fromEntries(Object.entries(proof.resources).map(([key, value]: [string, any]) => [key, value.status])))
      .toEqual({ manifest: 'accepted', 'job-definition': 'accepted', 'schedule-resource': 'accepted',
        support: 'refused', 'hidden-second': 'refused' });
    expect(proof.resources.support).toEqual(proof.resources['hidden-second']);
    for (const state of ['recorded', 'staged', 'retired', 'inhibited']) expect(proof.activity[state]).toEqual({
      status: 'refused', detail: 'competing package activity requires a Part Ten owner-issued activity resolution' });
    expect(proof.activity.active).toEqual({ status: 'refused', detail: 'duplicate scheduled job id' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
