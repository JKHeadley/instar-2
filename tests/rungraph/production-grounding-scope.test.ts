import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

// SEAM-LEDGER row 45 grant 08:48Z authorizes one additive Ten/Five unit.
it('PRODUCTION-GROUNDING-SCOPE ledger 45 confines this unit to its two owner source directories', () => {
  const base = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { encoding: 'utf8' }).trim();
  const paths = execFileSync('git', ['diff', '--name-only', base, 'HEAD', '--', 'src'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  expect(paths.filter(path => !['src/assembly/', 'src/rungraph/'].some(prefix => path.startsWith(prefix))))
    .toEqual([]);
});
