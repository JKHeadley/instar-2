import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const fixtures = {
  'tests/fixtures.ts': 'tests/types/compile.test.ts',
  'tests/facts/fixtures.ts': 'tests/facts/envelope.test.ts',
  'tests/rungraph/fixtures.ts': 'tests/rungraph/core.test.ts',
  'tests/assembly/fixture.ts': 'tests/assembly/records.test.ts',
};
const report = JSON.parse(readFileSync('.test-results.json', 'utf8'));
if (!report.success) throw new Error('P15 additivity requires a successful actual test run');
for (const [fixture, suite] of Object.entries(fixtures)) {
  const baseline = execFileSync('git', ['show', `main:${fixture}`]); const current = readFileSync(fixture);
  if (!baseline.equals(current)) throw new Error(`P15 additivity: legacy fixture bytes changed: ${fixture}`);
  const result = report.testResults.find(file => relative(process.cwd(), file.name) === suite);
  if (!result || result.assertionResults.length === 0 || result.assertionResults.some(test => test.status !== 'passed'))
    throw new Error(`P15 additivity: legacy owner Results are not wholly green: ${suite}`);
}
console.log(`${Object.keys(fixtures).length} legacy Part One/Two/Five/Ten fixture sources are byte-identical to main and their Results passed.`);
