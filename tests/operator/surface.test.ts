import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createOperatorSurface } from '../../src/operator/index.js';
import type { FactSnapshot } from '../../src/facts/index.js';
import { verificationInput } from '../verification/fixture.js';
import { verificationRuntimeFixture } from '../verification/runtime-fixture.js';
import { probeBoundToCurrentEvidence } from '../../src/verification/index.js';
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

it('R9-F3 V69 a channel-attested authentic requester renders while the operator remains independently verified', () => {
  const x = operatorFixture(), requester = x.f.principal('bob', 'person', true);
  x.syncCaptures();
  const history = { ...x.history, decode: () => ({ ...x.history.decode(),
    principals: x.history.decode().principals?.map(principal => principal.id === requester.id ? requester : principal) }) };
  const surface = value(createOperatorSurface({ ...x.composition, history }));
  const view = value(surface.render(x.request.id));
  expect(view.requestedBy).toMatchObject({ id: 'bob', provenance: { class: 'channel-attested' } });
  expect(view.approver).toMatchObject({ id: 'alice', provenance: { class: 'verified' } });
});

it('P11-NF-07 P11-NF-08 a fresh explicit independently verified yes binds the exact durable request and enters only Part Four intake', () => {
  const x = operatorFixture(), surface = x.surface(), challenge = value(surface.challenge(x.request.id));
  const receipt = value(surface.confirm({ challenge, proof: 'signed-proof', decision: 'approve' }));
  expect(receipt.owner).toBe('part-two');
  expect(x.admitted).toHaveLength(1);
  expect(x.admitted[0]).toMatchObject({ request: { owner: 'part-two', name: 'FactEnvelope', id: x.request.id }, requestDigest: x.f.authorization.requestDigest,
    decision: 'approve', surface: 'phone-surface', generation: x.history.generation() });
  const terminal = x.facts().filter(fact => fact.kind === 'intake-verified-act');
  expect(terminal).toHaveLength(1);
  expect(terminal[0]!.body).toMatchObject({ request: x.request.id, requestDigest: x.f.authorization.requestDigest,
    disposition: 'approved', surface: 'phone-surface' });
});

it('P11-NF-07 P11-NF-08 copied, altered, or stale status snapshots never substitute for current Part Two history', () => {
  const copied = operatorFixture(), copy = JSON.parse(JSON.stringify(copied.current())) as FactSnapshot;
  const copiedSurface = value(createOperatorSurface({ ...copied.composition,
    history: { ...copied.history, current: () => copied.f.success(copy) } }));
  expect(copied.detail(copiedSurface.render(copied.request.id))).toContain('Part Two-issued');

  const altered = operatorFixture(), alteredCopy = JSON.parse(JSON.stringify(altered.current())) as FactSnapshot;
  (alteredCopy.entries[1]!.body as Record<string, unknown>).audience = 'unsigned-audience';
  const alteredSurface = value(createOperatorSurface({ ...altered.composition,
    history: { ...altered.history, current: () => altered.f.success(alteredCopy) } }));
  expect(altered.detail(alteredSurface.render(altered.request.id))).toContain('Part Two-issued');

  const stale = operatorFixture(), issued = stale.current();
  (stale.context.decode.principals as unknown as { push(value: typeof stale.f.alice): void })
    .push(stale.f.principal('later-principal'));
  const staleSurface = value(createOperatorSurface({ ...stale.composition,
    history: { ...stale.history, current: () => stale.f.success(issued) } }));
  expect(stale.detail(staleSurface.render(stale.request.id))).toContain('current Part Two-issued');
});

it('P11-NF-06 P11-NF-07 P11-NF-08 the surface relays exact acts and Part Four refuses unrecognized, pre-resolved, or broad authority', () => {
  for (const act of [{ valid: true, scope: 'all', grant: 'all' }, operatorFixture().f.alice]) {
    const x = operatorFixture(); x.setAct(act);
    const surface = x.surface();
    const challenge = value(surface.challenge(x.request.id));
    expect(x.detail(surface.confirm({ challenge, proof: 'proof', decision: 'approve' }))).not.toBe('');
    expect(x.admitted).toHaveLength(1);
    expect(x.facts().some(fact => fact.kind === 'intake-verified-act')).toBe(false);
  }
  const broad = operatorFixture(), grant = broad.f.grant({ id: 'unrelated', scope: broad.f.org }); broad.setAct(grant);
  const surface = broad.surface();
  const challenge = value(surface.challenge(broad.request.id));
  expect(broad.detail(surface.confirm({ challenge, proof: 'proof', decision: 'approve' }))).not.toBe('');
  expect(broad.admitted).toHaveLength(1);
  expect(broad.facts().some(fact => fact.kind === 'intake-verified-act')).toBe(false);
});

