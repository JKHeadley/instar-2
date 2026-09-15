import { canonical, decode } from '../../src/index.js';
import type { Revocation } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { generationOf } from '../../src/register/index.js';
import { privateKey, json, value } from '../facts/fixtures.js';
import { intakeFixture } from './fixtures.js';

export function useDifferentLiveRegisterGeneration(fixture: ReturnType<typeof intakeFixture>) {
  const alternate = fixture.govern(fixture.registerInput.sources.map(source => source.declaration)
    .filter((declaration: any) => declaration.id !== 'phone-surface'));
  const next = value(generationOf(alternate.governance.register, alternate.governance.context));
  if (next.id === fixture.generation.id) throw new Error('round-20 fixture did not produce a distinct real register generation');
  Object.assign(fixture.context, { decode: { ...fixture.context.decode, register: { ...fixture.context.decode.register,
    generation: { owner: 'part-three', name: 'RegisterGeneration', id: next.id } } } });
  return { loaded: fixture.generation.id, live: next.id };
}

export function round20RevocationAdmission(target: 'intended' | 'other', directory?: string) {
  const fixture = intakeFixture(directory ? { directory } : {});
  Object.assign(fixture.context, { decode: { ...fixture.context.decode, register: { ...fixture.context.decode.register,
    actions: { ...fixture.context.decode.register.actions, 'revoke-standing': { protected: true, repository: false } } } } });
  fixture.bind();

  const grants = ['intended', 'other'].map(suffix => fixture.f.grant({ id: `target:${suffix}`, scope: fixture.f.scope,
    grantee: fixture.f.bob, standing: 'delegate', actions: ['work'] }));
  fixture.syncCaptures();
  for (const grant of grants) {
    const context = { ...fixture.context, decode: { ...fixture.context.decode, provenance: grant.source } };
    value(authorAndAppend({ kind: 'genesis-grant', schemaVersion: 1, machine: 'machine-a', principal: json(fixture.f.alice),
      provenance: json(grant.source), at: json(fixture.f.now), body: { grant: json(grant) }, required: [] },
    context, createFactStore(context, fixture.storage), privateKey));
  }

  const intended = grants[0]!;
  const canonicalTarget = value(canonical(intended));
  value(fixture.deps.capture.preserve(canonicalTarget.bytes, fixture.f.now));
  fixture.syncCaptures();
  Object.assign(fixture.context, { decode: { ...fixture.context.decode, artifact: canonicalTarget.hash } });

  const requestDigest = value(canonical({ type: 'AuthorizationRequest', schemaVersion: 1, approver: 'alice',
    action: 'revoke-standing', scope: fixture.f.scope, artifact: canonicalTarget.hash, base: 'base:1' })).hash;
  const verified = fixture.verifiedAct({ action: 'revoke-standing', request: { artifact: canonicalTarget.hash,
    requestDigest, requesterProse: 'untrusted requester prose names target:other' } });
  const fields = { id: `revocation:${target}`, grantId: `target:${target}`, by: fixture.f.alice,
    at: fixture.f.now, reason: 'withdrawn' };
  const signed = fixture.f.proof(fields, { id: 'alice', kind: 'person' }, 'approval');
  const act = value(decode('Revocation', { type: 'Revocation', schemaVersion: 1, ...fields, source: signed.p },
    { ...fixture.context.decode, provenance: signed.p })) as Revocation;
  const challenge = fixture.f.proof({ ...verified.challengePayload, actDigest: value(canonical(act)).hash },
    { id: 'alice', kind: 'person' }, 'verified-operator-challenge');
  const proof = value(fixture.deps.capture.preserve(JSON.stringify({ type: 'VerifiedActProofBundle', schemaVersion: 1,
    challenge: challenge.input, act: signed.input }), fixture.f.now));
  fixture.syncCaptures();
  return { fixture, request: verified.requestBody, target: intended,
    input: { ...verified.input, act, proof } as typeof verified.input };
}
