import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

type ChildResult = Readonly<{
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}>;

const worker = join(process.cwd(), 'node_modules/.bin/vite-node');

function asyncWorker(script: string, args: string[]): Promise<ChildResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(worker, [script, ...args], { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function waitFor(path: string) {
  const limit = Date.now() + 20_000;
  while (Date.now() < limit) {
    try { readFileSync(path); return; } catch { /* barrier not created yet */ }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${path}`);
}

const base = {
  type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'state:r7:race',
  adapter: 'native', machine: 'machine-a', revision: 0,
  maxHandles: 0, maxAttempts: 4, maxEvents: 0, maxCaptureBytes: 0,
  handles: [], attempts: [], events: [],
};

it('A2-E2E R7-A2-R5-01 P13-NF-24 P13-NF-28 P13-NF-38 P13-NF-39 dead-writer recovery atomically claims the exact lock and acknowledges only one successor', async () => {
  const root = mkdtempSync(join(tmpdir(), 'p13-a2-r7-race-'));
  const script = 'tests/harness-adapters/a2-round7-recovery-race-worker.ts';
  writeFileSync(join(root, 'state.json'), JSON.stringify(base));
  const seed = spawnSync(worker, [script, 'seed', root], { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000 });
  expect(seed.signal, seed.stderr).toBe('SIGKILL');

  const b = asyncWorker(script, ['b', root]);
  await waitFor(join(root, 'b-at-claim'));
  const a = asyncWorker(script, ['a', root]);
  const [aResult, bResult] = await Promise.all([a, b]);
  expect(aResult, aResult.stderr).toMatchObject({ code: 0, signal: null });
  expect(bResult, bResult.stderr).toMatchObject({ code: 0, signal: null });
  const outcomes = [JSON.parse(aResult.stdout), JSON.parse(bResult.stdout)];
  expect(outcomes.filter(row => row.state === 'saved')).toHaveLength(1);
  expect(outcomes.filter(row => row.state === 'refused')).toHaveLength(1);
  const final = JSON.parse(readFileSync(join(root, 'state.json'), 'utf8'));
  expect(final.revision).toBe(1);
  expect(final.attempts).toHaveLength(1);
  expect(final.attempts[0].operation).toBe(outcomes.find(row => row.state === 'saved').operation);

  const control = join(root, 'control');
  mkdirSync(control);
  writeFileSync(join(control, 'state.json'), JSON.stringify(base));
  const controlSeed = spawnSync(worker, [script, 'seed', control], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
  });
  expect(controlSeed.signal, controlSeed.stderr).toBe('SIGKILL');
  const recovered = spawnSync(worker, [script, 'control', control], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
  });
  expect(recovered.status, recovered.stderr).toBe(0);
  expect(JSON.parse(recovered.stdout)).toMatchObject({ state: 'saved', staleWrite: 'refused' });
}, 30_000);

it('A2-E2E R7-A2-R5-02 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 poison evidence loss stays unresolved after final-fsync SIGKILL and older-prefix reconstruction', () => {
  const script = 'tests/harness-adapters/a2-round7-poison-cut-worker.ts';
  let scenarios = 0;
  for (const cut of ['none', 'final-fsync'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r7-poison-${cut}-`));
    const seeded = spawnSync(worker, [script, 'seed', cut, directory, 'control', 'full'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
    });
    expect(seeded.signal, seeded.stderr).toBe(cut === 'final-fsync' ? 'SIGKILL' : null);
    expect(seeded.status, seeded.stderr).toBe(cut === 'final-fsync' ? null : 0);

    for (const history of ['full', 'older'] as const) for (const loss of ['control', 'conflict', 'nine-witness'] as const) {
      const recovered = spawnSync(worker, [script, 'recover', cut, directory, loss, history], {
        cwd: process.cwd(), encoding: 'utf8', timeout: 30_000,
      });
      expect(recovered.status, recovered.stderr).toBe(0);
      const result = JSON.parse(recovered.stdout);
      if (history === 'full' && loss === 'control') {
        expect(result.before).toMatchObject({ state: 'poisoned' });
        expect(result.after).toMatchObject({ state: 'poisoned' });
      } else {
        expect(result.after, `${cut}/${history}/${loss}`).toMatchObject({ state: 'unknown' });
      }
      expect(result.reconnect, `${cut}/${history}/${loss}`)
        .toMatchObject({ disposition: 'refused', handle: null });
      scenarios++;
    }
  }
  expect(scenarios).toBe(12);
}, 60_000);
