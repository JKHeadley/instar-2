import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
const design = readFileSync('docs/09-the-run-graph.md', 'utf8');
const expected = new Set([...design.matchAll(/^\| (P5-NF-\d+) \|/gm)].map(m => m[1]));
const report = JSON.parse(readFileSync('.test-results.json', 'utf8'));
if (!report.success) throw new Error('test suite failed');
const map = new Map();
for (const file of report.testResults) for (const test of file.assertionResults) for (const id of test.fullName.match(/\bP5-NF-\d+\b/g) ?? []) {
  if (!expected.has(id)) throw new Error(`unknown design check ${id}`);
  const rows = map.get(id) ?? []; rows.push({ file: relative(process.cwd(), file.name), name: test.title, status: test.status }); map.set(id, rows);
}
console.log('| Check | Executed test files | Scope status |'); console.log('|---|---|---|');
for (const id of [...expected].sort()) {
  const rows = map.get(id); if (!rows?.length) throw new Error(`missing actual test result: ${id}`);
  for (const r of rows) if (r.status !== 'passed' && !(['pending', 'skipped'].includes(r.status) && /SKIPPED: out of slice scope/.test(r.name))) throw new Error(`${id}: invalid result or unexplained skip`);
  const pass = rows.some(r => r.status === 'passed'), skip = rows.some(r => r.status !== 'passed');
  console.log(`| ${id} | ${[...new Set(rows.map(r => r.file))].join('; ')} | ${skip ? pass ? 'partial; residual skipped' : 'out of slice scope' : 'built-scope tests passed'} |`);
}
console.log(`${expected.size} P5 checks mapped to actual results; skipped portions are not held.`);
