import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// These are design dispositions, not claims that all forty fleet checks are held.
export const transportDispositions = [
  ['01', 'partial', 'Executed-test mapping and dark-feature honesty; no production check records.'],
  ['02', 'partial', 'Six slice schemas, private claim construction, foreign ownership and static core scan; Threadline records omitted.'],
  ['03', 'partial', 'One-voter conditional predecessor and durable compare-head; quorum safety outside slice.'],
  ['04', 'partial', 'Durable epoch restore; membership changes and quorum tolerance outside slice.'],
  ['05', 'partial', 'Scoped standing/fence and signed issuer checks at origin, replication and replay; production principal channel binding is injected.'],
  ['06', 'partial', 'Signed status-bearing fact rebuild; no fleet checkpoint implementation.'],
  ['07', 'partial', 'Current host policy/stop/generation and preserved refusal; production governed-port activation remains dark.'],
  ['08', 'partial', 'Renew/release dedup, old owner refusal, no run completion.'],
  ['09', 'partial', 'Real claim consumption and fixture eight doorway; production eight integration pending.'],
  ['10', 'partial', 'Monotonic expiry/regression and restored timer refusal; quorum timing outside slice.'],
  ['11', 'partial', 'Four transport SIGKILL cuts plus held/replicated/local-only accounting before ACK; exact original-demand proof after reopen; not every instruction boundary.'],
  ['12', 'partial', 'Local receipt cannot satisfy replicated effect demand; no replica provider shipped here.'],
  ['13', 'partial', 'Uncertain run/request/message cannot get new attempt; a resolved or conditionally closed operation stops blocking only its run, never its own request/message key; eight reply settlements never enable automatic retry.'],
  ['14', 'partial', 'Read-only observation never settles; actual eight consumer and explicit nine assessor fixture apply exact evidence accounting with all six storage/custody waits proven outside the current-assessment guard, not production verification.'],
  ['15', 'partial', 'Durable recovery wake before reservation; five-owned escalation evidence integration pending.'],
  ['16', 'partial', 'Static timer/dynamic import/foreign-type scan in owned core; no whole-fleet library audit.'],
  ['17', 'partial', 'Legacy stub behavior plus finite additive A1 breaker values; budgets remain outside A1.'],
  ['18', 'partial', 'One durable breaker episode opens, cools down, admits bounded half-open trials, reopens and closes with evidence.'],
  ['19', 'partial', 'One finite budget with retained uncertainty, original-demand accounting custody requiring live owner qualification, cumulative unused-credit release, conditional close of a never-dispatched prepared operation on absent-claim proof, and below-budget cap inhibition; nested and independent minimal-plane capacity outside slice.'],
  ['20', 'partial', 'Legacy durable level wake plus fresh-process A1 breaker reconstruction; one domain.'],
  ['21', 'partial', 'Stopped, open, half-open and closed remain distinct and never create a business Outcome.'],
  ['22', 'out-of-scope', 'Historical full Threadline source audit is not live Telegram slice proof.'],
  ['23', 'out-of-scope', 'Full authenticated Threadline wire adapter explicitly excluded.'],
  ['24', 'out-of-scope', 'Threadline discovery, peer identity and bridges explicitly excluded.'],
  ['25', 'partial', 'Five semantic identity carried unchanged and effect attempt dedup; signed peer replay cache excluded.'],
  ['26', 'out-of-scope', 'Multi-route/schema migration and Threadline adapter excluded.'],
  ['27', 'partial', 'Eight doorway refusal propagated without a six-created delivery success; worker receipt protocol excluded.'],
  ['28', 'out-of-scope', 'Authenticated peer deadline protocol excluded.'],
  ['29', 'out-of-scope', 'Distributed child-result collection and relay TTL excluded.'],
  ['30', 'partial', 'Verified prefix before recovery and exactly one A1 episode; five fresh grounding is its separate owner seam.'],
  ['31', 'out-of-scope', 'Independent minimal-plane quarantine and unrelated domains excluded.'],
  ['32', 'out-of-scope', 'Quorum and independent repair capacity excluded.'],
  ['33', 'partial', 'Generic ordered due selection has finite item/duration bounds, durable cursor restart, idempotent replay and absence refusal; production fleet scheduling and bounded P2 replay remain outside this slice.'],
  ['34', 'partial', 'Fresh-process A1 state reconstruction and stale owner refusal; no multi-machine quorum claim.'],
  ['35', 'partial', 'Actual P2 and pinned main eight producer/custody composition consumed twice per settlement with approved references and compiler/runtime controls; production nine/P10 assembly pending.'],
  ['36', 'partial', 'A1 has unit, real-P2 integration and fresh-process E2E evidence; feature remains dark.'],
  ['37', 'partial', 'Every design check has explicit disposition and required A1 evidence; declarations carry no invented held rule edges.'],
  ['38', 'partial', 'Claim/consume/send kills and bounded observation; no whole-session watchdog or all stall classes.'],
  ['39', 'partial', 'Injective mapping, one-use claim, terminal conditional close and actual eight public settlement accounting including duplicate/change, expiry-during-accounting and lost-ACK restart; seven provider and production nine verification remain pending.'],
  ['40', 'partial', 'Same-operation read-only recovery and distinct delivery attempt; no peer deadline or collection protocol.'],
].map(([number, status, reason]) => ({ id: `P6-NF-${number}`, status, reason }));

