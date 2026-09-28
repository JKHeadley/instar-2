#!/usr/bin/env node
// ci-local: run, on this machine, exactly the checks the two GitHub workflows run
// (.github/workflows/document-checks.yml and types-checks.yml), and write a machine-readable
// result. It exists because GitHub-hosted checks can be blocked by account billing; a landing
// must never depend on them. What a single machine genuinely cannot reproduce (the two-
// architecture compare) is reported as such — never as a pass.
//
//   node scripts/ci-local.mjs [--out .ci-local-result.json]
//
// There is deliberately no shortcut flag: every run is the full parity run, including both
// workflow `npm ci` steps. Exit status is 0 only when at least one required step executed and
// passed and none failed; a run with no verified checks is 'failed' (no-verified-checks).
import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { hostname } from 'node:os';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outPath = outIdx >= 0 ? args[outIdx + 1] : '.ci-local-result.json';

const steps = [];
function run(id, workflow, title, cmd, { required = true, shell = true } = {}) {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  process.stdout.write(`\n=== [${workflow}] ${title}\n$ ${cmd}\n`);
  const r = spawnSync(cmd, { shell, stdio: 'inherit', env: process.env });
  const status = r.status === 0 ? 'passed' : 'failed';
  steps.push({ id, workflow, title, cmd, required, status, exit: r.status, startedAt, elapsedMs: Date.now() - t0 });
  process.stdout.write(`=== ${status.toUpperCase()} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
  return r.status === 0;
}
function skip(id, workflow, title, reason) {
  steps.push({ id, workflow, title, required: false, status: 'not-reproducible-locally', reason });
  process.stdout.write(`\n=== [${workflow}] ${title}\n=== NOT REPRODUCIBLE LOCALLY: ${reason}\n`);
}
const git = (a) => spawnSync('git', a, { encoding: 'utf8' }).stdout.trim();
const head = git(['rev-parse', 'HEAD']);
// Rule 112: the run's start is recorded in the shared evidence ledger before any step runs, so
// a result that later fails to record stays visible as an unfinished (red) run. No start, no run.
const started = spawnSync(process.execPath, ['scripts/check-change-review.mjs', 'ci-start'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const runId = /^ci-run (\S+)$/m.exec(started.stdout ?? '')?.[1];
process.stdout.write(started.stdout ?? '');
if (started.status !== 0 || !runId) { process.stderr.write('ci-local: its start could not be recorded in the evidence ledger; refusing to run\n'); process.exit(2); }
const nodeVersion = process.version;

// document-checks.yml
run('doc-1', 'document-checks', 'changelogs carry every required field (rule 91)',
  'node scripts/validate-changelog.mjs docs/*.changelog.json docs/harvests/*.changelog.json');
run('doc-2', 'document-checks', 'generated changelog markdown is current (rule 91)',
  "node scripts/render-changelog.mjs docs/*.changelog.json docs/harvests/*.changelog.json && git diff --exit-code -- '*.changelog.md'");
run('doc-3', 'document-checks', 'no history markers in a governed body (rule 91)',
  'node scripts/check-governed-docs.mjs docs');
run('doc-4', 'document-checks', 'no whitespace errors',
  'git diff --check origin/main...HEAD || git diff --check HEAD~1');
run('doc-5', 'document-checks', 'every change is bound to its review record (rules 74, 109, 90)',
  'node scripts/check-change-review.mjs check');

// types-checks.yml — contract job (this machine's architecture)
run('types-0', 'constitutional-types', 'npm ci (contract job)', 'npm ci');
run('types-1', 'constitutional-types', 'npm run test:all', 'npm run test:all');
run('types-2', 'constitutional-types', `architecture is ${process.arch}`,
  `node -e "if (process.arch !== '${process.arch}') process.exit(1)"`);
run('types-3', 'constitutional-types', 'P2 determinism output', 'node scripts/p2-determinism.mjs p2-output.json');
skip('types-4', 'constitutional-types', 'cross-architecture compare of p2-output.json',
  `only ${process.arch} is available on this machine; GitHub compares x64 against arm64`);
skip('types-5', 'constitutional-types', 'P3-NF-07 register.json compare across architectures',
  `only ${process.arch} is available on this machine; generated/register.json ${existsSync('generated/register.json') ? 'was produced' : 'is missing'}`);
run('types-6a', 'constitutional-types', 'p3-body-seam job: npm ci && npm run build', 'npm ci && npm run build');
run('types-6', 'constitutional-types', 'p3-body-seam job: test-p3-body-seam', 'node scripts/test-p3-body-seam.mjs .');

const failed = steps.filter((s) => s.required && s.status === 'failed');
const passedRequired = steps.filter((s) => s.required && s.status === 'passed');
// A verdict is only ever 'passed' when at least one required step actually executed and passed;
// a run consisting solely of not-reproducible steps is 'failed' (reason below), never a pass.
const verdict = failed.length > 0 ? 'failed' : passedRequired.length === 0 ? 'failed' : 'passed';
const verdictReason = failed.length > 0 ? `${failed.length} required step(s) failed` : passedRequired.length === 0 ? 'no-verified-checks: no required step executed and passed' : 'every reproducible required step passed';
const result = {
  schema: 'ci-local/1',
  head, arch: process.arch, node: nodeVersion, machine: hostname(),
  finishedAt: new Date().toISOString(),
  verdict, verdictReason,
  passedRequiredCount: passedRequired.length,
  reproducedWorkflows: ['document-checks', 'constitutional-types (single architecture)'],
  steps,
};
writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
// Rule 112: the file above is only the latest pointer; the durable record completes the start
// above, hash-chained in the shared evidence ledger and never overwritten. The verdict below
// stays ci-local's own; a failed recording is reported, never shown as recorded.
const recorded = spawnSync(process.execPath, ['scripts/check-change-review.mjs', 'ci', outPath, '--run', runId], { stdio: 'inherit' });
if (recorded.status !== 0) process.stderr.write(`ci-local: its result was NOT recorded; start ${runId} stays an unfinished (red) run in the evidence ledger\n`);
process.stdout.write(`\n=== ci-local ${result.verdict.toUpperCase()} (${verdictReason}) at ${head.slice(0, 8)} (${process.arch}, node ${nodeVersion}); ${passedRequired.length} passed, ${failed.length} failed, ${steps.filter((s) => s.status === 'not-reproducible-locally').length} not reproducible locally -> ${outPath}\n`);
process.exit(verdict === 'failed' ? 1 : 0);
