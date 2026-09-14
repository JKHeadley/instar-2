import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const worker = './scripts/test-support/conditional-append-adversarial-worker.mjs';
const args = ['--loader', './scripts/slice-ts-loader.mjs', worker];

interface WorkerResult {
  readonly readCalls?: number;
  readonly currentCalls?: number;
  readonly stopIssued?: boolean;
  readonly stopped?: boolean;
  readonly outcome?: { readonly kind: string; readonly detail?: string };
  readonly rows?: readonly { readonly id: string; readonly adapter: string; readonly mode: string; readonly fact: string }[];
}

function run(command: 'init' | 'append' | 'read', directory: string,
  options: Readonly<Record<string, unknown>> = {}): WorkerResult {
  const child = spawnSync(process.execPath, [...args, command, directory, JSON.stringify(options)], {
    encoding: 'utf8', timeout: 60_000,
  });
  expect(child.status, child.stderr).toBe(0);
  return JSON.parse(child.stdout.trim().split('\n').at(-1)!) as WorkerResult;
}

function launch(directory: string, options: Readonly<Record<string, unknown>>) {
  const child = spawn(process.execPath, [...args, 'append', directory, JSON.stringify(options)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', value => { stdout += value; });
  child.stderr.on('data', value => { stderr += value; });
  const done = new Promise<{ readonly status: number | null; readonly stderr: string; readonly data: WorkerResult | undefined }>(resolve =>
    child.once('close', status => resolve({ status, stderr,
      data: stdout.trim() ? JSON.parse(stdout.trim().split('\n').at(-1)!) as WorkerResult : undefined })));
  return done;
}

async function waitFor(path: string, timeout = 60_000): Promise<void> {
  const started = Date.now();
  while (!existsSync(path)) {
    if (Date.now() - started > timeout) throw new Error(`timed out waiting for ${path}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

const readRaces = ([1, 2, 3] as const).flatMap(pauseRead => ([false, true] as const).flatMap(unrelated =>
  (['webhook', 'long-poll'] as const).map(role => ({
    pauseRead,
    unrelated,
    role,
    id: `read-${pauseRead}-${unrelated ? 'unrelated' : 'same'}-${role}`,
  }))));

it.each(readRaces)(
  'P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:read-window-race] $id',
  async ({ pauseRead, unrelated, role }) => {
    const directory = mkdtempSync(join(tmpdir(), 'p10-conditional-read-race-'));
    run('init', directory);
    const paused = launch(directory, { role, id: 'paused', pauseRead });
    const release = join(directory, 'read-pause');
    await waitFor(`${release}.ready`);
    const winner = run('append', directory, {
      role: role === 'webhook' ? 'long-poll' : 'webhook',
      id: 'interloper',
      adapter: unrelated ? 'other' : 'telegram:v1:bot:99',
    });
    writeFileSync(release, 'go');
    const resumed = await paused;
    const fresh = run('read', directory);

    expect(winner.outcome?.kind).toBe('Success');
    expect(resumed.status, resumed.stderr).toBe(0);
    if (unrelated) {
      expect(resumed.data?.outcome?.kind).toBe('Success');
      expect(fresh.rows).toHaveLength(2);
    } else {
      expect(resumed.data?.outcome?.kind).toBe('Refused');
      expect(fresh.rows).toHaveLength(1);
      expect(resumed.data?.outcome?.detail).toContain('conditional append subject frontier changed; current=');
      expect(resumed.data?.outcome?.detail).toContain(fresh.rows?.[0]?.fact);
    }
  },
  60_000,
);

const stopSchedules = ([false, true] as const).flatMap(replay => ([1, 2, 3, 4, 5] as const).map(stopCall => ({
  replay,
  stopCall,
  id: `stop-call-${stopCall}-${replay ? 'replay' : 'new'}`,
  evidence: replay && stopCall === 3 ? '[case:replay-stop]' : '[case:stop-read-schedule]',
})));

it.each(stopSchedules)(
  'P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] $evidence $id',
  ({ replay, stopCall }) => {
    const directory = mkdtempSync(join(tmpdir(), 'p10-conditional-stop-read-'));
    run('init', directory);
    if (replay) expect(run('append', directory).outcome?.kind).toBe('Success');
    const result = run('append', directory, { stopCall });
    const fresh = run('read', directory);

    if (result.stopIssued) {
      expect(result.outcome?.kind).toBe('Refused');
      expect(result.outcome?.detail).toBe('stop inhibits new assembly work');
    }
    expect(fresh.rows).toHaveLength(replay ? 1 : 0);
  },
  60_000,
);
