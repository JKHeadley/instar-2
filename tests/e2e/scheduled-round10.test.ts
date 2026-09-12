import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('P15-NF-08 P15-NF-10 P15-NF-17 P15-NF-19 P15-NF-51 round-ten review races survive fsync and SIGKILL', () => {
  const root = mkdtempSync(join(tmpdir(), 'p15-round10-cuts-'));
  const run = (directory: string, mode: string, kind: string) => spawnSync(process.execPath,
    ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory, mode, kind],
    { encoding: 'utf8', timeout: 30_000 });
  try {
    const cases = ['collision-99', 'collision-1', 'collision-4', 'dependency-99', 'dependency-2',
      'dependency-3', 'dependency-4', 'dependency-5', 'legacy-script', 'legacy-unknown', 'legacy-array-script'];
    for (const kind of cases) {
      const directory = join(root, kind);
      const cut = run(directory, 'round10-validation-seed-cut', kind);
      expect(cut.signal, cut.stderr).toBe('SIGKILL');
      const recovered = run(directory, 'round10-validation-recover', kind);
      expect(recovered.status, recovered.stderr).toBe(0);
      const result = JSON.parse(recovered.stdout);
      if (kind === 'collision-99' || kind === 'dependency-99') {
        expect(result.before.status).toBe('accepted'); expect(result.after.status).toBe('accepted');
      } else if (kind === 'collision-1') {
        expect(result.before.detail).toBe('package declaration namespace collision');
        expect(result.after.detail).toBe('package declaration namespace collision');
      } else if (kind === 'collision-4') {
        expect(result.before.detail).toBe('package admission history frontier moved');
        expect(result.after.detail).toBe('package declaration namespace collision');
      } else if (kind === 'dependency-2') {
        expect(result.before.detail).toBe('missing or mutable package dependency');
        expect(result.after.detail).toBe('missing or mutable package dependency');
      } else if (kind.startsWith('dependency-')) {
        expect(result.before.detail).toBe('package admission history frontier moved');
        expect(result.after.detail).toBe('missing or mutable package dependency');
      } else if (kind === 'legacy-script') {
        expect(result.before).toMatchObject({ status: 'accepted', learning: 'off', activation: 'eligible' });
        expect(result.after).toEqual(result.before);
      } else {
        expect(result.before).toEqual({ status: 'refused', detail: 'legacy execute type is unknown' });
        expect(result.after).toEqual(result.before);
      }
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);
