// Merging the two halves of an INSTAR_TEST_PLATFORM_SPLIT run back into one whole-suite vitest JSON
// report, and reading the local half back out of a merged one.
//
// Why this exists: under a split each host runs only its half, so each half's `.test-results.json`
// holds only that half's files. The gate's report-reading checks (scripts/gate-report-checks.mjs)
// ask whole-suite questions — "every design check NF-xx has a passing test", "the report's file
// multiset is the whole checkout" — so on a half they fail for the wrong reason ("missing actual
// test for NF-01"). The two halves together are the whole suite, so merging their reports and
// running those checks once over the merge is the whole-suite evidence.
//
// Two arms stay bound to a single real vitest process and to artifacts only its host wrote (the
// production-grounding assertion ledger and process exit, the boot-recovery receipts). Those keep
// reading the LOCAL half unchanged, through localHalfReport below; only the whole-checkout file set
// they also demand comes from the merge. So nothing accepts a remote host's process evidence.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const SPLITS = Object.freeze(['exclude-macos', 'only-macos']);
/** The whole-suite report the gate's checks read. A merge writes it; a half's own run writes it too. */
export const MERGED_REPORT = '.test-results.json';
/** The local half's own report, kept beside the merge for the single-process arms. */
export const LOCAL_HALF_REPORT = '.test-results.local.json';
/** Where a half records which half it is, its checkout, its commit, and the report it belongs to. */
export const halfSidecar = reportPath => `${reportPath.replace(/\.json$/, '')}.half.json`;

const refuse = message => { throw new Error(`split-report: ${message}`); };

/** The digest the half's sidecar binds to, over the parsed report — the same shape the
 * production-grounding process-exit rows already use, so one producer serves both. */
export const reportDigest = report => createHash('sha256').update(JSON.stringify(report)).digest('hex');

// Every top-level key a vitest JSON report carries, with how two halves combine. An unknown key
// refuses rather than being silently dropped or silently taken from one half.
const SUM = ['numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites',
  'numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests', 'numRuntimeErrorTestSuites'];
const CONCAT = ['testResults', 'unhandledErrors', 'errors'];
const ALL_TRUE = ['success'];
const EARLIEST = ['startTime'];
const COMBINED = ['snapshot'];

/** Snapshot summaries combine the same way: counts add, flags are true if either half's is, lists join. */
function mergeSnapshot(a = {}, b = {}) {
  const out = {};
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
    const [left, right] = [a[key], b[key]];
    if (typeof left === 'number' || typeof right === 'number') out[key] = (left ?? 0) + (right ?? 0);
    else if (typeof left === 'boolean' || typeof right === 'boolean') out[key] = Boolean(left) || Boolean(right);
    else if (Array.isArray(left) || Array.isArray(right)) out[key] = [...(left ?? []), ...(right ?? [])];
    else refuse(`unknown snapshot field ${JSON.stringify(key)}: teach the merge how it combines`);
  }
  return out;
}

/** This half's test files, relative to its own checkout root, refusing a name outside that root. */
function halfFiles(report, root, split) {
  return (report.testResults ?? []).map(file => {
    const name = String(file.name ?? '');
    if (!name.startsWith(`${root}/`)) refuse(`${split} half ran ${name || '(unnamed)'} outside its checkout ${root}`);
    return relative(root, name);
  });
}

/**
 * The whole-suite report the two halves add up to, plus which half is local.
 * `halves` is two `{ report, provenance }` pairs; `context` is this checkout's `{ root, revision,
 * expectedFiles }`, where expectedFiles is every test file the unsplit gate would run, relative to root.
 * Refuses when the halves overlap, when they are not both this checkout's commit, or when a file the
 * unsplit gate would run is in neither half.
 */
