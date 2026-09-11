// Part Thirteen's map is deliberately binary. A check is either backed by an
// actual passing test on this HEAD or held at the exact owner seam named by the
// approved design. A passing advisory/negative neighbor cannot satisfy a held
// governed positive.
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const executable = new Map([
  [1, 'Owner inventory, closed local decoders, canonical identity, immutability, and public-owner construction are exercised.'],
  [2, 'The complete approved design and section set pass the governed-document checker.'],
  [3, 'The four-method Ten port delegates only to the landed public Eight driver and returns Ten-decoded observations.'],
  [5, 'Exact adapter artifact, platform, durable launch, incarnation, and process identity are enforced.'],
  [6, 'The landed tuple advertises advisory mode only and exposes no governed or interruption fallback.'],
  [8, 'Claude Code and Codex use one adapter factory; the future-runtime constructor uses the same port and suite.'],
  [15, 'Retained process identity and fresh incarnation reject reuse and sibling substitution.'],
  [25, 'Same-machine reconnect candidacy requires Six fence subject, exact handle, fresh liveness, and resume evidence; cross-machine remains unsupported.'],
  [28, 'Missing runtime custody refuses blind fallback and no invocation occurs.'],
  [29, 'Only fresh exact-incarnation structured events prove live; timeout and absence are unknown.'],
  [30, 'Closed structured events drive the local view; prompt/pane appearance has no schema authority.'],
  [31, 'Heartbeats and event-id churn do not progress; a current real Part Five transition and exact resolved output range progress once.'],
  [32, 'Completion requires correlated closure with stream, children, and unresolved operations closed.'],
  [33, 'Exit status remains evidence and never constructs Five\'s RunExit.'],
  [34, 'Real Part Two pinned and unpinned captures survive age; only an admitted unprotected tombstone removes bytes.'],
  [39, 'A retained attempted launch returns uncertainty and directs observation without invoking again.'],
  [51, 'Pane classifications are undecodable; confirmed structured poison makes resume ineligible.'],
]);

// These rows have a landed, runnable negative/structural arm and separately
// named positive arms that remain held. A passing local arm never clears the
// owner seam recorded here.
const partial = new Map([
  [3, 'seam-response-effects-payloads.md + seam-response-effects-followup.md'],
  [4, 'seam-response-assembly-followup.md'],
  [5, 'seam-response-assembly-followup.md + seam-response-effects-followup.md'],
  [6, 'seam-response-effects-payloads.md + seam-response-effects-followup.md'],
  [8, 'seam-response-assembly-followup.md + seam-response-effects-followup.md'],
  [15, 'seam-response-assembly-followup.md + seam-response-effects-followup.md'],
  [28, 'seam-response-loop-followup.md + seam-response-effects-payloads.md + seam-response-effects-followup.md + dated 06:33Z addendum in seam-response-rungraph-followup.md + SEAM-LEDGER.md row 38 + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45'],
  [37, 'seam-response-loop-breaker.md + seam-response-loop-followup.md'],
  [39, 'seam-response-effects-followup.md + seam-response-loop-followup.md'],
  [46, 'dated 07:10Z addenda in seam-response-effects-followup.md and seam-response-assembly-followup.md + SEAM-LEDGER.md row 41'],
  [51, 'seam-response-loop-followup.md + seam-response-effects-payloads.md + seam-response-effects-followup.md + dated 06:33Z addendum in seam-response-rungraph-followup.md + SEAM-LEDGER.md row 38 + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45'],
  [52, 'seam-response-effects-payloads.md + seam-response-effects-followup.md'],
]);

