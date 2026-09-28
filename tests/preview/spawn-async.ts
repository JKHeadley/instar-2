// TEST-INFRASTRUCTURE: an asynchronous spawnSync twin. A long synchronous child blocks the Vitest fork worker's
// event loop, so its task-update RPC to the main process misses birpc's fixed 60s deadline ("Timeout calling
// onTaskUpdate") on a loaded host even though every assertion passes. Awaiting the child keeps the worker's loop
// turning. Same result shape as spawnSync with an encoding (text stdout/stderr), plus the raw stdout bytes.
import { spawn } from 'node:child_process';
import type { SpawnOptions } from 'node:child_process';

export interface SpawnAsyncResult {
  status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; stdoutBytes: Buffer; error?: Error;
}

export function spawnAsync(command: string, args: readonly string[],
  options: SpawnOptions & { input?: string | Buffer; timeout?: number; encoding?: 'utf8' } = {}): Promise<SpawnAsyncResult> {
  // Text output is always UTF-8 (the only encoding callers use); raw bytes are in stdoutBytes.
  const { input, timeout, encoding: _encoding, ...rest } = options;
  void _encoding;
  return new Promise<SpawnAsyncResult>(done => {
    const child = spawn(command, args, { ...rest, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [], err: Buffer[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null, settled = false;
    const finish = (status: number | null, signal: NodeJS.Signals | null, error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const stdoutBytes = Buffer.concat(out);
      done({ status, signal, stdout: stdoutBytes.toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), stdoutBytes,
        ...(error ? { error } : {}) });
    };
    child.stdout!.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr!.on('data', (chunk: Buffer) => err.push(chunk));
    child.once('error', (error: Error) => finish(null, null, error));
    child.once('close', (status, signal) => finish(status, signal));
    if (timeout) timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    if (input !== undefined) child.stdin!.end(input);
  });
}