export function mergeHalfReports(halves, context) {
  if (halves.length !== 2) refuse(`a merge needs exactly two halves, not ${halves.length}`);
  const { root, revision, expectedFiles } = context;
  for (const { report, provenance } of halves) {
    if (report.instarSplit) refuse(`${provenance.split ?? 'a'} input is already a merged report, not a half`);
    if (!SPLITS.includes(provenance.split)) refuse(`a half must be ${SPLITS.join(' or ')}, not ${JSON.stringify(provenance.split)}`);
    if (provenance.reportDigest !== reportDigest(report) || provenance.reportStart !== report.startTime)
      refuse(`the ${provenance.split} sidecar does not belong to the report it was given with`);
  }
  if (halves[0].provenance.split === halves[1].provenance.split)
    refuse(`both inputs are the ${halves[0].provenance.split} half`);
  for (const { provenance } of halves) if (provenance.revision !== revision)
    refuse(`halves are from different commits: the ${provenance.split} half ran ${provenance.revision}, this checkout is ${revision}`);

  const ordered = [...halves].sort((a, b) => SPLITS.indexOf(a.provenance.split) - SPLITS.indexOf(b.provenance.split));
  const withFiles = ordered.map(half => ({ ...half, files: halfFiles(half.report, half.provenance.root, half.provenance.split) }));
  const overlap = withFiles[0].files.filter(file => withFiles[1].files.includes(file)).sort();
  if (overlap.length) refuse(`both halves ran ${overlap.join(', ')}: a split runs every file in exactly one half`);
  const ran = new Set(withFiles.flatMap(half => half.files));
  const missing = expectedFiles.filter(file => !ran.has(file)).sort();
  if (missing.length) refuse(`neither half ran ${missing.join(', ')}: the merge is not the whole suite`);

  // In a real split the two halves are two checkouts, so at most one matches. A same-checkout
  // rehearsal matches both; then split order decides, which picks exclude-macos — the half that
  // carries the per-process grounding and boot artifacts.
  const local = withFiles.find(half => half.provenance.root === root);
  if (!local) refuse(`neither half ran in this checkout (${withFiles.map(h => `${h.provenance.split}: ${h.provenance.root}`).join('; ')})`
    + ': run the merge in one half\'s checkout, where its per-process evidence lives');

  const [a, b] = withFiles.map(half => half.report);
  const merged = {};
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (SUM.includes(key)) merged[key] = (a[key] ?? 0) + (b[key] ?? 0);
    else if (ALL_TRUE.includes(key)) merged[key] = Boolean(a[key]) && Boolean(b[key]);
    else if (EARLIEST.includes(key)) merged[key] = Math.min(...[a[key], b[key]].filter(Number.isFinite));
    else if (COMBINED.includes(key)) merged[key] = mergeSnapshot(a[key], b[key]);
    else if (CONCAT.includes(key)) merged[key] = [...(a[key] ?? []), ...(b[key] ?? [])];
    else refuse(`unknown report field ${JSON.stringify(key)}: teach the merge how it combines`);
  }
  // Rebased to this checkout so the whole-suite checks resolve every file the same way they do
  // in an unsplit run; the half each file came from stays recorded in instarSplit below.
  merged.testResults = withFiles.flatMap(half => (half.report.testResults ?? [])
    .map(file => ({ ...file, name: join(root, relative(half.provenance.root, file.name)) })))
    .sort((x, y) => x.name.localeCompare(y.name));
  merged.instarSplit = { local: local.provenance.split, halves: withFiles.map(half => ({
    split: half.provenance.split, root: half.provenance.root, revision: half.provenance.revision,
    reportDigest: half.provenance.reportDigest, reportStart: half.provenance.reportStart, files: [...half.files].sort(),
  })) };
  return { report: merged, local: local.report, localSplit: local.provenance.split };
}

/**
 * What the single-process arms should read: the local half's own report and the other half's test
 * files, rooted here. An unmerged report is returned unchanged with no other half, so an unsplit
 * gate behaves exactly as before.
 */
export function localHalfReport(report, root, read = path => readFileSync(path, 'utf8')) {
  if (!report.instarSplit) return { report, otherHalfFiles: [] };
  const { local, halves } = report.instarSplit;
  const mine = halves.find(half => half.split === local), other = halves.find(half => half.split !== local);
  if (!mine || !other) refuse('a merged report must name both halves and which one is local');
  const parsed = JSON.parse(read(LOCAL_HALF_REPORT));
  if (reportDigest(parsed) !== mine.reportDigest)
    refuse(`${LOCAL_HALF_REPORT} is not the ${local} half this merge was built from`);
  return { report: parsed, otherHalfFiles: other.files.map(file => join(root, file)) };
}
