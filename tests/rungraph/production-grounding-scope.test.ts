import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

// SEAM-LEDGER row 45 grant 08:48Z authorizes one additive Ten/Five unit.
it('PRODUCTION-GROUNDING-SCOPE ledger 45 confines this unit to its two owner source directories', () => {
  const base = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { encoding: 'utf8' }).trim();
  const paths = execFileSync('git', ['diff', '--name-only', base, 'HEAD', '--', 'src'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const liveInputGrant = ['src/effects/contracts.ts', 'src/effects/records.ts', 'src/effects/doorway.ts', 'src/effects/index.ts'];
  // GRANT U4-E: Eleven's two exact production switch-on paths.
  const productionBootGrant = ['src/operator/index.ts', 'src/operator/production-switch-on.ts'];
  // GRANT U5-A: Six's two exact production run-admission paths.
  const runAdmissionGrant = ['src/transport/run-admission.ts', 'src/transport/index.ts'];
  expect(paths.filter(path => !liveInputGrant.includes(path) && !productionBootGrant.includes(path)
    && !runAdmissionGrant.includes(path) && !['src/assembly/', 'src/rungraph/'].some(prefix => path.startsWith(prefix))))
    .toEqual([]);
});
