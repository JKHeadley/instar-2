import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
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

function lastJson(stdout: string): { kind?: string; detail?: string; rows?: readonly unknown[] } {
  const line = stdout.trim().split('\n').filter(row => row.startsWith('{')).at(-1);
  if (!line) throw new Error(`worker produced no JSON: ${stdout}`);
  return JSON.parse(line) as { kind?: string; detail?: string; rows: readonly unknown[] };
}

function childResult(child: ReturnType<typeof spawn>): Promise<{ status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  let stdout = '', stderr = '';
  child.stdout!.on('data', value => { stdout += value; });
  child.stderr!.on('data', value => { stderr += value; });
  return new Promise(resolve => child.once('exit', (status, signal) => resolve({ status, signal, stdout, stderr })));
}

function runWorker(directory: string, mode: 'attempt' | 'read', options: Readonly<Record<string, unknown>> = {}) {
  const child = spawnSync(process.execPath, [...args, mode, directory, '', '', JSON.stringify(options)],
    { encoding: 'utf8', timeout: 30_000 });
  expect(child.status, child.stderr).toBe(0);
  return lastJson(child.stdout);
}

it('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:held-lock-contention] production-held file lock returns a subject-scoped current frontier and preserves one winner', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'p10-conditional-held-lock-'));
  assemblyRuntimeFixture(f => createTransportFileStorage(directory, <T>(run: () => T) => f.success(run())));
  const marker = join(directory, 'held.ready');
  const writer = spawn(process.execPath, [...args, 'cut', directory, 'before-write', marker], { stdio: ['ignore', 'pipe', 'pipe'] });
  let writerStderr = '';
  writer.stderr!.on('data', value => { writerStderr += value; });
  const writerExited = new Promise<number | null>(resolve => writer.once('exit', resolve));
  await waitFor(marker);

  const contender = spawnSync(process.execPath, [...args, 'attempt', directory], { encoding: 'utf8', timeout: 30_000 });
  expect(contender.status, contender.stderr).toBe(0);
  const refusal = lastJson(contender.stdout);
  expect(refusal.kind).toBe('Refused');
  expect(refusal.detail).toContain('conditional append physical storage contended; current=');
  expect(refusal.detail).toContain('AdapterConformance');
  expect(refusal.detail).toContain('telegram:v1:bot:99');
  expect(refusal.rows).toHaveLength(0);

  unlinkSync(marker);
  expect(await writerExited, writerStderr).toBe(0);
  const read = spawnSync(process.execPath, [...args, 'read', directory], { encoding: 'utf8', timeout: 30_000 });
  expect(read.status, read.stderr).toBe(0);
  expect(lastJson(read.stdout).rows).toEqual([
    { id: 'conformance:cut', adapter: 'telegram:v1:bot:99', mode: 'webhook' },
  ]);
}, 30_000);

it.each([
  ['same-subject', 'telegram:v1:bot:99'],
  ['other-subject', 'telegram:v1:bot:other'],
] as const)('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:held-lock-contention] held-lock-exact-nonempty-current-%s names only the committed target frontier', async (_caseId, writerAdapter) => {
  const directory = mkdtempSync(join(tmpdir(), `p10-conditional-held-nonempty-${_caseId}-`));
  assemblyRuntimeFixture(f => createTransportFileStorage(directory, <T>(run: () => T) => f.success(run())));
  expect(runWorker(directory, 'attempt', { id: 'conformance:baseline', candidateMode: 'baseline' })).toMatchObject({ kind: 'Success' });
  const readBaseline = runWorker(directory, 'read');
  const baseline = readBaseline.rows as Array<{ id: string }>;
  expect(baseline).toHaveLength(1);

  const marker = join(directory, 'held.ready');
  const writer = spawn(process.execPath, [...args, 'cut', directory, 'before-write', marker,
    JSON.stringify({ id: 'conformance:writer', adapter: writerAdapter, candidateMode: 'writer' })], { stdio: ['ignore', 'pipe', 'pipe'] });
  const writerDone = childResult(writer);
  await waitFor(marker);
  const contender = runWorker(directory, 'attempt', { id: 'conformance:loser', candidateMode: 'loser' });
  expect(contender.kind).toBe('Refused');
  const detail = String(contender.detail);
  expect(detail).toContain('conditional append physical storage contended; current=');
  const current = JSON.parse(detail.split('current=')[1]!) as { subject: { value: string }; facts: string[] };
  expect(current.subject.value).toBe('telegram:v1:bot:99');
  expect(current.facts).toHaveLength(1);

  unlinkSync(marker);
  const completed = await writerDone;
  expect(completed.status, completed.stderr).toBe(0);
  expect(runWorker(directory, 'read').rows).toHaveLength(2);
}, 30_000);

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
  if (expectedRows) expect(rows?.[0]).toEqual({ id: 'conformance:cut', adapter: 'telegram:v1:bot:99', mode: 'webhook' });
}, 30_000);

it.each(cuts.flatMap(cut => (['webhook', 'long-poll'] as const).map(winnerMode => [cut, winnerMode] as const)))(
  'P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] live competing admission survives SIGKILL at %s with %s winner mode', async (cut, winnerMode) => {
    const directory = mkdtempSync(join(tmpdir(), `p10-conditional-race-cut-${winnerMode}-${cut}-`));
    assemblyRuntimeFixture(f => createTransportFileStorage(directory, <T>(run: () => T) => f.success(run())));
    const loserMode = winnerMode === 'webhook' ? 'long-poll' : 'webhook';
    const loserRelease = join(directory, 'loser');
    const loser = spawn(process.execPath, [...args, 'gate', directory, '', loserRelease,
      JSON.stringify({ id: `conformance:${loserMode}`, candidateMode: loserMode })], { stdio: ['ignore', 'pipe', 'pipe'] });
    const loserDone = childResult(loser);
    await waitFor(`${loserRelease}.ready`);

    const winnerMarker = join(directory, 'winner.ready');
    const winner = spawn(process.execPath, [...args, 'cut', directory, cut, winnerMarker,
      JSON.stringify({ id: `conformance:${winnerMode}`, candidateMode: winnerMode })], { stdio: ['ignore', 'pipe', 'pipe'] });
    const winnerDone = childResult(winner);
    await waitFor(winnerMarker);

    writeFileSync(loserRelease, 'go');
    const refused = await loserDone;
    expect(refused.status, refused.stderr).toBe(0);
    const refusal = lastJson(refused.stdout);
    expect(refusal.kind).toBe('Refused');
    expect(refusal.detail).toContain('current=');

    winner.kill('SIGKILL');
    const killed = await winnerDone;
    expect(killed.signal, killed.stderr).toBe('SIGKILL');
    const rows = runWorker(directory, 'read').rows as Array<{ id: string; adapter: string; mode: string }>;
    const expectedRows = cuts.indexOf(cut) >= cuts.indexOf('after-rename') ? 1 : 0;
    expect(rows).toHaveLength(expectedRows);
    if (expectedRows) expect(rows[0]).toEqual({ id: `conformance:${winnerMode}`, adapter: 'telegram:v1:bot:99', mode: winnerMode });
  }, 30_000,
);
