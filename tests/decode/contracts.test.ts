import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { aggregateStrength, canonical, compare, compareMeasurements, consumeResult, decode, decodeMeasurement, decodeIntake, grantLiveness, isValid,
  readEvidence, retryPermission, scopeIncludes } from '../../src/index.js';
import type { Clock, Inventory, Measurement, Result } from '../../src/index.js';
import { bytes, clone, digest, fixture, omission, raw, value } from '../fixtures.js';

function rejected<T>(result: Result<T>, detail?: string) {
  consumeResult(result, { Success: v => { throw new Error(`invalid input accepted: ${JSON.stringify(v)}`); },
    Refused: r => { expect(r.preserved).toBeTruthy(); expect(r.detail).toBeTruthy(); if (detail) expect(r.detail).toContain(detail); } });
}
describe('part one decoding contract', () => {
  it('NF-03 rejects unregistered verifiedBy', () => { const f = fixture(); rejected(decode('VerifiedPrincipal', raw('VerifiedPrincipal', { id: 'alice', kind: 'person', verifiedBy: 'invented' }), { ...f.ctx, provenance: f.alice.provenance }), 'verifiedBy'); });
  it('NF-04 refuses relay input relabeled person', () => { const f = fixture(); rejected(decode('VerifiedPrincipal', raw('VerifiedPrincipal', { id: 'bob', kind: 'person' }), { ...f.ctx, provenance: f.bob.provenance }), 'kind'); });
  it('NF-05 requires recorded grant source', () => { const f = fixture(); const a = f.grantInput({ grantor: { kind: 'conversation' } }); rejected(decode('StandingGrant', a.input, a.context), 'grantor'); });
  it('NF-06 refuses grantor whose standing expired before issuance', () => {
    const f = fixture(); const expiring = f.grant({ id: 'expiring', expiresAt: 105 });
    const a = f.authorize({ id: 'delegation', under: expiring.id, kind: { kind: 'grant' } });
    const g = f.grantInput({ id: 'child', grantor: { kind: 'principal', who: f.alice, authorization: a.id }, issuedAt: f.clock(110), expiresAt: 200 });
    rejected(decode('StandingGrant', g.input, { ...g.context, currentBase: a.base, artifact: a.artifact }), 'not live');
  });
  it('NF-07 requester is never a grant', () => { const f = fixture(); const g = f.grantInput({ standing: 'requester' }); rejected(decode('StandingGrant', g.input, g.context), 'standing'); });
  it('NF-08 delegate actions are nonempty and registered', () => { const f = fixture(); for (const actions of [[], ['invented']]) { const g = f.grantInput({ standing: 'delegate', actions }); rejected(decode('StandingGrant', g.input, g.context), actions.length ? 'action' : 'actions'); } });
  it('NF-09 principal-issued grants require expiry', () => { const f = fixture(); const g = f.grantInput({ grantor: { kind: 'principal', who: f.alice, authorization: 'anything' } }); rejected(decode('StandingGrant', g.input, g.context), 'expiresAt'); });
  it('NF-12 detects supersession cycles', () => { const f = fixture(); rejected(decode('Directive', f.directiveInput({ supersedes: 'd1' }), f.ctx), 'cycle'); });
  it('NF-13 preserves raw before interpretation', () => { const f = fixture(); rejected(decode('Intent', omission(f.intentInput(), 'raw'), f.ctx), 'raw'); });
  it('NF-16 refusals require preserved input', () => { const f = fixture(); rejected(decode('Result', omission(f.refusedInput(), 'preserved'), f.ctx), 'preserved'); });
  it('NF-17 refusal direction matches its site', () => { const f = fixture(); rejected(decode('Result', f.refusedInput({ failDirection: 'open' }), f.ctx), 'failDirection'); });
  it('NF-18 refusal reasons are closed', () => { const f = fixture(); rejected(decode('Result', f.refusedInput({ reason: 'oops' }), f.ctx), 'reason'); });
  it('NF-19 checks the public producers expected subject against actual bytes', () => {
    const f = fixture();
    rejected(decodeMeasurement('detection-latency', f.clockRaw(), f.ctx), 'subject.kind');
    rejected(decodeMeasurement('', f.clockRaw(), f.ctx), 'expected subject');
    const clock = value(decodeMeasurement('clock', f.clockRaw(), f.ctx));
    expect(grantLiveness(f.g, [], clock)).toBe('live');
    expect(value(compareMeasurements(clock, f.now, f.ctx.preserved))).toBe(0);
  });
  it('NF-20 measurement units match the subject registry', () => { const f = fixture(); rejected(decode('Measurement', { ...f.clockRaw(), unit: 'bananas' }, f.ctx), 'unit'); });
  it('NF-21 measurements name a registered producer', () => { const f = fixture(); for (const by of ['unknown', 'vault']) rejected(decode('Measurement', { ...f.clockRaw(), by }, f.ctx), 'by'); });
  it('NF-22 same-instance comparison refuses other instances', () => { const f = fixture(); const other = value(decodeMeasurement('clock', f.clockRaw(100, 'machine-b'), f.ctx)); rejected(compareMeasurements(f.now, other, f.ctx.preserved), 'instance'); expect(value(compareMeasurements(f.now, other, f.ctx.preserved, true))).toBe(0); });
  it('NF-23 adjectives cannot be declared as profile fields', () => { const f = fixture(); for (const key of ['critical', 'significant', 'userFacing', 'significance']) rejected(decode('Profile', f.profileInput({ [key]: true }), f.ctx), key); });
  it('NF-24 unbounded attention is control', () => { const f = fixture(); rejected(decode('Profile', f.profileInput({ repeats: { kind: 'unbounded' } }), f.ctx), 'attention'); expect(value(decode('Profile', f.profileInput({ consequence: 'control', repeats: { kind: 'unbounded' } }), f.ctx)).consequence).toBe('control'); });
  it('NF-25 bounded repetition names its registered bound', () => { const f = fixture(); for (const repeats of [{ kind: 'bounded' }, { kind: 'bounded', by: 'unknown' }]) rejected(decode('Profile', f.profileInput({ repeats }), f.ctx), 'by'); });
  it('NF-26 every profile fact is present and on its closed list', () => { const f = fixture(); for (const field of ['consequence', 'reversibility', 'reach', 'surface']) { rejected(decode('Profile', omission(f.profileInput(), field), f.ctx), field); rejected(decode('Profile', f.profileInput({ [field]: 'unknown' }), f.ctx), field); } });
  it('NF-28 freshness cannot be unbounded', () => { const f = fixture(); for (const freshFor of ['forever', Infinity, -1]) rejected(decode('Evidence', f.evidenceInput({ freshFor }), f.ctx)); });
  it('NF-29 capture hashes check stored bytes', () => { const f = fixture(); const input = f.evidenceInput(); f.captures['capture:evidence'] = 'tampered'; rejected(decode('Evidence', input, f.ctx), 'hash mismatch'); });
  it('NF-30 aggregate strength is its weakest member', () => { const f = fixture(); expect(value(aggregateStrength(f.evidence, f.ctx.preserved))).toBe('inference'); expect(value(aggregateStrength([f.e], f.ctx.preserved))).toBe('proof'); });
  it('NF-32 rejects identical reason and conclusion objects at runtime too', () => { const f = fixture(); const d = f.decisionInput(); rejected(decode('Decision', { ...d, reason: d.conclusion }, f.ctx), 'separate'); });
  it('NF-33 chosen model action belongs to its floor', () => { const f = fixture(); rejected(decode('Decision', f.decisionInput({ floor: { allowed: f.floor, chosen: 'other' } }), f.ctx), 'outside'); });
  it('NF-34 model and route are mandatory for judgment decisions', () => { const f = fixture(); for (const by of [{ judgment: 'judgment' }, { judgment: 'judgment', model: 'model' }, { judgment: 'judgment', route: 'route' }]) rejected(decode('Decision', f.decisionInput({ by }), f.ctx)); });
  it('NF-37 moved artifacts invalidate approvals', () => { const f = fixture(); expect(isValid(f.authorization, 'base:1', f.nextArtifact, f.now, f.ctx)).toBe('artifact-moved'); });
  it('NF-38 moved bases invalidate approvals', () => { const f = fixture(); expect(isValid(f.authorization, 'base:2', f.artifact, f.now, f.ctx)).toBe('base-moved'); });
  it('NF-39 authorization requires a live scoped grant', () => { const f = fixture(); const expired = f.grant({ id: 'expired', expiresAt: 105 }); const a = f.authInput({ under: expired.id, at: f.clock(110) }); rejected(decode('Authorization', a.input, a.context), 'not live'); const b = f.authInput({ action: { kind: 'work', scope: f.org } }); rejected(decode('Authorization', b.input, b.context), 'scope'); });
  it('NF-40 protected self approval is refused', () => { const f = fixture(); const a = f.authInput({ action: { kind: 'merge', scope: f.scope }, requestedBy: f.alice }); rejected(decode('Authorization', a.input, a.context), 'protected'); });
  it('NF-41 agent approval of protected artifacts is refused', () => { const f = fixture(); const g = f.grant({ id: 'agent-grant', grantee: f.bob }); const a = f.authInput({ approver: f.bob, requestedBy: f.carol, under: g.id, action: { kind: 'merge', scope: f.scope } }); rejected(decode('Authorization', a.input, a.context), 'protected'); });
  it('NF-42 protected approver must be read from authenticated record', () => { const f = fixture(); const a = f.authInput({ action: { kind: 'merge', scope: f.scope } }); rejected(decode('Authorization', { ...a.input, approver: f.carol }, a.context), 'provenance'); });
  it('NF-43 waiver precedes act, including equality boundary', () => { const f = fixture(); const a = f.authInput({ kind: { kind: 'waiver', rule: 'rule:94' } }); for (const at of [99, 100]) rejected(decode('Authorization', a.input, { ...a.context, actAt: f.clock(at) }), 'precede'); expect(value(decode('Authorization', a.input, { ...a.context, actAt: f.clock(101) })).kind.kind).toBe('waiver'); });
  it('NF-45 narrow standing does not authorize organization scope', () => { const f = fixture(); const a = f.authInput({ action: { kind: 'work', scope: f.org } }); rejected(decode('Authorization', a.input, a.context), 'scope'); expect(scopeIncludes(f.scope, f.org)).toBe(false); expect(scopeIncludes(f.org, f.scope)).toBe(true); });
  it('NF-48 secret values are rejected where references are required', () => { const f = fixture(); rejected(decode('SecretRef', raw('SecretRef', { vault: 'vault', name: 'token', value: 'secret-bytes' }), f.ctx), 'value'); });
  it('NF-49 unknown schema versions are refused', () => { const f = fixture(); rejected(decode('Profile', { ...f.profileInput(), schemaVersion: 99 }, f.ctx), 'schemaVersion'); });
  it('NF-54 principal cannot decode without Provenance', () => { const f = fixture(); rejected(decode('VerifiedPrincipal', raw('VerifiedPrincipal', { id: 'alice', kind: 'person' }), f.ctx), 'provenance'); });
  it('NF-55 principal identity fields match authenticated evidence', () => { const f = fixture(); for (const change of [{ id: 'bob' }, { kind: 'system' }]) rejected(decode('VerifiedPrincipal', raw('VerifiedPrincipal', { id: 'alice', kind: 'person', ...change }), { ...f.ctx, provenance: f.alice.provenance }), 'disagrees'); });
  it('NF-56 organization grants name document version and approval', () => { const f = fixture(); for (const field of ['documentVersion', 'approvedIn']) { const a = f.grantInput({ grantor: omission({ kind: 'org-intent', documentVersion: 'intent:1', approvedIn: 'approval:1' }, field) }); rejected(decode('StandingGrant', a.input, a.context), field); } });
  it('NF-57 grant fields agree with source provenance', () => { const f = fixture(); const g = f.grantInput(); rejected(decode('StandingGrant', { ...g.input, grantee: f.carol }, g.context), 'disagree'); });
  it('NF-58 explicitYes is mandatory', () => { const f = fixture(); const a = f.authInput(); rejected(decode('Authorization', omission(a.input, 'explicitYes'), a.context), 'explicitYes'); });
  it('NF-59 ordinary approval fields agree with explicitYes', () => { const f = fixture(); const a = f.authInput(); rejected(decode('Authorization', { ...a.input, approver: f.carol }, a.context), 'disagree'); });
  it('NF-60 protected approval fields agree with explicitYes', () => { const f = fixture(); const a = f.authInput({ action: { kind: 'merge', scope: f.scope } }); rejected(decode('Authorization', { ...a.input, requestedBy: f.carol }, a.context), 'disagree'); });
  it('NF-61 refusal site and reason are mandatory', () => { const f = fixture(); for (const field of ['site', 'reason']) rejected(decode('Result', omission(f.refusedInput(), field), f.ctx), field); });
  it('NF-63 directive cannot carry expiry', () => { const f = fixture(); rejected(decode('Directive', f.directiveInput({ expiresAt: 200 }), f.ctx), 'expiresAt'); });
  it('NF-64 serialized type and schema are mandatory', () => { const f = fixture(); for (const field of ['type', 'schemaVersion']) rejected(decode('Profile', omission(f.profileInput(), field), f.ctx), field); });
  it('NF-65 reading expired evidence returns refusal', () => { const f = fixture(); expect(value(readEvidence(f.e, f.clock(110), f.ctx.preserved)).predicate).toBe('exists'); rejected(readEvidence(f.e, f.clock(111), f.ctx.preserved), 'expired'); rejected(readEvidence(f.e, f.clock(99), f.ctx.preserved), 'future'); });
  it('NF-68 incompatible immutable fields create a Conflict', () => { const f = fixture(); const left = value(decode('Intent', f.intentInput(), f.ctx)); const right = value(decode('Intent', f.intentInput({ raw: f.capture('different input'), receivedAt: f.clock(101) }), f.ctx)); const result = value(compare('Intent', left, right, 'identity', f.scope, f.ctx.preserved)); expect(result).toMatchObject({ type: 'Conflict', fields: ['raw', 'receivedAt'] }); expect(value(compare('Intent', left, left, 'version', f.scope, f.ctx.preserved))).toBe(true); });
  it('NF-70 revocation needs provenance and an existing grant', () => { const f = fixture(); const payload = { id: 'r1', grantId: 'absent', by: f.alice, at: f.now, reason: 'withdrawn' }; const { p } = f.proof(payload); const r = raw('Revocation', { ...payload, source: p }); rejected(decode('Revocation', r, f.ctx), 'provenance'); rejected(decode('Revocation', r, { ...f.ctx, provenance: p }), 'nonexistent'); });
  it('NF-72 channel-attested provenance cannot confer higher authority', () => {
    const f = fixture(); const g = f.grantInput({}, true); rejected(decode('StandingGrant', g.input, g.context), 'verified required');
    const a = f.authInput({}, true); rejected(decode('Authorization', a.input, a.context), 'verified required');
    const payload = { id: 'r1', grantId: f.g.id, by: f.alice, at: f.now, reason: 'withdrawn' }; const { p } = f.proof(payload, { id: 'alice', kind: 'person' }, 'revocation', true);
    rejected(decode('Revocation', raw('Revocation', { ...payload, source: p }), { ...f.ctx, provenance: p }), 'verified required');
    const attested = f.principal('requester', 'person', true);
    for (const standing of ['operator', 'delegate']) rejected(decode('VerifiedPrincipal', raw('VerifiedPrincipal', { id: 'requester', kind: 'person', standing }), { ...f.ctx, provenance: attested.provenance }), 'verified required');
  });
  it('NF-73 bad signatures refuse; matching fetched hashes stay attested', () => {
    const f = fixture(); const { input } = f.proof({ id: 'alice', kind: 'person' });
    rejected(decode('Provenance', { ...input, evidence: { kind: 'signature', keyId: 'host', signature: '00'.repeat(64) } }, f.ctx), 'verification failed');
    const fetched = value(decode('Provenance', { ...input, evidence: { kind: 'fetched-record', authenticated: true } }, f.ctx)); expect(fetched.class).toBe('channel-attested');
  });
  it('NF-74 unauthenticated channels and names from content are never principals', () => {
    const f = fixture(); const { input } = f.proof({ id: 'alice', kind: 'person' });
    for (const evidence of [{ kind: 'channel', authenticated: false }, { kind: 'content', authenticated: true }]) rejected(decode('Provenance', { ...input, evidence }, f.ctx));
    const fallback = value(decodeIntake(f.intentInput({ principal: 'Alice in message body' }), { raw: f.capture('Alice said yes'), channel: 'chat', at: f.now }, f.ctx)); expect(fallback.type).toBe('UnresolvedInput');
  });
  it('NF-77 verified yes cannot be replayed for another action', () => { const f = fixture(); const a = f.authInput(); rejected(decode('Authorization', { ...a.input, action: { kind: 'other', scope: f.scope } }, a.context), 'disagree'); });
  it('NF-78 verified yes cannot be replayed for another scope', () => { const f = fixture(); const a = f.authInput(); rejected(decode('Authorization', { ...a.input, action: { kind: 'work', scope: f.org } }, a.context), 'disagree'); });
  it('NF-79 verified yes cannot be replayed for another artifact', () => { const f = fixture(); const a = f.authInput(); rejected(decode('Authorization', { ...a.input, artifact: f.nextArtifact }, a.context), 'disagree'); });
  it('NF-80 verified yes binds the base, and absent host bases refuse', () => { const f = fixture(); const a = f.authInput(); rejected(decode('Authorization', { ...a.input, base: 'base:other' }, a.context), 'disagree'); rejected(decode('Authorization', omission(a.input, 'base'), a.context), 'base'); });
});

