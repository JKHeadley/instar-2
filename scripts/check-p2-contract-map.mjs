// Rule 69: map all approved P2-NF IDs to tests that actually executed.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
const design = readFileSync('docs/06-the-fact-envelope.md', 'utf8');
const expected = new Set([...design.matchAll(/^\| (P2-NF-\d+) \|/gm)].map(m => m[1]));
const report = JSON.parse(readFileSync('.test-results.json', 'utf8'));
const map = new Map();
for (const file of report.testResults) for (const test of file.assertionResults) for (const id of test.fullName.match(/\bP2-NF-\d+\b/g) ?? []) {
  if (!expected.has(id)) throw new Error(`unknown design check ${id}`);
  const rows = map.get(id) ?? []; rows.push({ file: relative(process.cwd(), file.name), name: test.title, status: test.status }); map.set(id, rows);
}
if (!report.success) throw new Error('test suite failed');
for (const id of expected) {
  const rows = map.get(id); if (!rows?.length) throw new Error(`missing executed test: ${id}`);
  for (const row of rows) if (row.status !== 'passed' && !(['pending', 'skipped'].includes(row.status) && /SKIPPED:\s*\S.+/.test(row.name))) throw new Error(`${id}: neither passed nor explicitly skipped with reason`);
}
console.log('| Check | Actual test files | Status |');
console.log('|---|---|---|');
for (const id of [...expected].sort()) {
  const rows = map.get(id); console.log(`| ${id} | ${[...new Set(rows.map(r => r.file))].join('; ')} | ${[...new Set(rows.map(r => r.status))].join(', ')} |`);
}
console.log(`${expected.size} P2 design checks mapped; ${[...map.values()].filter(rows => rows.some(r => ['pending', 'skipped'].includes(r.status))).length} have explicit skips.`);
