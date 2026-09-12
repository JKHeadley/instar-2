// Structural Slice A1 contract map. Lifecycle-holder behavior is intentionally
// absent and is named only as NON-EXECUTABLE-UNTIL-slice-A2.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const A2 = 'NON-EXECUTABLE-UNTIL-slice-A2';
const OWNERSHIP = 'docs/17-harness-adapters/01-ownership-and-boundaries.md';
const CTX_GROUND = 'dated 06:33Z addendum in seam-response-rungraph-followup.md, SEAM-LEDGER.md row 38';
const CTX_CURRENT = 'dated 08:48Z addenda in seam-response-assembly-followup.md + seam-response-rungraph-followup.md, SEAM-LEDGER.md row 45';
const HISTORY_COVERAGE = 'dated 09:10Z addendum in seam-response-rungraph-followup.md, SEAM-LEDGER.md row 52';
const ROUTE_CONFORMANCE = 'dated 07:52Z addendum in seam-response-assembly-followup.md, SEAM-LEDGER.md row 42';
const PROMPT = 'dated 07:10Z addenda in seam-response-effects-followup.md + seam-response-assembly-followup.md, SEAM-LEDGER.md row 41';
const LIVE_PREREQUISITES = `LIVE-PREREQUISITES defined by ${OWNERSHIP}`;
const executable = new Map([
  [1, 'All four owned record forms and every runtime-event variant use closed total decoders, canonical comparison, migration, and deep freezing.'],
  [2, 'The root design and all indexed section files pass the governed-document checker.'],
  [5, 'A1 admission binds an exact launch subject to a current-generation Part Ten observation.'],
  [15, 'Malformed or substituted operation/process identities refuse through typed receipts.'],
  [24, 'The landed Part Four recovery port exposes EACCES/EIO custody reads as typed uncertainty while preserving its durable receipt.'],
  [25, 'The A1 observation-admission arm rejects otherwise valid evidence from an obsolete register generation.'],
  [29, 'The A1 observation-admission arm requires current owner generation; liveness classification remains in Slice A2.'],
  [30, 'Only closed structured events decode; diagnostic text is never interpreted as state.'],
  [31, 'A1 progress identity deduplicates owner subject plus output range and digest without inventing owner custody.'],
  [33, 'The owned event preserves exit status as evidence and never constructs Part Five state.'],
  [34, 'A1 output decoding and declared duplicate identity are executable; capture custody and lifecycle assembly remain in Slice A2.'],
  [39, 'One operation retains one exact action and subject; contradictory replays refuse.'],
  [46, 'The real landed Part Four EACCES/EIO recovery arm executes; holder liveness/work-gate/lifecycle cases remain in Slice A2.'],
]);

const mixedA2 = new Set([24, 25, 29, 31, 33, 34, 39, 46]);
const whollyA2 = new Set([3, 8, 21, 28, 32, 37, 38, 51, 52]);

const external = new Map([
  [4, 'seam-response-assembly-followup.md'],
  [6, 'seam-response-effects-payloads.md + seam-response-effects-followup.md'],
  [7, `seam-response-judgment.md + ${ROUTE_CONFORMANCE}`],
  [9, 'seam-response-assembly-followup.md'],
  [10, 'seam-response-judgment.md + seam-response-assembly-followup.md'],
  [11, 'seam-response-judgment.md + seam-response-assembly-followup.md'],
  [12, 'seam-response-judgment.md + seam-response-assembly-followup.md'],
  [13, 'seam-response-assembly-followup.md'],
  [14, `seam-response-effects-payloads.md + seam-response-effects-followup.md + ${CTX_GROUND} + ${CTX_CURRENT} + ${HISTORY_COVERAGE}`],
  [16, `${CTX_GROUND} + ${CTX_CURRENT} + ${HISTORY_COVERAGE} + seam-response-judgment.md + seam-response-effects-followup.md`],
  [17, `${CTX_GROUND} + ${CTX_CURRENT} + ${HISTORY_COVERAGE}`],
  [18, `${CTX_GROUND} + ${CTX_CURRENT} + ${HISTORY_COVERAGE}`],
  [19, `seam-response-effects-payloads.md + seam-response-effects-followup.md + ${CTX_CURRENT} + ${HISTORY_COVERAGE}`],
  [20, `seam-response-effects-payloads.md + seam-response-effects-followup.md + ${CTX_CURRENT} + ${HISTORY_COVERAGE}`],
  [22, CTX_CURRENT],
  [23, `${CTX_GROUND} + ${CTX_CURRENT} + ${HISTORY_COVERAGE} + seam-response-judgment.md + seam-response-effects-followup.md`],
  [26, `seam-response-rungraph-followup.md compaction grant + ${CTX_CURRENT} + ${HISTORY_COVERAGE}`],
  [27, 'seam-response-run-closure.md + seam-response-rungraph-followup.md'],
  [35, `${PROMPT} + seam-response-loop-breaker.md + seam-response-loop-followup.md`],
  [36, 'seam-response-effects-payloads.md + seam-response-effects-followup.md'],
  [40, 'seam-response-judgment.md + seam-response-assembly-followup.md + seam-response-effects-payloads.md + seam-response-effects-followup.md'],
  [41, 'seam-response-rungraph-followup.md'],
  [42, 'part-eleven-seam-response-assembly.md'],
  [43, LIVE_PREREQUISITES],
  [44, LIVE_PREREQUISITES],
  [45, `${ROUTE_CONFORMANCE} + ${HISTORY_COVERAGE} + seam-response-judgment.md + seam-response-assembly-followup.md`],
  [47, LIVE_PREREQUISITES],
  [48, `seam-response-judgment.md + seam-response-assembly-followup.md + ${ROUTE_CONFORMANCE} + ${HISTORY_COVERAGE}`],
  [49, HISTORY_COVERAGE],
  [50, HISTORY_COVERAGE],
]);

