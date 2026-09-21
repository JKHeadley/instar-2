// Part Thirteen contract map. The landed A1 audit view remains available for its
// byte-stable fixtures; direct invocation validates the authoritative A2 view.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const A2 = 'NON-EXECUTABLE-UNTIL-slice-A2';
const OUTPUT_CUSTODY = 'NON-EXECUTABLE-UNTIL-design-17-harness-adapters-seam-request-part-two-capture-read.md';
const CROSS_MACHINE = 'NON-EXECUTABLE-UNTIL-design-harness-adapters-seam-request-cross-machine-ownership.md';
const OWNERSHIP = 'docs/17-harness-adapters/01-ownership-and-boundaries.md';
const CTX_GROUND = 'dated 06:33Z addendum in seam-response-rungraph-followup.md, SEAM-LEDGER.md row 38';
const CTX_CURRENT = 'dated 08:48Z addenda in seam-response-assembly-followup.md + seam-response-rungraph-followup.md, SEAM-LEDGER.md row 45';
const HISTORY_COVERAGE = 'dated 09:10Z addendum in seam-response-rungraph-followup.md, SEAM-LEDGER.md row 52';
const ROUTE_CONFORMANCE = 'dated 07:52Z addendum in seam-response-assembly-followup.md, SEAM-LEDGER.md row 42';
const PROMPT = 'dated 07:10Z addenda in seam-response-effects-followup.md + seam-response-assembly-followup.md, SEAM-LEDGER.md row 41';
const LIVE_PREREQUISITES = `LIVE-PREREQUISITES defined by ${OWNERSHIP}`;
const HARNESS_EFFECT_IMPLEMENTATION = 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md';
const executable = new Map([
  [1, 'All four owned record forms and every runtime-event variant use closed total decoders, canonical comparison, migration, and deep freezing.'],
  [2, 'The root design and all indexed section files pass the governed-document checker.'],
  [5, 'A1 admission binds an exact launch subject to a current-generation Part Ten observation.'],
  [15, 'Malformed or substituted operation/process identities refuse through typed receipts.'],
  [24, 'The landed Part Four recovery port exposes EACCES/EIO custody reads as typed uncertainty while preserving its durable receipt.'],
  [25, 'The A1 observation-admission arm rejects otherwise valid evidence from an obsolete register generation.'],
  [29, 'The A1 observation-admission arm requires current owner generation; liveness classification remains in Slice A2.'],
  [30, 'Only closed structured events decode; diagnostic text is never interpreted as state.'],
  [31, 'A1 progress identity deduplicates an already presented owner subject plus output range and digest without claiming production owner admission.'],
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

const a2Executable = new Map([...executable, ...new Map([
  [4, 'The base describe arm re-resolves current Ten conformance for the exact advisory-mode tuple without executing a driver.'],
  [28, 'Missing, stale, or unreadable local handle custody refuses blind fallback.'],
  [32, 'Fresh correlated lifecycle evidence distinguishes pending work from complete closure.'],
  [35, 'The landed Six one-episode shared breaker opens, enforces cooldown, and reaches half-open.'],
  [37, 'The landed Six one-episode shared breaker stops at its owner-defined cooldown and half-open bounds.'],
  [38, 'Same-machine reconnect consumes the exact local handle, current Six fence, fresh liveness, and owner-validated resume posture.'],
  [47, 'The landed Six one-episode breaker is wired through its public authority; remaining production wiring stays held.'],
  [51, 'Resume compatibility and poison diagnostics grant nothing until current Part Nine posture validates the exact purpose, scope, and subject.'],
  [52, 'Preventive compaction is explicitly unsupported and exposes no pre-limit action.'],
])]);

const a2External = new Map([
  [3, HARNESS_EFFECT_IMPLEMENTATION],
  [8, HARNESS_EFFECT_IMPLEMENTATION],
]);

const a2Held = new Map([
  [21, `NON-EXECUTABLE-UNTIL-${CTX_CURRENT}`],
  [4, 'NON-EXECUTABLE-UNTIL-seam-response-assembly-followup.md'],
  [25, CROSS_MACHINE],
  [31, `${OUTPUT_CUSTODY} + NON-EXECUTABLE-UNTIL-${CTX_GROUND} + NON-EXECUTABLE-UNTIL-${CTX_CURRENT}`],
  [34, OUTPUT_CUSTODY],
  [35, `NON-EXECUTABLE-UNTIL-${PROMPT} + seam-response-loop-followup.md`],
  [37, 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md'],
  [38, 'NON-EXECUTABLE-UNTIL-seam-response-loop-followup.md + seam-response-effects-payloads.md + seam-response-effects-followup.md + design-harness-adapters-seam-request-cross-machine-ownership.md'],
  [39, 'NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md + seam-response-loop-followup.md'],
  [46, `NON-EXECUTABLE-UNTIL-${PROMPT} + seam-response-effects-payloads.md + seam-response-effects-followup.md + NON-EXECUTABLE-UNTIL-${CTX_GROUND} + NON-EXECUTABLE-UNTIL-${CTX_CURRENT}`],
  [47, `NON-EXECUTABLE-UNTIL-${CTX_GROUND} + ${CTX_CURRENT} + ${HISTORY_COVERAGE} + ${ROUTE_CONFORMANCE} + seam-response-judgment.md + seam-response-assembly-followup.md + seam-response-effects-payloads.md + seam-response-effects-followup.md + seam-response-run-closure.md + seam-response-rungraph-followup.md + seam-response-loop-followup.md + ${PROMPT} + part-eleven-seam-response-assembly.md`],
  [51, `NON-EXECUTABLE-UNTIL-${CTX_GROUND} + ${CTX_CURRENT} + seam-response-loop-followup.md + seam-response-effects-payloads.md + seam-response-effects-followup.md`],
  [52, 'NON-EXECUTABLE-UNTIL-seam-response-effects-payloads.md + seam-response-effects-followup.md'],
]);

const a2ProofTitles = new Map([
  ...proofTitles,
  [4, 'A2-INTEGRATION R2-F09 P13-NF-04 base describe re-resolves real Ten conformance and refuses its expired neighbour without driver execution'],
  [21, ''],
  [24, 'A2-UNIT REVIEW-F1 REVIEW-F2 P13-NF-24 P13-NF-32 later pending input defeats an older closure across concurrent holder views'],
  [25, 'A2-INTEGRATION P13-NF-28 P13-NF-38 same-machine reconnect consumes real Six fence, exact liveness, and Part Nine resume'],
  [28, 'A2-UNIT P13-NF-24 P13-NF-28 journal read errors remain typed unknown and never become absence'],
  [29, 'A2-UNIT REVIEW-F3 P13-NF-29 P13-NF-33 newest probe failure is unknown and exit is evidence, never a Run mutation'],
  [31, 'A2-UNIT R6-F04 P13-NF-31 local comparison and duplicate classification execute without crediting production Six admission or grounding'],
  [32, 'A2-UNIT REVIEW-F1 P13-NF-32 a disputed later pending input cannot restore completion'],
  [33, 'A2-UNIT REVIEW-F3 P13-NF-29 P13-NF-33 newest probe failure is unknown and exit is evidence, never a Run mutation'],
  [34, 'A2-UNIT REVIEW-F8 P13-NF-31 P13-NF-34 output stays held on the named Part Two read seam and compaction exposes no action'],
  [35, 'A2-INTEGRATION R2-F09 P13-NF-35 P13-NF-37 P13-NF-47 landed Six one-episode breaker opens, refuses cooldown, and reaches half-open'],
  [37, 'A2-INTEGRATION R2-F09 P13-NF-35 P13-NF-37 P13-NF-47 landed Six one-episode breaker opens, refuses cooldown, and reaches half-open'],
  [38, 'A2-INTEGRATION P13-NF-28 P13-NF-38 same-machine reconnect consumes real Six fence, exact liveness, and Part Nine resume'],
  [39, 'A2-UNIT P13-NF-28 P13-NF-39 durable holders reread current custody and keep attempts total'],
  [46, 'A2-INTEGRATION R4-F04 P13-NF-46 real Four custody, Six cooldown, and preventive-compaction boundaries; local work comparison does not claim production admission'],
  [47, 'A2-INTEGRATION R2-F09 P13-NF-35 P13-NF-37 P13-NF-47 landed Six one-episode breaker opens, refuses cooldown, and reaches half-open'],
  [51, 'A2-INTEGRATION R2-F02 R2-F10 P13-NF-51 literal diagnostics grant nothing; only exact-purpose current Part Nine posture owns resume'],
  [52, 'A2-UNIT REVIEW-F8 P13-NF-31 P13-NF-34 output stays held on the named Part Two read seam and compaction exposes no action'],
]);

/** Slice A2's authoritative map. p13Dispositions remains the landed A1 audit view for byte-stable A1 fixtures. */
export function p13A2Dispositions(design = readFileSync('docs/17-harness-adapters/12-negative-contract-fixtures.md', 'utf8')) {
  const base = p13Dispositions(design);
  return base.map(row => {
    if (a2Executable.has(row.number)) {
      const { heldArms: _a1Hold, ...current } = row;
      return { ...current, status: 'EXECUTABLE', reason: a2Executable.get(row.number),
      ...(a2Held.has(row.number) ? { heldArms: a2Held.get(row.number) } : {}) };
    }
    if (row.number === 21) return { ...row, status: a2Held.get(21),
      reason: 'The design requires the named current immutable context-delivery grants; no local owner substitute is counted.' };
    if (a2External.has(row.number)) return { ...row, status: a2External.get(row.number),
      reason: 'The real Eight harness-effect implementation is not landed; a local driver object is not owner execution.' };
    return row;
  });
}

/** Resolve held-arm citations against the governing ownership table and its exact paired grants. */
export function checkP13DependencyCitations(rows = p13A2Dispositions()) {
  const ownership = readFileSync(OWNERSHIP, 'utf8');
  const failures = [];
  const citations = new Set();
  const exactByRow = new Map();
  for (const view of [p13Dispositions(), p13A2Dispositions()]) for (const row of view) {
    const choices = exactByRow.get(row.number) ?? new Set();
    choices.add(`${row.status}\0${row.heldArms ?? ''}`);
    exactByRow.set(row.number, choices);
  }
  for (const row of rows) {
    const exact = `${row.status}\0${row.heldArms ?? ''}`;
    if (!exactByRow.get(row.number)?.has(exact)) {
      failures.push(`${row.id}: status or heldArms is not an exact executable disposition or existing grant/SEAM-LEDGER citation`);
    }
    const disposition = `${row.status} ${row.heldArms ?? ''}`;
    for (const path of disposition.match(/docs\/[A-Za-z0-9_./-]+\.md/g) ?? []) {
      citations.add(path);
      if (!existsSync(path)) failures.push(`${row.id}: missing dependency document ${path}`);
    }
    const files = disposition.match(/(?:design-[A-Za-z0-9-]+|(?:part-eleven-)?seam-response-[A-Za-z0-9-]+|SEAM-LEDGER)\.md/g) ?? [];
    for (const file of files) {
      if (file === OWNERSHIP.split('/').at(-1)) continue;
      citations.add(file);
      const grantedOutsideDesign = file === OUTPUT_CUSTODY.slice('NON-EXECUTABLE-UNTIL-'.length);
      if (!grantedOutsideDesign && !ownership.includes(`\`${file}\``))
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
    const row = rows.find(row => row.number === number);
    const disposition = `${row?.status ?? ''} ${row?.heldArms ?? ''}`;
    if (!disposition.includes(dependency)) failures.push(`P13-NF-${String(number).padStart(2, '0')}: missing ${dependency}`);
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
  || path === 'scripts/slice-p13-state-storage.mjs'
  || path.startsWith('tests/harness-adapters/')
  || /^tests\/(integration|e2e)\/harness-adapters(?:-[^/]*)?\.test\.ts$/.test(path)
  || generated.has(path);

export const p13A2PathAllowed = path => allowedPath(path);

function changedPaths() {
  // NUL-delimited output: Git never quotes or escapes pathnames under -z, so a path with non-ASCII or control
  // characters keeps its real bytes and the scope predicates below see the actual name (an escaped, quoted
  // name would start with `"` and match nothing).
  const nulSplit = out => out.split('\0').filter(Boolean);
  // --no-renames: a rename OUT of Part Thirteen must surface its deleted source path (rename detection would report
  // only the foreign destination and let the diff look as if it touched no Part Thirteen path).
  const tracked = nulSplit(execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', 'main'], { encoding: 'utf8' }));
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
  // Only the exact reviewed additivity amendments are outside this part's slice.
  const grantedAdditivityHashes = new Map([
    ['tests/harness-adapters/a2-governance-and-additivity.test.ts', '0bc17595e419a9fec702b641c67a1d0a82a6076d0feb481757a69eeda2579415'],
    ['tests/harness-adapters/a2-round6-regression.test.ts', 'cf563858558e979b3f9019fdbbd821583d16429848b991a6586efa8221f886c5'],
    ['tests/integration/harness-adapters-round7-regression.test.ts', 'c35559278c2f5a2a396de6d815834fc3f4e6542b8d54eefa63222a2c43ea2b02'],
  ]);
  const { createHash } = process.getBuiltinModule('node:crypto');
  const p13SliceChanged = changed.some(path => !(grantedAdditivityHashes.has(path)
    && existsSync(path) && createHash('sha256').update(readFileSync(path)).digest('hex') === grantedAdditivityHashes.get(path))
    && (path.startsWith('src/harness-adapters/')
    || path.startsWith('tests/harness-adapters/')
    || /^tests\/(integration|e2e)\/harness-adapters(?:-[^/]*)?\.test\.ts$/.test(path)));
  if (p13SliceChanged) for (const path of changed) {
    if (!allowedPath(path)) failures.push(`out-of-scope path: ${path}`);
    if (!generated.has(path) && existsOnMain(path)
      && path !== 'src/harness-adapters/index.ts' && path !== 'scripts/check-p13-contract-map.mjs')
      failures.push(`pre-existing main file changed: ${path}`);
  }
  const sourceFiles = readdirSync('src/harness-adapters').filter(name => name.endsWith('.ts'));
  const source = sourceFiles.map(name => readFileSync(`src/harness-adapters/${name}`, 'utf8')).join('\n');
  if (source.includes("owner: 'part-two'")) failures.push('local substitute Part Two custody provider remains');
  const imports = [...source.matchAll(/from ['"](\.\.\/[^'"]+)['"]/g)].map(match => match[1]);
  for (const specifier of imports) if (!specifier.endsWith('/index.js') && specifier !== '../index.js')
    failures.push(`private owner import: ${specifier}`);
  const checker = readFileSync('scripts/check-p13-contract-map.mjs', 'utf8');
  const invented = ['part-thirteen', 'seam-response', 'intake.md'].join('-');
  if (checker.includes(invented)) failures.push('invented intake seam grant remains');
  try { checkP13DependencyCitations(p13Dispositions()); }
  catch (error) { failures.push(error instanceof Error ? error.message : 'dependency citation validation failed'); }
  if (failures.length) throw new Error(failures.join('\n'));
  return { changed: p13SliceChanged ? changed.filter(path => path !== 'scripts/slice-p13-state-storage.mjs') : [],
    sourceFiles: ['admission.ts', 'contracts.ts', 'index.ts', 'records.ts'] };
}

export function checkP13A2Architecture() {
  checkP13Architecture();
  checkP13DependencyCitations(p13A2Dispositions());
  const changed = changedPaths();
  const sourceFiles = readdirSync('src/harness-adapters').filter(name => name.endsWith('.ts')).sort();
  for (const required of ['adapter.ts', 'holder.ts', 'regression-boundaries.ts'])
    if (!sourceFiles.includes(required)) throw new Error(`Slice A2 source missing: ${required}`);
  if (!existsSync('scripts/slice-p13-state-storage.mjs')) throw new Error('Slice A2 durable state host missing');
  const stateHost = readFileSync('scripts/slice-p13-state-storage.mjs', 'utf8');
  for (const ownerFactory of ['createFactStore(', 'createTransportFileStorage(']) {
    if (!stateHost.includes(ownerFactory)) throw new Error(`Slice A2 state host bypasses ${ownerFactory}`);
  }
  for (const handRolled of ['symlinkSync', 'readlinkSync', 'recoverDeadWriter', 'randomUUID']) {
    if (stateHost.includes(handRolled)) throw new Error(`Slice A2 state host retains hand-rolled recovery: ${handRolled}`);
  }
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

export function checkP13A2Coverage(report, dispositions = p13A2Dispositions()) {
  if (!report.success) throw new Error('P13 A2 mapping requires a successful actual test run');
  const results = report.testResults.flatMap(file => file.assertionResults.map(test => ({
    file: relative(process.cwd(), file.name), title: test.fullName, status: test.status,
  })));
  const rows = dispositions.map(row => {
    const tests = results.filter(test => (test.title.match(/\bP13-NF-\d+\b/g) ?? []).includes(row.id));
    const passing = tests.filter(test => test.status === 'passed');
    const skipped = tests.filter(test => ['pending', 'skipped'].includes(test.status));
    if (row.status === 'EXECUTABLE') {
      const title = a2ProofTitles.get(row.number);
      if (!title || !results.some(test => test.title === title && test.status === 'passed'))
        throw new Error(`${row.id}: exact A2 executable proof did not pass`);
      if (row.heldArms && !skipped.some(test => test.title.includes(row.heldArms)))
        throw new Error(`${row.id}: missing ${row.heldArms} skipped arm`);
    } else {
      if (passing.length && !a2Executable.has(row.number)) throw new Error(`${row.id}: held row has a stand-in passing test`);
      if (!skipped.some(test => test.title.includes(row.status)))
        throw new Error(`${row.id}: missing exact skipped disposition ${row.status}`);
    }
    return { ...row, tests, passing: passing.length, skipped: skipped.length };
  });
  for (const marker of ['A2-UNIT', 'A2-INTEGRATION', 'A2-E2E'])
    if (!results.some(test => test.status === 'passed' && test.title.includes(marker)))
      throw new Error(`three-tier A2 proof missing: ${marker}`);
  if (!results.some(test => test.status === 'passed' && test.title.includes('P13-A2-ADDITIVITY')))
    throw new Error('permanent A2 main-vs-HEAD owner-fixture proof missing');
  return rows;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkP13A2Architecture();
  const rows = checkP13A2Coverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log('| Check | Status | Test files |');
  console.log('|---|---|---|');
  for (const row of rows) console.log(`| ${row.id} | ${row.heldArms ? `${row.status}; ${row.heldArms}` : row.status} | ${[...new Set(row.tests.map(test => test.file))].join('; ') || '—'} |`);
  console.log(`${rows.length} P13 checks mapped: ${rows.filter(row => row.status === 'EXECUTABLE').length} with executable arms, ${rows.filter(row => row.heldArms).length} partial rows, ${rows.filter(row => row.status !== 'EXECUTABLE').length} wholly held rows.`);
}
