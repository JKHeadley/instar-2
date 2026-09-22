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
  // GRANT U5-E (2026-09-18): Part Two store projection reads (docs/06:55-58), exact file.
  const storeProjectionGrant = ['src/facts/store.ts', 'src/facts/historical.ts']; // GRANT M3-E: historical memo construction
  // GRANT M4-G6-N-T6: Nine's exact-response assessment and Seven/Eight acceptance, exact files.
  const providerResponseAssessmentGrant = [
    'src/facts/owned.ts',
    'src/verification/contracts.ts', 'src/verification/records.ts', 'src/verification/runtime.ts',
    'src/verification/effect-consumption.ts', 'src/verification/index.ts', 'src/verification/verification.declarations.json',
    'src/judgment/contracts.ts', 'src/judgment/model-adapter.ts', 'src/judgment/provider-path.ts', 'src/judgment/index.ts',
    'src/judgment/judgment.declarations.json', 'src/effects/provider-path.ts', 'src/effects/index.ts'];
  expect(paths.filter(path => !liveInputGrant.includes(path) && !productionBootGrant.includes(path)
    && !runAdmissionGrant.includes(path) && !storeProjectionGrant.includes(path)
    && !providerResponseAssessmentGrant.includes(path) && !['src/assembly/', 'src/rungraph/'].some(prefix => path.startsWith(prefix))))
    .toEqual([]);
});