const proofTitles = new Map([
  [1, 'P13-NF-01 A1-RECORDS all four owned forms and eleven event variants are closed, total, canonical, migrated, and deeply frozen'],
  [2, 'P13-NF-02 the complete Part Thirteen design still passes the governed-document checker'],
  [5, 'R5-F4 P13-NF-05 P13-NF-25 P13-NF-29 current Part Ten observation generation is mandatory at A1 admission'],
  [15, 'R5-F5 P13-NF-15 malformed begin/finish attempt fields are typed refusals and never append partial state'],
  [24, 'R5-F9 P13-NF-24 P13-NF-46 real Part Four custody read EACCES returns a typed refusal and preserves the durable receipt'],
  [25, 'R5-F4 P13-NF-05 P13-NF-25 P13-NF-29 current Part Ten observation generation is mandatory at A1 admission'],
  [29, 'R5-F4 P13-NF-05 P13-NF-25 P13-NF-29 current Part Ten observation generation is mandatory at A1 admission'],
  [30, 'A1-INTEGRATION R5-F7 R5-F8 P13-NF-30 P13-NF-31 P13-NF-33 P13-NF-34 deduplicates declared progress identity without inventing output custody'],
  [31, 'R5-F7 P13-NF-31 P13-NF-34 output progress identity ignores runtime id and capture label but not bytes'],
  [33, 'A1-INTEGRATION R5-F7 R5-F8 P13-NF-30 P13-NF-31 P13-NF-33 P13-NF-34 deduplicates declared progress identity without inventing output custody'],
  [34, 'R5-F7 P13-NF-31 P13-NF-34 output progress identity ignores runtime id and capture label but not bytes'],
  [39, 'R5-F6 P13-NF-39 one operation retains one exact action and subject across attempt kinds'],
  [46, 'R5-F9 P13-NF-24 P13-NF-46 real Part Four custody read EACCES returns a typed refusal and preserves the durable receipt'],
]);

export function p13Dispositions(design = readFileSync('docs/17-harness-adapters/12-negative-contract-fixtures.md', 'utf8')) {
  const ids = [...design.matchAll(/^\| (P13-NF-(\d+)) \|/gm)].map(match => ({ id: match[1], number: Number(match[2]) }));
  if (ids.length !== 52 || new Set(ids.map(row => row.number)).size !== 52)
    throw new Error(`expected exactly 52 unique P13-NF design rows, received ${ids.length}`);
  return ids.map(row => {
    if (executable.has(row.number)) return {
      ...row, status: 'EXECUTABLE', reason: executable.get(row.number),
      ...(mixedA2.has(row.number) ? { heldArms: A2 } : {}),
    };
    if (whollyA2.has(row.number)) return { ...row, status: A2,
      reason: 'The holder lifecycle implementation and its fixtures were structurally removed from Slice A1.' };
    const dependency = external.get(row.number);
    if (!dependency) throw new Error(`${row.id}: no executable arm or exact non-executable dependency`);
    return { ...row, status: `NON-EXECUTABLE-UNTIL-${dependency}`,
      reason: 'The named owner contract is not landed; no local stand-in is counted.' };
  });
}

