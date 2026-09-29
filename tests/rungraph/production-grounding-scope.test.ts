import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error The shared first-landing baseline checker is plain ESM.
import { firstLanding } from '../../scripts/first-landing.mjs';

// SEAM-LEDGER row 45 grant 08:48Z authorizes one additive Ten/Five unit.
function checkGroundingScope(root = process.cwd()) {
  const scope = firstLanding(root, ['src/assembly/grounding-capability.ts']);
  if (!scope.applicable) return scope;
  const base = scope.mergeBase;
  const paths = execFileSync('git', ['-C', root, 'diff', '--name-only', base, 'HEAD', '--', 'src'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const liveInputGrant = ['src/effects/contracts.ts', 'src/effects/records.ts', 'src/effects/doorway.ts', 'src/effects/index.ts'];
  // GRANT U4-E: Eleven's two exact production switch-on paths.
  const productionBootGrant = ['src/operator/index.ts', 'src/operator/production-switch-on.ts'];
  // GRANT U5-A: Six's two exact production run-admission paths.
  const runAdmissionGrant = ['src/transport/run-admission.ts', 'src/transport/index.ts'];
  // GRANT U5-E (2026-09-18): Part Two store projection reads (docs/06:55-58), exact file.
  const storeProjectionGrant = ['src/facts/store.ts', 'src/facts/historical.ts']; // GRANT M3-E: historical memo construction
  // GRANT SIX-PAIR (seam-six-reply-pair-grant.md): Six's fixed provider/reply Run pair, exact files.
  const runPairGrant = ['src/transport/contracts.ts', 'src/transport/records.ts', 'src/transport/authority.ts',
    'src/transport/run-pair.ts', 'src/transport/run-admission.ts', 'src/transport/index.ts',
    'src/transport/dispatch-invocation.ts', 'src/effects/doorway.ts', 'src/effects/effect.declarations.json',
    'src/transport/README.md', 'src/transport/slice-manifest.json', 'src/transport/transport.declarations.json'];
  // GRANT M4-G6-N-T6: Nine's exact-response assessment and Seven/Eight acceptance, exact files.
  const providerResponseAssessmentGrant = [
    'src/facts/owned.ts',
    'src/verification/contracts.ts', 'src/verification/records.ts', 'src/verification/runtime.ts',
    'src/verification/effect-consumption.ts', 'src/verification/index.ts', 'src/verification/verification.declarations.json',
    'src/judgment/contracts.ts', 'src/judgment/model-adapter.ts', 'src/judgment/provider-path.ts', 'src/judgment/index.ts',
    'src/judgment/judgment.declarations.json', 'src/effects/provider-path.ts', 'src/effects/index.ts'];
  expect(paths.filter(path => !liveInputGrant.includes(path) && !productionBootGrant.includes(path)
    && !runAdmissionGrant.includes(path) && !storeProjectionGrant.includes(path)
    && !providerResponseAssessmentGrant.includes(path) && !runPairGrant.includes(path) && !['src/assembly/', 'src/rungraph/'].some(prefix => path.startsWith(prefix))))
    .toEqual([]);
  return scope;
}

it('PRODUCTION-GROUNDING-SCOPE ledger 45 confines this unit to its two owner source directories', () => {
  expect(checkGroundingScope()).toMatchObject({ applicable: false });
});

it('grounding scope fixture accepts an addition, rejects foreign source, and permits later integration', () => {
  const root = mkdtempSync(join(tmpdir(), 'grounding-first-landing-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '-b', 'main');
    git('config', 'user.email', 'grounding-fixture@instar.local');
    git('config', 'user.name', 'Grounding Fixture');
    mkdirSync(join(root, 'src', 'assembly'), { recursive: true });
    writeFileSync(join(root, 'src', 'assembly', 'index.ts'), 'older assembly package\n');
    git('add', '.'); git('commit', '-m', 'older package');
    git('switch', '-c', 'unlanded');
    writeFileSync(join(root, 'src', 'assembly', 'grounding-capability.ts'), 'grounding addition\n');
    git('add', '.'); git('commit', '-m', 'permitted addition');
    expect(checkGroundingScope(root)).toMatchObject({ applicable: true });
    writeFileSync(join(root, 'src', 'foreign.ts'), 'violating mutation\n');
    git('add', '.'); git('commit', '-m', 'foreign mutation');
    expect(() => checkGroundingScope(root)).toThrow();
    git('switch', 'main');
    writeFileSync(join(root, 'src', 'assembly', 'grounding-capability.ts'), 'landed grounding\n');
    git('add', '.'); git('commit', '-m', 'land grounding');
    git('switch', '-c', 'later');
    writeFileSync(join(root, 'src', 'assembly', 'grounding-capability.ts'), 'later owner edit\n');
    writeFileSync(join(root, 'src', 'foreign.ts'), 'later cross-owner edit\n');
    git('add', '.'); git('commit', '-m', 'later integration');
    expect(checkGroundingScope(root)).toMatchObject({ applicable: false });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
