import { spawn } from 'node:child_process';
import { clearTimeout, setTimeout } from 'node:timers';

export type ChildResult = { status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string };

/** The async counterpart of spawnSync for e2e child runs. A blocking spawnSync freezes the fork
 * worker's event loop for the whole child, so a case running many children starves Vitest's
 * task-update RPC past its fixed 60s deadline (docs/defects/vitest-worker-rpc-timeouts.md).
 * Same result shape as spawnSync. A timeout remains non-success even if the child handles
 * SIGTERM by exiting zero; a child ignoring it is killed by its exact PID after one second. */
export function runChild(command: string, args: readonly string[],
  options: { cwd?: string | undefined; env?: NodeJS.ProcessEnv | undefined; timeout?: number | undefined;
    input?: string | undefined; encoding?: 'utf8' | undefined } = {}): Promise<ChildResult> {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') fail(error); });
    child.stdin.end(options.input);
    let timedOut = false;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const timer = options.timeout === undefined ? undefined : setTimeout(() => {
      timedOut = true; child.kill('SIGTERM');
      escalation = setTimeout(() => child.kill('SIGKILL'), 1000);
    }, options.timeout);
    child.on('error', error => { clearTimeout(timer); clearTimeout(escalation); fail(error); });
    child.on('close', (status, signal) => { clearTimeout(timer); clearTimeout(escalation); done({ status: timedOut ? null : status, signal, stdout,
      stderr: timedOut ? `${stderr}[timed out after ${options.timeout} ms]` : stderr }); });
  });
}
