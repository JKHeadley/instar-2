import { createPrivateKey, createPublicKey, createHash, sign } from 'node:crypto';
import { canonical, compare, consumeResult, decode, authorizationRequestDigest } from '../src/index.js';
import type { Clock, Conflict, DecodeContext, Inventory, Provenance, Result, Scope, VerifiedPrincipal } from '../src/index.js';

export const raw = <N extends keyof Inventory, F extends object>(type: N, fields: F) => ({ type, schemaVersion: 1 as const, ...fields });
export function value<T>(r: Result<T>): T {
  return consumeResult(r, { Success: v => v, Refused: r => { throw new Error(`${r.reason}: ${r.detail}`); } });
}
export const bytes = (v: unknown) => value(canonical(v)).bytes;
export const digest = (v: unknown) => value(canonical(v)).hash;
export const captureHash = (v: string) => `sha256:${createHash('sha256').update(v).digest('hex')}` as const;
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const privateKey = createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + '11'.repeat(32), 'hex'), format: 'der', type: 'pkcs8' });
const publicKey = createPublicKey(privateKey).export({ format: 'pem', type: 'spki' }).toString();

export function fixture() {
  const captures: Record<string, string> = {};
  const principals: VerifiedPrincipal[] = [];
  const grants: Inventory['StandingGrant'][] = [];
  const revocations: Inventory['Revocation'][] = [];
  const authorizations: Inventory['Authorization'][] = [];
  const directives: Inventory['Directive'][] = [];
  const evidence: Inventory['Evidence'][] = [];
  const recordSubjects: Record<string, Scope> = {};
  const ctx: DecodeContext = {
    register: {
      generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'generation:1' },
      entries: ['types.decode', 'host', 'probe', 'machine-a', 'machine-b', 'project-a', 'project-b', 'repo', 'chat-a', 'intent:1', 'approval:1', 'bound', 'vault', 'judgment', 'model', 'route', 'rule:94'],
      producers: ['probe', 'host'],
      methods: ['signed-envelope', 'telegram-sender', 'github-review', 'github-merge'],
      actions: { work: { protected: false, repository: false }, other: { protected: false, repository: false }, merge: { protected: true, repository: true }, delegate: { protected: false, repository: false } },
      subjects: { clock: ['unix-ms'], 'detection-latency': ['ms', 's'], 'time-remaining': ['ms'] },
      sites: { 'types.decode': 'closed', delivery: 'open' },
      keys: { host: { algorithm: 'ed25519', publicKey, methods: ['signed-envelope', 'github-review', 'github-merge', 'fact-envelope'], adapters: ['host'] } },
      allowRedelegation: false,
      conflictStanding: { ordinary: 'delegate', authority: 'operator' },
    },
    preserved: 'capture:input', captures, principals, grants, revocations, authorizations, directives, evidence, recordSubjects,
  };
  const clockRaw = (at = 100, machine = 'machine-a') => raw('Measurement', { subject: { kind: 'clock', instance: machine }, value: at, unit: 'unix-ms', at, by: 'probe' });
  const clock = (at = 100) => value(decode('Measurement', clockRaw(at), ctx)) as Clock;
  const now = clock();
  function capture(text: string, ref?: string) { const hash = captureHash(text); captures[ref ?? hash] = text; return hash; }
  function historyPin(record: unknown) {
    const signedBytes = bytes({ id: 'fact:1', body: record });
    return { origin: { owner: 'part-two' as const, name: 'FactEnvelope' as const, id: 'fact:1' },
      capture: { reference: 'capture:envelope', hash: capture(signedBytes, 'capture:envelope') }, machineKeyId: 'host',
      signature: sign(null, Buffer.from(signedBytes), privateKey).toString('hex'), path: ['body'] };
  }
  function proof(payload: object, actor = { id: 'alice', kind: 'person' }, recordType = 'approval', attested = false) {
    const recordBytes = bytes({ principal: actor, recordType, payload });
    const reference = `record:${captureHash(recordBytes)}`;
    const hash = capture(recordBytes, reference);
    const input = raw('Provenance', { adapter: 'host', method: attested ? 'telegram-sender' : 'signed-envelope', record: { reference, hash }, verifiedAt: now, machine: 'machine-a',
      evidence: attested ? { kind: 'channel', authenticated: true } : { kind: 'signature', keyId: 'host', signature: sign(null, Buffer.from(recordBytes), privateKey).toString('hex') } });
    return { input, p: value(decode('Provenance', input, ctx)) };
  }
  function principal(id: string, kind: 'person' | 'agent' | 'system' = 'person', attested = false) {
    const { p } = proof({ id, kind }, { id, kind }, 'identity', attested);
    const principal = value(decode('VerifiedPrincipal', raw('VerifiedPrincipal', { id, kind }), { ...ctx, provenance: p }));
    principals.push(principal); return principal;
  }
  const alice = principal('alice'); const bob = principal('bob', 'agent'); const carol = principal('carol');
  const scope = value(decode('Scope', raw('Scope', { kind: 'project', members: ['project-a'] }), ctx));
  const org = value(decode('Scope', raw('Scope', { kind: 'organization' }), ctx));
  function grantInput(overrides: Record<string, unknown> = {}, attested = false) {
    const payload = { id: 'g1', grantee: alice, standing: 'operator', scope, grantor: { kind: 'org-intent', documentVersion: 'intent:1', approvedIn: 'approval:1' }, issuedAt: now, ...overrides };
    const { p } = proof(payload, { id: 'alice', kind: 'person' }, 'intent-approval', attested);
    return { input: raw('StandingGrant', { ...payload, source: p }), context: { ...ctx, provenance: p } };
  }
  function grant(overrides: Record<string, unknown> = {}) { const { input, context } = grantInput(overrides); const g = value(decode('StandingGrant', input, context)); grants.push(g); return g; }
  const g = grant();
  function evidenceInput(overrides: Record<string, unknown> = {}) {
    return raw('Evidence', { id: 'e1', claim: { subject: 'artifact', predicate: 'exists', value: true }, source: 'probe', observedAt: now, freshFor: 10,
      capture: { reference: 'capture:evidence', hash: capture('observed bytes', 'capture:evidence') }, strength: 'proof', ...overrides });
  }
  const e = value(decode('Evidence', evidenceInput(), ctx)); evidence.push(e);
  evidence.push(value(decode('Evidence', evidenceInput({ id: 'e2', strength: 'inference' }), ctx)));
  const artifact = capture('artifact one'); const nextArtifact = capture('artifact two');
  function authInput(overrides: Record<string, unknown> = {}, attested = false, recordType = 'approval') {
    const payload = { id: 'a1', at: now, approver: alice, under: g.id, action: { kind: 'work', scope }, artifact, base: 'base:1', kind: { kind: 'approval' }, requestedBy: bob, ...overrides };
    const requestDigest = authorizationRequestDigest(payload as Parameters<typeof authorizationRequestDigest>[0]);
    const signed = { ...payload, requestDigest };
    const who = payload.approver as VerifiedPrincipal;
    const { p } = proof(signed, { id: who.id, kind: who.kind }, recordType, attested);
    return { input: raw('Authorization', { ...signed, explicitYes: p }), context: { ...ctx, provenance: p } };
  }
  function authorize(overrides: Record<string, unknown> = {}) { const a = authInput(overrides); const result = value(decode('Authorization', a.input, a.context)); authorizations.push(result); return result; }
  const authorization = authorize();
  const directiveInput = (overrides: Record<string, unknown> = {}) => raw('Directive', { id: 'd1', principal: alice, scope, statement: 'Do the work', issuedAt: now, ...overrides });
  const intentInput = (overrides: Record<string, unknown> = {}) => {
    const input = raw('Intent', { id: 'i1', principal: alice, receivedAt: now, via: 'host', raw: capture('request bytes'), ask: 'work', under: [], ...overrides });
    recordSubjects[digest(input)] = scope;
    return input;
  };
  const floor = value(decode('ActionFloor', raw('ActionFloor', { actions: ['work'], default: 'work' }), ctx));
  const decisionInput = (overrides: Record<string, unknown> = {}) => raw('Decision', { id: 'decision:1', at: now,
    by: { judgment: 'judgment', model: 'model', route: 'route' },
    conclusion: { subject: 'task', predicate: 'do', value: 'work', evidence: ['e1'] },
    reason: { subject: 'task', predicate: 'supported', value: true, evidence: ['e1', 'e2'] },
    floor: { allowed: floor, chosen: 'work' }, ...overrides });
  const profileInput = (overrides: Record<string, unknown> = {}) => raw('Profile', { consequence: 'attention', reversibility: 'reversible', reach: 'user', surface: 'chat', repeats: { kind: 'bounded', by: 'bound' }, ...overrides });
  const refusedInput = (overrides: Record<string, unknown> = {}) => raw('Result', { kind: 'Refused', reason: 'policy', site: 'types.decode', failDirection: 'closed', preserved: 'capture:input', ...overrides });
  return { ctx, captures, principals, grants, revocations, authorizations, directives, evidence, raw, now, clock, clockRaw, capture, proof, principal,
    alice, bob, carol, scope, org, g, grant, grantInput, artifact, nextArtifact, authInput, authorize, authorization, e, evidenceInput,
    directiveInput, intentInput, floor, decisionInput, profileInput, refusedInput, historyPin };
}

