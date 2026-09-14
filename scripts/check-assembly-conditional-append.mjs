import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const assemblyConditionalAppendMap = [{
  id: 'P10-SEAM-CONDITIONAL-APPEND-58',
  operation: 'appendIfSubjectFrontier',
  tiers: ['unit', 'integration', 'lifecycle'],
  evidence: ['replay-authentication', 'stop-inhibition', 'closed-shape-refusal', 'held-lock-contention', 'read-window-race', 'replay-read-race', 'replay-stop'],
  cases: 'typed current-frontier refusal, equal-frontier append, subject scoping, replay authentication, stop inhibition at entry and use including replay, closed-shape refusal, held-lock contention, adjacent Part Two new-record and replay read races, two-process mode race, and real-storage SIGKILL boundaries',
}];

export function checkAssemblyConditionalAppend(report, map = assemblyConditionalAppendMap) {
  if (!report.success) throw new Error('assembly conditional-append mapping requires a successful actual test run');
  const tierPath = { unit: '/tests/assembly/', integration: '/tests/integration/', lifecycle: '/tests/e2e/' };
  for (const row of map) {
    if (!row.id || !row.operation || !row.cases || new Set(row.tiers).size !== 3
      || !Array.isArray(row.evidence) || row.evidence.length !== 7 || new Set(row.evidence).size !== row.evidence.length)
      throw new Error('malformed assembly conditional-append map entry');
    const assertions = report.testResults.flatMap(file => (file.assertionResults ?? []).map(test => ({
      ...test, file: file.name.replaceAll('\\', '/'),
    })));
    const tests = assertions.filter(test => (test.fullName.match(/\bP10-SEAM-[A-Z0-9-]+-\d+\b/g) ?? []).includes(row.id)
      && test.fullName.includes(`[behavior:${row.operation}]`));
    for (const tier of row.tiers) if (!tests.some(test => test.status === 'passed' && test.file.includes(tierPath[tier])))
      throw new Error(`${row.id}: ${row.operation} lacks passing ${tier} evidence`);
    for (const evidence of row.evidence) if (!tests.some(test => test.status === 'passed'
      && (test.fullName.match(/\[case:([a-z0-9-]+)\]/g) ?? []).includes(`[case:${evidence}]`)))
      throw new Error(`${row.id}: ${row.operation} lacks passing ${evidence} evidence`);
    if (tests.some(test => test.status !== 'passed')) throw new Error(`${row.id}: mapped evidence did not pass`);
  }
  return map;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = checkAssemblyConditionalAppend(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  for (const row of rows) console.log(`${row.id}: ${row.operation}; ${row.tiers.join('/')} — ${row.cases}`);
}
