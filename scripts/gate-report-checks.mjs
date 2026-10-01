// The gate steps that read the whole run's `.test-results.json`, as one step.
//
// With INSTAR_TEST_PLATFORM_SPLIT unset this runs exactly the checks the gate ran inline before,
// in the same order, printing nothing of its own — an unsplit gate is unchanged.
//
// Under a split this half's report is only half the suite, so these checks would fail for the wrong
// reason. The step then records what this half is (which half, which checkout, which commit, which
// report) beside the report and says so; `npm run test:split-checks -- <half-a.json> <half-b.json>`
// merges the two halves and runs them once over the whole suite.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MERGED_REPORT, SPLITS, halfSidecar, reportDigest } from './split-report.mjs';

/** The checks that read the whole run's report, in the order the gate runs them. */
export const REPORT_CHECKS = Object.freeze([
  'check-contract-map.mjs',
  'check-p2-contract-map.mjs',
  'check-register-contract-map.mjs',
  'check-p4-contract-map.mjs',
  'check-transport-contracts.mjs',
  'check-effect-contracts.mjs',
  'check-p5-contract-map.mjs',
  'check-judgment-contracts.mjs',
  'check-verification-contracts.mjs',
  'check-assembly-contracts.mjs',
  'check-p11-contract-map.mjs',
]);

/** What this step does under `split`: the checks to run, or where they run instead and why. */
export function planReportChecks(split) {
  if (split === undefined) return { runs: true, commands: REPORT_CHECKS.map(name => ['node', `scripts/${name}`]), handOff: null };
  if (!SPLITS.includes(split)) throw new Error(`INSTAR_TEST_PLATFORM_SPLIT must be ${SPLITS.join(' or ')}, not ${JSON.stringify(split)}`);
  return { runs: false, commands: [], handOff: `this ${split} half holds half the suite; the whole-suite checks run in `
    + `\`npm run test:split-checks -- <half-a.json> <half-b.json>\`` };
}

/** What a half records beside its report so the merge can bind and pair the two halves. */
export function halfProvenance(split, root, revision, report) {
  return { split, root, revision, reportDigest: reportDigest(report), reportStart: report.startTime };
}

/** Run the commands in order, stopping at the first failure; its exit status is the step's. */
export function runCommands(commands, run = (file, args) => spawnSync(file, args, { stdio: 'inherit' })) {
  for (const [file, ...args] of commands) {
    const child = run(file, args);
    if ((child.status ?? 1) !== 0) return child.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
  const plan = planReportChecks(process.env.INSTAR_TEST_PLATFORM_SPLIT || undefined);
  if (plan.runs) process.exit(runCommands(plan.commands));
  const split = process.env.INSTAR_TEST_PLATFORM_SPLIT;
  const report = JSON.parse(readFileSync(resolve(root, MERGED_REPORT), 'utf8'));
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const sidecar = halfSidecar(MERGED_REPORT);
  writeFileSync(resolve(root, sidecar), `${JSON.stringify(halfProvenance(split, root, revision, report), null, 2)}\n`);
  console.log(`gate-report-checks: ${plan.handOff}`);
  console.log(`gate-report-checks: this half is ${MERGED_REPORT} with ${sidecar}; hand both to the merge`);
}
