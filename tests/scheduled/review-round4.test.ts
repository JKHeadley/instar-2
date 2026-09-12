import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { createScheduledWorkPackagePort, importLegacyScheduledJob, normalizeCronV1 } from '../../src/scheduled/index.js';
import { clone, scheduledFixture, value } from './fixture.js';

const status = <T>(result: import('../../src/index.js').Result<T>) => consumeResult(result, {
  Success: () => 'accepted' as const, Refused: () => 'refused' as const,
});

describe('Part Fifteen round-four data-validation repairs', () => {
  it('P15-NF-09 accepts named-zone forms without requiring a slash before the pinned calendar owner runs', () => {
    const f = scheduledFixture(); const port = createScheduledWorkPackagePort();
    const recurring = clone(f.manifest) as any;
    recurring.schedule = { ...recurring.schedule, kind: 'recurring', expression: '*/15 0 * * 0', timeZone: 'UTC' };
    delete recurring.schedule.at;
    for (const zone of ['UTC', 'CET', 'EST5EDT', 'America/New_York', 'Etc/UTC']) {
      expect(status(port.decode({ ...recurring, schedule: { ...recurring.schedule, timeZone: zone } }, f.context))).toBe('accepted');
    }
    for (const zone of ['', '/UTC', 'UTC/', 'America//New_York', 'America/New York']) {
      expect(status(port.decode({ ...recurring, schedule: { ...recurring.schedule, timeZone: zone } }, f.context))).toBe('refused');
    }
  });

  it('P15-NF-09 expands an arbitrary positive decimal cron step with bounded field work', () => {
    const f = scheduledFixture();
    expect(value(normalizeCronV1('*/9007199254740992 0 * * 0', f.context)).fields[0]).toEqual([0]);
    expect(value(normalizeCronV1('1-59/9007199254740992 0 * * 0', f.context)).fields[0]).toEqual([1]);
    expect(status(normalizeCronV1('*/0 0 * * 0', f.context))).toBe('refused');
  });

  it('P15-NF-51 imports and reports captured learning settings with execution-mode-specific mapping', () => {
    const f = scheduledFixture();
    const captured = JSON.parse(readFileSync('tests/scheduled/fixtures/legacy-health-check.json', 'utf8'));
    const script = value(importLegacyScheduledJob(JSON.stringify({ ...captured,
      execute: { type: 'script', value: 'health-check' }, livingSkills: { enabled: true }, integrationGate: true }), f.context));
    expect(script).toMatchObject({ postCompletionLearning: 'off', livingSkills: { enabled: true }, integrationGate: true });
    const model = value(importLegacyScheduledJob(JSON.stringify({ ...captured,
      execute: { type: 'prompt', value: 'Observe' }, livingSkills: { enabled: true }, integrationGate: true }), f.context));
    expect(model).toMatchObject({ postCompletionLearning: 'required', livingSkills: { enabled: true }, integrationGate: true });
  });

  it('P15-NF-51 keeps asserted locality inhibited without an owner-issued effects and storage witness', () => {
    const f = scheduledFixture();
    const plan = value(importLegacyScheduledJob(JSON.stringify({ slug: 'maintenance', executionMode: 'model-session',
      livingSkills: { enabled: true }, serverComposition: 'default-with-integration-gate',
      perMachineIndependent: true, machineLocalEffects: true }), f.context));
    expect(plan).toMatchObject({ activation: 'inhibited', placement: 'global-once' });
    expect(plan.residue).toContain('per-machine work is not proven machine-local by an owner witness');
  });
});
