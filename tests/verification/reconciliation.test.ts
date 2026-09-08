import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
import { decodeVerificationAssessment, mergeVerificationRecords } from '../../src/verification/index.js';
import { verificationInput } from './fixture.js';
import { jointVerificationFixture } from './joint-fixture.js';
import { value } from '../facts/fixtures.js';

const refused = <T>(result: import('../../src/index.js').Result<T>) => consumeResult(result, {
  Success: () => { throw new Error('expected refusal'); },
  Refused: refusal => refusal.detail,
});

it('R7 historical effect assessment reads re-establish request, plan, bar, reservation, and causal lineage', () => {
  const f = jointVerificationFixture(); const row = JSON.parse(JSON.stringify(verificationInput('VerificationAssessment')));
  Object.assign(row, { id: 'forged-assessment', request: 'nonexistent-request', operation: f.reservation.operation,
    attempt: f.reservation.attempt, operationDigest: f.request.digest, barVersion: 'never-approved-bar', validFrom: 100,
    validUntil: 1000, missingEvidence: [], evidence: ['evidence:occurred', 'evidence:quiescent', 'evidence:charged'] });
  for (const predicate of row.predicates) {
    predicate.verdict = predicate.predicate === 'non-occurrence' ? 'contradicted' : 'satisfied';
    predicate.evidence = [predicate.predicate === 'quiescence' ? 'evidence:quiescent'
      : predicate.predicate === 'charge' ? 'evidence:charged' : 'evidence:occurred'];
  }
  value(f.runtime.record('VerificationAssessment', row));
  const fact = value(f.runtime.inspect()).find(item => item.record.type === 'VerificationAssessment' && item.record.id === row.id)!.fact;
  const reference = { owner: 'part-nine' as const, name: 'VerificationAssessment' as const, id: fact.id };
  expect(refused(f.assessment.read(reference, f.input))).toContain('request');
  expect(refused(f.assessment.consumeCurrent(reference, f.input, current => current.outcome.kind))).toContain('read before');
});

it('N2 historical read and current consumption refuse a logical assessment disagreement', () => {
  const f = jointVerificationFixture(); const reference = value(f.assessment.assess(f.input));
  expect(value(f.assessment.read(reference, f.input)).outcome.kind).toBe('happened');
  const original = value(f.runtime.inspect()).find(row => row.fact.id === reference.id)!.record;
  if (original.type !== 'VerificationAssessment') throw new Error('assessment fixture missing');
  const conflicting = JSON.parse(JSON.stringify(original)) as typeof original;
  (conflicting as { id: string }).id = 'conflicting-assessment';
  const occurrence = conflicting.predicates.find(predicate => predicate.predicate === 'occurrence') as { verdict: string };
  occurrence.verdict = 'insufficient';
  value(f.spine.append(value(decodeVerificationAssessment(conflicting, f.host.boundary))));
  expect(mergeVerificationRecords(value(f.runtime.inspect()).map(row => row.record)).conflicts).toHaveLength(1);
  expect(refused(f.assessment.read(reference, f.input))).toContain('logical identity');
  let called = false;
  expect(refused(f.assessment.consumeCurrent(reference, f.input, current => { called = true; return current.outcome.kind; })))
    .toContain('logical identity');
  expect(called).toBe(false);
});
