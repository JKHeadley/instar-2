import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, it } from 'vitest';
import { createRuntimeHandleHolder } from '../../src/harness-adapters/holder.js';
import type { HarnessAdapterStateStorePort } from '../../src/harness-adapters/holder.js';
import { harnessFixture, decodedHandle } from '../harness-adapters/fixture.js';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';

type WorkerResult = Readonly<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }>;
function run(mode: 'seed' | 'recover', cut: string, path: string): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(join(process.cwd(), 'node_modules/.bin/vite-node'),
      ['tests/harness-adapters/a2-storage-cut-worker.ts', mode, cut, path], { cwd: process.cwd() });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += String(bytes); });
    child.stderr.on('data', bytes => { stderr += String(bytes); });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function runOwnerJournalCut(mode: 'seed' | 'recover', directory: string): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(join(process.cwd(), 'node_modules/.bin/vite-node'),
      ['tests/harness-adapters/a2-owner-journal-cut-worker.ts', mode, directory], { cwd: process.cwd() });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += String(bytes); });
    child.stderr.on('data', bytes => { stderr += String(bytes); });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function runRound4OwnerCut(mode: 'seed' | 'recover', cut: string, target: string,
  directory: string): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(join(process.cwd(), 'node_modules/.bin/vite-node'),
      ['tests/harness-adapters/a2-round4-owner-cut-worker.ts', mode, cut, target, directory],
      { cwd: process.cwd() });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += String(bytes); });
    child.stderr.on('data', bytes => { stderr += String(bytes); });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function runRound4PoisonCut(mode: 'seed' | 'recover', cut: string,
  directory: string): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(join(process.cwd(), 'node_modules/.bin/vite-node'),
      ['tests/harness-adapters/a2-round4-poison-cut-worker.ts', mode, cut, directory],
      { cwd: process.cwd() });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += String(bytes); });
    child.stderr.on('data', bytes => { stderr += String(bytes); });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function race(directory: string, who: string): Promise<{ status: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(join(process.cwd(), 'node_modules/.bin/vite-node'),
      ['tests/harness-adapters/a2-cas-worker.ts', directory, who], { cwd: process.cwd() });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += String(bytes); });
    child.stderr.on('data', bytes => { stderr += String(bytes); });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(JSON.parse(stdout) as { status: string })
      : reject(new Error(`CAS child ${who} exited ${code}: ${stderr}`)));
  });
}

function initial(path: string): void {
  writeFileSync(path, `${JSON.stringify({ type: 'HarnessAdapterStateSnapshot', schemaVersion: 1,
    id: 'state:a2-cut', adapter: 'native', machine: 'machine-a', revision: 0,
    maxHandles: 4, maxAttempts: 8, maxEvents: 0, maxCaptureBytes: 0,
    handles: [], attempts: [], events: [] })}\n`);
}

it('A2-E2E P13-NF-28 holder custody reconstructs from the durable journal after restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p13-a2-restart-'));
  const state = createHarnessAdapterFileState(join(directory, 'state.json')) as HarnessAdapterStateStorePort;
  const f = harnessFixture();
  const first = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 4,
    maxAttempts: 8, context: f.owner.c, state, admission: f.port });
  const handle = decodedHandle(f);
  expect(first.put(handle).disposition).toBe('stored');
  const restarted = createRuntimeHandleHolder({ adapter: 'native', machine: 'machine-a', maxHandles: 4,
    maxAttempts: 8, context: f.owner.c, state, admission: f.port });
  expect(restarted.lookup(handle.launch)).toMatchObject({ state: 'found', handle });
});

