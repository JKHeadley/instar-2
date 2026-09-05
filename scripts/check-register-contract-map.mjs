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
checkProtectedTests(JSON.parse(readFileSync('generated/register.json', 'utf8')), [...map.values()].flatMap(rows => rows.map(r => r.file)));
console.log('| Check | Executed test file | Status |'); console.log('|---|---|---|');
for (const id of [...expected].sort()) {
  const rows = map.get(id); if (!rows?.length) throw new Error(`missing actual test for ${id}`);
  for (const row of rows) if (row.status !== 'passed' && !(['pending', 'skipped'].includes(row.status) && /SKIPPED:.+/.test(row.name))) throw new Error(`${id}: neither passed nor explicitly skipped with reason`);
  console.log(`| ${id} | ${[...new Set(rows.map(r => r.file))].join('; ')} | ${[...new Set(rows.map(r => r.status))].join(', ')} |`);
}
console.log(`${expected.size} P3 contracts mapped to actual run results.`);
