// Same nested-runner budget as the other repair configs here; the 5,000 ms default is not
// a budget this fixture process was ever measured against. Rule 37.
export default { test: { include: ['tests/fixtures/transport-loop-a1-repair18-e2e-child.ts'],
  pool: 'forks', fileParallelism: false, maxWorkers: 1, testTimeout: 30_000 } };
