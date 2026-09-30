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
    // test-tmp: before the fork pool starts, point TMPDIR at a per-run directory on RAM-
    // backed storage (removed at teardown) so test fsyncs never swamp the real disk.
    // INSTAR_TEST_REAL_DISK=1 opts out; `npm run test:durability` uses that to prove
    // production storage on the real disk once per gate.
    // runtime: refuses the run in one line on a Node that cannot launch the shipped bin.
    globalSetup: ['tests/setup/runtime.ts', 'tests/setup/test-tmp.ts'],
    // nice-worker: best-effort priority reduction for each worker and its spawned children
    // (a resource optimization, never a correctness gate). yield-worker: an awaited
    // event-loop turn after every test case so the fork worker's task-update IPC can be
    // answered between synchronous cases — the structural remedy for the runner's fixed
    // 60s RPC deadline, which serialization and priority alone do not cure.
    // conversation-owners: each test file's runner children claim conversations in their own
    // temporary directory, never the real host directory (Rule 63 fence).
    setupFiles: ['tests/setup/nice-worker.mjs', 'tests/setup/yield-worker.mjs', 'tests/setup/conversation-owners.mjs'],
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
