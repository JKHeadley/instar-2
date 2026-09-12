export default {
  test: {
    include: ['tests/fixtures/transport-loop-a1-repair25-e2e-child.ts'],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30_000,
  },
};
