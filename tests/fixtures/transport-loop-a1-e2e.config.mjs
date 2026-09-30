import { defineConfig } from 'vitest/config';
// Nested fixture runners carry their own budget: without one this child inherited Vitest's
// 5,000 ms default while the gate itself runs at 10,000 ms, so a producer that is merely
// slow under load was reported as a semantic failure. 30,000 ms is the budget the later
// repair configs in this directory already use, and it stays well inside the parent's
// 90,000 ms spawn bound. Rule 37.
export default defineConfig({ test: { include: ['tests/fixtures/transport-loop-a1-e2e-child.ts'],
  pool: 'forks', fileParallelism: false, maxWorkers: 1, testTimeout: 30_000 } });
