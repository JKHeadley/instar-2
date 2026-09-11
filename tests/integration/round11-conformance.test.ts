// @ts-nocheck -- adversarial provider substitutions intentionally exercise runtime refusal boundaries.
import { expect, it } from 'vitest';
import { canonical, consumeResult, decode } from '../../src/index.js';
import { createOperatorSurface } from '../../src/operator/index.js';
import { probeBoundToCurrentEvidence } from '../../src/verification/index.js';
import { operatorFixture } from '../operator/fixture.js';
import { intakeFixture, value } from '../intake/fixtures.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { verificationInput } from '../verification/fixture.js';

const outcome = result => consumeResult(result, { Success: value => ({ accepted: true, value }),
  Refused: refusal => ({ accepted: false, detail: refusal.detail }) });

function protectionFixture(change = {}) {
  const operator = operatorFixture(), verification = verificationRuntimeFixture();
  const plan = verificationInput('VerificationPlan'), probe = verificationInput('ProbeRecord');
  value(verification.runtime.record('VerificationPlan', plan));
  value(verification.runtime.record('ProbeRecord', probe));
  operator.setClock(21);
  const receipt = { operation: probe.operation, path: probe.subject, requestDigest: operator.f.authorization.requestDigest,
    base: 'base:1', proposedHash: plan.bar.subjectDigest, authorization: 'authorization:1',
    priorHash: plan.bar.subjectDigest, effectiveHash: plan.bar.subjectDigest, disposition: 'committed',
    attestation: 'broker-receipt', ...change };
  const verificationPort = { ...verification.runtime, probeBound: (fact, at) => {
    const row = value(verification.runtime.inspectCurrent()).find(candidate => candidate.fact.id === fact);
    const current = verification.host.current();
    return verification.success(!!row && probeBoundToCurrentEvidence(plan, row.record, at,
      current.evidence, current.decode, current.facts, verification.host.boundary));
  } };
  const composition = { ...operator.composition,
    broker: { ...operator.composition.broker, query: () => operator.f.success(receipt),
      posture: () => operator.f.success('protected') },
    verification: verificationPort, isolation: { owner: 'part-ten', live: () => operator.f.success(true) } };
  return { operator, verification, plan, probe, composition,
    view: () => value(value(createOperatorSurface(composition)).protection(probe.operation, probe.subject)) };
}

it('V79 P11-NF-10 exact current independent digest displays protected', () => {
  const f = protectionFixture();
  expect(f.view()).toMatchObject({ posture: 'protected', effectiveDigest: f.plan.bar.subjectDigest, witnessFresh: true });
});

it('V80 P11-NF-10 P11-NF-11 a different independently witnessed digest cannot display protected', () => {
  const changed = `sha256:${'7'.repeat(64)}`, f = protectionFixture({ effectiveHash: changed, proposedHash: changed });
  expect(f.view()).toMatchObject({ posture: 'unprotected', effectiveDigest: changed,
    uncertainty: expect.arrayContaining(['independent-probe-effective-digest-mismatch']) });
});

for (const [id, method] of [['V81', 'posture'], ['V82', 'probeBound']]) {
  it(`${id} P11-NF-13 unavailable ${method} keeps read-only unprotected diagnosis`, () => {
    const f = protectionFixture();
    f.composition.verification[method] = () => decode('Scope',
      { type: 'Scope', schemaVersion: 1, kind: 'project', members: [] }, f.operator.context.decode);
    expect(outcome(value(createOperatorSurface(f.composition)).protection(f.probe.operation, f.probe.subject)))
      .toMatchObject({ accepted: true, value: { posture: 'unprotected' } });
  });
}

function grantInput(f, verified) {
  const raw = f.f.grant({ id: 'grant:recurrence', grantee: f.f.bob, standing: 'delegate', actions: ['work'],
    scope: f.f.scope, expiresAt: 400 });
  const fields = Object.fromEntries(Object.entries(raw).filter(([key]) => !['type', 'schemaVersion', 'source'].includes(key)));
  const signed = f.f.proof(fields, { id: 'alice', kind: 'person' }, 'intent-approval');
  const act = value(decode('StandingGrant', { type: 'StandingGrant', schemaVersion: 1, ...fields, source: signed.p },
    { ...f.context.decode, provenance: signed.p }));
  const challenge = f.f.proof({ ...verified.challengePayload, actDigest: value(canonical(act)).hash },
    { id: 'alice', kind: 'person' }, 'verified-operator-challenge');
  const proof = value(f.deps.capture.preserve(JSON.stringify({ type: 'VerifiedActProofBundle', schemaVersion: 1,
    challenge: challenge.input, act: signed.input }), f.f.now));
  f.syncCaptures();
  return { ...verified.input, act, proof };
}

it('V88 P11-NF-05 nonexistent recurrence history cannot satisfy standing-grant admission', () => {
  const f = intakeFixture(), verified = f.verifiedAct({ request: { recurrence: JSON.stringify(['missing:prior-request']) } });
  expect(outcome(f.port().admitVerifiedAct(grantInput(f, verified))).accepted).toBe(false);
});

it('V89 P11-NF-05 a real prior matching durable request is accepted as the recurrence neighbor', () => {
  const f = intakeFixture();
  const prior = f.verifiedAct({ request: { requestId: 'prior', recurrence: '[]' } });
  const verified = f.verifiedAct({ request: { requestId: 'current', recurrence: JSON.stringify([prior.request.id]) } });
  expect(value(f.port().admitVerifiedAct(grantInput(f, verified))).kind).toBe('approved');
});

it('V90 P11-NF-05 request without recurrence remains an ordinary approval without a grant candidate', () => {
  const f = operatorFixture();
  expect(value(f.surface().render(f.request.id)).standingGrantCandidate).toBeNull();
  expect(value(f.port().admitVerifiedAct(f.verifiedAct({ request: { requestId: 'ordinary', recurrence: '[]' } }).input)).kind)
    .toBe('approved');
});

it('V91 P11-NF-05 wrong-kind recurrence history cannot satisfy standing-grant admission', () => {
  const f = intakeFixture(), verified = f.verifiedAct({ request: { recurrence: JSON.stringify(['machine-a:0:0']) } });
  expect(f.facts().find(row => row.id === 'machine-a:0:0')?.kind).toBe('genesis-grant');
  expect(outcome(f.port().admitVerifiedAct(grantInput(f, verified))).accepted).toBe(false);
});

it('V92 P11-NF-05 a prior request for another operation cannot satisfy recurrence', () => {
  const f = intakeFixture();
  const prior = f.verifiedAct({ action: 'other', request: { requestId: 'other-action', recurrence: '[]' } });
  const verified = f.verifiedAct({ request: { requestId: 'current-work', recurrence: JSON.stringify([prior.request.id]) } });
  expect(outcome(f.port().admitVerifiedAct(grantInput(f, verified))).accepted).toBe(false);
});
