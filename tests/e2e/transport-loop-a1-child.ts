import { spawn } from 'node:child_process';

/** Async child run for the A1 fresh-process e2e files. Each child is a whole nested vitest run that can take
 * over 60 s under load; a blocking spawnSync froze this worker's event loop for that long, so its onTaskUpdate
 * RPC to the main process timed out (docs/defects/vitest-worker-rpc-timeouts.md). Same result shape as spawnSync. */
export const runChildAsync = (args: readonly string[], env: NodeJS.ProcessEnv, timeout: number) =>
  new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', status => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
  });
