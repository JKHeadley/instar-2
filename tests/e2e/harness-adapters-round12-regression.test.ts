import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const runner = join(process.cwd(), 'node_modules/.bin/vite-node');
const worker = 'tests/harness-adapters/a2-round12-confirmation-worker.ts';
const SUBJECT_FIELDS = [
  'adapter',
  'artifact',
  'platform',
  'machine',
  'launch',
  'incarnation',
  'processIdentity',
] as const;

function seedAndRecover(cut: 'normal' | 'kill', field: string, history: 'prefix' | 'full') {
  const directory = mkdtempSync(join(tmpdir(), `p13-a2-r12-${cut}-${field}-${history}-`));
  const seed = spawnSync(runner, [worker, 'seed', cut, directory, field, history], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 40_000,
  });
  expect(seed.signal, `${cut}/${field}/${history}: ${seed.stderr}`).toBe(cut === 'kill' ? 'SIGKILL' : null);
  expect(seed.status, `${cut}/${field}/${history}: ${seed.stderr}`).toBe(cut === 'kill' ? null : 0);
  if (cut === 'normal') {
    expect(JSON.parse(seed.stdout), `${cut}/${field}/${history}`).toMatchObject({
      blockedLocalAppend: true,
      localPoison: false,
      floorCount: 1,
      candidateCount: 1,
    });
  }
  const recovered = spawnSync(runner, [worker, 'recover', cut, directory, field, history], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 40_000,
  });
  expect(recovered.status, `${cut}/${field}/${history}: ${recovered.stderr}`).toBe(0);
  return JSON.parse(recovered.stdout);
}

it('A2-E2E R12-F1-RETAINED-CANDIDATE-RESTARTS P13-NF-24 P13-NF-25 P13-NF-28 P13-NF-38 P13-NF-51 all 14 contradictory confirmations refuse after final-fsync normal and SIGKILL restart', () => {
  let scenarios = 0;
  for (const cut of ['normal', 'kill'] as const) {
    for (const field of SUBJECT_FIELDS) {
      const result = seedAndRecover(cut, field, 'prefix');
      expect(result, `${cut}/${field}`).toMatchObject({
        nineRead: 'Success',
        tenRead: 'Success',
        localPoison: false,
        floorCount: 1,
        candidateCount: 1,
        resume: { state: 'unknown' },
        reconnect: { disposition: 'refused', handle: null },
      });
      scenarios++;
    }
  }
  expect(scenarios).toBe(14);
}, 180_000);

it('A2-E2E R12-F1-RETAINED-CANDIDATE-CONTROLS P13-NF-28 P13-NF-38 P13-NF-51 unchanged confirmation remains unknown on an older prefix and poisoned on full history after both restart forms', () => {
  let scenarios = 0;
  for (const cut of ['normal', 'kill'] as const) {
    for (const history of ['prefix', 'full'] as const) {
      const result = seedAndRecover(cut, 'control', history);
      expect(result, `${cut}/${history}`).toMatchObject({
        nineRead: 'Success',
        tenRead: 'Success',
        localPoison: false,
        floorCount: 1,
        candidateCount: 1,
        resume: { state: history === 'prefix' ? 'unknown' : 'poisoned' },
        reconnect: { disposition: 'refused', handle: null },
      });
      scenarios++;
    }
  }
  expect(scenarios).toBe(4);
}, 120_000);
