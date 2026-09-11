import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/fixtures/transport-loop-a1-e2e-child.ts'],
  pool: 'forks', fileParallelism: false, maxWorkers: 1 } });
