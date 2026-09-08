import { expect, it } from 'vitest';
import { canonical, consumeResult } from '../../src/index.js';
import { compareVerificationRecords, decodeVerificationRecord, verificationIdentity } from '../../src/verification/index.js';
import type { VerificationRecordName } from '../../src/verification/index.js';
import { factsFixture } from '../facts/fixtures.js';
import { verificationInput, verificationInputs } from './fixture.js';

const names = Object.keys(verificationInputs) as VerificationRecordName[];
const value = <T>(result: import('../../src/index.js').Result<T>): T => consumeResult(result, { Success: v => v, Refused: r => { throw new Error(r.detail); } });
const refused = <T>(result: import('../../src/index.js').Result<T>, contains?: string) => consumeResult(result, {
  Success: () => { throw new Error('expected refusal'); },
  Refused: r => { if (contains) expect(r.detail).toContain(contains); return r; },
});

it('P9-NF-01 P9-NF-02 exposes exactly ten closed, total, immutable payload decoders', () => {
  const context = factsFixture().c;
  expect(names).toHaveLength(10);
  for (const name of names) {
    const decoded = value(decodeVerificationRecord(name, verificationInput(name), context));
    expect(decoded.type).toBe(name); expect(Object.isFrozen(decoded)).toBe(true);
    refused(decodeVerificationRecord(name, { ...verificationInput(name), undeclared: true }, context), 'undeclared field');
    refused(decodeVerificationRecord(name, { ...verificationInput(name), schemaVersion: 2 }, context), 'schema version unknown');
    refused(decodeVerificationRecord(name, { ...verificationInput(name), id: '' }, context), 'identity/version');
  }
});

it('P9-NF-02 P9-NF-23 canonical bytes define version identity only after total decoding', () => {
  const context = factsFixture().c;
  const raw = verificationInput('VerificationAssessment');
  const decoded = value(decodeVerificationRecord('VerificationAssessment', JSON.parse(JSON.stringify(raw)), context));
  const canonicalRecord = value(canonical(decoded));
  expect(verificationIdentity(decoded)).toEqual({ id: raw.id, logicalKey: `assessment:${raw.request}:${raw.barVersion}:${raw.vectorDigest}`, canonicalHash: canonicalRecord.hash });
  expect(value(compareVerificationRecords('VerificationAssessment', raw, JSON.parse(canonicalRecord.bytes), context))).toEqual({ equal: true });
  refused(decodeVerificationRecord('VerificationAssessment', { ...raw, predicates: raw.predicates.filter(p => p.predicate !== 'charge') }, context), 'four settlement predicates separate');
});

it('P9-NF-02 same owned id with divergent canonical content yields an immutable-disagreement conflict', () => {
  const context = factsFixture().c;
  const left = verificationInput('VerificationRequest');
  const right = { ...left, missingEvidence: ['different-authoritative-receipt'] };
  const comparison = value(compareVerificationRecords('VerificationRequest', left, right, context));
  expect(comparison.equal).toBe(false);
  expect(comparison.conflict).toMatchObject({ kind: 'immutable-disagreement', key: `request:${left.logicalKey}:${left.predicate}` });
});

it('P9-NF-38 P9-NF-44 a default cannot invent a Decision and a zero benchmark denominator cannot turn green', () => {
  const context = factsFixture().c;
  const grade = verificationInput('Grade');
  refused(decodeVerificationRecord('Grade', { ...grade, decision: '', conclusion: { ...grade.conclusion, assessment: 'supported' } }, context), 'absent Decision');
  const evaluation = verificationInput('BenchmarkEvaluation');
  refused(decodeVerificationRecord('BenchmarkEvaluation', { ...evaluation, candidates: [], scenarios: [], executions: [], grades: [], sampleSize: 0, selection: 'route:a', complete: true }, context), 'zero denominator');
});
