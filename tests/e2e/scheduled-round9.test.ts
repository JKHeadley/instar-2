import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P15-NF-08 P15-NF-09 P15-NF-10 P15-NF-16 P15-NF-17 P15-NF-19 round-nine refusals survive SIGKILL reconstruction', () => {
  const root = mkdtempSync(join(tmpdir(), 'p15-round9-cuts-'));
  const run = (directory: string, mode: string, kind: string) => spawnSync(process.execPath,
    ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory, mode, kind],
    { encoding: 'utf8', timeout: 30_000 });
  try {
    for (const kind of ['active', 'retire-read-3', 'retire-read-4', 'repeated-type', 'repeated-type-overridden',
      'repeated-display-name', 'repeated-at', 'normal-second', 'support']) {
      const directory = join(root, kind);
      const cut = run(directory, 'round9-validation-seed-cut', kind);
      expect(cut.signal, cut.stderr).toBe('SIGKILL');
      const recovered = run(directory, 'round9-validation-recover', kind);
      expect(recovered.status, recovered.stderr).toBe(0);
      const result = JSON.parse(recovered.stdout);
      const accepted = kind === 'active' || kind === 'support';
      expect(result.before.status).toBe(accepted ? 'accepted' : 'refused');
      expect(result.after.status).toBe(accepted ? 'accepted' : 'refused');
      expect(result.owner.status).toBe(kind.startsWith('retire-read') ? 'refused' : 'accepted');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);
