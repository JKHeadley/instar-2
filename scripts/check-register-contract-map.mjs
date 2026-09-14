import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { checkProtectedTests } from './check-register-protection.mjs';
const design = readFileSync('docs/07-the-declarations.md', 'utf8');
const sliceScope = readFileSync('docs/07-the-declarations/part-three-slice-a1-scope.md', 'utf8');
const expected = new Set([...design.matchAll(/^\| (P3-NF-\d+) \|/gm)].map(m => m[1]));
const workflowEnrollmentHold = 'HELD-BY-SCOPE:SEAM-LEDGER-row-124';
const workflowEnrollmentFiles = new Set([
  'tests/e2e/register-missing-owner-manifest-round6.test.ts',
  'tests/e2e/register-normal-restart-round3.test.ts',
  'tests/e2e/register-roster-only-enrollment-round8.test.ts',
  'tests/e2e/register-shape-change.test.ts',
  'tests/e2e/retained-enrollment-a2-round12.test.ts',
  'tests/integration/register-captured-evidence-round10.test.ts',
  'tests/integration/register-evidence-currency-round9.test.ts',
  'tests/integration/register-owner-enrollment-round7.test.ts',
  'tests/integration/register-owner-enrollment-signed-roster-round8.test.ts',
  'tests/integration/register-reference-identity-round6.test.ts',
  'tests/integration/register-workflow-captured-input-round11.test.ts',
  'tests/integration/register-workflow-evidence-round3.test.ts',
  'tests/integration/register-workflow-record-id-round5.test.ts',
  'tests/integration/retained-enrollment-a2-round12.test.ts',
  'tests/register/owner-enrollment-round2-review.test.ts',
  'tests/register/owner-enrollment-signature-round8.test.ts',
  'tests/register/owner-identity-round7.test.ts',
  'tests/register/public-validation-import-round8.test.ts',
  'tests/register/shape-change-order-round6.test.ts',
  'tests/register/shape-change-round2-review.test.ts',
  'tests/register/shape-change.test.ts',
  'tests/register/workflow-evidence-round3-review.test.ts',
  'tests/register/retained-enrollment-a2-round12.test.ts',
]);
if (!sliceScope.includes('SEAM-LEDGER row 124') || !sliceScope.includes(workflowEnrollmentHold))
  throw new Error('Part Three A1 scope does not carry the exact row-124 workflow/enrollment hold');
const scopeRows = new Map([...sliceScope.matchAll(/^\| (P3-NF-\d+) \|[^\n]+$/gm)].map(match => [match[1], match[0]]));
if (scopeRows.size !== expected.size || [...expected].some(id => !scopeRows.has(id)))
  throw new Error('Part Three A1 scope must disposition exactly the 30 governed P3-NF rows');
const workflowEnrollmentChecks = new Set([...scopeRows]
  .filter(([, row]) => row.includes(workflowEnrollmentHold)).map(([id]) => id));
const contractIds = name => [...new Set([...name.matchAll(/\bP3-NF-(\d+)((?:\/\d+)*)\b/g)].flatMap(match =>
  [match[1], ...match[2].split('/').filter(Boolean)].map(number => `P3-NF-${number}`)))];
const realUnlandedGrants = new Map([
  ['part-nine:semantic-adequacy-of-held-edges', { citation: 'semantic adequacy of `held` edges', checks: new Set() }],
  ['part-nine:runtime-freshness-holder', { citation: 'runtime freshness holder (part nine)', checks: new Set() }],
  ['parts-nine-eleven:external-anchor-for-protected-artifact-enforcement', { citation: 'external anchor for protected-artifact enforcement (parts nine and eleven', checks: new Set() }],
].filter(([, grant]) => design.includes(grant.citation)));
const grantedSkip = (name, id, file) => {
  const match = name.match(/SKIPPED:\s*GRANT:([A-Za-z0-9:-]+)(?:\s|$)/);
  if (match === null || realUnlandedGrants.get(match[1])?.checks.has(id) !== true) return false;
  return true;
};
const heldByScope = (name, id, file) => name.includes(`SKIPPED: ${workflowEnrollmentHold}`)
  && workflowEnrollmentChecks.has(id) && workflowEnrollmentFiles.has(file);
