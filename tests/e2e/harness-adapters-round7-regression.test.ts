import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runChild } from './async-child.js';
import { expect, it } from 'vitest';
// @ts-expect-error The exact filesystem host is JavaScript outside pure core compilation.
import { createHarnessAdapterFileState } from '../../scripts/slice-p13-state-storage.mjs';

const worker = join(process.cwd(), 'node_modules/.bin/vite-node');

const base = {
  type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'state:r7:race',
  adapter: 'native', machine: 'machine-a', revision: 0,
  maxHandles: 0, maxAttempts: 4, maxEvents: 0, maxCaptureBytes: 0,
  handles: [], attempts: [], events: [],
};

// Each cut is independent. Await children so even a slow launch leaves runner IPC responsive.
it.each(['lock', 'open:1', 'write', 'fsync:1', 'close:1', 'rename', 'open:2', 'fsync:2', 'close:2'])('A2-E2E A2-R6-01-BOUNDARIES P13-NF-24 P13-NF-28 P13-NF-38 P13-NF-39 owner append cut %s retains persistent uncertainty', async cut => {
  const script = 'tests/harness-adapters/a2-round7-recovery-race-worker.ts';
  const root = mkdtempSync(join(tmpdir(), `p13-a2-r8-boundary-${cut.replace(':', '-')}-`));
  writeFileSync(join(root, 'state.json'), JSON.stringify(base));
  const seeded = await runChild(worker, [script, 'boundary', root, cut], {
    cwd: process.cwd(), timeout: 30_000,
  });
  expect(seeded.signal, `${cut}: ${seeded.stderr}`).toBe('SIGKILL');
  const reader = await runChild(worker, [script, 'reader', root], {
    cwd: process.cwd(), timeout: 30_000,
  });
  expect(reader.status, `${cut}: ${reader.stderr}`).toBe(0);
  expect(JSON.parse(reader.stdout).observations.every((row: { state: string }) => row.state === 'unknown'), cut)
    .toBe(true);
}, 60_000);

it('A2-E2E A2-R6-01-BOUNDARIES P13-NF-24 P13-NF-28 P13-NF-38 P13-NF-39 completed owner append retains the exact successor', async () => {
  const script = 'tests/harness-adapters/a2-round7-recovery-race-worker.ts';
  const control = mkdtempSync(join(tmpdir(), 'p13-a2-r8-boundary-control-'));
  writeFileSync(join(control, 'state.json'), JSON.stringify(base));
  const completed = await runChild(worker, [script, 'control', control], {
    cwd: process.cwd(), timeout: 30_000,
  });
  expect(completed.status, completed.stderr).toBe(0);
  expect(createHarnessAdapterFileState(join(control, 'state.json')).load()).toMatchObject({
    revision: 1, attempts: [{ operation: 'operation:cut' }],
  });
}, 60_000);

it('A2-E2E A2-R6-01 P13-NF-24 P13-NF-28 P13-NF-38 P13-NF-39 a fully fsynced pending owner append remains persistently uncertain after SIGKILL', async () => {
  const root = mkdtempSync(join(tmpdir(), 'p13-a2-r7-race-'));
  const script = 'tests/harness-adapters/a2-round7-recovery-race-worker.ts';
  writeFileSync(join(root, 'state.json'), JSON.stringify(base));
  const seed = await runChild(worker, [script, 'seed', root], { cwd: process.cwd(), timeout: 30_000 });
  expect(seed.signal, seed.stderr).toBe('SIGKILL');

  const readers = await Promise.all([
    runChild(worker, [script, 'reader', root], { timeout: 30_000 }),
    runChild(worker, [script, 'reader', root], { timeout: 30_000 }),
  ]);
  for (const reader of readers) {
    expect(reader, reader.stderr).toMatchObject({ status: 0, signal: null });
    const result = JSON.parse(reader.stdout);
    expect(result.observations).toHaveLength(3);
    expect(result.observations.every((row: { state: string; reason: string }) =>
      row.state === 'unknown' && row.reason.includes('Part Two harness state append is uncertain'))).toBe(true);
  }
  expect(readFileSync(join(root, 'state.json.part-two', 'facts.pending'), 'utf8')).toContain('operation:cut');
  expect(JSON.parse(readFileSync(join(root, 'state.json.part-two', 'facts.json'), 'utf8'))).toHaveLength(1);

  const control = join(root, 'control');
  mkdirSync(control);
  writeFileSync(join(control, 'state.json'), JSON.stringify(base));
  const recovered = await runChild(worker, [script, 'control', control], {
    cwd: process.cwd(), timeout: 30_000,
  });
  expect(recovered.status, recovered.stderr).toBe(0);
  expect(JSON.parse(recovered.stdout)).toMatchObject({ state: 'saved', staleWrite: 'refused' });
  expect(createHarnessAdapterFileState(join(control, 'state.json')).load()).toMatchObject({
    revision: 1, attempts: [{ operation: 'operation:cut' }],
  });
}, 30_000);