const held = new Map([
  [4, 'seam-response-assembly-followup.md'],
  [7, 'seam-response-judgment.md + dated 07:52Z addendum in seam-response-assembly-followup.md + SEAM-LEDGER.md row 42'],
  [9, 'seam-response-assembly-followup.md'],
  [10, 'seam-response-judgment.md + seam-response-assembly-followup.md'],
  [11, 'seam-response-judgment.md + seam-response-assembly-followup.md'],
  [12, 'seam-response-judgment.md + seam-response-assembly-followup.md'],
  [13, 'seam-response-assembly-followup.md'],
  [14, 'seam-response-effects-payloads.md + seam-response-effects-followup.md + dated 06:33Z addendum in seam-response-rungraph-followup.md + SEAM-LEDGER.md row 38 + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45'],
  [16, 'dated 06:33Z addendum in seam-response-rungraph-followup.md + SEAM-LEDGER.md row 38 + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45 + seam-response-judgment.md + seam-response-effects-followup.md'],
  [17, 'dated 06:33Z addendum in seam-response-rungraph-followup.md + SEAM-LEDGER.md row 38 + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45'],
  [18, 'dated 06:33Z addendum in seam-response-rungraph-followup.md + SEAM-LEDGER.md row 38 + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45'],
  [19, 'seam-response-effects-payloads.md + seam-response-effects-followup.md + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45'],
  [20, 'seam-response-effects-payloads.md + seam-response-effects-followup.md + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45'],
  [21, 'dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45'],
  [22, 'dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45'],
  [23, 'dated 06:33Z addendum in seam-response-rungraph-followup.md + SEAM-LEDGER.md row 38 + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45 + seam-response-judgment.md + seam-response-effects-followup.md'],
  [24, 'part-thirteen-seam-response-intake.md'],
  [26, 'seam-response-rungraph-followup.md + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md + SEAM-LEDGER.md row 45'],
  [27, 'seam-response-run-closure.md + seam-response-rungraph-followup.md'],
  [35, 'dated 07:10Z addenda in seam-response-effects-followup.md and seam-response-assembly-followup.md + SEAM-LEDGER.md row 41 + seam-response-loop-breaker.md + seam-response-loop-followup.md'],
  [36, 'seam-response-effects-payloads.md + seam-response-effects-followup.md'],
  [37, 'seam-response-loop-breaker.md + seam-response-loop-followup.md'],
  [38, 'seam-response-loop-followup.md + seam-response-effects-payloads.md + seam-response-effects-followup.md + design-harness-adapters-seam-request-cross-machine-ownership.md'],
  [40, 'seam-response-judgment.md + seam-response-assembly-followup.md + seam-response-effects-payloads.md + seam-response-effects-followup.md'],
  [41, 'seam-response-rungraph-followup.md'],
  [42, 'part-eleven-seam-response-assembly.md'],
  [43, 'LIVE-PREREQUISITES: dated 06:33Z addendum in seam-response-rungraph-followup.md row 38 + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md row 45 + dated 09:10Z addendum in seam-response-rungraph-followup.md row 52 + seam-response-judgment.md + seam-response-assembly-followup.md + seam-response-effects-payloads.md + seam-response-effects-followup.md + seam-response-run-closure.md + seam-response-loop-breaker.md + seam-response-loop-followup.md + part-eleven-seam-response-assembly.md'],
  [44, 'LIVE-PREREQUISITES: dated 06:33Z addendum in seam-response-rungraph-followup.md row 38 + dated 08:48Z addenda in seam-response-assembly-followup.md and seam-response-rungraph-followup.md row 45 + dated 09:10Z addendum in seam-response-rungraph-followup.md row 52 + seam-response-judgment.md + seam-response-assembly-followup.md + seam-response-effects-payloads.md + seam-response-effects-followup.md + seam-response-run-closure.md + seam-response-loop-breaker.md + seam-response-loop-followup.md + part-eleven-seam-response-assembly.md'],
  [45, 'dated 07:52Z addendum in seam-response-assembly-followup.md + SEAM-LEDGER.md row 42 + seam-response-judgment.md + seam-response-assembly-followup.md'],
  [46, 'dated 07:10Z addenda in seam-response-effects-followup.md and seam-response-assembly-followup.md + SEAM-LEDGER.md row 41'],
  [47, 'dated 07:52Z addendum in seam-response-assembly-followup.md row 42 + dated 06:33Z addendum in seam-response-rungraph-followup.md row 38 + seam-response-judgment.md + seam-response-effects-followup.md + dated 07:10Z addenda in seam-response-effects-followup.md and seam-response-assembly-followup.md row 41 + seam-response-loop-breaker.md + seam-response-loop-followup.md + part-eleven-seam-response-assembly.md'],
  [48, 'seam-response-judgment.md + dated 07:52Z addendum in seam-response-assembly-followup.md + SEAM-LEDGER.md row 42'],
  [49, 'dated 09:10Z addendum in seam-response-rungraph-followup.md + SEAM-LEDGER.md row 52'],
  [50, 'dated 09:10Z addendum in seam-response-rungraph-followup.md + SEAM-LEDGER.md row 52'],
  [52, 'seam-response-effects-payloads.md + seam-response-effects-followup.md'],
]);

