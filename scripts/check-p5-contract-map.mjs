import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const design = readFileSync('docs/09-the-run-graph.md', 'utf8');
const expected = new Set([...design.matchAll(/^\| (P5-NF-\d+) \|/gm)].map(m => m[1]));
const report = JSON.parse(readFileSync('.test-results.json', 'utf8'));
if (!report.success) throw new Error('test suite failed');

const seamEvidence = new Map([
  ['P5-SEAM-RC-A-F1-DECODERS', 'tests/rungraph/closure.test.ts'],
  ['P5-SEAM-RC-A-F2-OWNER-BOUNDARIES', 'tests/rungraph/closure.test.ts'],
  ['P5-SEAM-RC-A-F2-INTEGRATION', 'tests/integration/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-A-F3-INHIBITIONS-UNIT', 'tests/rungraph/closure.test.ts'],
  ['P5-SEAM-RC-A-F3-UNSETTLED-INTEGRATION', 'tests/integration/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-A-F4-RESTART-CUTS', 'tests/e2e/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-A-F5-LEGACY-BYTES', 'tests/rungraph/legacy-decoder-preservation.test.ts'],
  ['P5-SEAM-RC-A-F6-EQUAL-FRONTIER', 'tests/integration/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-A-F7-CANCELLED-REFUSAL', 'tests/rungraph/closure.test.ts'],
  ['P5-SEAM-RC-F8-CONTINUITY-INTEGRATION', 'tests/integration/rungraph-continuity-conformance.test.ts'],
  ['P5-SEAM-RC-F8-PRESSURE-INTEGRATION', 'tests/integration/rungraph-continuity-conformance.test.ts'],
  ['P5-SEAM-RC-F8-CONTINUITY-E2E', 'tests/e2e/rungraph-continuity-restart.test.ts'],
  ['P5-SEAM-RC-F8-PRESSURE-E2E', 'tests/e2e/rungraph-continuity-restart.test.ts'],
  ['P5-SEAM-RC-R3-REPLICATION', 'tests/integration/rungraph-closure-repair3.test.ts'],
  ['P5-SEAM-RC-R3-E2E-REPLAY', 'tests/e2e/rungraph-closure-repair3.test.ts'],
  ['P5-SEAM-RC-R6-V37-HISTORY-UNIT', 'tests/rungraph/closure-repair6.test.ts'],
  ['P5-SEAM-RC-R6-V38-SEND-INTEGRATION', 'tests/integration/rungraph-closure-repair6.test.ts'],
  ['P5-SEAM-RC-R6-V39-REPLAY-E2E', 'tests/e2e/rungraph-closure-repair6.test.ts'],
  ['P5-SEAM-RC-R6-V40-LEGACY-EXITTEST', 'tests/rungraph/closure-repair6.test.ts'],
  ['P5-SEAM-RC-R6-V41-LEGACY-CHECK', 'tests/rungraph/closure-repair6.test.ts'],
  ['P5-SEAM-RC-R6-V42-LEGACY-EVIDENCE', 'tests/rungraph/closure-repair6.test.ts'],
  ['P5-SEAM-RC-R6-V43-LEGACY-RESULT', 'tests/rungraph/closure-repair6.test.ts'],
  ['P5-SEAM-RC-R6-V44-LEGACY-PRECEDENCE', 'tests/rungraph/closure-repair6.test.ts'],
  ['P5-SEAM-RC-R7-HISTORY-V25', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-F1-V19', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-F1-V21', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-F2-V18', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-F4-V26-EXITTEST', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-F4-V26-CHECK', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-F4-V26-EVIDENCE', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-F4-V26-RESULT', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-F4-V26-SETTLEDOPERATIONS', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-F4-TYPE-PRECEDENCE', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-HISTORY-V45', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-HISTORY-V46-V47', 'tests/rungraph/closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-INTEGRATION-V19', 'tests/integration/rungraph-closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-INTEGRATION-V18', 'tests/integration/rungraph-closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-INTEGRATION-V25', 'tests/integration/rungraph-closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-E2E-V29', 'tests/e2e/rungraph-closure-repair7.test.ts'],
  ['P5-SEAM-RC-R7-E2E-V30', 'tests/e2e/rungraph-closure-repair7.test.ts'],
  ['P5-SEAM-RC-R8-F3-LEGACY-771-BYTES', 'tests/rungraph/legacy-decoder-preservation.test.ts'],
  ['P5-SEAM-RC-R9-F3-ADMISSION-BINDINGS', 'tests/rungraph/closure-registration-additivity.test.ts'],
  ['P5-SEAM-RC-R10-F3-ADDITIVE-REGISTRATION', 'tests/rungraph/closure-registration-additivity.test.ts'],
  ['P5-SEAM-RC-R12-V01', 'tests/rungraph/legacy-decoder-preservation.test.ts'],
  ['P5-SEAM-RC-R12-V02', 'tests/integration/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-R12-V03', 'tests/integration/rungraph-continuity-conformance.test.ts'],
  ['P5-SEAM-RC-R12-V04', 'tests/rungraph/closure.test.ts'],
  ...Array.from({ length: 13 }, (_, index) => [
    `P5-SEAM-RC-R12-V${String(index + 5).padStart(2, '0')}`,
    'tests/rungraph/review11-conformance.test.ts',
  ]),
  ['P5-SEAM-RC-R12-V18', 'tests/e2e/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-R12-V19', 'tests/rungraph/review11-conformance.test.ts'],
  ['P5-SEAM-RC-R12-V20', 'tests/rungraph/review11-conformance.test.ts'],
  ['P5-SEAM-RC-R12-V21', 'tests/rungraph/review11-conformance.test.ts'],
  ['P5-SEAM-RC-R12-V22', 'tests/rungraph/review11-conformance.test.ts'],
  ['P5-SEAM-RC-R12-V23', 'tests/e2e/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-R12-V24', 'tests/rungraph/review11-conformance.test.ts'],
  ['P5-SEAM-RC-R12-V25', 'tests/rungraph/review11-conformance.test.ts'],
  ...['V01', 'V02', 'V03', 'V04', 'V05', 'V08', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17']
    .map(id => [`P5-SEAM-RC-R13-${id}`, 'tests/rungraph/review13-conformance.test.ts']),
  ...['MISSING', 'WRONG-KIND', 'WRONG-ID', 'UNWITNESSED', 'CLAUSES', 'EXTERNAL-ACTION', 'RECHECK',
    'PENDING-EFFECT', 'BAD-SIGNATURE', 'INCOMPLETE-HISTORY']
    .map(mode => [`P5-SEAM-RC-R13-V06-${mode}`, 'tests/rungraph/review13-conformance.test.ts']),
  ...['UNKNOWN', 'RESOLVED', 'CONFLICTED', 'UNRELATED']
    .map(mode => [`P5-SEAM-RC-R13-V07-${mode}`, 'tests/rungraph/review13-conformance.test.ts']),
  ...['QUEUE-FULL', 'QUOTA-WALL', 'SAFETY-CEILING', 'OPEN-BREAKER']
    .map(mode => [`P5-SEAM-RC-R13-V09-${mode}`, 'tests/rungraph/review13-conformance.test.ts']),
  ...['AVAILABLE-ADDRESSED', 'AVAILABLE-PENDING', 'UNAVAILABLE-PENDING', 'UNAVAILABLE-ADDRESSED',
    'WRONG-GROUNDING', 'WRONG-DIGEST', 'MISSING-RESULT']
    .map(mode => [`P5-SEAM-RC-R13-V10-${mode}`, 'tests/rungraph/review13-conformance.test.ts']),
  ['P5-SEAM-RC-R13-INTEGRATION-V02-V04', 'tests/integration/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-R13-INTEGRATION-V05', 'tests/integration/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-R13-E2E-V02-V05-V18', 'tests/e2e/rungraph-closure.test.ts'],
  ...['V01', 'V04', 'V06', 'V07', 'V08', 'V09', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V19']
    .map(id => [`P5-SEAM-RC-R14-${id}`, 'tests/rungraph/review14-conformance.test.ts']),
  ...['MISSING', 'WRONG-KIND', 'WRONG-ID', 'UNWITNESSED', 'CLAUSES', 'DEPENDENCY', 'RECHECK', 'MANIFEST',
    'SIGNATURE', 'INCOMPLETE']
    .map(mode => [`P5-SEAM-RC-R14-V02-${mode}`, 'tests/rungraph/review14-conformance.test.ts']),
  ...['UNKNOWN', 'RESOLVED', 'CONFLICTED', 'UNRELATED']
    .map(status => [`P5-SEAM-RC-R14-V03-${status}`, 'tests/rungraph/review14-conformance.test.ts']),
  ...['QUEUE-FULL', 'QUOTA-WALL', 'SAFETY-CEILING', 'OPEN-BREAKER']
    .map(mode => [`P5-SEAM-RC-R14-V05-${mode}`, 'tests/rungraph/review14-conformance.test.ts']),
  ...['1000', '1001']
    .map(age => [`P5-SEAM-RC-R14-V20-AGE-${age}`, 'tests/rungraph/review14-conformance.test.ts']),
  ...['ADDRESSED', 'PENDING']
    .map(mode => [`P5-SEAM-RC-R14-V18-${mode}`, 'tests/e2e/rungraph-closure-review14.test.ts']),
  ...['COMPLETED-PROPOSAL', 'COMPLETED-CLOSE', 'UNREACHABLE-PROPOSAL', 'UNREACHABLE-CLOSE']
    .map(cut => [`P5-SEAM-RC-R14-V16-${cut}`, 'tests/e2e/rungraph-closure-review14.test.ts']),
  ...['EXHAUSTION', 'CONTINUITY']
    .map(kind => [`P5-SEAM-RC-R14-V17-${kind}`, 'tests/e2e/rungraph-closure-review14.test.ts']),
  ['P5-SEAM-RC-R14-V20-REPLAY', 'tests/e2e/rungraph-closure-review14.test.ts'],
  ['P5-SEAM-RC-R14-INTEGRATION-V08-V09', 'tests/integration/rungraph-closure-review14.test.ts'],
  ['P5-SEAM-RC-R14-INTEGRATION-V11-V20', 'tests/integration/rungraph-closure-review14.test.ts'],
  ['P5-SEAM-RC-R14-INTEGRATION-V13-V14', 'tests/integration/rungraph-closure-review14.test.ts'],
]);

const map = new Map();
const seamRows = new Map();
for (const file of report.testResults) for (const test of file.assertionResults) for (const id of test.fullName.match(/\bP5-NF-\d+\b/g) ?? []) {
  if (!expected.has(id)) throw new Error(`unknown design check ${id}`);
  const rows = map.get(id) ?? [];
  rows.push({ file: relative(process.cwd(), file.name), name: test.title, status: test.status });
  map.set(id, rows);
}
for (const file of report.testResults) for (const test of file.assertionResults) for (const id of test.fullName.match(/\bP5-SEAM-RC-[A-Z0-9-]+\b/g) ?? []) {
  if (!seamEvidence.has(id)) throw new Error(`unknown run-closure seam evidence ${id}`);
  const rows = seamRows.get(id) ?? [];
  rows.push({ file: relative(process.cwd(), file.name), status: test.status });
  seamRows.set(id, rows);
}
for (const [id, requiredFile] of seamEvidence) {
  const rows = seamRows.get(id);
  if (!rows?.length) throw new Error(`missing required run-closure seam evidence: ${id}`);
  if (!rows.some(row => row.file === requiredFile && row.status === 'passed'))
    throw new Error(`${id}: required passing evidence absent from ${requiredFile}`);
}
console.log('| Check | Executed test files | Scope status |');
console.log('|---|---|---|');
for (const id of [...expected].sort()) {
  const rows = map.get(id);
  if (!rows?.length) throw new Error(`missing actual test result: ${id}`);
  for (const r of rows) if (r.status !== 'passed' && !(['pending', 'skipped'].includes(r.status)
    && /SKIPPED: out of slice scope/.test(r.name))) throw new Error(`${id}: invalid result or unexplained skip`);
  const pass = rows.some(r => r.status === 'passed'), skip = rows.some(r => r.status !== 'passed');
  console.log(`| ${id} | ${[...new Set(rows.map(r => r.file))].join('; ')} | ${skip ? pass ? 'partial; residual skipped' : 'out of slice scope' : 'built-scope tests passed'} |`);
}
console.log(`${expected.size} P5 checks mapped to actual results; skipped portions are not held.`);
console.log(`${seamEvidence.size} run-closure seam evidence fixtures present at their required tiers.`);
