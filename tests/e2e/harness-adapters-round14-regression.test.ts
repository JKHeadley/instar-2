import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { sameMachineReconnectCandidate } from '../../src/harness-adapters/holder.js';
import { attemptInput } from '../harness-adapters/fixture.js';
import { round14FileFixture } from '../harness-adapters/a2-round14-file-fixture.js';

const runner = join(process.cwd(), 'node_modules/.bin/vite-node');
const worker = 'tests/harness-adapters/a2-round14-worker.ts';

function runWorker(operation: string, target: string) {
  const result = spawnSync(runner, [worker, operation, target], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 60_000,
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as {
    receipt?: { disposition: string; attempt?: { attemptedAt: number } };
    liveness?: { state: string };
    error?: string;
  };
}

it('A2-E2E R14-F1-FINAL-READ-RACE P13-NF-25 P13-NF-29 P13-NF-38 separate-process failed probes during final Six reads refuse reconnect', () => {
  let scenarios = 0;
  for (const mode of ['stable', 'failure-before', 'failure-at-final-inspect', 'failure-at-final-admit'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r14-${mode}-`));
    const fixture = round14FileFixture(directory, true);
    let reads = 0;
    let writes = 0;
    let child: ReturnType<typeof runWorker> | null = null;
    const append = () => {
      child = runWorker('append-failed-probe', directory);
    };
    if (mode === 'failure-before') append();
    const authority = {
      ...fixture.six.api,
      inspect() {
        reads++;
        if (reads === 2 && mode === 'failure-at-final-inspect') append();
        return fixture.six.api.inspect();
      },
      admitWrite(...args: Parameters<typeof fixture.six.api.admitWrite>) {
        writes++;
        if (writes === 2 && mode === 'failure-at-final-admit') append();
        return fixture.six.api.admitWrite(...args);
      },
    };
    const decision = sameMachineReconnectCandidate({
      launch: fixture.handle.launch,
      machine: fixture.handle.machine,
      incarnation: fixture.handle.incarnation,
      fence: fixture.fence,
      now: 22,
      evidence: fixture.evidence,
      authority,
    }, fixture.handles);
    expect(decision, mode).toMatchObject({
      disposition: mode === 'stable' ? 'reconnect' : 'refused',
      handle: mode === 'stable' ? fixture.handle : null,
    });
    if (mode !== 'stable') {
      expect(child, mode).toMatchObject({
        receipt: { disposition: 'recorded' },
        liveness: { state: 'unknown' },
      });
      expect(fixture.evidence.liveness(fixture.handle, 22), mode).toMatchObject({ state: 'unknown' });
    }
    scenarios++;
  }
  expect(scenarios).toBe(4);
}, 120_000);

it('A2-E2E R14-F2-LEGACY-REOPEN P13-NF-24 P13-NF-28 P13-NF-39 P13-NF-46 invalid existing custody stays refused across separate-process reopen', () => {
  const valid = {
    type: 'HarnessAdapterStateSnapshot', schemaVersion: 1, id: 'r14:legacy:pending',
    adapter: 'native', machine: 'machine-a', revision: 1,
    maxHandles: 4, maxAttempts: 8, maxEvents: 0, maxCaptureBytes: 0,
    handles: [], attempts: [attemptInput()], events: [],
  };
  let scenarios = 0;
  for (const mode of ['regular-file', 'symlink-to-valid-file', 'directory', 'absent-control', 'json-null'] as const) {
    const directory = mkdtempSync(join(tmpdir(), `p13-a2-r14-reopen-${mode}-`));
    const target = join(directory, 'journal.json');
    if (mode === 'regular-file') writeFileSync(target, JSON.stringify(valid));
    if (mode === 'symlink-to-valid-file') {
      const original = join(directory, 'original.json');
      writeFileSync(original, JSON.stringify(valid));
      symlinkSync(original, target);
    }
    if (mode === 'directory') mkdirSync(target);
    if (mode === 'json-null') writeFileSync(target, 'null');

    const first = runWorker('open-legacy', target);
    const reopened = runWorker('open-legacy', target);
    if (mode === 'regular-file') {
      expect(first).toMatchObject({ receipt: { disposition: 'existing', attempt: { attemptedAt: 10 } } });
      expect(reopened).toMatchObject({ receipt: { disposition: 'existing', attempt: { attemptedAt: 10 } } });
    } else if (mode === 'absent-control') {
      expect(first).toMatchObject({ receipt: { disposition: 'started', attempt: { attemptedAt: 30 } } });
      expect(reopened).toMatchObject({ receipt: { disposition: 'existing', attempt: { attemptedAt: 30 } } });
    } else {
      expect(first.error, mode).toBeTruthy();
      expect(reopened.error, mode).toBeTruthy();
      expect(first.receipt, mode).toBeUndefined();
      expect(reopened.receipt, mode).toBeUndefined();
    }
    scenarios++;
  }
  expect(scenarios).toBe(5);
}, 120_000);
