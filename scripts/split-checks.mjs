// `npm run test:split-checks -- <half-a.json> <half-b.json>`: merge the two halves of a split run
// into one whole-suite report and run the gate's report-reading checks once over it.
//
// Each half is its own `.test-results.json` plus the `.test-results.half.json` its gate wrote (see
// scripts/gate-report-checks.mjs). Both files come from the host that ran that half. This runs in
// one half's own checkout, because the single-process arms read artifacts only that host wrote.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPORT_CHECKS, runCommands } from './gate-report-checks.mjs';
import { LOCAL_HALF_REPORT, MERGED_REPORT, halfSidecar, mergeHalfReports } from './split-report.mjs';
import { testFiles } from '../tests/platform/macos-only.mjs';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const paths = process.argv.slice(2);
if (paths.length !== 2) {
  console.error('usage: npm run test:split-checks -- <half-a.json> <half-b.json>');
  process.exit(2);
}

// Read both halves whole before writing anything: one of them is usually this checkout's own
// .test-results.json, which the merge overwrites.
const halves = paths.map(path => {
  const bytes = readFileSync(resolve(root, path), 'utf8');
  return { report: JSON.parse(bytes), bytes, provenance: JSON.parse(readFileSync(resolve(root, halfSidecar(path)), 'utf8')) };
});
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const { report, localSplit } = mergeHalfReports(halves, { root, revision, expectedFiles: testFiles(root).sort() });
const localBytes = halves.find(half => half.provenance.split === localSplit).bytes;

writeFileSync(resolve(root, LOCAL_HALF_REPORT), localBytes);
writeFileSync(resolve(root, MERGED_REPORT), `${JSON.stringify(report)}\n`);
console.log(`split-checks: merged ${report.instarSplit.halves.map(half => `${half.split} (${half.files.length} files)`).join(' + ')}`
  + ` into ${report.testResults.length} files, ${report.numTotalTests} tests at ${revision.slice(0, 8)};`
  + ` the ${localSplit} half is this checkout and stays in ${LOCAL_HALF_REPORT}`);
process.exit(runCommands(REPORT_CHECKS.map(name => ['node', `scripts/${name}`])));
