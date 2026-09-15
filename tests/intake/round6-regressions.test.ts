import { expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { intakeFixture, message, refused, route, value } from './fixtures.js';

it('R6-F1 V48/V51/V52 ordinary receive and recovery keep the additive verified-act decoder on every port', () => {
  const f = intakeFixture(), verified = f.verifiedAct(), first = f.port();
  const admitted = value(first.receive(message('ordinary before verified act'), route));
  expect(admitted.kind).toBe('admitted');
  const receipt = f.facts().find(row => row.kind === 'intake-receipt')!;
  value(first.admitVerifiedAct(verified.input));
  expect(value(first.receive(message('ordinary after verified act'), { ...route, eventId: 'event:after' })).kind).toBe('admitted');
  expect(value(first.recover(receipt.id)).kind).toBe('duplicate');
  expect(value(f.port().receive(message('ordinary on fresh port'), { ...route, eventId: 'event:fresh' })).kind).toBe('admitted');
});

function standingGrantDisposition(expiresAt: number) {
  const f = intakeFixture();
  const prior = f.verifiedAct({ request: { requestId: 'request:prior-standing-grant', recurrence: '[]' } });
  const verified = f.verifiedAct({ request: { recurrence: JSON.stringify([prior.request.id]) } });
  const raw = f.f.grant({ id: `grant:selected:${expiresAt}`, grantee: f.f.bob, standing: 'delegate',
    actions: ['work'], scope: f.f.scope, expiresAt });
  const fields = Object.fromEntries(Object.entries(raw).filter(([key]) => !['type', 'schemaVersion', 'source'].includes(key)));
  const signed = f.f.proof(fields, { id: 'alice', kind: 'person' }, 'intent-approval');
  const act = value(decode('StandingGrant', { type: 'StandingGrant', schemaVersion: 1, ...fields, source: signed.p },
    { ...f.context.decode, provenance: signed.p }));
  const challenge = f.f.proof({ ...verified.challengePayload, actDigest: value(canonical(act)).hash },
    { id: 'alice', kind: 'person' }, 'verified-operator-challenge');
  const proof = value(f.deps.capture.preserve(JSON.stringify({ type: 'VerifiedActProofBundle', schemaVersion: 1,
    challenge: challenge.input, act: signed.input }), f.f.now));
  f.syncCaptures();
  return f.port().admitVerifiedAct({ ...verified.input, act, proof });
}

it('R6-F2 V35/V37 accepts only the durable request-derived standing-grant expiry', () => {
  expect(value(standingGrantDisposition(400)).kind).toBe('approved');
  refused(standingGrantDisposition(1_000_000), 'term differs');
});
