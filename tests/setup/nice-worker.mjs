// TEST-INFRASTRUCTURE (scope exception, REPAIR5): nice each vitest WORKER process, so
// every CPU-heavy fresh-process/SIGKILL child it spawns (part five rungraph, part two
// durability, part seven/eight cuts, the slice harness) INHERITS reduced OS priority.
// On a 2-core CI runner those children saturate both cores and starve the vitest MAIN
// process past its fixed 60s worker-RPC deadline ("Timeout calling onTaskUpdate"); a
// kill-schedule file split alone did not cure it because the starvation is suite-wide.
// The MAIN process stays at nice 0, so under saturation the scheduler keeps servicing its
// RPC while the niced worker subtree yields. This is a scheduler-priority tweak only —
// the workers and their children run the identical code with identical results; nothing
// about test semantics changes. Best-effort: any failure (e.g. an unsupported platform)
// leaves priority unchanged rather than breaking the run.
import { setPriority } from 'node:os';

try { setPriority(0, 10); } catch { /* priority is an optimization, never a correctness gate */ }
