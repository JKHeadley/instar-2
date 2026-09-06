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
  ['13', 'partial', 'Uncertain run/request/message cannot get new attempt; eight reply settlements never enable automatic retry.'],
  ['14', 'partial', 'Read-only observation never settles; actual eight consumer and explicit nine assessor fixture apply exact evidence accounting, not production verification.'],
  ['15', 'partial', 'Durable recovery wake before reservation; five-owned escalation evidence integration pending.'],
  ['16', 'partial', 'Static timer/dynamic import/foreign-type scan in owned core; no whole-fleet library audit.'],
  ['17', 'partial', 'Finite/zero/duration/min-delay/closed admission with measured call-count controls; breaker only explicit closed stub.'],
  ['18', 'partial', 'Durable attempt and active reservations, no overlap or episode reset; half-open breaker outside slice.'],
  ['19', 'partial', 'One finite budget with retained uncertainty, original-demand accounting custody, cumulative unused-credit release and below-budget cap inhibition; nested and independent minimal-plane capacity outside slice.'],
  ['20', 'partial', 'Durable level wake, competing scheduler refusal, restart resume; one domain.'],
  ['21', 'partial', 'Stopped is not closed and capacity never creates business Outcome.'],
  ['22', 'out-of-scope', 'Historical full Threadline source audit is not live Telegram slice proof.'],
  ['23', 'out-of-scope', 'Full authenticated Threadline wire adapter explicitly excluded.'],
  ['24', 'out-of-scope', 'Threadline discovery, peer identity and bridges explicitly excluded.'],
  ['25', 'partial', 'Five semantic identity carried unchanged and effect attempt dedup; signed peer replay cache excluded.'],
  ['26', 'out-of-scope', 'Multi-route/schema migration and Threadline adapter excluded.'],
  ['27', 'partial', 'Eight doorway refusal propagated without a six-created delivery success; worker receipt protocol excluded.'],
  ['28', 'out-of-scope', 'Authenticated peer deadline protocol excluded.'],
  ['29', 'out-of-scope', 'Distributed child-result collection and relay TTL excluded.'],
  ['30', 'partial', 'Verified prefix before recovery and stable episode; five fresh grounding is its separate owner seam.'],
  ['31', 'out-of-scope', 'Independent minimal-plane quarantine and unrelated domains excluded.'],
  ['32', 'out-of-scope', 'Quorum and independent repair capacity excluded.'],
  ['33', 'out-of-scope', 'Fleet fairness and incremental scans not implemented; the slice has a finite replay ceiling, not fleet-scale proof.'],
  ['34', 'partial', 'Fresh-process handoff and stale owner refusal; no multi-machine quorum claim.'],
  ['35', 'partial', 'Actual P2 and pinned repaired eight producer/custody composition with approved references and compiler/runtime controls; production nine/P10 assembly pending.'],
  ['36', 'partial', 'Three test tiers and real process kills; feature dark, no live Telegram, supervisor or production probes.'],
  ['37', 'partial', 'Every design check has explicit disposition; declarations carry no invented held rule edges.'],
  ['38', 'partial', 'Claim/consume/send kills and bounded observation; no whole-session watchdog or all stall classes.'],
  ['39', 'partial', 'Injective mapping, one-use claim and actual eight public settlement accounting including duplicate/change and lost-ACK restart; seven provider and production nine verification remain pending.'],
  ['40', 'partial', 'Same-operation read-only recovery and distinct delivery attempt; no peer deadline or collection protocol.'],
].map(([number, status, reason]) => ({ id: `P6-NF-${number}`, status, reason }));

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

export function inspectTransportCore(sources) {
  const issues = [];
  const foreign = new Set(['Run', 'Step', 'AgentTransportEnvelope', 'DeliveryEvidence', 'EffectRequest', 'EffectSettlement', 'OperationObservation', 'EffectObservation', 'OperationDefinition', 'Outcome', 'Result']);
  for (const [path, source] of Object.entries(sources)) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(n) {
      if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isClassDeclaration(n)) && foreign.has(n.name?.text)) issues.push(`${path}: foreign-owned ${n.name.text}`);
      if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword
        || ts.isIdentifier(n.expression) && ['setTimeout', 'setInterval', 'fetch', 'eval', 'require'].includes(n.expression.text))) issues.push(`${path}: operational side effect/dynamic import outside host`);
      if (!path.endsWith('/telegram.ts') && ts.isStringLiteral(n) && /api\.telegram\.org|sendMessage|threadline/i.test(n.text)) issues.push(`${path}: protocol branch outside adapter`);
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  return issues;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sources = Object.fromEntries(readdirSync('src/transport').filter(p => p.endsWith('.ts')).map(p => [`src/transport/${p}`, readFileSync(`src/transport/${p}`, 'utf8')]));
  const issues = inspectTransportCore(sources); if (issues.length) throw new Error(issues.join('\n'));
  const rows = checkTransportCoverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  for (const row of rows) console.log(`${row.id}: ${row.status}; ${row.tests.length} executed tests; ${row.reason}`);
}
