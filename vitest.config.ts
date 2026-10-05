import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { configDefaults, defineConfig } from 'vitest/config';

// VITEST_SERIAL_GATE=1 is the exact serial comparator (one fork worker, no file
// parallelism) without editing source between evidence runs; the transitional FINAL
// landing gate and small hosts use it.
const serialGate = process.env.VITEST_SERIAL_GATE === '1';
// Bounded fork parallelism: half the available logical CPUs, capped at six (16 CPUs → 6,
// 4 → 2, 2 → 1). A conservative engineering starting point that bounds resource
// pressure, not a measured optimum for every runner.
const workerLimit = Math.max(1, Math.min(6, Math.floor(availableParallelism() / 2)));

// INSTAR_TEST_PLATFORM_SPLIT splits a full run across hosts by the checked-in list of macOS-only
// test files: exclude-macos runs everything else (a Linux host), only-macos runs exactly the list
// (a Mac). A piece passes when both halves pass. Unset or empty runs everything; any other value
// refuses, so a typo never silently runs the wrong half.
const split = process.env.INSTAR_TEST_PLATFORM_SPLIT || undefined;
if (split !== undefined && split !== 'exclude-macos' && split !== 'only-macos')
  throw new Error(`INSTAR_TEST_PLATFORM_SPLIT must be exclude-macos or only-macos, not ${JSON.stringify(split)}`);
const macosOnly = split === undefined ? [] : readFileSync(new URL('./tests/platform/macos-only.txt', import.meta.url), 'utf8').split('\n')
  .map(line => line.replace(/#.*/, '').trim()).filter(Boolean);

export default defineConfig({
  test: {
    include: split === 'only-macos' ? macosOnly : ['tests/**/*.test.ts'],
    exclude: split === 'exclude-macos' ? [...configDefaults.exclude, ...macosOnly] : configDefaults.exclude,
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
    // bound-children: give every synchronous child-process call a finite bound, so a child that
    // blocks forever fails its own test instead of freezing the whole run (2026-10-05: one
    // intake harness child sat at 0% CPU for 54 minutes and the full suite waited on it).
    setupFiles: ['tests/setup/nice-worker.mjs', 'tests/setup/yield-worker.mjs', 'tests/setup/conversation-owners.mjs',
      'tests/setup/bound-children.mjs'],
    pool: 'forks',
    isolate: true,
    fileParallelism: !serialGate,
    minWorkers: 1,
    maxWorkers: serialGate ? 1 : workerLimit,
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
  },
});
