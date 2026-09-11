import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, it } from 'vitest';

function child(directory: string, who: string): Promise<{ status: string; detail?: string }> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(join(process.cwd(), 'node_modules/.bin/vite-node'),
      ['tests/harness-adapters/round3-cas-worker.ts', directory, who], { cwd: process.cwd() });
    let stdout = '', stderr = '';
    childProcess.stdout.on('data', bytes => { stdout += String(bytes); });
    childProcess.stderr.on('data', bytes => { stderr += String(bytes); });
    childProcess.on('error', reject);
    childProcess.on('exit', code => code === 0 ? resolve(JSON.parse(stdout) as { status: string; detail?: string })
      : reject(new Error(`CAS child ${who} exited ${code}: ${stderr}`)));
  });
}

it('R3-F3 P13-NF-24 two filesystem writers cannot both acknowledge one journal predecessor', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'p13-cas-'));
  const path = join(directory, 'state.json');
  writeFileSync(path, JSON.stringify({ type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'state:race',
    adapter: 'adapter:claude-code', machine: 'machine-a', revision: 0, maxHandles: 4, maxAttempts: 4,
    maxEvents: 0, maxCaptureBytes: 0, handles: [], attempts: [], events: [] }));
  const results = await Promise.all([child(directory, 'a'), child(directory, 'b')]);
  expect(results.filter(result => result.status === 'saved')).toHaveLength(1);
  expect(results.filter(result => result.status === 'refused')).toHaveLength(1);
  const final = JSON.parse(readFileSync(path, 'utf8')) as { revision: number; attempts: readonly unknown[] };
  expect(final).toMatchObject({ revision: 1 });
  expect(final.attempts).toHaveLength(1);
}, 20_000);
