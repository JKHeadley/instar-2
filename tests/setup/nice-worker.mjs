// TEST-INFRASTRUCTURE (scope exception, REPAIR5): nice each vitest WORKER process, so
// every CPU-heavy fresh-process/SIGKILL child it spawns (part five rungraph, part two
// durability, part seven/eight cuts, the slice harness) INHERITS reduced OS priority.
// Best-effort resource optimization: under CPU saturation the scheduler keeps servicing
// the un-niced vitest MAIN process while the niced worker subtree yields. It is NOT the
// remedy for the runner's "Timeout calling onTaskUpdate": that deadline is answered by
// the worker's own event loop reaching its I/O phase (tests/setup/yield-worker.mjs), and
// the worker count bound in vitest.config.ts limits resource pressure. Resource contention
// and worker starvation can coexist, so all three are retained. This is a scheduler-
// priority tweak only — workers and children run identical code with identical results;
// nothing about test semantics changes. Any failure (e.g. an unsupported platform)
// leaves priority unchanged rather than breaking the run.
import { setPriority } from 'node:os';

try { setPriority(0, 10); } catch { /* priority is an optimization, never a correctness gate */ }