// Slice A1 acceptance is a closed executable contract. Missing, renamed,
// skipped, or tier-moved evidence must fail this map.
export const transportSeamEvidence = [
  ['SLB-A1-POLICY-84', 'unit', 'finite A1 policy and typed exclusions'],
  ['SLB-A1-CURSOR-85', 'unit', 'no new cursor or loop-record decoder'],
  ['SLB-A1-CYCLE-86', 'integration', 'one full breaker cycle'],
  ['SLB-A1-REFUSALS-87', 'integration', 'second episode and excluded transition refusals'],
  ['SLB-A1-GENERATION-88', 'integration', 'checked generation is recorded and replay-validated'],
  ['SLB-A1-OPAQUE-VECTOR-89', 'integration', 'opaque vector carriage without advancement'],
  ['SLB-A1-RESTART-90', 'integration', 'durable Part Two reconstruction'],
  ['SLB-A1-E2E-91', 'e2e', 'fresh-process reconstruction'],
  ['SLB-A1-MAP-92', 'unit', 'zero-test and per-fixture coverage refusal'],
  ['SLB-LEGACY-ALL-KINDS-93', 'unit', 'generated 1313-case legacy mutation differential over every legacy field plus V34'],
  ['SLB-LEGACY-V2-94', 'unit', 'legacy breaker marker remains a byte-identical main refusal'],
  ['SLB-A1-PARENT-95', 'integration', 'second pressure and conflicting parent policy refusal'],
  ['SLB-A1-EXCLUSIONS-96', 'integration', 'all excluded A2 budget and cursor fields are refused'],
  ['SLB-A1-OPAQUE-SHAPE-97', 'integration', 'opaque vector reference accepted and coordinates refused'],
  ['SLB-A1-LATER-CYCLE-98', 'integration', 'later same-episode cycle requires fresh closure evidence'],
  ['SLB-A1-FRONTIER-99', 'integration', 'locale-independent equal-clock ordering and reverse replay'],
  ['SLB-LEGACY-BYTES-100', 'unit', 'all main-owned transport sources and tests are byte-identical'],
  ['SLB-A1-CUTS-101', 'e2e', 'every A1 transition cut reconstructs in a fresh process'],
  ['SLB-A1-MAXOPEN-102', 'integration', 'maximum-open deadline survives reopen and stops at equality'],
  ['SLB-A1-SIGNED-EXCLUSIONS-103', 'integration', 'typed refusal for excluded fields on signed new records'],
  ['SLB-A1-SHARED-PRESSURE-104', 'integration', 'two workers on two machines exercise one stable pressure identity'],
  ['SLB-A1-PLAN-SUBJECT-105', 'integration', 'signed restoration plan is bound to the governed pressure subject'],
  ['SLB-A1-EXCLUDED-INVENTORY-106', 'integration', 'every excluded field typed-refuses on requests and signed replay'],
  ['SLB-A1-HISTORICAL-TIME-107', 'integration', 'historical restoration validity is judged at its witnessed transition'],
  ['SLB-A1-SHARED-HISTORY-108', 'integration', 'one durable history contains both signed machine contributors across recovery'],
  ['SLB-A1-RESTORATION-TRANSITION-109', 'integration', 'V18 and V27 transition-time restoration with forged-time and expired replay controls'],
  ['SLB-A1-EXCLUSION-PRESENCE-110', 'integration', 'every top-level and nested excluded field presence typed-refuses before value interpretation'],
  ['SLB-LEGACY-TEXT-RANGES-111', 'unit', 'empty, exact-limit, over-limit, non-ASCII and whitespace values for every legacy text field'],
  ['SLB-A1-LOST-ACK-IDEMPOTENCY-112', 'integration', 'exact evidence-close and stopped submissions return their original durable results'],
  ['SLB-A1-PARTIAL-RETENTION-113', 'integration', 'honestly partial evidence remains referenced without closure promotion'],
  ['SLB-A1-REPAIR17-E2E-114', 'e2e', 'fresh processes repeat mixed-evidence close and stopped commands without another transition'],
  ['SLB-A1-SUBMISSION-SHAPE-115', 'unit', 'optional signed submission evidence preserves old records and refuses inconsistency'],
  ['SLB-A1-LATE-RESTORATION-116', 'integration', 'V11 and V12 late evidence uses its signed introducing transition across restart cuts'],
  ['SLB-A1-PARTIAL-ONLY-117', 'integration', 'V17 partial-only evidence is retained without closure across restart cuts'],
  ['SLB-A1-REPAIR18-E2E-118', 'e2e', 'fresh processes replay late closure and partial-only retention exactly'],
  ['SLB-A1-EVIDENCE-SUBMISSION-119', 'unit', 'signed partial-evidence successor is closed and replay-validated'],
  ['SLB-A1-COMPLETE-REPLAY-120', 'unit', 'V15 complete evidence retention is recomputed during signed replay'],
  ['SLB-A1-COMPLETE-RETENTION-121', 'integration', 'V15 complete evidence survives durable restart cuts until trials finish'],
  ['SLB-A1-EXPIRED-RETRY-122', 'integration', 'V17 and V24 exact durable close retries survive expiry and lost acknowledgment'],
  ['SLB-A1-REPAIR19-E2E-123', 'e2e', 'fresh processes replay V15 complete retention and V17 expired close retry'],
  ['SLB-A1-ORDINARY-REPLAY-124', 'integration', 'V18 ordinary outcome replay survives evidence expiry and both append cuts'],
  ['SLB-A1-CURRENT-PROOF-125', 'integration', 'V20 and V34 use only current closure candidates while retaining outcomes'],
  ['SLB-A1-CLOSED-REFERENCES-126', 'integration', 'V24 and V24b refuse undeclared fields in all new request references'],
  ['SLB-A1-CURRENT-PROOF-REPLAY-127', 'unit', 'signed replay derives the same current closure candidates as live append'],
  ['SLB-A1-ORDINARY-REPLAY-E2E-128', 'e2e', 'V31 fresh process returns the durable ordinary close after expiry'],
  ['SLB-A1-FACT-REFERENCE-CONTINUITY-129', 'integration', 'V20 fact-addressed restoration remains valid for a later half-open trial'],
  ['SLB-A1-REPEATED-REFERENCE-SHAPE-130', 'integration', 'V21 malformed repeated restoration references refuse before retry deduplication'],
  ['SLB-A1-FACT-REFERENCE-CONFLICT-131', 'integration', 'V23 physical fact references expose every conflicting logical assessment'],
  ['SLB-A1-COMMAND-SHAPE-132', 'integration', 'empty, wrong-type and oversized command identifiers refuse before repeated-request lookup; valid neighbors remain accepted'],
  ['SLB-A1-EQUIVALENT-WITNESSES-133', 'integration', 'identical policy and assessment copies preserve signed witnesses; conflicting values still refuse'],
  ['SLB-A1-SUPPORT-WITNESSES-134', 'integration', 'identical Run, plan, request and Evidence copies preserve signed support and later admission'],
  ['SLB-A1-COPY-INVARIANCE-135', 'integration', 'every signed A1 record kind collapses identical copies across all operations and refuses a mutated copy'],
  ['SLB-A1-DUPLICATE-VALIDATION-136', 'integration', 'V2/V25 invalid signed transitions validate before copy collapse while valid duplicates retain one history'],
  ['SLB-A1-EXACT-BINDING-137', 'integration', 'V3 exact missing, wrong-kind and wrong-subject pressure witnesses refuse without substitution or append'],
  ['SLB-A1-EQUIVALENT-BINDING-138', 'integration', 'V30 equivalent current binding selection preserves the exact recorded valid witness'],
  ['SLB-A1-DUPLICATE-RESTART-139', 'e2e', 'V29 fresh-process durable replay refuses duplicated invalid transitions and retains the valid neighbor'],
  ['SLB-A1-EQUIVALENT-SCHEDULE-140', 'integration', 'V13 exact schedule replay collapses canonically equivalent current binding re-encodings; missing references still refuse'],
  ['SLB-A1-CLOSED-PRESSURE-141', 'integration', 'V14, V15 and V26 malformed pressure scopes refuse before governed normalization and never append'],
  ['SLB-A1-COMMAND-RESULT-142', 'integration', 'V16, V17, V25 and V27 preserve original command results and refuse cross-operation command reuse'],
  ['SLB-A1-DEPENDENCY-SET-143', 'integration', 'V29 signed dependency sets collapse across every permutation while changed content still conflicts'],
  ['SLB-A1-COMMAND-RESTART-144', 'e2e', 'V25 fresh-process replay returns original schedule and admission results without appending'],
  ['SLB-A1-OUTCOME-COMMAND-145', 'integration', 'V2 returns the original outcome after later work; both V3 rows refuse schedule/admission command reuse; exact and unused equivalent neighbors pass'],
  ['SLB-A1-OUTCOME-COMMAND-RESTART-146', 'e2e', 'V21 fresh-process replay returns the original outcome and refuses schedule/admission command reuse'],
].map(([id, tier, cases]) => ({ id, tier, cases }));