describe('positive boundaries and totality', () => {
  it('host HMAC deliveries verify inside the package without retaining key bytes', () => {
    const f = fixture(); const { input } = f.proof({ id: 'alice', kind: 'person' });
    const verificationKey = new Uint8Array(32).fill(42);
    const record = input.record as { reference: string };
    const signature = createHmac('sha256', verificationKey).update(f.captures[record.reference]!).digest('hex');
    const context = { ...f.ctx, register: { ...f.ctx.register, keys: { host: { algorithm: 'hmac-sha256' as const, verificationKey, methods: ['signed-envelope'], adapters: ['host'] } } } };
    const proven = value(decode('Provenance', { ...input, evidence: { kind: 'signature', keyId: 'host', signature } }, context));
    expect(proven.class).toBe('verified'); expect(JSON.stringify(proven)).not.toContain('verificationKey');
    rejected(decode('Provenance', { ...input, evidence: { kind: 'signature', keyId: 'host', signature: '00'.repeat(32) } }, context), 'verification failed');
  });
  it('valid fixture for every directly decoded schema', () => {
    const f = fixture();
    for (const [type, input] of [
      ['Profile', f.profileInput()], ['Evidence', f.evidenceInput()], ['Directive', f.directiveInput()], ['Intent', f.intentInput()],
      ['Decision', f.decisionInput()], ['SecretRef', raw('SecretRef', { vault: 'vault', name: 'token' })],
      ['Outcome', raw('Outcome', { kind: 'uncertain', evidence: ['e1'] })],
      ['Result', raw('Result', { kind: 'Success', value: 'ok', capacity: { kind: 'applied', bound: 'bound', action: 'coalesced' } })],
    ] as const) expect(value(decode(type, input, f.ctx)).type).toBe(type);
  });
  it('every decoder is total over adversarial unknown data', () => {
    const f = fixture(); const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    const values: unknown[] = [null, undefined, 1, 'x', Symbol('x'), NaN, Infinity, 1n, () => 0, cycle, new Date(0), new Proxy({}, { ownKeys() { throw new Error('trap'); } }), Object.defineProperty({}, 'x', { get() { throw new Error('getter'); }, enumerable: true })];
    values.push(new Proxy({}, { ownKeys() { throw new Proxy({}, { getPrototypeOf() { throw new Error('error trap'); } }); } }));
    for (const type of ['VerifiedPrincipal', 'StandingGrant', 'Revocation', 'Intent', 'Directive', 'Result', 'Measurement', 'Profile', 'Evidence', 'Decision', 'Authorization', 'Scope', 'ActionFloor', 'Outcome', 'SecretRef', 'Provenance', 'Conflict', 'UnresolvedInput'] as const)
      for (const input of values) expect(() => rejected(decode(type, input, f.ctx))).not.toThrow();
  });
  it('all authorization validity reasons are observable', () => { const f = fixture(); expect(isValid(f.authorization, 'base:1', f.artifact, f.now, f.ctx)).toBe('valid'); expect(isValid(f.authorization, 'base:1', f.artifact, f.now, { grants: [] })).toBe('standing-not-live'); const narrower = f.grant({ scope: value(decode('Scope', raw('Scope', { kind: 'project', members: ['project-b'] }), f.ctx)) }); expect(isValid(f.authorization, 'base:1', f.artifact, f.now, { grants: [narrower] })).toBe('scope-mismatch'); });
  it('revocation remains a separate record and liveness has named states', () => { const f = fixture(); const payload = { id: 'r1', grantId: f.g.id, by: f.alice, at: f.clock(101), reason: 'withdrawn' }; const { p } = f.proof(payload); const r = value(decode('Revocation', raw('Revocation', { ...payload, source: p }), { ...f.ctx, provenance: p })); expect(grantLiveness(f.g, [r], f.now)).toBe('live'); expect(grantLiveness(f.g, [r], f.clock(101))).toBe('revoked'); expect(grantLiveness(f.g, [], f.clock(99))).toBe('not-yet-live'); expect(grantLiveness(f.grant({ id: 'expiry', expiresAt: 105 }), [], f.clock(105))).toBe('expired'); });
  it('uncertainty retains evidence and cannot grant retry admission', () => { const f = fixture(); for (const kind of ['uncertain', 'happened', 'did-not-happen']) { const o = value(decode('Outcome', raw('Outcome', { kind, evidence: ['e1'] }), f.ctx)); if (kind === 'did-not-happen') expect(value(retryPermission(o, f.ctx.preserved))).toBe('may-request-admission'); else rejected(retryPermission(o, f.ctx.preserved), 'non-occurrence'); } });
  it('decoded data is recursively immutable and detached from input', () => { const f = fixture(); const input = f.profileInput(); const p = value(decode('Profile', input, f.ctx)); input.repeats.by = 'changed'; expect(p.repeats).toEqual({ kind: 'bounded', by: 'bound' }); expect(Object.isFrozen(p.repeats)).toBe(true); });
  it('decision evidence dependencies are the hand-computed union', () => { const f = fixture(); expect(value(decode('Decision', f.decisionInput(), f.ctx)).standsOn).toEqual(['e1', 'e2']); rejected(decode('Decision', f.decisionInput({ standsOn: ['e1'] }), f.ctx), 'standsOn'); });
});
