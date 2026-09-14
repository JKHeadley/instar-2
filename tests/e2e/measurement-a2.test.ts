import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createMeasurementLedgerA2 } from '../../src/measurement/index.js';
import { value } from '../facts/fixtures.js';
import { judgmentFixture } from '../judgment/fixture.js';
import { captureRetentionProof, measurementA2Fixture } from '../measurement/a2-fixture.js';

const worker = new URL('./measurement-a2-worker.ts', import.meta.url);
const burnWorker = new URL('./measurement-a2-burn-worker.ts', import.meta.url);
const restartHook = new URL('./measurement-a2-restart-hook.cjs', import.meta.url);
const viteNode = join(process.cwd(), 'node_modules', '.bin', 'vite-node');

it('P16-NF-12 [behavior:signed-history-attribution] P16-NF-13 [behavior:unattributed-conflicted] production judgment lifecycle supplies attribution without trusting presentation labels', async () => {
  const judgment = judgmentFixture();
  value(await judgment.door.judge(judgment.input, judgment.start()));
  const f = measurementA2Fixture();
  const port = createMeasurementLedgerA2({ ...f.c, register: judgment.ctx.decode.register,
    types: judgment.ctx.decode });
  expect(value(port.attribute({ attempt: `attempt:${judgment.input.id}:1`,
    claimed: { feature: 'fake', model: 'fake', machine: 'fake' },
    evaluationClock: judgment.now, sourceHistory: value(judgment.store.readForProjection()),
    candidates: [] }))).toMatchObject({ state: 'attributed', feature: 'judgment',
    model: 'model', machine: 'machine-a' });
}, 30_000);

it('P16-NF-04 [behavior:evidence-quantity-binding] P16-NF-14 [behavior:causal-quantity-resolution] P16-NF-16 [behavior:current-history-read] P16-NF-36 [behavior:deterministic-historical-presentation] P16-NF-37 [behavior:peer-union-window] P16-NF-38 [behavior:peer-completeness-clock] NON-EXECUTABLE-UNTIL-slice-A2b-peer-merge P16-NF-39 [behavior:all-identities-retention] P16-NF-40 [behavior:capture-retention] P16-NF-41 [behavior:bounded-cache-eviction] P16-NF-47 [behavior:privacy] P16-NF-48 [behavior:bounded-query] P16-NF-50 [behavior:historical-restart-rebuild] rebuilds from the real Part Two store and transport adapter across deterministic SIGKILL cuts', () => {
  expect(captureRetentionProof()).toMatchObject({
    protectedDetail: expect.stringContaining('protected'),
    tombstone: { status: 'tombstoned', bytes: null },
  });
  const cuts = ['before-append', 'before-write', 'after-write', 'after-file-sync',
    'after-rename', 'after-directory-sync', 'after-append', 'before-fold', 'after-fold',
    'control'];
  for (const cut of cuts) {
    const directory = mkdtempSync(join(tmpdir(), 'p16-a2-restart-'));
    const environment = { ...process.env,
      NODE_OPTIONS: `--require=${restartHook.pathname}`,
      ASTRA_CUT: cut === 'control' ? 'none' : cut,
      ASTRA_DIRECTORY: directory };
    const written = spawnSync(viteNode, ['--script', worker.pathname, directory, 'write'],
      { cwd: process.cwd(), encoding: 'utf8', env: environment });
    if (cut === 'control') expect(written.status).toBe(0);
    else expect(written.signal).toBe('SIGKILL');
    const first = execFileSync(viteNode, ['--script', worker.pathname, directory, 'read'],
      { cwd: process.cwd(), encoding: 'utf8' });
    const second = execFileSync(viteNode, ['--script', worker.pathname, directory, 'read'],
      { cwd: process.cwd(), encoding: 'utf8' });
    expect(second).toBe(first);
    const recovered = JSON.parse(first) as Record<string, unknown>;
    if (['after-rename', 'after-directory-sync', 'after-append', 'before-fold',
      'after-fold', 'control'].includes(cut))
      expect(recovered).toMatchObject({ state: 'rebuilt', quantity: 13, peer: 'complete',
        rows: 1, cache: 1, pending: false,
        lock: cut === 'after-rename' || cut === 'after-directory-sync' });
    else expect(recovered).toEqual({ state: 'no-committed-observation',
      pending: cut !== 'before-append', lock: cut !== 'before-append' });
  }
}, 120_000);

it('P16-NF-33 [behavior:burn-hysteresis] P16-NF-34 [behavior:coverage-debt] rebuilds a witnessed open episode and adjacent recovery sequence from the real Part Two store', () => {
  const directory = mkdtempSync(join(tmpdir(), 'p16-a2-burn-restart-'));
  const written = execFileSync(viteNode, ['--script', burnWorker.pathname, directory, 'write'],
    { cwd: process.cwd(), encoding: 'utf8' });
  expect(JSON.parse(written)).toEqual({ state: 'written', facts: 12 });
  const first = execFileSync(viteNode, ['--script', burnWorker.pathname, directory, 'read'],
    { cwd: process.cwd(), encoding: 'utf8' });
  const second = execFileSync(viteNode, ['--script', burnWorker.pathname, directory, 'read'],
    { cwd: process.cwd(), encoding: 'utf8' });
  expect(second).toBe(first);
  expect(JSON.parse(first)).toEqual({ state: 'rebuilt', facts: 12, opened: 'open',
    notified: true, firstRecovery: 1, recovered: 'closed' });
}, 30_000);
