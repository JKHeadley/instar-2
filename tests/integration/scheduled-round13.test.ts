import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { importLegacyScheduledJob } from '../../src/scheduled/index.js';
import { scheduledFixture, value } from '../scheduled/fixture.js';

it('P15-NF-51 round-thirteen full-port legacy import preserves enabled and disabled activation semantics', () => {
  const context = scheduledFixture().context;
  const enabledBytes = readFileSync('tests/scheduled/fixtures/legacy-health-check.json', 'utf8');
  const disabledBytes = readFileSync('tests/scheduled/fixtures/legacy-benchmark-divergence-analysis.json', 'utf8');
  const enabled = value(importLegacyScheduledJob(enabledBytes, context));
  const disabled = value(importLegacyScheduledJob(disabledBytes, context));
  expect(enabled).toMatchObject({ activation: 'eligible', residue: [], model: 'haiku' });
  expect(disabled).toMatchObject({ activation: 'inhibited', model: 'sonnet' });
  expect(disabled.residue).toContain('legacy job is disabled; explicit package enable choice required');
  expect(enabled.sourceBytes).toBe(enabledBytes); expect(disabled.sourceBytes).toBe(disabledBytes);
});