it.each(['lock', 'write', 'fsync:1', 'rename', 'fsync:2', 'unlink', 'fsync:3'])
    ('A2-E2E R2-F12 P13-NF-24 P13-NF-32 P13-NF-38 owner storage cut at %s preserves state or persistent uncertainty', async cut => {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-storage-${cut}-`));
    const path = join(directory, 'state.json');
    const killed = await run('seed', cut, path);
    expect(killed.signal).toBe('SIGKILL');
    const recovered = await run('recover', cut, path);
    if (!['unlink', 'fsync:3'].includes(cut)) {
      expect(recovered.code).toBe(1);
      expect(recovered.stderr).toContain('Part Two harness state append is uncertain');
      return;
    }
    expect(recovered, recovered.stderr).toMatchObject({ code: 0, signal: null });
    expect(JSON.parse(recovered.stdout)).toMatchObject({ status: 'recovered',
      attemptState: cut === 'lock' ? 'pending' : 'observed', attemptedAt: 20,
      delivery: 'uncertain', completion: 'pending', resume: 'eligible', driverCalls: 0 });
  }, 20_000);

it('A2-E2E P13-NF-24 P13-NF-39 concurrent filesystem writers cannot acknowledge the same journal predecessor', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'p13-a2-cas-'));
  const path = join(directory, 'state.json');
  initial(path);
  const state = createHarnessAdapterFileState(path) as HarnessAdapterStateStorePort;
  expect(state.load()).toMatchObject({ revision: 0 });
  const results = await Promise.all([race(directory, 'a'), race(directory, 'b')]);
  expect(results.filter(result => result.status === 'saved')).toHaveLength(1);
  expect(results.filter(result => result.status === 'refused')).toHaveLength(1);
  expect(state.load()).toMatchObject({ revision: 1 });
}, 20_000);

it('A2-E2E R3-F05 P13-NF-24 P13-NF-32 P13-NF-38 owner history prevents completion after the pending-event owner commit', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'p13-a2-owner-journal-cut-'));
  const killed = await runOwnerJournalCut('seed', directory);
  expect(killed.signal).toBe('SIGKILL');
  const recovered = await runOwnerJournalCut('recover', directory);
  expect(recovered, recovered.stderr).toMatchObject({ code: 0, signal: null });
  const result = JSON.parse(recovered.stdout) as {
    owner: { kind: string }; completion: { state: string; event: string }; events: string[];
  };
  expect(result.owner.kind).toBe('Success');
  expect(result.events).toEqual(['closure:ten', 'pending:twenty']);
  expect(result.completion).toMatchObject({ state: 'pending', event: 'closure:ten' });
}, 20_000);

it.each(['heartbeat', 'probe-failed', 'process-exited'])
    ('A2-E2E R4-F01 R4-F02 P13-NF-24 P13-NF-29 P13-NF-32 P13-NF-33 owner %s survives SIGKILL after the owner commit', async target => {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r4-${target}-`));
    const killed = await runRound4OwnerCut('seed', 'unlink', target, directory);
    expect(killed.signal).toBe('SIGKILL');
    const recovered = await runRound4OwnerCut('recover', 'unlink', target, directory);
    expect(recovered, recovered.stderr).toMatchObject({ code: 0, signal: null });
    const result = JSON.parse(recovered.stdout) as {
      liveness: { state: string }; completion: { state: string }; events: string[];
    };
    expect(result.events).toEqual(['r4:prior-live', 'r4:prior-close', `r4:pending:${target}`]);
    expect(result.completion.state).toBe('pending');
    expect(result.liveness.state).toBe(target === 'heartbeat' ? 'live'
      : target === 'probe-failed' ? 'unknown' : 'dead');
  }, 20_000);

it('A2-E2E R4-F03 P13-NF-28 P13-NF-38 P13-NF-51 owner-confirmed poison survives SIGKILL after the owner commit', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'p13-a2-r4-poison-'));
  const killed = await runRound4PoisonCut('seed', 'unlink', directory);
  expect(killed.signal).toBe('SIGKILL');
  const recovered = await runRound4PoisonCut('recover', 'unlink', directory);
  expect(recovered, recovered.stderr).toMatchObject({ code: 0, signal: null });
  expect(JSON.parse(recovered.stdout)).toMatchObject({
    resume: { state: 'poisoned', event: 'r4:event:transcript-poison' },
    reconnect: { disposition: 'refused', handle: null },
  });
}, 20_000);
