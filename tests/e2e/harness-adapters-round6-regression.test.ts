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

function run(mode: 'seed' | 'recover', scenario: string, history: 'full' | 'older',
  directory: string): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(join(process.cwd(), 'node_modules/.bin/vite-node'),
      ['tests/harness-adapters/a2-round6-cut-worker.ts', mode, scenario, history, directory],
      { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

for (const scenario of ['input-accepted', 'probe-failed', 'process-exited', 'fact-closure'] as const) {
  it(`A2-E2E R6-F01 R6-F02 P13-NF-24 P13-NF-25 P13-NF-28 P13-NF-29 P13-NF-32 P13-NF-33 P13-NF-34 P13-NF-38 P13-NF-46 ${scenario} survives SIGKILL after final directory fsync and real older-prefix reconstruction`, async () => {
    const root = mkdtempSync(join(tmpdir(), `p13-a2-r6-${scenario}-`));
    const directory = join(root, 'final-fsync');
    mkdirSync(directory);
    const seeded = await run('seed', scenario, 'full', directory);
    expect(seeded, seeded.stderr).toMatchObject({ code: null, signal: 'SIGKILL' });

    const full = await run('recover', scenario, 'full', directory);
    expect(full, full.stderr).toMatchObject({ code: 0, signal: null });
    const fullResult = JSON.parse(full.stdout);
    if (scenario === 'fact-closure') {
      expect(fullResult).toMatchObject({ completion: { state: 'complete' } });
    } else {
      expect(fullResult.completion).toMatchObject({ state: 'pending' });
      expect(fullResult.liveness).toMatchObject({ state: scenario === 'input-accepted'
        ? 'live' : scenario === 'probe-failed' ? 'unknown' : 'dead' });
    }

    const older = await run('recover', scenario, 'older', directory);
    expect(older, older.stderr).toMatchObject({ code: 0, signal: null });
    const olderResult = JSON.parse(older.stdout);
    if (scenario === 'fact-closure') {
      expect(olderResult.completion).toMatchObject({ state: 'unknown' });
    } else {
      expect(olderResult.completion).toMatchObject({ state: 'pending' });
      expect(olderResult.liveness).toMatchObject({ state: scenario === 'input-accepted' ? 'live' : 'unknown' });
    }
  }, 20_000);
}