/** Resolve held-arm citations against the governing ownership table and its exact paired grants. */
export function checkP13DependencyCitations(rows = p13Dispositions()) {
  const ownership = readFileSync(OWNERSHIP, 'utf8');
  const failures = [];
  const citations = new Set();
  for (const row of rows) {
    for (const path of row.status.match(/docs\/[A-Za-z0-9_./-]+\.md/g) ?? []) {
      citations.add(path);
      if (!existsSync(path)) failures.push(`${row.id}: missing dependency document ${path}`);
    }
    for (const file of row.status.match(/(?:part-eleven-)?seam-response-[A-Za-z0-9-]+\.md|SEAM-LEDGER\.md/g) ?? []) {
      if (file === OWNERSHIP.split('/').at(-1)) continue;
      citations.add(file);
      if (!ownership.includes(`\`${file}\``))
        failures.push(`${row.id}: ${file} is not resolved by ${OWNERSHIP}`);
    }
  }
  const required = [
    ...[14, 16, 17, 18, 19, 20, 22, 23, 26].map(number => [number, CTX_CURRENT]),
    [35, PROMPT],
    ...[7, 45, 48].map(number => [number, ROUTE_CONFORMANCE]),
    ...[14, 16, 17, 18, 19, 20, 23, 26, 45, 48, 49, 50].map(number => [number, HISTORY_COVERAGE]),
  ];
  for (const [number, dependency] of required) {
    const status = rows.find(row => row.number === number)?.status ?? '';
    if (!status.includes(dependency)) failures.push(`P13-NF-${String(number).padStart(2, '0')}: missing ${dependency}`);
  }
  for (const anchor of [
    'The stable label **LIVE-PREREQUISITES** means',
    'dated 06:33Z addendum in `seam-response-rungraph-followup.md`',
    'dated 08:48Z addenda in `seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md`',
    'dated 09:10Z addendum in `seam-response-rungraph-followup.md`',
    'dated 07:52Z addendum in `seam-response-assembly-followup.md`',
    'dated 07:10Z addendum in `seam-response-effects-followup.md`',
  ]) if (!ownership.includes(anchor)) failures.push(`${OWNERSHIP}: missing dependency anchor ${anchor}`);
  if (failures.length) throw new Error(failures.join('\n'));
  return { ownership: OWNERSHIP, citations: [...citations].sort(), requiredPairs: required.length };
}

const generated = new Set(['generated/capabilities.md', 'generated/coverage.md', 'generated/glossary.md',
  'generated/register.json', 'generated/rules.md', 'generated/source.json']);
const allowedPath = path => path.startsWith('src/harness-adapters/')
  || path === 'scripts/check-p13-contract-map.mjs'
  || path.startsWith('tests/harness-adapters/')
  || /^tests\/(integration|e2e)\/harness-adapters(?:-[^/]*)?\.test\.ts$/.test(path)
  || generated.has(path);

function changedPaths() {
  // NUL-delimited output: Git never quotes or escapes pathnames under -z, so a path with non-ASCII or control
  // characters keeps its real bytes and the scope predicates below see the actual name (an escaped, quoted
  // name would start with `"` and match nothing).
  const nulSplit = out => out.split('\0').filter(Boolean);
  const tracked = nulSplit(execFileSync('git', ['diff', '--name-only', '-z', 'main'], { encoding: 'utf8' }));
  const untracked = nulSplit(execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }));
  return [...new Set([...tracked, ...untracked])].sort();
}

