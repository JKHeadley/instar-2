/** The `execute` contract a confined provider route is built against, run directly on this host.
 * Used where the shipped limit shim cannot apply its declared process limit (a host whose /bin/sh
 * has no `ulimit -u`): that shim correctly refuses rather than skipping a limit, which would make a
 * route case a test of the host's shell. Everything the route depends on is honoured here — the
 * exact executable, a closed environment, a fixed working directory, stdin, the timeout and the
 * byte bound — and nothing else is granted. */
import { spawn } from 'node:child_process';

export function directExecute(input: Readonly<{ executable: string; args: readonly string[]; cwd: string;
  env: Readonly<Record<string, string>>; stdin: string; timeout: number; maxBytes: number }>):
  Promise<Readonly<{ code: number | null; limited: boolean; stdout: string; stdoutBytes: Uint8Array }>> {
  return new Promise(resolve => {
    const child = spawn(input.executable, [...input.args], { cwd: input.cwd, env: { ...input.env },
      stdio: ['pipe', 'pipe', 'ignore'] });
    let chunks: Buffer[] = [], size = 0, limited = false;
    const settle = (code: number | null) => {
      const bytes = Buffer.concat(chunks);
      resolve({ code: limited ? null : code, limited, stdout: bytes.toString('utf8'), stdoutBytes: new Uint8Array(bytes) });
    };
    const fail = () => { limited = true; chunks = []; try { child.kill('SIGKILL'); } catch { /* already gone */ } };
    const timer = setTimeout(fail, input.timeout);
    child.on('error', () => { clearTimeout(timer); settle(null); });
    child.stdin.on('error', fail);
    child.stdout.on('data', (chunk: Buffer) => { size += chunk.length; if (size > input.maxBytes) fail(); else if (!limited) chunks.push(chunk); });
    child.on('close', code => { clearTimeout(timer); settle(code); });
    child.stdin.end(input.stdin);
  });
}