export const omission = (v: object, key: string) => Object.fromEntries(Object.entries(v).filter(([k]) => k !== key));

export function inventoryFixtures(): Inventory {
  const f = fixture();
  const intent = value(decode('Intent', f.intentInput(), f.ctx));
  const other = value(decode('Intent', f.intentInput({ raw: f.capture('other input') }), f.ctx));
  const payload = { id: 'r1', grantId: f.g.id, by: f.alice, at: f.now, reason: 'withdrawn' }; const { p } = f.proof(payload);
  return {
    VerifiedPrincipal: f.alice, StandingGrant: f.g,
    Revocation: value(decode('Revocation', raw('Revocation', { ...payload, source: p }), { ...f.ctx, provenance: p })),
    Intent: intent, Directive: value(decode('Directive', f.directiveInput(), f.ctx)),
    Result: value(decode('Result', f.refusedInput(), f.ctx)), Measurement: f.now,
    Profile: value(decode('Profile', f.profileInput(), f.ctx)), Evidence: f.e,
    Decision: value(decode('Decision', f.decisionInput(), f.ctx)), Authorization: f.authorization,
    Scope: f.scope, ActionFloor: f.floor,
    Outcome: value(decode('Outcome', raw('Outcome', { kind: 'uncertain', evidence: ['e1'] }), f.ctx)),
    SecretRef: value(decode('SecretRef', raw('SecretRef', { vault: 'vault', name: 'token' }), f.ctx)),
    Provenance: f.alice.provenance,
    Conflict: value(compare('Intent', intent, other, 'identity', f.scope, f.ctx.preserved)) as Conflict,
    UnresolvedInput: value(decode('UnresolvedInput', raw('UnresolvedInput', { raw: f.capture('unknown sender'), channel: 'host', at: f.now, reason: 'unresolved' }), f.ctx)),
  };
}
