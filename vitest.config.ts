import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // x64 runs 34012982546 / 34012981173 passed all 516 assertions, then
    // failed worker onTaskUpdate RPC at teardown under concurrent CPU-heavy
    // compiled-CLI workloads. Vitest 3's RPC deadline is fixed at 60s (not
    // teardownTimeout). Serialize isolated fork workers to avoid contention;
    // keep test deadlines and unhandled-error reporting unchanged.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
  },
});
