import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { verificationEvidenceFreshness } from '../../src/verification/index.js';
import { refused, value } from '../facts/fixtures.js';
import { verificationInput } from './fixture.js';
import { verificationRuntimeFixture } from './runtime-fixture.js';

it('P9-NF-09 P9-NF-12 never-run required arms enter the due index and restart debt is clock-derived', () => {
  const f = verificationRuntimeFixture();
  value(f.runtime.record('VerificationPlan', verificationInput('VerificationPlan')));
  expect(value(f.runtime.due(f.clock(100)))).toEqual([{ plan: 'VerificationPlan', arm: 'runtime', instance: 'effect-operation', dueAt: 0, lastAttempt: '', overdueBy: 100 }]);
  expect(value(f.runtime.due(f.clock(150)))[0]!.overdueBy).toBe(150);
});

it('P9-NF-09 exact endpoint is expired and a future or incomparable clock is unknown', () => {
  const f = verificationRuntimeFixture();
  const evidence = value(decode('Evidence', f.evidenceInput({ id: 'freshness', observedAt: f.clock(100), freshFor: 10 }), f.context.decode));
  expect(value(verificationEvidenceFreshness(evidence, f.clock(109), f.c))).toBe('fresh');
  expect(value(verificationEvidenceFreshness(evidence, f.clock(110), f.c))).toBe('expired');
  expect(value(verificationEvidenceFreshness(evidence, f.clock(99), f.c))).toBe('unknown');
  const other = value(decode('Measurement', f.clockRaw(109, 'machine-b'), f.context.decode));
  expect(value(verificationEvidenceFreshness(evidence, other as typeof f.now, f.c))).toBe('unknown');
});

it('P9-NF-10 P9-NF-14 failed and missing arms cannot be averaged into a healthy posture', () => {
  const f = verificationRuntimeFixture(); const plan = verificationInput('VerificationPlan');
  value(f.runtime.record('VerificationPlan', plan));
  const planFact = value(f.runtime.inspect())[0]!.fact.id;
  const failed = { ...verificationInput('ProbeRecord'), id: 'probe:failed', predecessors: [planFact], disposition: 'failed' as const, witnesses: [], comparison: 'Result:failed' };
  value(f.runtime.record('ProbeRecord', failed));
  expect(value(f.runtime.posture(plan.id, f.clock(21))).posture).toBe('failed');
  const pass = { ...verificationInput('ProbeRecord'), id: 'probe:passed', predecessors: [planFact], slot: 'slot:2', attempt: 'attempt:2', startedAt: 30, completedAt: 40 };
  value(f.runtime.record('ProbeRecord', pass));
  expect(value(f.runtime.posture(plan.id, f.clock(139))).posture).toBe('healthy');
  expect(value(f.runtime.posture(plan.id, f.clock(140))).posture).toBe('stale');
});

it('P9-NF-17 P9-NF-18 a passing probe needs a real witness and complete phases', () => {
  const f = verificationRuntimeFixture();
  const probe = verificationInput('ProbeRecord');
  refused(f.runtime.record('ProbeRecord', { ...probe, witnesses: [] }), 'independent witness');
  refused(f.runtime.record('ProbeRecord', { ...probe, missingPhases: ['worker-consumption'] }), 'independent witness');
});

it('P9-NF-24 duplicate delivery is idempotent while a changed digest conflicts', () => {
  const f = verificationRuntimeFixture(); const plan = verificationInput('VerificationPlan');
  expect(value(f.runtime.record('VerificationPlan', plan))).toEqual(plan);
  expect(value(f.runtime.record('VerificationPlan', JSON.parse(JSON.stringify(plan))))).toEqual(plan);
  expect(value(f.runtime.inspect())).toHaveLength(1);
  refused(f.runtime.record('VerificationPlan', { ...plan, subject: { ...plan.subject, governed: 'changed' } }), 'divergent canonical content');
  expect(value(f.runtime.inspect())).toHaveLength(1);
});