export function checkTransportCoverage(report, dispositions = transportDispositions) {
  if (!report.success) throw new Error('transport mapping requires a successful actual test run');
  if (dispositions.length !== 40 || new Set(dispositions.map(r => r.id)).size !== 40) throw new Error('missing/duplicate design disposition');
  return dispositions.map(row => {
    if (!['partial', 'out-of-scope'].includes(row.status) || !row.reason) throw new Error('unsupported or unexplained held claim');
    const tests = report.testResults.flatMap(file => file.assertionResults
      .filter(test => (test.fullName.match(/\bP6-NF-\d+\b/g) ?? []).includes(row.id))
      .map(test => ({ file: file.name, title: test.fullName, status: test.status })));
    if (row.status === 'partial' && (!tests.length || tests.some(t => t.status !== 'passed'))) throw new Error(`no executed passing fixture: ${row.id}`);
    return { ...row, tests };
  });
}

export function checkTransportSeamEvidence(report, seamEvidence = transportSeamEvidence) {
  if (!report.success) throw new Error('transport seam mapping requires a successful actual test run');
  const tierPath = { unit: '/tests/transport/', integration: '/tests/integration/', e2e: '/tests/e2e/' };
  for (const required of seamEvidence) {
    const tests = report.testResults.flatMap(file => file.assertionResults
      .filter(test => (test.fullName.match(/\bSLB-[A-Z0-9-]+-\d+\b/g) ?? []).includes(required.id))
      .map(test => ({ file: file.name.replaceAll('\\', '/'), status: test.status })));
    if (!tests.length || tests.some(test => test.status !== 'passed')
      || !tests.some(test => test.file.includes(tierPath[required.tier])))
      throw new Error(`missing seam evidence: ${required.id} (${required.tier}; ${required.cases})`);
  }
  return seamEvidence;
}

