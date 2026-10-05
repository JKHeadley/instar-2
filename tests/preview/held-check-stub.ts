// Plan #507: every outward tool call the admission hook decides first asks the runner's held-secret check (the turn's
// runner socket, tool-turn.mjs serveTurnSocket) and is refused when no check answers. Tests that drive the real hook
// with a hand-built configuration and are not about held values point it at this stand-in runner, which answers every
// check `clear`. It runs in its own process because those tests run the hook under spawnSync, which blocks this one.
// Held values themselves are proven against the runner's real check in held-egress.test.ts.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function startClearHeldCheck(): Promise<{ path: string; stop(): void }> {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'hc-')));
  const path = join(dir, 's');
  const child = spawn(process.execPath, ['-e', `require('node:net').createServer({ allowHalfOpen: true }, c => { c.on('data', () => {});
    c.on('end', () => c.end('clear')); }).listen(${JSON.stringify(path)})`], { stdio: 'ignore' });
  for (let i = 0; i < 300 && !existsSync(path); i++) await new Promise(done => setTimeout(done, 10));
  if (!existsSync(path)) throw Error('the stand-in held-secret check did not start');
  // Stopped by its exact process id, never by pattern.
  return { path, stop: () => { if (child.pid !== undefined && child.exitCode === null) process.kill(child.pid); rmSync(dir, { recursive: true, force: true }); } };
}
