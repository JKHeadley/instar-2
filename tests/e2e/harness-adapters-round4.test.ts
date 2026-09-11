import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, it } from 'vitest';

type WorkerResult = Readonly<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }>;

function run(mode: 'seed' | 'recover', cut: string, path: string): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(join(process.cwd(), 'node_modules/.bin/vite-node'),
      ['tests/harness-adapters/round4-storage-cut-worker.ts', mode, cut, path], { cwd: process.cwd() });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += String(bytes); });
    child.stderr.on('data', bytes => { stderr += String(bytes); });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function initial(path: string): void {
  writeFileSync(path, `${JSON.stringify({ type: 'HarnessAdapterStateSnapshot', schemaVersion: 1,
    id: 'state:storage-cut', adapter: 'adapter:claude-code', machine: 'machine-a', revision: 0,
    maxHandles: 4, maxAttempts: 4, maxEvents: 4, maxCaptureBytes: 32,
    handles: [], attempts: [], events: [] })}\n`);
}

it.each(['lock', 'write', 'fsync', 'rename', 'unlink'])('R4-F6 storage cut at %s recovers a valid successor after proving the writer dead', async cut => {
  const directory = mkdtempSync(join(tmpdir(), `p13-storage-${cut}-`));
  const path = join(directory, 'state.json');
  initial(path);
  const killed = await run('seed', cut, path);
  expect(killed.signal).toBe('SIGKILL');

  const recovered = await run('recover', cut, path);
  expect(recovered, recovered.stderr).toMatchObject({ code: 0, signal: null });
  expect(JSON.parse(recovered.stdout)).toMatchObject({ status: 'saved', revision: cut === 'lock' ? 1 : 2 });
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ revision: cut === 'lock' ? 1 : 2 });
}, 20_000);

it('R4-F6 uninterrupted storage remains an exact one-revision transition', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'p13-storage-control-'));
  const path = join(directory, 'state.json');
  initial(path);
  expect(JSON.parse((await run('recover', 'control', path)).stdout)).toMatchObject({ status: 'saved', revision: 1 });
  expect(JSON.parse((await run('recover', 'control', path)).stdout)).toMatchObject({ status: 'saved', revision: 2 });
});
