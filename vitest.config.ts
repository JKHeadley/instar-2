import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Nice each worker so its spawned children inherit reduced priority and the MAIN
    // process keeps servicing its 60s RPC under CPU saturation on 2-core CI runners
    // (REPAIR5; the starvation is suite-wide, not only the kill schedule). Priority-only,
    // zero semantic change.
    setupFiles: ['tests/setup/nice-worker.mjs'],
    // x64 runs 34012982546 / 34012981173 passed all 516 assertions, then
    // failed worker onTaskUpdate RPC at teardown under concurrent CPU-heavy
    // compiled-CLI workloads. Vitest 3's RPC deadline is fixed at 60s (not
    // teardownTimeout). Serialize isolated fork workers to avoid contention;
    // keep test deadlines and unhandled-error reporting unchanged.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    // Full-gate workers run at reduced priority and exercise durable multi-owner
    // histories. Keep the runner deadline above the observed ~5.1s boundary so
    // valid serialized tests are not reported as semantic failures under load.
    testTimeout: 10_000,
  },
});
