import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const design = readFileSync('docs/09-the-run-graph.md', 'utf8');
const expected = new Set([...design.matchAll(/^\| (P5-NF-\d+) \|/gm)].map(m => m[1]));
const report = JSON.parse(readFileSync('.test-results.json', 'utf8'));
if (!report.success) throw new Error('test suite failed');

const requiredSeamEvidence = new Map([
  ['P5-SEAM-RC-A-PRIME-PRESSURE-STATES', 'tests/rungraph/closure-pressure-states.test.ts'],
  ['P5-SEAM-RC-A-PRIME-R23-F1-UNIT', 'tests/rungraph/review23-a-prime.test.ts'],
  ['P5-SEAM-RC-A-PRIME-R23-F1-INTEGRATION', 'tests/integration/rungraph-closure-review23.test.ts'],
  ['P5-SEAM-RC-A-PRIME-R23-F1-E2E', 'tests/e2e/rungraph-closure-review23.test.ts'],
  ['P5-SEAM-RC-A-PRIME-R23-F2-UNIT', 'tests/rungraph/review23-a-prime.test.ts'],
  ['P5-SEAM-RC-A-PRIME-R23-F2-INTEGRATION', 'tests/integration/rungraph-closure-review23.test.ts'],
  ['P5-SEAM-RC-A-PRIME-R23-F2-E2E', 'tests/e2e/rungraph-closure-review23.test.ts'],
  ['P5-SEAM-RC-A-F1-DECODERS', 'tests/rungraph/closure.test.ts'],
  ['P5-SEAM-RC-A-F2-OWNER-BOUNDARIES', 'tests/rungraph/closure.test.ts'],
  ['P5-SEAM-RC-A-F2-INTEGRATION', 'tests/integration/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-A-F3-INHIBITIONS-UNIT', 'tests/rungraph/closure.test.ts'],
  ['P5-SEAM-RC-A-F3-UNSETTLED-INTEGRATION', 'tests/integration/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-A-F4-RESTART-CUTS', 'tests/e2e/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-A-F5-LEGACY-BYTES', 'tests/rungraph/legacy-decoder-preservation.test.ts'],
  ['P5-SEAM-RC-A-F6-EQUAL-FRONTIER', 'tests/integration/rungraph-closure.test.ts'],
  ['P5-SEAM-RC-A-F7-CANCELLED-REFUSAL', 'tests/rungraph/closure.test.ts'],
  ['P5-SEAM-RC-A-PRIME-F1-UNIT', 'tests/rungraph/review22-a-prime.test.ts'],
  ['P5-SEAM-RC-A-PRIME-F1-INTEGRATION', 'tests/integration/rungraph-closure-review22.test.ts'],
  ['P5-SEAM-RC-A-PRIME-F1-E2E', 'tests/e2e/rungraph-closure-review22.test.ts'],
  ['P5-SEAM-RC-A-PRIME-F2-UNIT', 'tests/rungraph/review22-a-prime.test.ts'],
  ['P5-SEAM-RC-A-PRIME-F2-INTEGRATION', 'tests/integration/rungraph-closure-review22.test.ts'],
  ['P5-SEAM-RC-A-PRIME-F2-E2E', 'tests/e2e/rungraph-closure-review22.test.ts'],
]);

const designRows = new Map();
const seamRows = new Map();
for (const file of report.testResults) {
  for (const test of file.assertionResults) {
    for (const id of test.fullName.match(/\bP5-NF-\d+\b/g) ?? []) {
      if (!expected.has(id)) throw new Error(`unknown design check ${id}`);
      const rows = designRows.get(id) ?? [];
      rows.push({ file: relative(process.cwd(), file.name), name: test.title, status: test.status });
      designRows.set(id, rows);
    }
    for (const id of test.fullName.match(/\bP5-SEAM-RC-[A-Z0-9-]+\b/g) ?? []) {
      const rows = seamRows.get(id) ?? [];
      rows.push({ file: relative(process.cwd(), file.name), status: test.status });
      seamRows.set(id, rows);
    }
  }
}

for (const [id, requiredFile] of requiredSeamEvidence) {
  const rows = seamRows.get(id);
  if (!rows?.length) throw new Error(`missing required run-closure seam evidence: ${id}`);
  if (!rows.some(row => row.file === requiredFile && row.status === 'passed'))
    throw new Error(`${id}: required passing evidence absent from ${requiredFile}`);
}

console.log('| Check | Executed test files | Scope status |');
console.log('|---|---|---|');
for (const id of [...expected].sort()) {
  const rows = designRows.get(id);
  if (!rows?.length) throw new Error(`missing actual test result: ${id}`);
  for (const row of rows) {
    if (row.status !== 'passed' && !(['pending', 'skipped'].includes(row.status)
      && /SKIPPED: out of slice scope/.test(row.name))) {
      throw new Error(`${id}: invalid result or unexplained skip`);
    }
  }
  const pass = rows.some(row => row.status === 'passed');
  const skip = rows.some(row => row.status !== 'passed');
  console.log(`| ${id} | ${[...new Set(rows.map(row => row.file))].join('; ')} | ${skip
    ? pass ? 'partial; residual skipped' : 'out of slice scope'
    : 'built-scope tests passed'} |`);
}
console.log(`${expected.size} P5 checks mapped to actual results; skipped portions are not held.`);
console.log(`${requiredSeamEvidence.size} required run-closure seam evidence fixtures passed at their required tiers.`);