it('A2-E2E A2-R6-02 P13-NF-24 P13-NF-28 P13-NF-39 torn owner pending bytes stay unknown across reads and block a retrying holder', async () => {
  const root = mkdtempSync(join(tmpdir(), 'p13-a2-r7-torn-'));
  const script = 'tests/harness-adapters/a2-round7-recovery-race-worker.ts';
  writeFileSync(join(root, 'state.json'), JSON.stringify(base));
  const seed = await runChild(worker, [script, 'seed-torn', root], {
    cwd: process.cwd(), timeout: 30_000,
  });
  expect(seed.signal, seed.stderr).toBe('SIGKILL');
  const pendingPath = join(root, 'state.json.part-two', 'facts.pending');
  const torn = readFileSync(pendingPath, 'utf8');

  for (let reconstruction = 0; reconstruction < 3; reconstruction++) {
    const reader = await runChild(worker, [script, 'reader', root], {
      cwd: process.cwd(), timeout: 30_000,
    });
    expect(reader.status, reader.stderr).toBe(0);
    expect(JSON.parse(reader.stdout).observations)
      .toEqual([1, 2, 3].map(read => expect.objectContaining({ read, state: 'unknown' })));
    expect(readFileSync(pendingPath, 'utf8')).toBe(torn);
  }

  const holder = await runChild(worker, [script, 'holder', root], {
    cwd: process.cwd(), timeout: 30_000,
  });
  expect(holder.status, holder.stderr).toBe(0);
  expect(JSON.parse(holder.stdout)).toMatchObject({ state: 'unknown' });
  expect(readFileSync(pendingPath, 'utf8')).toBe(torn);
}, 30_000);

it('A2-E2E R7-A2-R5-02 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 poison evidence loss stays unresolved after final-fsync SIGKILL and older-prefix reconstruction', async () => {
  const script = 'tests/harness-adapters/a2-round7-poison-cut-worker.ts';
  let scenarios = 0;
  for (const cut of ['none', 'final-fsync'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r7-poison-${cut}-`));
    const seeded = await runChild(worker, [script, 'seed', cut, directory, 'control', 'full'], {
      cwd: process.cwd(), timeout: 30_000,
    });
    expect(seeded.signal, seeded.stderr).toBe(cut === 'final-fsync' ? 'SIGKILL' : null);
    expect(seeded.status, seeded.stderr).toBe(cut === 'final-fsync' ? null : 0);

    for (const history of ['full', 'older'] as const) for (const loss of ['control', 'conflict', 'nine-witness'] as const) {
      const recovered = await runChild(worker, [script, 'recover', cut, directory, loss, history], {
        cwd: process.cwd(), timeout: 30_000,
      });
      if (cut === 'final-fsync') {
        expect(recovered.status).toBe(1);
        expect(recovered.stderr).toContain('Part Two harness state append is uncertain');
        scenarios++;
        continue;
      }
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
