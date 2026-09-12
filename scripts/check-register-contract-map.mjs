import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { checkProtectedTests } from './check-register-protection.mjs';
const design = readFileSync('docs/07-the-declarations.md', 'utf8');
const expected = new Set([...design.matchAll(/^\| (P3-NF-\d+) \|/gm)].map(m => m[1]));
const realUnlandedGrants = new Map([
  ['part-nine:semantic-adequacy-of-held-edges', { citation: 'semantic adequacy of `held` edges', checks: new Set() }],
  ['part-nine:runtime-freshness-holder', { citation: 'runtime freshness holder (part nine)', checks: new Set() }],
  ['parts-nine-eleven:external-anchor-for-protected-artifact-enforcement', { citation: 'external anchor for protected-artifact enforcement (parts nine and eleven', checks: new Set() }],
].filter(([, grant]) => design.includes(grant.citation)));
const grantedSkip = (name, id) => {
  const match = name.match(/SKIPPED:\s*GRANT:([a-z0-9-]+(?::[a-z0-9-]+)+)\s*$/);
  return match !== null && realUnlandedGrants.get(match[1])?.checks.has(id) === true;
};
const restoredLegacySkip = (file, test) => {
  if (file !== 'tests/integration/register.test.ts' || !['pending', 'skipped'].includes(test.status)
    || test.title !== 'P3-NF-21 P3-NF-23 SKIPPED: production spine admission, signed vector verification and replica initialization require the part-two adapter, absent on this lane base') return false;
  try {
    const base = execFileSync('git', ['merge-base', 'main', 'HEAD'], { encoding: 'utf8' }).trim();
    return readFileSync(file, 'utf8') === execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
  } catch { return false; }
};
const report = JSON.parse(readFileSync('.test-results.json', 'utf8')); const map = new Map();
for (const file of report.testResults) for (const test of file.assertionResults) {
  const testFile = isAbsolute(file.name) ? relative(process.cwd(), file.name) : file.name;
  if (restoredLegacySkip(testFile, test)) continue;
  for (const id of test.fullName.match(/\bP3-NF-\d+\b/g) ?? []) {
    if (!expected.has(id)) throw new Error(`unknown P3 contract ${id}`);
    const rows = map.get(id) ?? []; rows.push({ file: testFile, name: test.title, status: test.status }); map.set(id, rows);
  }
}
if (!report.success) throw new Error('test run failed');
checkProtectedTests(JSON.parse(readFileSync('generated/register.json', 'utf8')), [...map.values()].flatMap(rows => rows.map(r => r.file)));
console.log('| Check | Executed test file | Status |'); console.log('|---|---|---|');
for (const id of [...expected].sort()) {
  const rows = map.get(id); if (!rows?.length) throw new Error(`missing actual test for ${id}`);
  if (rows.some(row => !['passed', 'pending', 'skipped'].includes(row.status))) throw new Error(`${id}: test failed`);
  if (rows.some(row => ['pending', 'skipped'].includes(row.status) && !grantedSkip(row.name, id)))
    throw new Error(`${id}: pending test arm has no exact design grant for this check`);
  if (!rows.some(row => row.status === 'passed')
    && !rows.some(row => ['pending', 'skipped'].includes(row.status) && grantedSkip(row.name, id)))
    throw new Error(`${id}: neither passed nor skipped under an exact unlanded design grant`);
  console.log(`| ${id} | ${[...new Set(rows.map(r => r.file))].join('; ')} | ${[...new Set(rows.map(r => r.status))].join(', ')} |`);
}
console.log(`${expected.size} P3 contracts mapped to actual run results.`);
