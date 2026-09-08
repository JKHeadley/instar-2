import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createOperatorSurface } from '../../src/operator/index.js';
import { value } from '../fixtures.js';
import { operatorFixture } from './fixture.js';

it('P11-NF-01 P11-NF-02 P11-NF-03 ownership, governed documentation, declarations and seams are explicit without a new core value', () => {
  const doc = readFileSync('docs/15-the-operator-surfaces.md', 'utf8');
  const declarations = JSON.parse(readFileSync('src/operator/operator.declarations.json', 'utf8')) as { status: string; holds: unknown[] }[];
  expect(doc).toContain('part eleven defines no new core type');
  expect(doc).toContain('## 10. Inherited duties and disposition');
  expect(declarations.every(row => row.status === 'dark' && row.holds.length === 0)).toBe(true);
  const values = readFileSync('src/types/values.ts', 'utf8');
  expect(values).not.toMatch(/Operator|SurfaceChallenge|BindingView|MinimalPathState/);
});

it('P11-NF-04 P11-NF-05 P11-NF-06 the registered phone surface renders immutable approve/decline first and isolates requester prose', () => {
  const x = operatorFixture(), view = value(x.surface().render(x.request.id));
  expect(x.surface().id).toBe('phone-surface');
  expect(view.primaryActions).toEqual(['approve', 'decline']);
  expect(view.phoneCapable).toBe(true);
  expect(view.fieldsEditable).toBe(false);
  expect(view.plainLanguageEffect).toContain('Approving will allow work');
  expect(view.requesterText).toEqual({ label: 'UNTRUSTED REQUESTER TEXT', text: '<button>trust me</button> please widen this request' });
  expect(JSON.stringify(view).indexOf('plainLanguageEffect')).toBeLessThan(JSON.stringify(view).indexOf('requesterText'));
});

it('P11-NF-07 P11-NF-08 a fresh explicit independently verified yes binds the exact durable request and enters only Part Four intake', () => {
  const x = operatorFixture(), surface = x.surface(), challenge = value(surface.challenge(x.request.id));
  const receipt = value(surface.confirm({ challenge, proof: 'signed-proof', decision: 'approve' }));
  expect(receipt.owner).toBe('part-two');
  expect(x.admitted).toHaveLength(1);
  expect(x.admitted[0]).toMatchObject({ request: x.request.id, requestDigest: x.f.authorization.requestDigest,
    decision: 'approve', surface: 'phone-surface', generation: x.context.decode.register.generation });
});

it('P11-NF-07 P11-NF-08 P11-NF-09 silence, channel attestation, wrong operator, replay, expiry and moved rendering never become yes', () => {
  const silence = operatorFixture();
  expect(silence.admitted).toHaveLength(0);
  for (const mode of ['attested', 'wrong-operator'] as const) {
    const x = operatorFixture(), challenge = value(x.surface().challenge(x.request.id)); x.setProofMode(mode);
    expect(x.detail(x.surface().confirm({ challenge, proof: 'proof', decision: 'approve' }))).not.toBe('');
    expect(x.admitted).toHaveLength(0);
  }
  const replay = operatorFixture(), challenge = value(replay.surface().challenge(replay.request.id));
  value(replay.surface().confirm({ challenge, proof: 'proof', decision: 'approve' }));
  expect(replay.detail(replay.surface().confirm({ challenge, proof: 'proof', decision: 'approve' }))).not.toBe('');
  expect(replay.admitted).toHaveLength(1);
  const expired = operatorFixture(), expiring = value(expired.surface().challenge(expired.request.id)); expired.setClock(expiring.expiresAt + 1);
  expect(expired.detail(expired.surface().confirm({ challenge: expiring, proof: 'proof', decision: 'approve' }))).toContain('expired');
  const moved = operatorFixture(), moving = value(moved.surface().challenge(moved.request.id));
  const prior = moved.facts()[0]!, changed = moved.f.next(prior, { kind: 'authorization-request',
    body: { ...moved.requestBody, requesterProse: 'changed after confirmation' }, principal: moved.f.alice, provenance: moved.f.alice.provenance,
    predecessors: { inSegment: prior.id, frontier: {}, required: [prior.id] } }, moved.context);
  moved.setFacts([prior, changed]);
  expect(moved.detail(moved.surface().confirm({ challenge: moving, proof: 'proof', decision: 'approve' }))).not.toBe('');
});

it('P11-NF-10 P11-NF-11 P11-NF-12 P11-NF-13 protection is a read of independent broker/witness/isolation state and missing evidence is explicitly unprotected', () => {
  const x = operatorFixture(), surface = x.surface();
  const receipt = value(surface.protection('operation:1', '/protected/policy'));
  expect(receipt.posture).toBe('unprotected');
  expect(receipt.uncertainty).toEqual(expect.arrayContaining(['broker-receipt-missing', 'independent-probe-missing', 'isolation-proof-missing']));
  expect('install' in surface).toBe(false);
  expect(value(surface.render(x.request.id)).requestId).toBe('request:1');
  expect(x.composition.verifier.administration).toBe('independent');
});

