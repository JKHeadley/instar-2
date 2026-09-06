import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const partial = {
  1: 'Three slice-owned records and honest executed-test mapping; five other P7 types are outside the one-question slice.',
  2: 'P2 registered closed/versioned owner decoders and private construction; only version one is shipped.',
  3: 'Static core import/invocation scan; fake client only, no whole-fleet or dynamic-plugin coverage.',
  4: 'Current generation/host route checks; trusted reference seed is NOT an anchored P3 point loader.',
  5: 'Actual P1 ActionFloor enforced; only one finite informational consumer contract.',
  7: 'P1 Decision reason/conclusion and bounded evidence references; no semantic grading.',
  8: 'Provider cannot create approval or wider floor; real intake classification/effects remain four/eight.',
  9: 'One guarded provider callback per consumed six claim; negative retrying/no-op/delayed SDK tests. Production eight executor isolation remains pending.',
  10: 'Immutable actual input/admitted-response/usage captures; invalid output retains bounded limitation evidence. Provider internals unavailable; no benchmark manifest.',
  11: 'Real six reservation/claim and current-fence use; five actual-start grounding is not implemented here.',
  12: 'Real six liability retained and unreserved calls refused; production disclosure admission remains eight/ten.',
  14: 'Real process kills after consumed handoff and provider; no receipt means no answer or repeated invocation; no provider lookup/settlement.',
  15: 'Real process kills after response/resolution and inside capture locking; receipt-only recovery makes zero calls. Five acceptance remains separate.',
  16: 'Late response remains recorded after stop/expiry; no usable answer. Full run terminal semantics remain five.',
  17: 'One question/attempt, immutable owner identities, concurrent duplicate refusal and terminal exclusion; no distributed multi-question projection.',
  19: 'Stop/expiry refuse use while retaining observed answer; no directive completion or owned intake wait closure.',
  22: 'Durable pre-spend receipt capacity against competing writers, exact/minus-one bounds and real append faults; no independent production repair plane.',
  25: 'Generation/floor/standing checked at use; classification and actual business effect revalidation remain four/eight.',
  28: 'Valid provider tokens/charge survive over-cap or invalid output with explicit limitations; unknown stays null. No normalized hold metrics or settlement ledger.',
  30: 'Known rejection and uncertainty never permit hidden SDK retry; six alone retains reservation, no settlement/release implemented.',
  31: 'Finite input/output/capture storage and one invocation per question; no production latency/queue/token pricing measurements.',
  34: 'Local capture reread and constructor survive dead/ambiguous writer locks; no remote full-case reconstruction.',
  39: 'Stop/lost lease prevent answer use; observer-only local recording does not accept into five.',
  41: 'Real compiled reference assembly, durable files and deterministic fake provider. Explicit LIVE-PROVIDER test remains skipped, no activation claim.',
  43: 'Content-addressed local-only capture port rejects remote/path references; host OS administrator isolation remains ten.',
  45: 'No deletion or routine retention timer; missing evidence refuses use. Lawful tombstones/assessment pins/retention reconciliation outside slice.',
  52: 'Four doorway and two capture-lock SIGKILL cuts, live-writer/reaper races and duplicate/stop cases; multi-machine replication and five/eight integration not claimed.',
};
const out = {
  6: 'Per-consumer defaults and measured routing beyond the single informational request are excluded.',
  13: 'Pipeline supervision recursion/activation belongs to the later assembled slice.',
  18: 'No default selection Result implemented; failed model decoding stays Refused.',
  20: 'Provider switching and per-consumer communication defaults excluded; one fake provider.',
  21: 'Fallback/new-provider disclosure excluded; unresolved first attempt cannot be retried.',
  23: 'AskRefinement explicitly excluded by build brief.', 24: 'AskRefinement/intake classification explicitly excluded by brief.',
  26: 'Intake hold lifecycle is not part of the one-question build slice.',
  27: 'JudgmentHoldCost and cohort/queue measurements not in one captured provider meter.',
  29: 'Hold-duration aggregation and cross-machine clock measurements excluded.',
  32: 'BenchmarkRecord/scenario populations explicitly excluded by brief.',
  33: 'Full disposable benchmark/route/hold projections excluded; only direct signed-fact inspection shipped.',
  35: 'Affected-claims grading projections excluded; P2 current taint remains inherited.',
  36: 'Part-nine grading/report correlation excluded by brief.', 37: 'Reason semantic re-derivation/assessment excluded by brief.',
  38: 'External attestation conformance and independent proof grading excluded; local provider evidence explicitly observation only.',
  40: 'No runtime activation declaration: gate/catalog, bounds/evidence, production owners must be assembled first.',
  42: 'Nine/eleven independent external monitor is not implemented here.',
  44: 'Benchmark replay disclosure excluded by brief.', 46: 'BenchmarkScenario explicitly excluded.',
  47: 'Compatibility digests/replay suites explicitly excluded.', 48: 'BenchmarkRunRecord explicitly excluded.',
  49: 'Measured route evaluation/grade retraction excluded.', 50: 'Live model verification/compatibility support excluded.',
  51: 'Recurrence comparison case collection excluded from the one-question slice.',
  53: 'Changed-configuration benchmark execution/compatibility gates explicitly excluded; runtime remains dark.',
};
export const judgmentDispositions = Array.from({ length: 53 }, (_, i) => ({ id: `P7-NF-${String(i + 1).padStart(2, '0')}`,
  status: partial[i + 1] ? 'partial' : 'out-of-scope', reason: partial[i + 1] ?? out[i + 1] }));
