import { expect, it } from 'vitest';
import { recoverUnsettledVerificationRequests } from '../../src/verification/index.js';
import { refused, value } from '../facts/fixtures.js';
import { verificationInput } from '../verification/fixture.js';
import { jointVerificationFixture } from '../verification/joint-fixture.js';

it('P9-NF-05 P9-NF-13 P9-NF-22 P9-NF-24 TRACE crash after effect before verification record reconstructs the original question and only queries', () => {
  const f = jointVerificationFixture();
  expect(value(f.runtime.inspect()).filter(row => row.record.type === 'VerificationRequest')).toHaveLength(0);
  f.effect.time(110);
  value(f.effect.transport.recover('verification-read', f.effect.fence, f.observed.operation, f.effect.api));
  const planFact = value(f.runtime.inspect()).find(row => row.record.type === 'VerificationPlan')!.fact.id;
  const recovered = value(recoverUnsettledVerificationRequests(f.host.current().facts.facts,
    [{ fact: planFact, plan: f.plan }], [], f.effect.clock(110), f.host.boundary));
  expect(recovered).toHaveLength(1);
  expect(recovered[0]).toMatchObject({ operation: f.observed.operation, attempt: f.reservation.attempt,
    reservation: expect.any(String), operationDigest: f.request.digest, plan: f.plan.id });
  expect(value(f.effect.api.inspect()).filter(row => row.record.type === 'EffectSettlement')).toHaveLength(0);
  expect(value(f.effect.transport.inspect()).filter(row => row.record.type === 'SettlementApplication')).toHaveLength(0);
  expect(f.effect.calls()).toBe(1); expect(f.effect.queries()).toBe(1);
});

it('P9-NF-24 TRACE duplicate delivery returns one request and assessment; it never renews observation time', () => {
  const f = jointVerificationFixture();
  const first = value(f.assessment.assess(f.input)); const firstView = value(f.assessment.read(first, f.input));
  const second = value(f.assessment.assess(f.input)); const secondView = value(f.assessment.read(second, f.input));
  expect(second).toEqual(first); expect(secondView).toEqual(firstView);
  const rows = value(f.runtime.inspect());
  expect(rows.filter(row => row.record.type === 'VerificationRequest')).toHaveLength(1);
  expect(rows.filter(row => row.record.type === 'VerificationAssessment')).toHaveLength(1);
  const assessment = rows.find(row => row.record.type === 'VerificationAssessment')!.record;
  expect(assessment.type === 'VerificationAssessment' && assessment.validFrom).toBe(100);
  expect(f.effect.calls()).toBe(1);
});

it('P9-NF-16 P9-NF-20 P9-NF-24 P9-NF-25 TRACE cancellation racing completion retains evidence and cost but inhibits consequential acceptance', () => {
  const f = jointVerificationFixture(); const reference = value(f.assessment.assess(f.input));
  value(f.assessment.read(reference, f.input)); f.effect.stop();
  refused(f.assessment.consumeCurrent(reference, f.input, () => 'continue'), 'stop or cancellation');
  refused(f.runtime.record('ProbeRecord', { ...verificationInput('ProbeRecord'), id: 'post-cancel-probe' }), 'stop inhibits');
  expect(value(f.runtime.inspect()).some(row => row.record.type === 'VerificationAssessment')).toBe(true);
  expect(value(f.effect.transport.inspect()).filter(row => row.record.type === 'AdmissionReservation').at(-1)!.record)
    .toMatchObject({ operation: f.observed.operation, charge: 20, state: 'consumed' });
  expect(f.effect.calls()).toBe(1);
});

it('P9-NF-24 TRACE stale authority refuses changed custody and exact-expiry reuse while retaining history', () => {
  const f = jointVerificationFixture(); const reference = value(f.assessment.assess(f.input));
  value(f.assessment.read(reference, f.input));
  f.captures[f.evidenceCapture] = { ...f.captures[f.evidenceCapture]!, bytes: null, status: 'missing' };
  refused(f.assessment.consumeCurrent(reference, f.input, () => 'continue'), 'assessment or evidence changed');
  expect(value(f.runtime.inspect()).filter(row => row.record.type === 'VerificationAssessment')).toHaveLength(1);
  const fresh = jointVerificationFixture(); const next = value(fresh.assessment.assess(fresh.input)); value(fresh.assessment.read(next, fresh.input));
  fresh.effect.time(200);
  refused(fresh.assessment.consumeCurrent(next, fresh.input, () => 'continue'), 'expired');
  expect(fresh.effect.calls()).toBe(1);
});
