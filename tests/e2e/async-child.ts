import { spawn } from 'node:child_process';
import { clearTimeout, setTimeout } from 'node:timers';

export type ChildResult = { status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string };

/** The async counterpart of spawnSync for e2e child runs. A blocking spawnSync freezes the fork
 * worker's event loop for the whole child, so a case running many children starves Vitest's
 * task-update RPC past its fixed 60s deadline (docs/defects/vitest-worker-rpc-timeouts.md).
 * Same result shape as spawnSync; a timeout sends SIGTERM exactly as spawnSync's does. */
export function runChild(command: string, args: readonly string[],
  options: { cwd?: string | undefined; env?: NodeJS.ProcessEnv | undefined; timeout?: number | undefined } = {}): Promise<ChildResult> {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    const timer = options.timeout === undefined ? undefined : setTimeout(() => child.kill('SIGTERM'), options.timeout);
    child.on('error', error => { clearTimeout(timer); fail(error); });
    child.on('close', (status, signal) => { clearTimeout(timer); done({ status, signal, stdout, stderr }); });
  });
}
