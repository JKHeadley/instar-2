// P4-NF identifiers resolve to executed checks or explicit, bounded slice omissions.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
const expected = new Set([...readFileSync('docs/08-the-intake.md', 'utf8').matchAll(/^\| (P4-NF-\d+) \|/gm)].map(m => m[1]));
for (let i = 1; i <= 9; i++) expected.add(`P4-VA-${String(i).padStart(2, '0')}`);
for (let i = 1; i <= 102; i++) expected.add(`P4-ST-${String(i).padStart(2, '0')}`);
for (let i = 1; i <= 5; i++) expected.add(`P4-PRESERVE-${String(i).padStart(2, '0')}`);
const report = JSON.parse(readFileSync('.test-results.json', 'utf8'));
if (!report.success) throw new Error('test suite failed');
const map = new Map();
for (const file of report.testResults) for (const test of file.assertionResults) for (const id of test.fullName.match(/\bP4-(?:(?:NF|VA|ST)-\d+|PRESERVE-\d+)\b/g) ?? []) {
  if (!expected.has(id)) throw new Error(`unknown intake check ${id}`);
  if (test.status !== 'passed' && !(['pending', 'skipped'].includes(test.status) && /out of slice scope:\s*\S.+/.test(test.title)))
    throw new Error(`${id}: missing executable proof or explicit slice-scope reason`);
  const rows = map.get(id) ?? [];
  rows.push({ file: relative(process.cwd(), file.name), name: test.title, status: test.status }); map.set(id, rows);
}
console.log('| Check | Test files | Status |'); console.log('|---|---|---|');
for (const id of [...expected].sort()) {
  const rows = map.get(id); if (!rows?.length) throw new Error(`missing intake check ${id}`);
  console.log(`| ${id} | ${[...new Set(rows.map(r => r.file))].join('; ')} | ${[...new Set(rows.map(r => r.status))].join(', ')} |`);
}
console.log(`${expected.size} P4 checks mapped; slice omissions remain explicit, never counted as passes.`);
