import { describe, expect, it } from 'vitest';
import { decodeCheckRun, runRegisterChecks } from '../../src/register/index.js';
import type { WorkflowChecks } from '../../src/register/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { detail, json, setup, value } from './fixtures.js';

describe.skip('round-three workflow evidence validation SKIPPED: HELD-BY-SCOPE:SEAM-LEDGER-row-124', () => {
  it('P3-NF-28 direct normal checks cannot raise holder strength from unwitnessed run or review rows', () => {
    const s = setup();
    const run = value(decodeCheckRun(json('CheckRunRecord', { id: 'not-on-any-spine', commit: 'commit:1', branch: 'main',
      providerRun: 'provider:run', outcome: 'passed', fixtures: [], at: s.f.now }), s.context));
    const base: WorkflowChecks = { mode: 'normal', branch: 'main', runs: [run],
      catalog: { fixtures: [], probes: [], sentinels: [], semanticReviews: [] }, landedParts: [], now: s.f.now,
      constructs: [], observations: [], separations: [], bootstrapRules: [],
      boundaries: s.context.shape.kinds.map(kind => ({ kind: kind.name, language: 'TypeScript', impossible: [], swept: [], residual: [] })),
      claims: s.context.shape.kinds.map(kind => ({ kind: kind.name, complete: false })) };
    expect(detail(runRegisterChecks(s.build([s.rule(7)]), base, s.context))).toContain('signed Part Two record verifier');
    const reviewOnly = { ...base, runs: [], catalog: { ...base.catalog, semanticReviews: [{ holder: 'holder', rule: 7,
      generation: 'generation:invented', subjectHash: 'sha256:invented', record: 'not-on-any-spine-either' }] } };
    expect(detail(runRegisterChecks(s.build([s.rule(7)]), reviewOnly, s.context))).toContain('signed Part Two record verifier');
  });

  it('P3-NF-28 treats a successful false owner answer as a final negative verdict', () => {
    const s = setup(), f = factsFixture();
    const run = value(decodeCheckRun(json('CheckRunRecord', { id: 'signed-run', commit: 'commit:1', branch: 'main',
      providerRun: 'provider:run', outcome: 'passed', fixtures: [], at: s.f.now }), s.context));
    const checks: WorkflowChecks = { mode: 'normal', branch: 'main', runs: [run], catalog: { fixtures: [], probes: [],
      sentinels: [], semanticReviews: [{ holder: 'holder', rule: 7, generation: 'generation:review',
        subjectHash: 'sha256:subject', record: 'signed-review' }] }, landedParts: [], now: s.f.now,
      constructs: [], observations: [], separations: [], bootstrapRules: [],
      boundaries: s.context.shape.kinds.map(kind => ({ kind: kind.name, language: 'TypeScript', impossible: [], swept: [], residual: [] })),
      claims: s.context.shape.kinds.map(kind => ({ kind: kind.name, complete: false })) };
    const negative = { verifyRecord: () => f.success(false), verifySemanticReview: () => f.success(false) };
    expect(detail(runRegisterChecks(s.build([s.rule(7)]), checks, s.context, negative)))
      .toContain('Part Two rejected check-run evidence signed-run');
    expect(detail(runRegisterChecks(s.build([s.rule(7)]), { ...checks, runs: [] }, s.context, negative)))
      .toContain('Part Nine rejected semantic-review evidence signed-review');
  });
});
