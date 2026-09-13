import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, it } from 'vitest';

type WorkerResult = Readonly<{
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}>;

function run(scenario: 'frontier' | 'unknown-stream', mode: 'seed' | 'recover', cut: string,
  target: string, directory: string): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(join(process.cwd(), 'node_modules/.bin/vite-node'),
      ['tests/harness-adapters/a2-round5-cut-worker.ts', scenario, mode, cut, target, directory],
      { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', bytes => { stdout += String(bytes); });
    child.stderr.on('data', bytes => { stderr += String(bytes); });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

const cuts = ['none', 'lock', 'write', 'fsync:1', 'rename', 'fsync:2', 'unlink', 'fsync:3'] as const;

for (const target of ['probe-failed', 'process-exited'] as const) {
  it.each(cuts)(`A2-E2E R5-F01 P13-NF-29 P13-NF-33 P13-NF-38 P13-NF-46 ${target} equal-clock frontier survives %s cut`, async cut => {
    const root = mkdtempSync(join(tmpdir(), `p13-a2-r5-frontier-${target}-`));
    const directory = join(root, cut.replace(':', '-'));
    mkdirSync(directory);
    const seeded = await run('frontier', 'seed', cut, target, directory);
    expect(seeded.signal, seeded.stderr).toBe(cut === 'none' ? null : 'SIGKILL');
    expect(seeded.code, seeded.stderr).toBe(cut === 'none' ? 0 : null);
    const recovered = await run('frontier', 'recover', cut, target, directory);
    expect(recovered, recovered.stderr).toMatchObject({ code: 0, signal: null });
    expect(JSON.parse(recovered.stdout)).toMatchObject({ liveness: { state: 'unknown' } });
  }, 20_000);
}

it.each(cuts)('A2-E2E R5-F02 P13-NF-24 P13-NF-32 P13-NF-34 unknown stream survives %s cut without restoring old completion', async cut => {
  const root = mkdtempSync(join(tmpdir(), 'p13-a2-r5-unknown-stream-'));
  const directory = join(root, cut.replace(':', '-'));
  mkdirSync(directory);
  const seeded = await run('unknown-stream', 'seed', cut, 'heartbeat', directory);
  expect(seeded.signal, seeded.stderr).toBe(cut === 'none' ? null : 'SIGKILL');
  expect(seeded.code, seeded.stderr).toBe(cut === 'none' ? 0 : null);
  const recovered = await run('unknown-stream', 'recover', cut, 'heartbeat', directory);
  expect(recovered, recovered.stderr).toMatchObject({ code: 0, signal: null });
  expect(JSON.parse(recovered.stdout)).toMatchObject({ completion: { state: 'pending' } });
}, 20_000);
