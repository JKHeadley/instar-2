// Every P11-NF identifier in docs/15 resolves to an EXECUTED check or an explicit,
// bounded scope statement. This lane builds section 7's vertical-slice fixture only;
// sections 2, 3, 5 and the measured genesis-replay bound are not built here, and this
// map says so by name instead of implying coverage.
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const executed = {
  24: 'The minimal plane is enumerated: six projection definitions, each declaring every admitted fact kind as consumed or ignored.',
  25: 'Each fold reads the spine only; kinds whose identity lives under an owner record are ignored with that exact reason and the horizon stays visible.',
  26: 'No minimal-plane projection is authority-answering, and every one rebuilds from facts alone.',
  41: 'The four/five grounding seam, six\'s one-operation-per-run rule in BOTH directions, six\'s settlement application and conditional close, and the absent model-operation resolution seam are exercised through their public ports and their exact refusals are recorded.',
  43: 'The slice runs through the reference assembly\'s public boot path with real persistence, intake, run, lease, judgment and effect ports; part ten\'s production assembly is NOT claimed.',
  44: 'The deterministic kill schedule cuts after every enumerated durable boundary of every declared profile, enumerates every adjacent pair, and records which cut actually fired; the recovery-only conditional-close boundary is reached by the schedule rather than cut.',
  45: 'Within-execution genesis, checkpoint and fresh-process rebuild equality at one pinned vector, plus the across-execution semantic predicate; real history is never normalized.',
  46: 'One bounded judgment through the registered doorway with complete capture and meter references, inside its recorded floor.',
  47: 'Delivery is proved only to the adapter\'s declared stage; a decisive and an opaque adapter are exercised as required neighbours.',
  48: 'No open ownerless obligation; uncertain and blocked obligations stay owned and pending with maximum exposure retained; every six-owned operation is resolved by six or named by an obligation, and only a conditionally closed operation releases credit without a settlement. Every rebuild reproduces that state.',
  49: 'Every required port is real and delegates: the assessment port refuses without independent evidence and the capture port really preserves bytes.',
  50: 'Complete recorded accounting: measured duration and a cross-boot high-water RSS, plus facts, bytes, boots, attempts, notifications, tokens and money, all inside DECLARED finite bounds (declared, never presented as measured targets).',
  53: 'Every SUPPORTED capability of every declared adapter names one specific test, and this checker refuses unless that exact test PASSED in the actual run.',
};
const scoped = {
  51: 'Declared skip: a live model provider, live platform credentials and an independent live delivery witness are not built on this base.',
  52: 'Declared skip: the objective dashboard and mobile-completion floor belongs to the operator surface, which this lane does not build.',
};
const outOfScope = {
  1: 'Section 1 ownership/duty inventories are a build-stage lint over the whole part; this lane builds section 7 only.',
  2: 'Governed-document lint over docs/15 is the existing check-governed-docs workflow, unchanged by this lane.',
  3: 'No new core, approval or binding schema is introduced here; the architecture lint already covers src.',
  4: 'Registered authority-completing surfaces belong to section 2, which this lane does not build.',
  5: 'Operator authoring/phone flow belongs to section 2.', 6: 'Untrusted-region rendering belongs to section 2.',
  7: 'Explicit-yes gestures belong to section 2.', 8: 'Subject binding of an approval belongs to section 2.',
  9: 'Challenge freshness belongs to section 2.', 10: 'Broker receipts belong to section 2 and part nine.',
  11: 'Broker atomicity belongs to section 2 and part nine.', 12: 'Verifier isolation belongs to part ten.',
  13: 'Broker outage posture belongs to section 2 and part nine.', 14: 'Authorization queue drain belongs to section 2.',
  15: 'Approval-flood coalescing belongs to section 2.', 16: 'First-sender pairing belongs to section 3.',
  17: 'Pairing act verification belongs to section 3.', 18: 'Binding subject rendering belongs to section 3.',
  19: 'Identity churn re-verification belongs to section 3.', 20: 'Concurrent rebinding conflict belongs to section 3.',
  21: 'Transfer/widen/revoke acts belong to section 3.', 22: 'Brake reachability during a binding conflict belongs to section 3.',
  23: 'Blast-radius privacy belongs to section 3.',
  27: 'A measured genesis-replay bound needs a declared deployment matrix and release corpus; this lane records no number rather than inventing one.',
  28: 'Checkpoint-versus-genesis equality IS executed here per projection, but the release-gate form of the check needs the measured corpus of P11-NF-27.',
  29: 'Cold/warm deployment matrix belongs with P11-NF-27.', 30: 'Failed-sample admission accounting belongs with P11-NF-27.',
  31: 'Replay memory/time budget belongs with P11-NF-27.', 32: 'Scoped projection-failure recovery belongs to section 4\'s live posture.',
  33: 'Live minimal-responder reachability belongs to section 5.', 34: 'Limited-responder authority belongs to section 5.',
  35: 'Reachability reserve under saturation belongs to section 5.', 36: 'Dependency-split outage posture belongs to section 5.',
  37: 'Response-bound measurement belongs to section 5.', 38: 'Eligible-message bound and owned recovery belong to section 5.',
  39: 'Unknown-identity preservation belongs to section 5.',
  40: 'The seam inventory row completeness is a build-stage lint over the whole part.',
  42: 'Three of the four shared traces are exercised by the slice; the full trace matrix needs section 2 and part nine, so no complete claim is made here.',
};

