// Rule 69: compare the approved fixture table to tests that actually ran, never a source grep.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { schemas } from '../dist/index.js';
const design = readFileSync('docs/05-the-types.md', 'utf8');
const expected = new Set([...design.matchAll(/^\| (NF-\d+) \|/gm)].map(m => m[1]));
const realUnlandedGrants = new Map([
  ['part-nine:semantic-adequacy-of-held-edges', 'semantic adequacy of `held` edges'],
  ['part-nine:runtime-freshness-holder', 'runtime freshness holder (part nine)'],
  ['parts-nine-eleven:external-anchor-for-protected-artifact-enforcement', 'part nine (verification holders and'],
].filter(([, citation]) => design.includes(citation)));
const grantedSkip = name => {
  const match = name.match(/SKIPPED:\s*GRANT:([a-z0-9-]+(?::[a-z0-9-]+)+)\s*$/);
  return match !== null && realUnlandedGrants.has(match[1]);
};
const inventory = [...design.matchAll(/^\| ([^|]+) \| (?:core|supporting) \|/gm)].map(m => m[1].trim().replace(/^Result \(.+\)$/, 'Result')).sort();
if (JSON.stringify(inventory) !== JSON.stringify(Object.keys(schemas).sort())) throw new Error('built schema inventory differs from approved design');
const report = JSON.parse(readFileSync('.test-results.json', 'utf8'));
const map = new Map();
for (const file of report.testResults) for (const test of file.assertionResults) {
  const ids = test.fullName.match(/(?<![A-Za-z0-9-])NF-\d+\b/g) ?? [];
  for (const id of ids) {
    if (!expected.has(id)) throw new Error(`test cites unknown design check ${id}`);
    const list = map.get(id) ?? []; list.push({ file: relative(process.cwd(), file.name), name: test.title, status: test.status }); map.set(id, list);
  }
}
if (!report.success) throw new Error('test run was not successful');
for (const id of expected) {
  const rows = map.get(id);
  if (!rows?.length) throw new Error(`missing actual test for ${id}`);
  if (rows.some(row => !['passed', 'pending', 'skipped'].includes(row.status))) throw new Error(`${id}: test failed`);
  if (!rows.some(row => row.status === 'passed')
    && !rows.some(row => ['pending', 'skipped'].includes(row.status) && grantedSkip(row.name)))
    throw new Error(`${id}: neither passed nor skipped under an exact unlanded design grant`);
}
console.log('| Check | Actual test file | Status |');
console.log('|---|---|---|');
for (const id of [...expected].sort()) console.log(`| ${id} | ${[...new Set(map.get(id).map(r => r.file))].join('; ')} | ${map.get(id).map(r => r.status).join(', ')} |`);
console.log(`${expected.size} design checks mapped to actual tests; ${report.numPassedTests} passing tests, ${report.numPendingTests} skipped.`);
