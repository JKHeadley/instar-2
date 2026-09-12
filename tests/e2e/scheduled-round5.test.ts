import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('accepts validated support resources while preserving ambiguous-package refusal across a durable restart cut', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p15-round5-cuts-'));
  const run = (mode: string) => spawnSync(process.execPath,
    ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory, mode],
    { encoding: 'utf8', timeout: 30_000 });
  try {
    const cut = run('round5-validation-seed-cut');
    expect(cut.signal).toBe('SIGKILL');
    const recovered = run('round5-validation-recover');
    expect(recovered.status, recovered.stderr).toBe(0);
    expect(JSON.parse(recovered.stdout)).toEqual({ ambiguous: 'refused', additionalContent: 'accepted' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
