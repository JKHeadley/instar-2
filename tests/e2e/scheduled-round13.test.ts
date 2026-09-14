import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P15-NF-51 round-thirteen disabled import survives fsync and SIGKILL without becoming eligible', () => {
  const root = mkdtempSync(join(tmpdir(), 'p15-round13-cuts-'));
  const run = (directory: string, mode: string, fixture: string) => spawnSync(process.execPath,
    ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory, mode, fixture],
    { encoding: 'utf8', timeout: 30_000 });
  try {
    for (const fixture of ['legacy-health-check.json', 'legacy-benchmark-divergence-analysis.json']) {
      const directory = join(root, fixture); const sourceEnabled = fixture === 'legacy-health-check.json';
      const cut = run(directory, 'round13-legacy-seed-cut', fixture);
      expect(cut.signal, cut.stderr).toBe('SIGKILL');
      const recovered = run(directory, 'round13-legacy-recover', fixture);
      expect(recovered.status, recovered.stderr).toBe(0);
      const result = JSON.parse(recovered.stdout);
      expect(result).toMatchObject({ status: 'accepted', sourceEnabled, sourceBytesPreserved: true,
        activation: sourceEnabled ? 'eligible' : 'inhibited' });
      if (sourceEnabled) expect(result.residue).toEqual([]);
      else expect(result.residue).toContain('legacy job is disabled; explicit package enable choice required');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);