const binding = (file, title) => Object.freeze({ file, title });
const sharedBoundary = platform => `${platform} shared harness contract P13-NF-03 P13-NF-05 P13-NF-06 P13-NF-08 LOCAL-BOUNDARY-ARM exposes one advisory four-method port without claiming an Eight effect`;
const structuredEvidence = 'P13-NF-29 P13-NF-30 P13-NF-31 P13-NF-32 P13-NF-33 P13-NF-34 structured evidence keeps liveness, progress, output, and completion distinct under finite bounds';
const preventive = 'round-3 independent conformance regressions R3-F8 P13-NF-46 P13-NF-52 every preventive-compaction signal tuple remains explicitly unsupported';

// Every executable row is pinned to the exact semantic assertion(s) that
// establish its runnable local arms. Merely putting a row id in another passing
// title cannot satisfy this table.
const executableEvidence = new Map([
  [1, [binding('tests/harness-adapters/records-and-holders.test.ts', 'P13-NF-01 records are closed, total, migrated before comparison, canonical, and immutable')]],
  [2, [binding('tests/harness-adapters/governance-and-additivity.test.ts', 'P13-NF-02 the complete Part Thirteen design passes the governed-document checker')]],
  [3, [binding('tests/integration/harness-adapters.test.ts', sharedBoundary('claude-code')), binding('tests/integration/harness-adapters.test.ts', sharedBoundary('codex'))]],
  [4, [binding('tests/integration/harness-adapters-round2.test.ts', 'round-2 signed-history adapter regressions REVIEW-F2 P13-NF-04 EXECUTABLE-LOCAL-ARM re-resolves current conformance before describe and launch')]],
  [5, [binding('tests/integration/harness-adapters.test.ts', sharedBoundary('claude-code')), binding('tests/integration/harness-adapters.test.ts', sharedBoundary('codex'))]],
  [6, [binding('tests/integration/harness-adapters.test.ts', sharedBoundary('claude-code')), binding('tests/integration/harness-adapters.test.ts', sharedBoundary('codex'))]],
  [8, [binding('tests/integration/harness-adapters.test.ts', sharedBoundary('claude-code')), binding('tests/integration/harness-adapters.test.ts', sharedBoundary('codex')), binding('tests/integration/harness-adapters.test.ts', 'P13-BOUNDARY-TUPLE adapter families share semantics without borrowing another tuple result')]],
  [15, [binding('tests/harness-adapters/round4-regressions.test.ts', 'round-4 independent data-validation regressions R4-F3 P13-NF-15 P13-NF-25 P13-NF-29 refuses absent and mismatched signed launch subjects')]],
  [25, [binding('tests/harness-adapters/round4-regressions.test.ts', 'round-4 independent data-validation regressions R4-F1 P13-NF-25 P13-NF-29 binds both event clocks and uses the signed source lifetime'), binding('tests/harness-adapters/round4-regressions.test.ts', 'round-4 independent data-validation regressions R4-F3 P13-NF-15 P13-NF-25 P13-NF-29 refuses absent and mismatched signed launch subjects')]],
  [28, [binding('tests/e2e/harness-adapters.test.ts', 'P13-NF-25 P13-NF-28 local handle snapshot restart refuses blind fallback without claiming Eight retry behavior')]],
  [29, [binding('tests/harness-adapters/round4-regressions.test.ts', 'round-4 independent data-validation regressions R4-F1 P13-NF-25 P13-NF-29 binds both event clocks and uses the signed source lifetime'), binding('tests/harness-adapters/round4-regressions.test.ts', 'round-4 independent data-validation regressions R4-F3 P13-NF-15 P13-NF-25 P13-NF-29 refuses absent and mismatched signed launch subjects')]],
  [30, [binding('tests/harness-adapters/records-and-holders.test.ts', structuredEvidence)]],
  [31, [binding('tests/harness-adapters/round4-regressions.test.ts', 'round-4 independent data-validation regressions R4-F4 P13-NF-31 P13-NF-34 hashes current Part Two capture bytes before crediting progress'), binding('tests/integration/harness-adapters-round3.test.ts', 'R3-F1 R4-F5 P13-NF-31 real Part Five work state and exact reported step are required for each progress transition')]],
  [32, [binding('tests/harness-adapters/round4-regressions.test.ts', 'round-4 independent data-validation regressions R4-F2 P13-NF-32 P13-NF-34 retains pending when later closure or captured output becomes unavailable'), binding('tests/harness-adapters/records-and-holders.test.ts', structuredEvidence)]],
  [33, [binding('tests/harness-adapters/records-and-holders.test.ts', structuredEvidence)]],
  [34, [binding('tests/harness-adapters/round4-regressions.test.ts', 'round-4 independent data-validation regressions R4-F2 P13-NF-32 P13-NF-34 retains pending when later closure or captured output becomes unavailable'), binding('tests/harness-adapters/round4-regressions.test.ts', 'round-4 independent data-validation regressions R4-F4 P13-NF-31 P13-NF-34 hashes current Part Two capture bytes before crediting progress'), binding('tests/integration/harness-adapters-round3.test.ts', 'R3-F8 P13-NF-34 real Part Two captures survive age; only an admitted tombstone may remove unpinned bytes')]],
  [37, [binding('tests/integration/harness-adapters-round2.test.ts', 'round-2 signed-history adapter regressions REVIEW-F8 P13-NF-37 EXECUTABLE-BOUNDED-OBSERVATION-ARM uses real Six to stop at the bound without invoking an observer')]],
  [39, [binding('tests/integration/harness-adapters-round2.test.ts', 'round-2 signed-history adapter regressions REVIEW-F9 P13-NF-39 executes Eight and Six same-request closure without granting retry')]],
  [46, [
    binding('tests/harness-adapters/legacy-1x-traces.test.ts', 'R4-F9 exact runnable legacy boundaries from design section 10 P13-NF-46 legacy PendingInjectStore EACCES enumeration failure silently collapses to empty'),
    binding('tests/harness-adapters/legacy-1x-traces.test.ts', 'R4-F9 exact runnable legacy boundaries from design section 10 P13-NF-46 legacy PendingInjectStore EIO enumeration failure silently collapses to empty'),
    binding('tests/harness-adapters/legacy-1x-traces.test.ts', 'R4-F9 exact runnable legacy boundaries from design section 10 P13-NF-46 legacy newest-rollout oracle falsely credits unrelated worker B to stalled A'),
    binding('tests/harness-adapters/legacy-1x-traces.test.ts', 'R4-F9 exact runnable legacy boundaries from design section 10 P13-NF-46 legacy synchronous has-session timeout reports dead while its conditional async neighbor is indeterminate'),
    ...['absent', 'disabled', 'unreadable'].map(mode => binding('tests/harness-adapters/legacy-1x-traces.test.ts', `R4-F9 exact runnable legacy boundaries from design section 10 P13-NF-46 legacy ${mode} work gate permits busy refresh`)),
    binding('tests/harness-adapters/legacy-1x-traces.test.ts', 'R4-F9 exact runnable legacy boundaries from design section 10 P13-NF-46 legacy dry-run work gate logs a would-refusal but still proceeds'),
    binding('tests/harness-adapters/round4-regressions.test.ts', 'round-4 independent data-validation regressions R4-F7 P13-NF-46 keeps raw growth diagnostic until current owner-resolved work proves recovery'),
    binding('tests/harness-adapters/round3-regressions.test.ts', preventive),
  ]],
  [51, [binding('tests/harness-adapters/records-and-holders.test.ts', 'P13-NF-51 pane classifications grant nothing and confirmed structured poison forbids resume')]],
  [52, [binding('tests/harness-adapters/round3-regressions.test.ts', preventive)]],
]);

