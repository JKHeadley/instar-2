import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createScheduledWorkPackagePort } from '../../src/scheduled/index.js';
import { scheduledFixture, value } from '../scheduled/fixture.js';

describe('Part Fifteen package-resource restart evidence', () => {
  it('P15-NF-08 re-resolves signed Part Ten package history after a durable fsync and killed-process cut', () => {
    const directory = mkdtempSync(join(tmpdir(), 'p15-package-cut-'));
    const args = ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory];
    try {
      const cut = spawnSync(process.execPath, [...args, 'seed-cut'], { encoding: 'utf8', timeout: 30_000 });
      expect(cut.signal).toBe('SIGKILL');
      const recovered = spawnSync(process.execPath, [...args, 'recover'], { encoding: 'utf8', timeout: 30_000 });
      expect(recovered.status, recovered.stderr).toBe(0);
      const result = JSON.parse(recovered.stdout) as { replay: unknown; before: unknown };
      expect(result.replay).toEqual(result.before);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('P15-SLICE-A-CRON gives independently decoded recurring declarations the same identity without claiming lifecycle expansion', () => {
    const before = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const recurring = { ...before.manifest, schedule: { kind: 'recurring' as const, expression: '10-20/5 1 * * 0', timeZone: 'America/New_York',
      activationInstant: before.manifest.schedule.activationInstant, timeZoneDataVersion: before.manifest.schedule.timeZoneDataVersion,
      calendarPolicyVersion: before.manifest.schedule.calendarPolicyVersion, currentLatenessCutoffMs: before.manifest.schedule.currentLatenessCutoffMs } };
    const first = value(port.identity(recurring, before.context));
    const after = scheduledFixture(); const rebuilt = value(createScheduledWorkPackagePort().identity(JSON.parse(JSON.stringify(recurring)), after.context));
    expect(rebuilt).toEqual(first);
  });

  it('P15-NF-51 preserves legacy source and conversion across a durable killed-process cut', () => {
    const directory = mkdtempSync(join(tmpdir(), 'p15-legacy-cut-'));
    const args = ['--loader', './scripts/slice-ts-loader.mjs', './scripts/slice-scheduled-package.mjs', directory];
    try {
      const cut = spawnSync(process.execPath, [...args, 'legacy-seed-cut'], { encoding: 'utf8', timeout: 30_000 });
      expect(cut.signal).toBe('SIGKILL');
      const recovered = spawnSync(process.execPath, [...args, 'legacy-recover'], { encoding: 'utf8', timeout: 30_000 });
      expect(recovered.status, recovered.stderr).toBe(0);
      const plan = JSON.parse(recovered.stdout) as { model: string; postCompletionLearning: string; activation: string; sourceBytes: string };
      expect(plan.model).toBe('sonnet'); expect(plan.postCompletionLearning).toBe('required'); expect(plan.activation).toBe('eligible');
      expect(JSON.parse(plan.sourceBytes).slug).toBe('maintenance');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