export function checkJudgmentCoverage(report, dispositions = judgmentDispositions) {
  if (!report.success) throw new Error('judgment mapping requires successful actual tests');
  if (dispositions.length !== 53 || new Set(dispositions.map(r => r.id)).size !== 53) throw new Error('missing or duplicate design disposition');
  return dispositions.map(row => {
    if (!row.reason || !['partial', 'out-of-scope'].includes(row.status)) throw new Error('unexplained or invented held claim');
    const tests = report.testResults.flatMap(file => file.assertionResults.filter(t => (t.fullName.match(/\bP7-NF-\d+\b/g) ?? []).includes(row.id))
      .map(t => ({ file: file.name, title: t.fullName, status: t.status })));
    const live = tests.filter(t => t.title.includes('LIVE-PROVIDER slice fixture requires separately authorized real provider, eight executor and activation evidence'));
    const scoped = tests.filter(t => !live.includes(t));
    if (live.some(t => t.status !== 'skipped')) throw new Error('live-provider disposition changed without updating activation scope');
    if (row.status === 'partial' && (!scoped.length || scoped.some(t => t.status !== 'passed'))) throw new Error(`no executed passing slice fixture: ${row.id}`);
    return { ...row, tests: scoped, explicitlySkipped: live };
  });
}
export function inspectJudgmentCore(sources) {
  const issues = [];
  for (const [path, source] of Object.entries(sources)) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(n) {
      if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)
        && !n.moduleSpecifier.text.startsWith('.') && n.moduleSpecifier.text !== 'node:crypto') issues.push(`${path}: provider/core external import`);
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'exchange'
        && !path.endsWith('/judgment/doorway.ts')) issues.push(`${path}: model exchange outside doorway`);
      if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isClassDeclaration(n))
        && path.startsWith('src/judgment/')
        && ['AdmissionReservation', 'FenceToken', 'DispatchClaim', 'Run', 'EffectRequest', 'OperationObservation', 'Result', 'Outcome', 'Decision'].includes(n.name?.text)) issues.push(`${path}: foreign-owned type`);
      ts.forEachChild(n, visit);
    } visit(ast);
  } return issues;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : []);
  const sources = Object.fromEntries(walk('src').map(f => [f, readFileSync(f, 'utf8')]));
  const issues = inspectJudgmentCore(sources); if (issues.length) throw new Error(issues.join('\n'));
  const rows = checkJudgmentCoverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  for (const row of rows) console.log(`${row.id}: ${row.status}; ${row.tests.length} executed slice fixtures; ${row.reason}`);
}
