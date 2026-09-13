import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
    ('A2-E2E R2-F12 P13-NF-24 P13-NF-32 P13-NF-38 storage cut at %s preserves pending delivery and holder lifecycle evidence', async cut => {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-storage-${cut}-`));
    const path = join(directory, 'state.json');
    const killed = await run('seed', cut, path);
    expect(killed.signal).toBe('SIGKILL');
    const recovered = await run('recover', cut, path);
    expect(recovered, recovered.stderr).toMatchObject({ code: 0, signal: null });
    expect(JSON.parse(recovered.stdout)).toMatchObject({ status: 'recovered',
      attemptState: cut === 'lock' ? 'pending' : 'observed', attemptedAt: 20,
      delivery: 'uncertain', completion: 'pending', resume: 'eligible', driverCalls: 0 });
    expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({
      handles: [{ launch: 'launch:restart' }], attempts: [{ kind: 'delivery', operation: 'operation:restart-delivery' }],
    });
    expect(JSON.parse(readFileSync(`${path}.evidence`, 'utf8'))).toMatchObject({
      events: expect.arrayContaining([
        expect.objectContaining({ id: 'restart:closure', kind: 'turn-closed' }),
        expect.objectContaining({ id: 'restart:pending-input', kind: 'input-accepted' }),
        expect.objectContaining({ id: 'restart:resume', kind: 'diagnostic' }),
      ]),
    });
  }, 20_000);

it('A2-E2E P13-NF-24 P13-NF-39 concurrent filesystem writers cannot acknowledge the same journal predecessor', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'p13-a2-cas-'));
  const path = join(directory, 'state.json');
  initial(path);
  const results = await Promise.all([race(directory, 'a'), race(directory, 'b')]);
  expect(results.filter(result => result.status === 'saved')).toHaveLength(1);
  expect(results.filter(result => result.status === 'refused')).toHaveLength(1);
  expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ revision: 1 });
}, 20_000);
