import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { configDefaults, defineConfig } from 'vitest/config';
import { resolveTestWorkerLimit } from './tests/setup/worker-limit.js';

// Bound ordinary file parallelism as before the train-159 serial-all workaround.
// Host-wide suite admission is separate from this per-run worker ceiling.
const serialGate = process.env.VITEST_SERIAL_GATE === '1';
const hostWorkerLimit = Math.max(1, Math.min(6, Math.floor(availableParallelism() / 2)));
const { limit: workerLimit, ignoredValue } = resolveTestWorkerLimit(process.env.INSTAR_TEST_MAX_WORKERS, hostWorkerLimit);
if (ignoredValue !== null)
  process.stderr.write(`INSTAR_TEST_MAX_WORKERS=${ignoredValue} is not a positive integer; running ${workerLimit} workers\n`);

// INSTAR_TEST_PLATFORM_SPLIT splits a full run across hosts by the checked-in list of macOS-only
// test files: exclude-macos runs everything else (a Linux host), only-macos runs exactly the list
// (a Mac). A piece passes when both halves pass. Unset or empty runs everything; any other value
// refuses, so a typo never silently runs the wrong half.
const split = process.env.INSTAR_TEST_PLATFORM_SPLIT || undefined;
if (split !== undefined && split !== 'exclude-macos' && split !== 'only-macos')
  throw new Error(`INSTAR_TEST_PLATFORM_SPLIT must be exclude-macos or only-macos, not ${JSON.stringify(split)}`);
const macosOnly = split === undefined ? [] : readFileSync(new URL('./tests/platform/macos-only.txt', import.meta.url), 'utf8').split('\n')
  .map(line => line.replace(/#.*/, '').trim()).filter(Boolean);

// Only files with traced worker stalls / long child matrices or measured train-159
// timing sensitivity enter this lane. Provenance: docs/defects/vitest-worker-rpc-timeouts.md.
// One ordered project per file preserves fresh-process isolation; singleFork would reuse
// process globals. Built-in group ordering avoids lock waiters consuming worker slots.
export const serialFixtureFiles = [
  'tests/preview/stage2-recovery.test.ts',
  'tests/e2e/transport-loop-a1.test.ts',
  'tests/e2e/transport-loop-a1-repair18.test.ts',
  'tests/e2e/transport-loop-a1-repair19.test.ts',
  'tests/e2e/transport-loop-a1-repair20.test.ts',
  'tests/e2e/transport-loop-a1-repair25.test.ts',
  'tests/e2e/transport-loop-a1-repair27.test.ts',
  'tests/e2e/transport-loop-a1-repair28.test.ts',
  'tests/e2e/register.test.ts',
  'tests/e2e/harness-adapters-round9-regression.test.ts',
  'tests/e2e/harness-adapters-round12-regression.test.ts',
  'tests/conversation/telegram.round24.integration.test.ts',
  'tests/assembly/provider-response-evidence.test.ts',
  'tests/assembly/fixed-installation-peer.test.ts',
];
const include = split === 'only-macos' ? macosOnly : ['tests/**/*.test.ts'];
const exclude = split === 'exclude-macos' ? [...configDefaults.exclude, ...macosOnly] : [...configDefaults.exclude];
const shared = {
  // nice-worker: best-effort priority reduction for each worker and its spawned children
  // (a resource optimization, never a correctness gate). yield-worker: an awaited
  // event-loop turn after every test case so the fork worker's task-update IPC can be
  // answered between synchronous cases — the structural remedy for the runner's fixed
  // 60s RPC deadline, which serialization and priority alone do not cure.
  // conversation-owners: each test file's runner children claim conversations in their own
  // temporary directory, never the real host directory (Rule 63 fence).
  // bound-children: give every synchronous child-process call a finite bound, so a child that
  // blocks forever fails its own test instead of freezing the whole run (2026-10-05: one
  // intake harness child sat at 0% CPU for 54 minutes and the full suite waited on it).
  setupFiles: ['tests/setup/nice-worker.mjs', 'tests/setup/yield-worker.mjs', 'tests/setup/conversation-owners.mjs',
    'tests/setup/bound-children.mjs'],
  pool: 'forks' as const,
  isolate: true,
  // Full-gate workers run at reduced priority and exercise durable multi-owner
  // histories. Keep the runner deadline above the observed boundary so valid
  // serialized tests are not reported as semantic failures under load.
  // 2026-10-04 (cint-L50 gate at 67544546): six cases that take 0.1-1.4 s in
  // isolation were reported as timed out at 10.2-38.0 s under this gate's six
  // fork workers. Five of the six have synchronous bodies, so the 10 s timer
  // could not fire until the starved body yielded: the verdict is a timeout and
  // the reported duration is the real body time. Sized to 2.4x the worst such
  // duration seen (38.0 s), the margin convention recorded in
  // docs/defects/full-suite-load-timeouts.md. Every case that needs a tighter or
  // wider bound still declares its own.
  testTimeout: 90_000,
};

export default defineConfig({
  test: {
    ...shared,
    include,
    exclude,
    // Root setup runs once before any project: every fork/child inherits the same
    // per-run RAM-backed scratch directory. Real-disk qualification stays opt-in.
    globalSetup: ['tests/setup/runtime.ts', 'tests/setup/test-tmp.ts'],
    fileParallelism: !serialGate,
    minWorkers: 1,
    maxWorkers: serialGate ? 1 : workerLimit,
    projects: [
      { test: { ...shared, name: 'parallel', include, exclude: [...exclude, ...serialFixtureFiles],
        sequence: { groupOrder: 0 } } },
      ...serialFixtureFiles.map((file, index) => ({ test: { ...shared, name: file,
        include: split === 'only-macos' && !macosOnly.includes(file) ? [] : [file], exclude,
        sequence: { groupOrder: index + 1 } } })),
    ],
  },
});
