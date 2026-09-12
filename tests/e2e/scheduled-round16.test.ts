import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P15-NF-09 round-sixteen lifecycle re-resolves valid and invalid named zones after a durable process cut', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p15-round16-zone-'));
  const args = ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory];
  try {
    const cut = spawnSync(process.execPath, [...args, 'round16-zone-seed-cut'], { encoding: 'utf8', timeout: 30_000 });
    expect(cut.signal).toBe('SIGKILL');
    const recovered = spawnSync(process.execPath, [...args, 'round16-zone-recover'], { encoding: 'utf8', timeout: 30_000 });
    expect(recovered.status, recovered.stderr).toBe(0);
    expect(JSON.parse(recovered.stdout)).toEqual({
      'Mars/Olympus_Mons': expect.objectContaining({ status: 'refused' }),
      'America/New_York': { status: 'accepted', timeZone: 'America/New_York' },
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
