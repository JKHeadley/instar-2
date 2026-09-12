import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P15-NF-08 P15-NF-10 round-twelve malformed-resource refusals survive fsync and SIGKILL', () => {
  const root = mkdtempSync(join(tmpdir(), 'p15-round12-cuts-'));
  const run = (directory: string, mode: string, kind: string) => spawnSync(process.execPath,
    ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory, mode, kind],
    { encoding: 'utf8', timeout: 30_000 });
  try {
    for (const kind of ['support', 'second-valid', 'second-missing-field', 'second-trailing-comma',
      'second-truncated', 'second-duplicate-type']) {
      const directory = join(root, kind);
      const cut = run(directory, 'round12-validation-seed-cut', kind);
      expect(cut.signal, cut.stderr).toBe('SIGKILL');
      const recovered = run(directory, 'round12-validation-recover', kind);
      expect(recovered.status, recovered.stderr).toBe(0);
      const result = JSON.parse(recovered.stdout);
      expect(result.records).toBeGreaterThan(0);
      expect(result.status).toBe(kind === 'support' ? 'accepted' : 'refused');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 90_000);
