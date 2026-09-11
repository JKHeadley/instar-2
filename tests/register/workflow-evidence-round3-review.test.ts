import { describe, expect, it } from 'vitest';
import { decodeCheckRun, runRegisterChecks } from '../../src/register/index.js';
import type { WorkflowChecks } from '../../src/register/index.js';
import { detail, json, setup, value } from './fixtures.js';

describe('round-three workflow evidence validation', () => {
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
});
