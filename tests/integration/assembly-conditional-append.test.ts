import { existsSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
// @ts-expect-error The physical file adapter is an executable JavaScript boundary.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';
import { assemblyRuntimeFixture } from '../assembly/runtime-fixture.js';

const worker = './tests/integration/assembly-conditional-append-worker.ts';
const args = ['--loader', './scripts/slice-ts-loader.mjs', worker];

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

function childResult(child: ReturnType<typeof spawn>): Promise<{ status: number | null; stdout: string; stderr: string }> {
  let stdout = '', stderr = '';
  child.stdout!.on('data', value => { stdout += value; });
  child.stderr!.on('data', value => { stderr += value; });
  return new Promise(resolve => child.once('exit', status => resolve({ status, stdout, stderr })));
}

function lastJson(stdout: string): Record<string, unknown> {
  const line = stdout.trim().split('\n').filter(row => row.startsWith('{')).at(-1);
  if (!line) throw new Error(`worker produced no JSON: ${stdout}`);
  return JSON.parse(line) as Record<string, unknown>;
}

function runCase(directory: string, options: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  const child = spawnSync(process.execPath, [...args, 'case', directory, JSON.stringify(options)], { encoding: 'utf8', timeout: 30_000 });
  expect(child.status, child.stderr).toBe(0);
  return lastJson(child.stdout);
}

it.each(['unknown', 'forged', 'missing'] as const)('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:replay-authentication] real-store unauthenticated-existing-%s refuses in a fresh process', principal => {
  const directory = mkdtempSync(join(tmpdir(), `p10-conditional-auth-${principal}-`));
  expect(runCase(directory)).toMatchObject({ kind: 'Success', rows: [{ id: 'review:webhook' }] });
  const replay = runCase(directory, { principal });
  expect(replay).toMatchObject({ kind: 'Refused', rows: [{ id: 'review:webhook' }] });
}, 30_000);

it('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:stop-inhibition] real-store ordinary and conditional work share the stop refusal', () => {
  const ordinary = runCase(mkdtempSync(join(tmpdir(), 'p10-conditional-stop-ordinary-')), { stop: true, ordinary: true });
  const conditional = runCase(mkdtempSync(join(tmpdir(), 'p10-conditional-stop-conditional-')), { stop: true });
  expect(ordinary).toMatchObject({ kind: 'Refused', detail: 'stop inhibits new assembly work', rows: [] });
  expect(conditional).toMatchObject({ kind: 'Refused', detail: 'stop inhibits new assembly work', rows: [] });
}, 30_000);

it.each([
  ['extra-current-claim', { extraExpected: { current: true } }],
  ['extra-current-facts', { extraExpected: { currentFrontier: [] } }],
  ['extra-subject-key', { extraSubject: { current: true } }],
] as const)('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] [case:closed-shape-refusal] real-store %s refuses without an append', (_caseId, options) => {
  const result = runCase(mkdtempSync(join(tmpdir(), 'p10-conditional-claims-')), options);
  expect(result).toMatchObject({ kind: 'Refused', detail: 'conditional append frontier token is malformed', rows: [] });
}, 30_000);

it.each([
  ['webhook', 'long-poll'],
  ['long-poll', 'webhook'],
] as const)('P10-SEAM-CONDITIONAL-APPEND-58 [behavior:appendIfSubjectFrontier] authenticated two-process %s winner excludes %s and fresh process reconstructs one mode', async (winner, loser) => {
  const directory = mkdtempSync(join(tmpdir(), 'p10-conditional-race-'));
  assemblyRuntimeFixture(f => createTransportFileStorage(directory, <T>(run: () => T) => f.success(run())));
  const winnerRelease = join(directory, `release-${winner}`), loserRelease = join(directory, `release-${loser}`);
  const winnerChild = spawn(process.execPath, [...args, 'race', directory, winner, winnerRelease], { stdio: ['ignore', 'pipe', 'pipe'] });
  const winnerDone = childResult(winnerChild);
  await waitFor(`${winnerRelease}.ready`);
  // Start the competing process only after the first has entered the internal
  // read-to-physical-append interval. Its own production initialization may add
  // unrelated reference facts; the first operation must retry those safely.
  const loserChild = spawn(process.execPath, [...args, 'race', directory, loser, loserRelease], { stdio: ['ignore', 'pipe', 'pipe'] });
  const loserDone = childResult(loserChild);
  await waitFor(`${loserRelease}.ready`);

  writeFileSync(winnerRelease, 'go');
  const won = await winnerDone;
  expect(won.status, won.stderr).toBe(0);
  expect(lastJson(won.stdout)).toMatchObject({ kind: 'Success', mode: winner });

  writeFileSync(loserRelease, 'go');
  const lost = await loserDone;
  expect(lost.status, lost.stderr).toBe(0);
  expect(lastJson(lost.stdout)).toMatchObject({ kind: 'Refused', reason: 'decode' });
  expect(String(lastJson(lost.stdout).detail)).toContain('conditional append subject frontier changed; current=');

  const read = spawnSync(process.execPath, [...args, 'read', directory], { encoding: 'utf8', timeout: 30_000 });
  expect(read.status, read.stderr).toBe(0);
  expect(lastJson(read.stdout).rows).toEqual([{ id: `conformance:${winner}`, adapter: 'telegram:v1:bot:99', mode: winner }]);
}, 30_000);
