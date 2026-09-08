import { expect, it } from 'vitest';
import { consumeResult } from '../../src/index.js';
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