export function p13Dispositions(design = readFileSync('docs/17-harness-adapters/12-negative-contract-fixtures.md', 'utf8')) {
  const ids = [...design.matchAll(/^\| (P13-NF-(\d+)) \|/gm)].map(match => ({ id: match[1], number: Number(match[2]) }));
  if (ids.length !== 52 || new Set(ids.map(row => row.number)).size !== 52)
    throw new Error(`expected exactly 52 unique P13-NF design rows, received ${ids.length}`);
  return ids.map(row => {
    if (partial.has(row.number)) return { ...row, status: 'EXECUTABLE',
      reason: executable.get(row.number) ?? 'The landed negative/structural arm executes without supplying the held owner behavior.',
      heldArms: `NON-EXECUTABLE-UNTIL-${partial.get(row.number)}` };
    if (executable.has(row.number)) return { ...row, status: 'EXECUTABLE', reason: executable.get(row.number) };
    const dependency = held.get(row.number);
    if (!dependency) throw new Error(`${row.id}: no executable test or exact owner seam disposition`);
    return { ...row, status: `NON-EXECUTABLE-UNTIL-${dependency}`, reason: 'The named owner contract is not landed on this HEAD; only boundary/negative neighbors may execute.' };
  });
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
    if (tests.some(test => !['passed', 'pending', 'skipped'].includes(test.status)))
      throw new Error(`${row.id}: mapped test is not passing or explicitly skipped`);
    if (row.status === 'EXECUTABLE') {
      if (!passing.length) throw new Error(`${row.id}: EXECUTABLE has no passing real test`);
      const required = executableEvidence.get(row.number);
      if (!required?.length) throw new Error(`${row.id}: EXECUTABLE has no exact evidence binding`);
      for (const expected of required) {
        const actual = results.find(test => test.file === expected.file && test.title === expected.title);
        if (!actual || actual.status !== 'passed')
          throw new Error(`${row.id}: exact evidence did not pass: ${expected.file} :: ${expected.title}`);
      }
      if (row.heldArms && !skipped.some(test => test.title.includes(row.heldArms)))
        throw new Error(`${row.id}: executable local arm lacks an exact skipped fixture for ${row.heldArms}`);
    } else {
      if (passing.length) throw new Error(`${row.id}: a stand-in pass attempts to satisfy ${row.status}`);
      if (!skipped.some(test => test.title.includes(row.status)))
        throw new Error(`${row.id}: held check lacks an exact skipped fixture for ${row.status}`);
    }
    return { ...row, tests, passing: passing.length, skipped: skipped.length };
  });
  for (const exact of [
    binding('tests/harness-adapters/records-and-holders.test.ts', 'P13-NF-01 records are closed, total, migrated before comparison, canonical, and immutable'),
    binding('tests/integration/harness-adapters.test.ts', sharedBoundary('claude-code')),
    binding('tests/e2e/harness-adapters.test.ts', 'P13-NF-25 P13-NF-28 local handle snapshot restart refuses blind fallback without claiming Eight retry behavior'),
  ]) if (!results.some(test => test.file === exact.file && test.title === exact.title && test.status === 'passed'))
    throw new Error(`three-tier requirement missing exact passing assertion ${exact.file} :: ${exact.title}`);
  if (!results.some(test => test.title.includes('P13-ADDITIVITY') && test.status === 'passed'))
    throw new Error('permanent main-vs-HEAD owner-fixture additivity check did not pass');
  return rows;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = checkP13Coverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log('| Check | Status | Test files |');
  console.log('|---|---|---|');
  for (const row of rows) console.log(`| ${row.id} | ${row.heldArms ? `${row.status}; ${row.heldArms}` : row.status} | ${[...new Set(row.tests.map(test => test.file))].join('; ') || '—'} |`);
  console.log(`${rows.length} P13 checks mapped: ${rows.filter(row => row.status === 'EXECUTABLE').length} with executable arms, ${rows.filter(row => row.heldArms).length} partial rows, ${rows.filter(row => row.status !== 'EXECUTABLE').length} wholly held rows.`);
}
