import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { importLegacyScheduledJob } from '../../src/scheduled/index.js';
import { scheduledFixture, value } from './fixture.js';

it('P15-NF-51 round-thirteen disabled captured declaration is inhibited with explicit residue', () => {
  const sourceBytes = readFileSync('tests/scheduled/fixtures/legacy-benchmark-divergence-analysis.json', 'utf8');
  expect(JSON.parse(sourceBytes).enabled).toBe(false);
  const plan = value(importLegacyScheduledJob(sourceBytes, scheduledFixture().context));
  expect(plan).toMatchObject({ activation: 'inhibited', model: 'sonnet' });
  expect(plan.residue).toContain('legacy job is disabled; explicit package enable choice required');
  expect(plan.sourceBytes).toBe(sourceBytes);
});
