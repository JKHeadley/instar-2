import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

// VITEST_SERIAL_GATE=1 is the exact serial comparator (one fork worker, no file
// parallelism) without editing source between evidence runs; the transitional FINAL
// landing gate and small hosts use it.
const serialGate = process.env.VITEST_SERIAL_GATE === '1';
// Bounded fork parallelism: half the available logical CPUs, capped at six (16 CPUs → 6,
// 4 → 2, 2 → 1). A conservative engineering starting point that bounds resource
// pressure, not a measured optimum for every runner.
const workerLimit = Math.max(1, Math.min(6, Math.floor(availableParallelism() / 2)));

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // nice-worker: best-effort priority reduction for each worker and its spawned children
    // (a resource optimization, never a correctness gate). yield-worker: an awaited
    // event-loop turn after every test case so the fork worker's task-update IPC can be
    // answered between synchronous cases — the structural remedy for the runner's fixed
    // 60s RPC deadline, which serialization and priority alone do not cure.
    setupFiles: ['tests/setup/nice-worker.mjs', 'tests/setup/yield-worker.mjs'],
    pool: 'forks',
    isolate: true,
    fileParallelism: !serialGate,
    minWorkers: 1,
    maxWorkers: serialGate ? 1 : workerLimit,
    // Full-gate workers run at reduced priority and exercise durable multi-owner
    // histories. Keep the runner deadline above the observed ~5.1s boundary so
    // valid serialized tests are not reported as semantic failures under load.
    testTimeout: 10_000,
  },
});
