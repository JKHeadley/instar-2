import { existsSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
// @ts-expect-error The physical file adapter is an executable JavaScript boundary.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';

const worker = './tests/e2e/assembly-conditional-append-worker.ts';
const args = ['--loader', './scripts/slice-ts-loader.mjs', worker];
const cuts = [
  'before-write', 'after-write', 'before-fsync', 'after-fsync',
  'before-rename', 'after-rename', 'before-directory-sync', 'after-directory-sync',
] as const;

function waitFor(path: string, timeout = 10_000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (existsSync(path)) resolve();
      else if (Date.now() - started >= timeout) reject(new Error(`timed out waiting for ${path}`));
      else setTimeout(poll, 10);
    };
    poll();
  });
}

function lastJson(stdout: string): { rows: readonly unknown[] } {
  const line = stdout.trim().split('\n').filter(row => row.startsWith('{')).at(-1);
  if (!line) throw new Error(`worker produced no JSON: ${stdout}`);
  return JSON.parse(line) as { rows: readonly unknown[] };
}

it.each(cuts)('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] production initialization survives SIGKILL at %s on the real Two/Ten file path', async cut => {
  const directory = mkdtempSync(join(tmpdir(), `p10-conditional-${cut}-`));
  assemblyRuntimeFixture(f => createTransportFileStorage(directory, <T>(run: () => T) => f.success(run())));
  const marker = join(directory, 'cut.ready');
  const child = spawn(process.execPath, [...args, 'cut', directory, cut, marker], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr!.on('data', value => { stderr += value; });
  await waitFor(marker);
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve =>
    child.once('exit', (code, signal) => resolve({ code, signal })));
  child.kill('SIGKILL');
  const killed = await exited;
  expect(killed.signal, stderr).toBe('SIGKILL');

  const read = spawnSync(process.execPath, [...args, 'read', directory], { encoding: 'utf8', timeout: 30_000 });
  expect(read.status, read.stderr).toBe(0);
  const expectedRows = cuts.indexOf(cut) >= cuts.indexOf('after-rename') ? 1 : 0;
  const rows = lastJson(read.stdout).rows;
  expect(rows).toHaveLength(expectedRows);
  if (expectedRows) expect(rows[0]).toEqual({ id: 'conformance:cut', adapter: 'telegram:v1:bot:99', mode: 'webhook' });
}, 30_000);
