// Shared TEST-INFRASTRUCTURE helper (scope exception, astra/CI REPAIR5): spawn a test's
// node CHILD at reduced OS priority. The e2e/integration harnesses across parts spawn
// CPU-heavy fresh-process/SIGKILL children; on a 2-core CI runner a child's threads
// (V8 GC/compile, libuv) saturate BOTH cores and starve the vitest MAIN process past its
// fixed 60s worker-RPC deadline ("Timeout calling onTaskUpdate"). Reduced priority keeps
// the main process (nice 0) schedulable so it services the RPC under full saturation. The
// child is otherwise byte-for-byte the SAME node invocation — same argv, stdin, env, cwd —
// so this is a mechanical wrapper with ZERO semantic change.
//
// The PRIMARY mechanism is `tests/setup/nice-worker.mjs`: it nices each vitest WORKER, so
// every child spawned inside a worker inherits reduced priority with no callsite change.
// This helper covers the ONE spawn path that runs OUTSIDE the worker pool — the
// kill-schedule pre-step's children — and is a deliberate no-op when the caller is already
// niced (an in-worker slice spawn), so a child is never double-niced.
import { getPriority } from 'node:os';

export const CHILD_NICE = 10;

/**
 * @param {readonly string[]} args argv for the node child (everything after the binary).
 * @returns {[string, string[]]} the [command, argv] pair to spawn.
 */
export function nicedNode(args) {
  const argv = [...args];
  // `nice` is POSIX (present on the Linux CI runners and macOS). Elsewhere (win32),
  // spawn node directly — the priority tweak is a CI-scheduler optimization, not
  // behaviour, so its absence only forgoes the optimization.
  if (process.platform === 'win32') return [process.execPath, argv];
  // Already niced (a vitest worker): the child inherits it; don't stack another increment.
  let current = 0;
  try { current = getPriority(); } catch { current = 0; }
  if (current >= CHILD_NICE) return [process.execPath, argv];
  return ['nice', ['-n', String(CHILD_NICE), process.execPath, ...argv]];
}
