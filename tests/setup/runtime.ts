// TEST-INFRASTRUCTURE: vitest globalSetup that refuses the whole run on a Node the suite
// cannot exercise, in one line, before any test starts. The production-boot, serving and
// run-admission proofs launch the shipped bin with `--experimental-transform-types`, and
// the register certifies the self-host tuple on node-24 only. A Node that no longer accepts
// that flag (Node 26 removed it) turned one gate into 41 misleading failures across
// unrelated files (cint-L6, 2026-09-29), so the runtime is checked here instead.
export const REQUIRED_NODE_FLAG = '--experimental-transform-types';

/** The refusal line for this runtime, or null when the suite can run on it. */
export function runtimeRefusal(allowedFlags: ReadonlySet<string>, version: string): string | null {
  return allowedFlags.has(REQUIRED_NODE_FLAG) ? null
    : `[instar tests] REFUSED: node ${version} does not accept ${REQUIRED_NODE_FLAG}, which the shipped-bin proofs need; `
      + 'run the suite on the certified node-24 runtime.';
}

export default function setup(): void {
  const refusal = runtimeRefusal(process.allowedNodeEnvironmentFlags, process.version);
  if (refusal !== null) throw new Error(refusal);
}
