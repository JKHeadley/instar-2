import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { checkProtectedTests } from './check-register-protection.mjs';
const design = readFileSync('docs/07-the-declarations.md', 'utf8');
const expected = new Set([...design.matchAll(/^\| (P3-NF-\d+) \|/gm)].map(m => m[1]));
const report = JSON.parse(readFileSync('.test-results.json', 'utf8')); const map = new Map();
for (const file of report.testResults) for (const test of file.assertionResults) for (const id of test.fullName.match(/\bP3-NF-\d+\b/g) ?? []) {
  if (!expected.has(id)) throw new Error(`unknown P3 contract ${id}`);
  const rows = map.get(id) ?? []; rows.push({ file: relative(process.cwd(), file.name), name: test.title, status: test.status }); map.set(id, rows);
}
if (!report.success) throw new Error('test run failed');
const register = JSON.parse(readFileSync('generated/register.json', 'utf8'));
checkProtectedTests(register, [...map.values()].flatMap(rows => rows.map(r => r.file)));
const heldTests = new Set(register.entries.flatMap(entry => entry.declaration.holds ?? [])
  .filter(hold => hold.class !== 'deferred' && ['fixture', 'probe'].includes(hold.evidence.kind))
  .map(hold => hold.evidence.id));
for (const id of heldTests) {
  const matches = report.testResults.flatMap(file => file.assertionResults
    .filter(test => test.fullName.split(/[^A-Za-z0-9-]+/u).includes(id))
    .map(test => ({ file: relative(process.cwd(), file.name), status: test.status })));
  if (!matches.length || matches.some(match => match.status !== 'passed'))
    throw new Error(`held test ${id} must pass in the current run`);
}
console.log('| Check | Executed test file | Status |'); console.log('|---|---|---|');
for (const id of [...expected].sort()) {
  const rows = map.get(id); if (!rows?.length) throw new Error(`missing actual test for ${id}`);
  for (const row of rows) if (row.status !== 'passed' && !(['pending', 'skipped'].includes(row.status) && /SKIPPED:.+/.test(row.name))) throw new Error(`${id}: neither passed nor explicitly skipped with reason`);
  console.log(`| ${id} | ${[...new Set(rows.map(r => r.file))].join('; ')} | ${[...new Set(rows.map(r => r.status))].join(', ')} |`);
}
console.log(`${expected.size} P3 contracts mapped to actual run results.`);
