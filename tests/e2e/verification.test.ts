import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { decode } from '../../src/index.js';
import { createFactStore } from '../../src/facts/index.js';
import type { FactContext } from '../../src/facts/index.js';
import { createVerificationRuntime, createVerificationSpine, registerVerificationBodies,
  retainedGap, verificationSchemas } from '../../src/verification/index.js';
import type { VerificationHost } from '../../src/verification/index.js';
import { factsFixture, privateKey, value } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
// @ts-expect-error Reference physical storage is a Part Ten JavaScript adapter.
import { createTransportFileStorage } from '../../scripts/transport-file-storage.mjs';

it('P9-NF-12 P9-NF-34 P9-NF-42 P9-NF-58 P9-NF-62 lifecycle initializes real ports and rebuilds holders, grades and obligations from durable facts', () => {
  const f = factsFixture(); const probeInput = verificationInput('ProbeRecord'); const planInput = verificationInput('VerificationPlan');
  const witness = value(decode('Evidence', f.evidenceInput({ id: 'evidence:witness', source: 'probe',
    observedAt: f.clock(probeInput.completedAt), freshFor: 200,
    claim: { subject: probeInput.subject, predicate: 'probe-passed', value: { challengeDigest: probeInput.challengeDigest,
      subjectDigest: planInput.bar.subjectDigest, plan: probeInput.plan, planVersion: probeInput.planVersion,
      arm: probeInput.arm, slot: probeInput.slot, attempt: probeInput.attempt, run: probeInput.run,
      operation: probeInput.operation, comparison: probeInput.comparison } } }), f.ctx.decode));
  let context: FactContext = { ...f.ctx, decode: { ...f.ctx.decode, evidence: [...f.ctx.decode.evidence ?? [], witness] } }; let now = 100;
  const host: VerificationHost = { machine: 'machine-a', principal: f.alice, scope: f.scope, boundary: f.c,
    current: () => ({ decode: context.decode, clock: f.clock(now), generation: context.decode.register.generation.id,
      stopped: false, facts: context, evidence: context.decode.evidence ?? [] }) };
  const registrations = value(registerVerificationBodies(host));
  context = { ...context, schemas: [...context.schemas, ...verificationSchemas(host)], ownedBodies: registrations };
  const directory = mkdtempSync(join(tmpdir(), 'p9-lifecycle-'));
  const storage = createTransportFileStorage(directory, <T>(run: () => T) => f.success(run()));
  const start = () => {
    const store = createFactStore(context, storage);
    const spine = createVerificationSpine(host, { context, privateKey }, store);
    return createVerificationRuntime(host, spine);
  };
  const first = start(); const plan = value(first.record('VerificationPlan', planInput));
  const planFact = value(first.inspect()).find(row => row.record.type === 'VerificationPlan')!.fact.id;
  const probe = value(first.record('ProbeRecord', { ...probeInput, predecessors: [planFact] }));
  const probeFact = value(first.inspect()).find(row => row.record.type === 'ProbeRecord')!.fact.id;
  value(first.record('Grade', { ...verificationInput('Grade'), predecessors: [probeFact] }));
  const gradeFact = value(first.inspect()).find(row => row.record.type === 'Grade')!.fact.id;
  value(first.record('FeedbackDisposition', { ...verificationInput('FeedbackDisposition'), predecessors: [gradeFact] }));
  const feedbackFact = value(first.inspect()).find(row => row.record.type === 'FeedbackDisposition')!.fact.id;
  value(first.record('SemanticReviewRecord', { ...verificationInput('SemanticReviewRecord'), predecessors: [feedbackFact] }));
  expect(value(first.posture(plan.id, f.clock(99))).posture).toBe('healthy');

  // New store/runtime instances model process reconstruction from the fsync'd
  // signed spine. No prior in-memory view or issued assessment is reused.
  now = 150; const restarted = start(); const rebuilt = value(restarted.inspect());
  expect(rebuilt.map(row => row.record.type)).toEqual(['VerificationPlan', 'ProbeRecord', 'Grade', 'FeedbackDisposition', 'SemanticReviewRecord']);
  expect(value(restarted.posture(plan.id, f.clock(150))).posture).toBe('stale');
  expect(value(restarted.due(f.clock(150)))[0]).toMatchObject({ plan: plan.id, arm: 'runtime', lastAttempt: probe.id, overdueBy: 130 });
  expect(retainedGap).toMatchObject({ status: 'partial', rule: 7 });
}, 30000);