function existsOnMain(path) {
  try { execFileSync('git', ['cat-file', '-e', `main:${path}`], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

export function checkP13Architecture() {
  const failures = [];
  const changed = changedPaths();
  // The feature-scope arm guards THIS part's slice. On a branch that touches no Part Thirteen path (another
  // part's slice re-synced onto main), every changed file is by definition outside Part Thirteen's scope, so the
  // arm has nothing to judge; the structural checks below still run unconditionally.
  const p13SliceChanged = changed.some(path => path.startsWith('src/harness-adapters/')
    || path.startsWith('tests/harness-adapters/')
    || /^tests\/(integration|e2e)\/harness-adapters(?:-[^/]*)?\.test\.ts$/.test(path));
  if (p13SliceChanged) for (const path of changed) {
    if (!allowedPath(path)) failures.push(`out-of-scope path: ${path}`);
    if (!generated.has(path) && existsOnMain(path)) failures.push(`pre-existing main file changed: ${path}`);
  }
  for (const path of ['src/harness-adapters/holder.ts', 'src/harness-adapters/adapter.ts',
    'src/harness-adapters/regression-boundaries.ts', 'scripts/slice-p13-state-storage.mjs'])
    if (existsSync(path)) failures.push(`Slice A2 file remains: ${path}`);
  const sourceFiles = readdirSync('src/harness-adapters').filter(name => name.endsWith('.ts'));
  const source = sourceFiles.map(name => readFileSync(`src/harness-adapters/${name}`, 'utf8')).join('\n');
  for (const symbol of ['createRuntimeHandleHolder', 'restoreRuntimeHandleHolder', 'createHarnessEvidenceHolder',
    'sameMachineReconnectCandidate', 'createMemoryHarnessAdapterStateStore', 'correlatedRecoveryProgress',
    'preventiveCompactionDisposition', 'RuntimeHandleHolder', 'HarnessEvidenceHolder'])
    if (source.includes(symbol)) failures.push(`Slice A2 symbol remains: ${symbol}`);
  if (source.includes("owner: 'part-two'")) failures.push('local substitute Part Two custody provider remains');
  const imports = [...source.matchAll(/from ['"](\.\.\/[^'"]+)['"]/g)].map(match => match[1]);
  for (const specifier of imports) if (!specifier.endsWith('/index.js') && specifier !== '../index.js')
    failures.push(`private owner import: ${specifier}`);
  const checker = readFileSync('scripts/check-p13-contract-map.mjs', 'utf8');
  const invented = ['part-thirteen', 'seam-response', 'intake.md'].join('-');
  if (checker.includes(invented)) failures.push('invented intake seam grant remains');
  try { checkP13DependencyCitations(); }
  catch (error) { failures.push(error instanceof Error ? error.message : 'dependency citation validation failed'); }
  if (failures.length) throw new Error(failures.join('\n'));
  return { changed, sourceFiles };
}

export function checkP13Coverage(report, dispositions = p13Dispositions()) {
  if (!report.success) throw new Error('P13 mapping requires a successful actual test run');
  const results = report.testResults.flatMap(file => file.assertionResults.map(test => ({
    file: relative(process.cwd(), file.name), title: test.fullName, status: test.status,
  })));
  const rows = dispositions.map(row => {
    const tests = results.filter(test => (test.title.match(/\bP13-NF-\d+\b/g) ?? []).includes(row.id));
    const passing = tests.filter(test => test.status === 'passed');
    const skipped = tests.filter(test => ['pending', 'skipped'].includes(test.status));
    if (row.status === 'EXECUTABLE') {
      const title = proofTitles.get(row.number);
      if (!title || !results.some(test => test.title === title && test.status === 'passed'))
        throw new Error(`${row.id}: exact executable proof did not pass`);
      if (row.heldArms && !skipped.some(test => test.title.includes(row.heldArms)))
        throw new Error(`${row.id}: missing ${row.heldArms} skipped arm`);
    } else {
      if (passing.length) throw new Error(`${row.id}: held row has a stand-in passing test`);
      if (!skipped.some(test => test.title.includes(row.status)))
        throw new Error(`${row.id}: missing exact skipped disposition ${row.status}`);
    }
    return { ...row, tests, passing: passing.length, skipped: skipped.length };
  });
  for (const marker of ['A1-RECORDS', 'A1-INTEGRATION', 'A1-E2E'])
    if (!results.some(test => test.status === 'passed' && test.title.includes(marker)))
      throw new Error(`three-tier A1 proof missing: ${marker}`);
  if (!results.some(test => test.status === 'passed' && test.title.includes('P13-ADDITIVITY R5-F10')))
    throw new Error('permanent main-vs-HEAD scope/additivity proof missing');
  return rows;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkP13Architecture();
  const rows = checkP13Coverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log('| Check | Status | Test files |');
  console.log('|---|---|---|');
  for (const row of rows) console.log(`| ${row.id} | ${row.heldArms ? `${row.status}; ${row.heldArms}` : row.status} | ${[...new Set(row.tests.map(test => test.file))].join('; ') || '—'} |`);
  console.log(`${rows.length} P13 checks mapped: ${rows.filter(row => row.status === 'EXECUTABLE').length} with executable arms, ${rows.filter(row => row.heldArms).length} partial rows, ${rows.filter(row => row.status !== 'EXECUTABLE').length} wholly held rows.`);
}