const preservedWorkflowCompatibility = (file, test) => {
  const wholeFile = file === 'tests/e2e/register.test.ts' || file === 'tests/register/workflow.test.ts';
  const completionArm = file === 'tests/integration/register.test.ts'
    && test.title === 'P3-NF-22 completion plans require live genesis standing and remain unanchored until append';
  if ((!wholeFile && !completionArm) || test.status !== 'passed') return false;
  try { return readFileSync(file).equals(execFileSync('git', ['show', `main:${file}`])); }
  catch { return false; }
};
const preservedLegacySkip = (file, test) => {
  const title = 'P3-NF-21 P3-NF-23 SKIPPED: production spine admission, signed vector verification and replica initialization require the part-two adapter, absent on this lane base';
  if (file !== 'tests/integration/register.test.ts' || test.title !== title
    || !['pending', 'skipped'].includes(test.status)) return false;
  try {
    // The add-only rule requires this main-era file to remain byte-identical.
    // Its obsolete skip is not accepted or mapped as evidence: only new passing
    // rows can satisfy P3-NF-21/23, and any changed/copied pending row still fails.
    return readFileSync(file).equals(execFileSync('git', ['show', `main:${file}`]));
  } catch { return false; }
};
const report = JSON.parse(readFileSync('.test-results.json', 'utf8')); const map = new Map();
const workflowBindings = new Map();
for (const file of report.testResults) for (const test of file.assertionResults) {
  const testFile = isAbsolute(file.name) ? relative(process.cwd(), file.name) : file.name;
  if (preservedLegacySkip(testFile, test)) continue;
  const ids = contractIds(test.fullName);
  if (preservedWorkflowCompatibility(testFile, test)) {
    for (const id of ids) if (workflowEnrollmentChecks.has(id)) {
      const rows = workflowBindings.get(id) ?? [];
      rows.push({ file: testFile, name: test.fullName, status: test.status }); workflowBindings.set(id, rows);
    }
    continue;
  }
  if (ids.length > 0 && workflowEnrollmentFiles.has(testFile) && test.status === 'passed')
    throw new Error(`${testFile}: workflow/enrollment arm was counted as an A1 pass`);
  if (ids.length > 0 && ['pending', 'skipped'].includes(test.status)
    && ids.every(id => heldByScope(test.fullName, id, testFile))) {
    for (const id of ids) {
      const bindings = workflowBindings.get(id) ?? [];
      bindings.push({ file: testFile, name: test.fullName, status: test.status }); workflowBindings.set(id, bindings);
    }
    continue;
  }
  for (const id of ids) {
    if (!expected.has(id)) throw new Error(`unknown P3 contract ${id}`);
    const rows = map.get(id) ?? []; rows.push({ file: testFile, name: test.fullName, status: test.status }); map.set(id, rows);
  }
}
if (!report.success) throw new Error('test run failed');
for (const [id, rows] of map) if (rows.some(row =>
  ['pending', 'skipped'].includes(row.status) && !grantedSkip(row.name, id, row.file)))
  throw new Error(`${id}: pending test arm has no exact design grant for this check`);
for (const id of workflowEnrollmentChecks) if (!workflowBindings.get(id)?.length)
  throw new Error(`${id}: row-124 workflow/enrollment disposition has no actual test binding`);
checkProtectedTests(JSON.parse(readFileSync('generated/register.json', 'utf8')), [...map.values()].flatMap(rows => rows.map(r => r.file)));
console.log('| Check | Executed test file | Status |'); console.log('|---|---|---|');
for (const id of [...expected].sort()) {
  const rows = map.get(id);
  if (!rows?.length) throw new Error(`${id}: executable A1 contract has no passing test result`);
  if (rows.some(row => !['passed', 'pending', 'skipped'].includes(row.status))) throw new Error(`${id}: test failed`);
  if (rows.some(row => ['pending', 'skipped'].includes(row.status) && !grantedSkip(row.name, id, row.file)))
    throw new Error(`${id}: pending test arm has no exact design grant for this check`);
  if (!rows.some(row => row.status === 'passed'))
    throw new Error(`${id}: executable A1 contract has no passing test result`);
  console.log(`| ${id} | ${[...new Set(rows.map(r => r.file))].join('; ')} | ${[...new Set(rows.map(r => r.status))].join(', ')} |`);
}
console.log(`${expected.size} P3 contracts mapped to actual run results.`);
