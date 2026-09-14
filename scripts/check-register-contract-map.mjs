import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { checkProtectedTests } from './check-register-protection.mjs';
const design = readFileSync('docs/07-the-declarations.md', 'utf8');
const sliceScope = readFileSync('docs/07-the-declarations/part-three-slice-a1-scope.md', 'utf8');
const expected = new Set([...design.matchAll(/^\| (P3-NF-\d+) \|/gm)].map(m => m[1]));
const workflowEnrollmentGrant = 'NON-EXECUTABLE-UNTIL-slice-A2-workflow-enrollment';
const workflowEnrollmentChecks = new Set([
  'P3-NF-01', 'P3-NF-02', 'P3-NF-03', 'P3-NF-07', 'P3-NF-09', 'P3-NF-13', 'P3-NF-15', 'P3-NF-19',
  'P3-NF-21', 'P3-NF-22', 'P3-NF-23', 'P3-NF-24', 'P3-NF-26', 'P3-NF-27', 'P3-NF-28', 'P3-NF-29',
]);
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
if (!sliceScope.includes('SEAM-LEDGER row 124') || !sliceScope.includes(workflowEnrollmentGrant))
  throw new Error('Part Three A1 scope does not carry the exact row-124 workflow/enrollment grant');
const scopeRows = new Map([...sliceScope.matchAll(/^\| (P3-NF-\d+) \|[^\n]+$/gm)].map(match => [match[1], match[0]]));
if (scopeRows.size !== expected.size || [...expected].some(id => !scopeRows.has(id)))
  throw new Error('Part Three A1 scope must disposition exactly the 30 governed P3-NF rows');
for (const [id, row] of scopeRows) if (row.includes(workflowEnrollmentGrant) !== workflowEnrollmentChecks.has(id))
  throw new Error(`${id}: row-124 workflow/enrollment disposition differs from the executable map`);
const realUnlandedGrants = new Map([
  [workflowEnrollmentGrant, { citation: workflowEnrollmentGrant, checks: workflowEnrollmentChecks }],
  ['part-nine:semantic-adequacy-of-held-edges', { citation: 'semantic adequacy of `held` edges', checks: new Set() }],
  ['part-nine:runtime-freshness-holder', { citation: 'runtime freshness holder (part nine)', checks: new Set() }],
  ['parts-nine-eleven:external-anchor-for-protected-artifact-enforcement', { citation: 'external anchor for protected-artifact enforcement (parts nine and eleven', checks: new Set() }],
].filter(([name, grant]) => (name === workflowEnrollmentGrant ? sliceScope : design).includes(grant.citation)));
const grantedSkip = (name, id, file) => {
  const match = name.match(/SKIPPED:\s*GRANT:([A-Za-z0-9:-]+)(?:\s|$)/);
  if (match === null || realUnlandedGrants.get(match[1])?.checks.has(id) !== true) return false;
  return match[1] !== workflowEnrollmentGrant || workflowEnrollmentFiles.has(file);
};
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
for (const file of report.testResults) for (const test of file.assertionResults) {
  const testFile = isAbsolute(file.name) ? relative(process.cwd(), file.name) : file.name;
  if (preservedLegacySkip(testFile, test)) continue;
  if (preservedWorkflowCompatibility(testFile, test)) continue;
  const ids = test.fullName.match(/\bP3-NF-\d+\b/g) ?? [];
  if (ids.length > 0 && workflowEnrollmentFiles.has(testFile) && test.status === 'passed')
    throw new Error(`${testFile}: workflow/enrollment arm was counted as an A1 pass`);
  for (const id of ids) {
    if (!expected.has(id)) throw new Error(`unknown P3 contract ${id}`);
    const rows = map.get(id) ?? []; rows.push({ file: testFile, name: test.fullName, status: test.status }); map.set(id, rows);
  }
}
if (!report.success) throw new Error('test run failed');
checkProtectedTests(JSON.parse(readFileSync('generated/register.json', 'utf8')), [...map.values()].flatMap(rows => rows.map(r => r.file)));
console.log('| Check | Executed test file | Status |'); console.log('|---|---|---|');
for (const id of [...expected].sort()) {
  const rows = map.get(id); if (!rows?.length) throw new Error(`missing actual test for ${id}`);
  if (rows.some(row => !['passed', 'pending', 'skipped'].includes(row.status))) throw new Error(`${id}: test failed`);
  if (rows.some(row => ['pending', 'skipped'].includes(row.status) && !grantedSkip(row.name, id, row.file)))
    throw new Error(`${id}: pending test arm has no exact design grant for this check`);
  if (!rows.some(row => row.status === 'passed')
    && !rows.some(row => ['pending', 'skipped'].includes(row.status) && grantedSkip(row.name, id, row.file)))
    throw new Error(`${id}: neither passed nor skipped under an exact unlanded design grant`);
  console.log(`| ${id} | ${[...new Set(rows.map(r => r.file))].join('; ')} | ${[...new Set(rows.map(r => r.status))].join(', ')} |`);
}
console.log(`${expected.size} P3 contracts mapped to actual run results.`);