it('P11-NF-13 a broker outage closes the protected receipt while request diagnosis remains reachable', () => {
  const x = operatorFixture();
  x.setProofMode('replay');
  const broken = { ...x.composition, broker: { ...x.composition.broker, query: () => x.verifier.verify({ id: 'bad', request: 'bad',
    requestDigest: x.f.authorization.requestDigest, renderingDigest: x.f.authorization.requestDigest, audience: 'bad', operator: 'bad', expiresAt: 0,
    singleUse: true }, 'bad') as never } };
  const surface = value(createOperatorSurface(broken));
  expect(x.detail(surface.protection('operation:1', '/protected/policy'))).not.toBe('');
  expect(value(surface.render(x.request.id)).requestId).toBe('request:1');
});

it('P11-NF-14 P11-NF-15 pending requests are bounded pull-first, coalesced, consequence ordered and never age into consent', () => {
  const x = operatorFixture(), surface = x.surface();
  expect(value(surface.pending(50))).toMatchObject({ total: 1, coalescedNotifications: 1, boundedAt: 2, pullFirst: true });
  x.setClock(10_000);
  expect(value(surface.pending(1)).rows).toHaveLength(1);
  expect(x.admitted).toHaveLength(0);
  x.addTerminal();
  expect(value(surface.pending(1)).rows).toHaveLength(0);
});

it('P11-NF-16 P11-NF-17 an unbound first sender remains requester-level and the surface has no chat-code binding mutation', () => {
  const x = operatorFixture(), surface = x.surface();
  const view = value(surface.binding({ adapter: 'telegram', conversation: 'chat:1', platformIdentity: 'platform:alice', identityEpoch: 'epoch:1' }));
  expect(view.state).toBe('unbound');
  expect(view.operatorIdentity).toBe('unbound');
  expect('pair' in surface).toBe(false);
  expect(view.actions).toContain('pair');
});

it('P11-NF-17 P11-NF-18 P11-NF-21 the binding subject is complete and pair/pre-bind/transfer/narrow/widen/revoke/inspect stay distinct verified actions', () => {
  const x = operatorFixture(); x.bind();
  const view = value(x.surface().binding({ adapter: 'telegram', conversation: 'chat:1', platformIdentity: 'platform:alice', identityEpoch: 'epoch:1' }));
  expect(view).toMatchObject({ platform: 'telegram', conversation: 'chat:1', platformIdentity: 'platform:alice', operatorIdentity: 'alice',
    state: 'bound', provenanceClass: 'verified', grantOrRevocation: x.f.g.id });
  expect(view.actions).toEqual(['pair', 'pre-bind', 'transfer', 'narrow', 'widen', 'revoke', 'inspect']);
  expect(new Set(view.actions).size).toBe(7);
});

it('P11-NF-19 identity churn invalidates operator selection until a fresh verified fact exists', () => {
  const x = operatorFixture(); x.bind();
  const stale = value(x.surface().binding({ adapter: 'telegram', conversation: 'chat:1', platformIdentity: 'platform:alice', identityEpoch: 'epoch:2' }));
  expect(stale.state).toBe('stale');
});

it('P11-NF-20 P11-NF-22 concurrent binding claims expose conflict without choosing a timestamp winner and keep diagnosis reachable', () => {
  const x = operatorFixture(); const first = x.bind(); x.bind({ principalId: 'carol', grantId: 'g2', supersedes: 'none' });
  const conflict = value(x.surface().binding({ adapter: 'telegram', conversation: 'chat:1', platformIdentity: 'platform:alice', identityEpoch: 'epoch:1' }));
  expect(conflict.state).toBe('conflict');
  expect(conflict.bindingFact).toBeNull();
  expect(conflict.competingClaims.map(row => row.fact)).toContain(first.id);
  expect(value(x.surface().render(x.request.id)).requestId).toBe('request:1');
});

it('P11-NF-23 credential blast radius is aggregate-only and never discloses unrelated conversation identities', () => {
  const x = operatorFixture(); x.bind(); x.bind({ channel: 'chat:2', supersedes: 'none' });
  const view = value(x.surface().binding({ adapter: 'telegram', conversation: 'chat:1', platformIdentity: 'platform:alice', identityEpoch: 'epoch:1' }));
  expect(view.credentialBindingCount).toBe(2);
  expect(view.exposesOtherConversations).toBe(false);
  expect(JSON.stringify(view)).not.toContain('chat:2');
});