export function inspectTransportCore(sources) {
  const issues = [];
  const foreign = new Set(['Run', 'Step', 'AgentTransportEnvelope', 'DeliveryEvidence', 'EffectRequest', 'EffectSettlement', 'OperationObservation', 'EffectObservation', 'OperationDefinition', 'Outcome', 'Result']);
  for (const [path, source] of Object.entries(sources)) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(n) {
      if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isClassDeclaration(n)) && foreign.has(n.name?.text)) issues.push(`${path}: foreign-owned ${n.name.text}`);
      if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword
        || ts.isIdentifier(n.expression) && ['setTimeout', 'setInterval', 'fetch', 'eval', 'require'].includes(n.expression.text))) issues.push(`${path}: operational side effect/dynamic import outside host`);
      // Reference adapters (design 10 §6) may name their own protocol; export wiring of an adapter
      // module is not a branch. Every other transport-core file stays protocol-free.
      const adapter = path.endsWith('/telegram.ts') || path.endsWith('/threadline.ts');
      const specifier = ts.isStringLiteral(n) && (ts.isImportDeclaration(n.parent) || ts.isExportDeclaration(n.parent));
      if (!adapter && !specifier && ts.isStringLiteral(n) && /api\.telegram\.org|sendMessage|threadline/i.test(n.text)) issues.push(`${path}: protocol branch outside adapter`);
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  return issues;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sources = Object.fromEntries(readdirSync('src/transport', { recursive: true })
    .filter(p => typeof p === 'string' && p.endsWith('.ts'))
    .map(p => [`src/transport/${p}`, readFileSync(`src/transport/${p}`, 'utf8')]));
  const issues = inspectTransportCore(sources); if (issues.length) throw new Error(issues.join('\n'));
  const report = JSON.parse(readFileSync('.test-results.json', 'utf8'));
  const rows = checkTransportCoverage(report);
  checkTransportSeamEvidence(report);
  for (const row of rows) console.log(`${row.id}: ${row.status}; ${row.tests.length} executed tests; ${row.reason}`);
}