export function p11Dispositions(design = readFileSync('docs/15-the-operator-surfaces.md', 'utf8')) {
  const ids = [...design.matchAll(/^\| (P11-NF-(\d+)) \|/gm)].map(m => ({ id: m[1], number: Number(m[2]) }));
  if (!ids.length) throw new Error('no P11-NF identifiers found in the design');
  return ids.map(({ id, number }) => {
    const reason = executed[number] ?? scoped[number] ?? outOfScope[number];
    if (!reason) throw new Error(`unexplained design check ${id}`);
    const status = executed[number] ? 'executed' : scoped[number] ? 'declared-skip' : 'out-of-scope';
    return { id, number, status, reason };
  });
}

export function checkP11Coverage(report, dispositions = p11Dispositions()) {
  if (!report.success) throw new Error('P11 mapping requires a successful actual test run');
  return dispositions.map(row => {
    const tests = report.testResults.flatMap(file => file.assertionResults
      .filter(t => (t.fullName.match(/\bP11-NF-\d+\b/g) ?? []).includes(row.id))
      .map(t => ({ file: relative(process.cwd(), file.name), title: t.title, status: t.status })));
    const passing = tests.filter(t => t.status === 'passed');
    const skipped = tests.filter(t => ['pending', 'skipped'].includes(t.status));
    if (tests.length !== passing.length + skipped.length) throw new Error(`${row.id}: a mapped test neither passed nor was explicitly skipped`);
    for (const test of skipped) if (!/out of slice scope:\s*\S.+/.test(test.title))
      throw new Error(`${row.id}: skipped without an explicit slice-scope reason`);
    if (row.status === 'executed' && !passing.length) throw new Error(`${row.id}: declared executed with no passing test`);
    if (row.status === 'declared-skip' && !skipped.length) throw new Error(`${row.id}: declared a skip with no explicitly skipped test`);
    if (row.status === 'out-of-scope' && passing.length) throw new Error(`${row.id}: declared out of scope but a test claims it`);
    return { ...row, tests, passing: passing.length, skipped: skipped.length };
  });
}

/**
 * Each SUPPORTED capability of each declared adapter names one specific executed test
 * as `<file>::<substring of its title>`. Naming a whole file would let a capability
 * inherit execution from unrelated tests, so this binds the capability to the test.
 */
export function checkCapabilityConformance(report, contracts = JSON.parse(readFileSync('scripts/slice-contracts.json', 'utf8'))) {
  const rows = [];
  for (const [adapter, contract] of Object.entries(contracts.adapters)) {
    for (const [name, capability] of Object.entries(contract.capabilities)) {
      if (capability.status !== 'supported') continue;
      const reference = capability.conformance;
      if (typeof reference !== 'string' || !reference.includes('::'))
        throw new Error(`${adapter}.${name}: a supported capability must name '<file>::<test title substring>'`);
      const [file, title] = [reference.slice(0, reference.indexOf('::')), reference.slice(reference.indexOf('::') + 2)];
      if (!title.trim()) throw new Error(`${adapter}.${name}: conformance names no test`);
      const suite = report.testResults.find(f => relative(process.cwd(), f.name) === file);
      if (!suite) throw new Error(`${adapter}.${name}: conformance names a file this run did not execute: ${file}`);
      const passing = suite.assertionResults.filter(t => t.fullName.includes(title) && t.status === 'passed');
      if (!passing.length) throw new Error(`${adapter}.${name}: no PASSING test in ${file} whose title contains '${title}'`);
      rows.push({ adapter, capability: name, file, title, passing: passing.length });
    }
  }
  if (!rows.length) throw new Error('no supported capability declared a conformance fixture');
  return rows;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = checkP11Coverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log('| Check | Status | Executed test files |'); console.log('|---|---|---|');
  for (const row of rows) console.log(`| ${row.id} | ${row.status} | ${[...new Set(row.tests.map(t => t.file))].join('; ') || '—'} |`);
  const conformance = checkCapabilityConformance(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log(`${conformance.length} supported adapter capabilities each bound to a specific PASSING test.`);
  const executedRows = rows.filter(r => r.status === 'executed');
  console.log(`${rows.length} P11 checks mapped; ${executedRows.length} executed by this lane, `
    + `${rows.filter(r => r.status === 'declared-skip').length} declared skips, `
    + `${rows.filter(r => r.status === 'out-of-scope').length} outside this lane's build scope. `
    + 'No held or live claim is emitted for an unbuilt section.');
}
