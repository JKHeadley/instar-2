// `npm run test:affected` — run only the tests vitest's module graph links to what changed
// since this branch left main (committed AND uncommitted), so a builder can iterate on the
// relevant slice of the suite and reserve `npm run test:all` for the single final gate.
// This is a speed tool for the inner loop, never evidence: the full gate is what the
// review desk and the landing runbook trust. Extra arguments pass through to vitest
// (e.g. `npm run test:affected -- --reporter=dot`). AFFECTED_BASE overrides the base ref.
import { spawnSync } from 'node:child_process';

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function baseRef() {
  if (process.env.AFFECTED_BASE) return process.env.AFFECTED_BASE;
  for (const ref of ['main', 'origin/main'])
    if (git(['rev-parse', '--verify', '--quiet', ref]) !== null) {
      const base = git(['merge-base', ref, 'HEAD']);
      if (base) return base;
    }
  return 'HEAD~1';
}

const base = baseRef();
const extra = process.argv.slice(2);
process.stdout.write(`affected tests: changes since ${base} (plus uncommitted); full gate is still \`npm run test:all\`\n`);
const r = spawnSync('npx', ['vitest', 'run', '--changed', base, '--passWithNoTests', ...extra], { stdio: 'inherit' });
process.exit(r.status ?? 1);