it('P11-NF-09 P11-NF-14 confirmation rechecks signed terminal state and request-level replay', () => {
  const declined = operatorFixture(), surface = declined.surface(), challenge = value(surface.challenge(declined.request.id));
  declined.addTerminal('declined');
  expect(declined.detail(surface.confirm({ challenge, proof: 'proof', decision: 'approve' }))).toContain('already terminal');
  expect(declined.admitted).toHaveLength(0);

  const consumed = operatorFixture(), first = consumed.surface(), firstChallenge = value(first.challenge(consumed.request.id));
  value(first.confirm({ challenge: firstChallenge, proof: 'proof', decision: 'approve' }));
  const replacement = consumed.surface(), secondChallenge = value(replacement.challenge(consumed.request.id));
  expect(consumed.detail(replacement.confirm({ challenge: secondChallenge, proof: 'proof', decision: 'approve' }))).toContain('already terminal');
  expect(consumed.admitted).toHaveLength(1);
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

it('P11-NF-07 an unknown decision and a registered non-surface producer both refuse before Part Four admission', () => {
  const unknown = operatorFixture(), surface = unknown.surface(), challenge = value(surface.challenge(unknown.request.id));
  expect(unknown.detail(surface.confirm({ challenge, proof: 'proof', decision: 'unknown' as 'approve' }))).toContain('exactly approve or decline');
  expect(unknown.admitted).toHaveLength(0);
  const wrong = operatorFixture();
  const other = value(createOperatorSurface({ ...wrong.composition, id: 'chat:1' }));
  const otherChallenge = value(other.challenge(wrong.request.id));
  expect(wrong.detail(other.confirm({ challenge: otherChallenge, proof: 'proof', decision: 'approve' }))).toContain('registered surface');
  expect(wrong.admitted).toHaveLength(0);
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

function independentlyEvaluatedProtection(unwitnessed = false, staleGeneration = false, wrongReceiptPath = false) {
  const x = operatorFixture(), verification = verificationRuntimeFixture();
  const plan = verificationInput('VerificationPlan');
  value(verification.runtime.record('VerificationPlan', plan));
  const probe = { ...verificationInput('ProbeRecord'), ...(unwitnessed ? { witnesses: ['missing-witness'] } : {}) };
  value(verification.runtime.record('ProbeRecord', probe));
  if (staleGeneration) verification.setGeneration('generation:2');
  x.setClock(21);
  const owner = value(verification.runtime.posture(plan.id, verification.clock(21)));
  const witnessedDigest = plan.bar.subjectDigest as `sha256:${string}`;
  const broker = { ...x.composition.broker, posture: () => x.f.success('protected' as const), query: () => x.f.success({
    operation: probe.operation, path: wrongReceiptPath ? 'other-path' : probe.subject,
    requestDigest: x.f.authorization.requestDigest, base: 'base:1', proposedHash: witnessedDigest,
    authorization: 'authorization:1', priorHash: witnessedDigest, effectiveHash: witnessedDigest,
    disposition: 'committed' as const, attestation: 'broker-receipt',
  }) };
  const verificationPort = { ...verification.runtime, probeBound: (fact: string, at: ReturnType<typeof verification.clock>) => {
    const rows = value(verification.runtime.inspectCurrent()), row = rows.find(candidate => candidate.fact.id === fact);
    if (!row || row.record.type !== 'ProbeRecord') return verification.success(false);
    const probeRecord = row.record;
    const selected = rows.find(candidate => candidate.record.type === 'VerificationPlan' && candidate.record.id === probeRecord.plan);
    if (!selected || selected.record.type !== 'VerificationPlan') return verification.success(false);
    const current = verification.host.current();
    return verification.success(probeBoundToCurrentEvidence(selected.record, probeRecord, at, current.evidence,
      current.decode, current.facts, verification.host.boundary));
  } };
  const surface = value(createOperatorSurface({ ...x.composition, broker, verification: verificationPort,
    isolation: { owner: 'part-ten', live: () => x.f.success(true) } }));
  return { owner, view: value(surface.protection(probe.operation, probe.subject)) };
}

it('P11-NF-10 P11-NF-11 P11-NF-13 displayed protection follows current Part Nine posture and exact receipt subject', () => {
  const clean = independentlyEvaluatedProtection();
  expect([clean.owner.posture, clean.view.posture]).toEqual(['healthy', 'protected']);
  for (const result of [independentlyEvaluatedProtection(true), independentlyEvaluatedProtection(false, true)]) {
    expect(result.owner.posture).toBe('unknown');
    expect(result.view.posture).toBe('unprotected');
    expect(result.view.witnessFresh).toBe(false);
  }
  const mismatch = independentlyEvaluatedProtection(false, false, true).view;
  expect(mismatch.posture).toBe('unprotected');
  expect(mismatch.brokerReceipt).toBeNull();
  expect(mismatch.uncertainty).toContain('broker-receipt-subject-mismatch');
});

it('P11-NF-10 P11-NF-13 an unwitnessed operation cannot borrow a healthy result from another probe in the same Part Nine plan', () => {
  const x = operatorFixture(), verification = verificationRuntimeFixture(), plan = verificationInput('VerificationPlan');
  value(verification.runtime.record('VerificationPlan', plan));
  const earlier = { ...verificationInput('ProbeRecord'), id: 'probe:earlier', slot: 'slot:earlier', attempt: 'attempt:earlier',
    operation: 'operation:earlier', startedAt: 5, completedAt: 15, witnesses: ['missing-witness'] };
  value(verification.runtime.record('ProbeRecord', earlier));
  value(verification.runtime.record('ProbeRecord', verificationInput('ProbeRecord')));
  x.setClock(21);
  expect(value(verification.runtime.posture(plan.id, verification.clock(21))).posture).toBe('healthy');
  const rows = value(verification.runtime.inspectCurrent());
  const verificationPort = { ...verification.runtime, probeBound: (fact: string, at: ReturnType<typeof verification.clock>) => {
    const row = rows.find(candidate => candidate.fact.id === fact);
    if (!row || row.record.type !== 'ProbeRecord') return verification.success(false);
    const probeRecord = row.record;
    const selected = rows.find(candidate => candidate.record.type === 'VerificationPlan' && candidate.record.id === probeRecord.plan);
    if (!selected || selected.record.type !== 'VerificationPlan') return verification.success(false);
    const current = verification.host.current();
    return verification.success(probeBoundToCurrentEvidence(selected.record, probeRecord, at, current.evidence,
      current.decode, current.facts, verification.host.boundary));
  } };
  const broker = { ...x.composition.broker, posture: () => x.f.success('protected' as const), query: () => x.f.success({
    operation: earlier.operation, path: earlier.subject, requestDigest: x.f.authorization.requestDigest, base: 'base:1',
    proposedHash: x.f.artifact, authorization: 'authorization:1', priorHash: x.f.artifact, effectiveHash: x.f.artifact,
    disposition: 'committed' as const, attestation: 'broker-receipt',
  }) };
  const protectedSurface = value(createOperatorSurface({ ...x.composition, broker, verification: verificationPort,
    isolation: { owner: 'part-ten', live: () => x.f.success(true) } }));
  expect(value(protectedSurface.protection(earlier.operation, earlier.subject))).toMatchObject({ posture: 'unprotected', witnessFresh: false });
});

it('R9-F4 V68 a broker outage renders explicit unprotected evidence while request diagnosis remains reachable', () => {
  const x = operatorFixture();
  x.setProofMode('replay');
  const broken = { ...x.composition, broker: { ...x.composition.broker, query: () => x.verifier.verify({ id: 'bad', request: 'bad',
    requestDigest: x.f.authorization.requestDigest, renderingDigest: x.f.authorization.requestDigest, audience: 'bad', operator: 'bad', expiresAt: 0,
    singleUse: true, action: 'work', scope: x.f.scope, requestedBy: x.f.bob.id, artifact: x.f.artifact, base: x.f.authorization.base,
    issuedAt: 0, surface: 'phone-surface', generation: x.context.decode.register.generation }, 'bad', 'approve') as never } };
  const surface = value(createOperatorSurface(broken));
  const protection = value(surface.protection('operation:1', '/protected/policy'));
  expect(protection.posture).toBe('unprotected');
  expect(protection.uncertainty).toEqual(expect.arrayContaining([
    expect.stringContaining('broker-evidence-unavailable:'), 'broker-receipt-missing',
  ]));
  expect('install' in surface).toBe(false);
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

it('P11-V22 R6 pending omits a superseded row without hiding the clean causal successor', () => {
  const x = operatorFixture();
  const latest = x.verifiedAct({ surface: 'phone-surface', request: { requestId: 'request:1' } });
  const surface = x.surface();
  expect(value(surface.render(latest.request.id)).fact).toBe(latest.request.id);
  const pending = value(surface.pending(2));
  expect(pending.rows.map(row => row.fact)).toContain(latest.request.id);
  expect(pending.rows.map(row => row.fact)).not.toContain(x.request.id);
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
    state: 'bound', provenanceClass: 'verified', grantOrRevocation: 'binding-grant' });
  expect(view.actions).toEqual(['pair', 'pre-bind', 'transfer', 'narrow', 'widen', 'revoke', 'inspect']);
  expect(new Set(view.actions).size).toBe(7);
});

it('P11-NF-17 P11-NF-18 a binding whose reported grant is absent from resolved authority remains unbound', () => {
  const x = operatorFixture(); x.bind({ grantId: 'missing-grant' });
  const view = value(x.surface().binding({ adapter: 'telegram', conversation: 'chat:1', platformIdentity: 'platform:alice', identityEpoch: 'epoch:1' }));
  expect(view.state).toBe('unbound');
  expect(view.operatorIdentity).toBe('unbound');
  expect(view.grantOrRevocation).toBe('none');
});

it('P11-NF-04 P11-NF-15 a surface identifier must resolve in the current register and every bound is finite', () => {
  const x = operatorFixture();
  const unregistered = value(createOperatorSurface({ ...x.composition, id: 'unregistered-surface' }));
  const challenge = value(unregistered.challenge(x.request.id));
  expect(x.detail(unregistered.confirm({ challenge, proof: 'proof', decision: 'approve' }))).toContain('currently registered surface');
  expect(x.admitted).toHaveLength(0);
  for (const overrides of [{ maxPending: Infinity }, { challengeLifetime: Infinity }, { witnessFreshness: Infinity }, { maxPending: 1.5 }])
    expect(x.detail(createOperatorSurface({ ...x.composition, ...overrides }))).toContain('finite bounds');
  expect(value(createOperatorSurface({ ...x.composition, maxPending: 1, challengeLifetime: 1, witnessFreshness: 1 })).id).toBe('phone-surface');
});

it('P11-NF-07 P11-NF-13 P11-NF-22 the independent emergency brake stays open without authority intake and carries no authority act', () => {
  const x = operatorFixture(), surface = value(createOperatorSurface({ ...x.composition, intake: null }));
  const challenge = value(surface.stopChallenge({ operator: x.f.alice.id, scope: x.f.scope }));
  const receipt = value(surface.stop({ challenge, proof: 'independent-proof', scope: x.f.scope }));
  expect(receipt.owner).toBe('part-two');
  expect(x.stopped).toHaveLength(1);
  expect(x.stopped[0]).toMatchObject({ principal: { id: x.f.alice.id }, surface: 'phone-surface' });
  expect(x.admitted).toHaveLength(0);

  const smuggled = operatorFixture();
  const unsafe = value(createOperatorSurface({ ...smuggled.composition, verifier: { ...smuggled.verifier,
    verify: (candidate, _proof, decision) => {
      const verified = value(smuggled.proofFor(candidate, decision));
      return smuggled.f.success({ ...verified, act: smuggled.f.authorization });
    } } }));
  const unsafeChallenge = value(unsafe.stopChallenge({ operator: smuggled.f.alice.id, scope: smuggled.f.scope }));
  expect(smuggled.detail(unsafe.stop({ challenge: unsafeChallenge, proof: 'proof', scope: smuggled.f.scope }))).toContain('no authority act');
  expect(smuggled.stopped).toHaveLength(0);
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
