// Rules 4, 28, 42, 69: one invariant implementation at the decoding boundary.
import { createHmac, timingSafeEqual, verify } from 'node:crypto';
import type * as T from '../types/values.js';
import type { DecodeContext } from '../types/ports.js';
import { bindRecordSubject, evaluateGrantLiveness, seal, success, trusted } from '../types/internal.js';
import { canonicalText, hashText, snapshot } from './canonical.js';
import { schemaRegistry } from './schema.js';
import { runBoundary } from './framework.js';
import { causalClock, childContext, sealInContext, sessionFor, trustedIn } from './session.js';
import { accountAssentRecordTypes, isExplicitYes, isRepositoryYes, verifiedYesRecordTypes } from './explicit-yes.js';

type Obj = Record<string, T.Json>;
function requireThat(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}
function obj(v: unknown, path = 'record'): Obj {
  requireThat(v !== null && typeof v === 'object' && !Array.isArray(v), `${path}: expected object`);
  return v as Obj;
}
function text(v: unknown, path: string): string {
  requireThat(typeof v === 'string' && v.length > 0, `${path}: expected nonempty string`); return v;
}
function number(v: unknown, path: string): number {
  requireThat(typeof v === 'number' && Number.isFinite(v), `${path}: expected finite number`); return v;
}
function one(v: unknown, values: readonly string[], path: string): string {
  const s = text(v, path); requireThat(values.includes(s), `${path}: unregistered or unknown value ${s}`); return s;
}
function list(v: unknown, path: string, nonempty = false): string[] {
  requireThat(Array.isArray(v), `${path}: expected list`);
  const a = v.map(x => text(x, path));
  requireThat((!nonempty || a.length > 0) && new Set(a).size === a.length, `${path}: empty or duplicate members`); return a;
}
function fields(v: Obj, required: string[], optional: string[] = []): void {
  for (const k of required) requireThat(Object.hasOwn(v, k), `${k}: missing required field`);
  for (const k of Object.keys(v)) requireThat([...required, ...optional].includes(k), `${k}: unexpected field`);
}
function tagged(v: Obj, type: string, required: string[], optional: string[] = []): void {
  fields(v, ['type', 'schemaVersion', ...required], optional);
  requireThat(v.type === type, `type: expected ${type}`);
  requireThat(v.schemaVersion === 1, 'schemaVersion: unknown or missing version');
}
function ref(v: unknown, c: DecodeContext, path: string): string {
  const s = text(v, path); requireThat(c.register.entries.includes(s), `${path}: unresolved register reference ${s}`); return s;
}
function action(v: unknown, c: DecodeContext): string {
  const s = text(v, 'action'); requireThat(Object.hasOwn(c.register.actions, s), 'action: unregistered'); return s;
}
function hash(v: unknown, c: DecodeContext, path: string, reference?: string): T.Hash {
  const s = text(v, path); requireThat(/^sha256:[a-f0-9]{64}$/.test(s), `${path}: malformed SHA-256 hash`);
  const bytes = c.captures[reference ?? s];
  const historical = sessionFor(c);
  if (historical) {
    const key = reference ?? s;
    const status = historical.statuses[key] ?? (typeof bytes === 'string' ? 'available' : 'missing');
    if (typeof bytes === 'string') requireThat(hashText(bytes) === s, `${path}: capture hash mismatch`);
    if (status !== 'available') { historical.unavailable.set(key, { reference: key, hash: s as T.Hash, status }); return s as T.Hash; }
  }
  requireThat(typeof bytes === 'string' && hashText(bytes) === s, `${path}: capture absent or hash mismatch`); return s as T.Hash;
}
function clock(v: unknown, c: DecodeContext): T.Clock {
  return measurement(obj(v), c, 'clock') as T.Clock;
}
function measurement(v: Obj, c: DecodeContext, expected?: string): T.Measurement {
  tagged(v, 'Measurement', ['subject', 'value', 'unit', 'at', 'by']);
  const s = obj(v.subject, 'subject'); fields(s, ['kind', 'instance']);
  const kind = text(s.kind, 'subject.kind'); text(s.instance, 'subject.instance');
  requireThat(expected === undefined || kind === expected, `subject.kind: expected ${expected}`);
  const units = c.register.subjects[kind]; requireThat(units, 'subject.kind: unregistered');
  one(v.unit, units, 'unit'); number(v.value, 'value'); one(v.by, c.register.producers, 'by');
  if (kind === 'clock') { one(v.unit, ['unix-ms'], 'clock.unit'); number(v.at, 'at'); requireThat(Number.isSafeInteger(v.value) && v.at === v.value, 'clock.at must equal a safe integer sampled instant'); ref(s.instance, c, 'clock.instance'); }
  else v.at = clock(v.at, c) as unknown as T.Json;
  return seal(v);
}
function principal(v: unknown, c: DecodeContext): T.VerifiedPrincipal {
  const raw = obj(v, 'principal');
  if (sessionFor(c)) return decodeRecord('VerifiedPrincipal', raw, c);
  const found = c.principals?.find(p => trusted(p, 'VerifiedPrincipal') && p.id === raw.id && canonicalText(p) === canonicalText(raw));
  requireThat(found, 'principal: requires a previously decoded matching principal'); return found;
}
function provenance(c: DecodeContext, aboveRequester: boolean): T.Provenance {
  const p = c.provenance;
  requireThat(trustedIn(c, p, 'Provenance'), 'provenance: missing or not produced by Provenance decoder');
  requireThat(p && (!aboveRequester || p.class === 'verified'), 'provenance: verified required above requester'); return p;
}
function bound(v: Obj, p: T.Provenance, omitted: string[]): void {
  const payload = Object.fromEntries(Object.entries(v).filter(([k]) => !['type', 'schemaVersion', ...omitted].includes(k)));
  requireThat(canonicalText(payload) === canonicalText(p.authenticated.payload), 'provenance: authenticated fields disagree');
}
function scope(v: unknown, c: DecodeContext): T.Scope {
  const s = obj(v, 'scope');
  tagged(s, 'Scope', ['kind'], s.kind === 'organization' ? [] : ['members']);
  one(s.kind, ['organization', 'conversation', 'project', 'repository', 'artifact', 'actions', 'machine'], 'scope.kind');
  if (s.kind !== 'organization') {
    const members = list(s.members, 'scope.members', true);
    for (const member of members) {
      if (s.kind === 'actions') action(member, c); else ref(member, c, 'scope.member');
    }
    s.members = members.sort();
  }
  return seal(s);
}
export function scopeIncludes(outer: T.Scope, inner: T.Scope): boolean {
  if (outer.kind === 'organization') return true;
  if (inner.kind === 'organization' || outer.kind !== inner.kind) return false;
  return inner.members.every(m => outer.members.includes(m));
}
export function grantLiveness(grant: T.StandingGrant, revocations: readonly T.Revocation[], now: T.Clock): T.GrantLiveness {
  return evaluateGrantLiveness(grant, revocations, now);
}
function grantLiveForBody(c: DecodeContext, grant: T.StandingGrant, at: T.Clock): boolean {
  const revocations = c.revocations ?? [];
  // NF-06/39 and the analogous Directive/Revocation checks refer to the body's
  // OWN clock. The originating causal-standing check composes with that obligation.
  if (!trustedIn(c, grant, 'StandingGrant') || grantLiveness(grant, revocations, at) !== 'live') return false;
  const causal = causalClock(c);
  return causal === undefined || evaluateGrantLiveness(grant, revocations, causal, true) === 'live';
}
function grantAt(c: DecodeContext, id: unknown, at: T.Clock): T.StandingGrant {
  const g = c.grants?.find(g => g.id === id && trustedIn(c, g, 'StandingGrant'));
  requireThat(g && grantLiveForBody(c, g, at), 'standing: grant missing or not live'); return g;
}
function covers(g: T.StandingGrant, s: T.Scope, a: string): boolean {
  return scopeIncludes(g.scope, s) && (g.standing === 'operator' || g.actions.includes(a));
}
function knownEvidence(v: unknown, c: DecodeContext): string[] {
  const ids = list(v, 'evidence', true);
  for (const id of ids) requireThat(c.evidence?.some(e => trustedIn(c, e, 'Evidence') && e.id === id), `evidence: unresolved ${id}`);
  return ids;
}
function claim(v: unknown): void {
  const r = obj(v, 'claim'); fields(r, ['subject', 'predicate', 'value']); text(r.subject, 'claim.subject'); text(r.predicate, 'claim.predicate');
}
function decodeRecord<N extends keyof T.Inventory>(type: N, v: Obj, c: DecodeContext): T.Inventory[N] {
  requireThat(c.register.generation.owner === 'part-three' && c.register.generation.name === 'RegisterGeneration' && c.register.generation.id, 'register generation required');
  if (sessionFor(c)) {
    const field = type === 'VerifiedPrincipal' ? 'provenance' : type === 'StandingGrant' || type === 'Revocation' ? 'source' : type === 'Authorization' ? 'explicitYes' : undefined;
    if (field) c = childContext(c, { provenance: decodeRecord('Provenance', obj(v[field], field), c) });
  }
  const seal = <V>(record: object): V => sealInContext<V>(record, c);
  switch (type) {
    case 'Measurement': return measurement(v, c) as T.Inventory[N];
    case 'Scope': return scope(v, c) as T.Inventory[N];
    case 'Provenance': {
      if (sessionFor(c)) {
        tagged(v, type, ['adapter', 'method', 'record', 'verifiedAt', 'machine', 'class', 'authenticated']);
        ref(v.adapter, c, 'adapter'); one(v.method, c.register.methods, 'method'); ref(v.machine, c, 'machine');
        one(v.class, ['verified', 'channel-attested'], 'class');
        const record = obj(v.record); fields(record, ['reference', 'hash']); const reference = text(record.reference, 'record.reference');
        hash(record.hash, c, 'record.hash', reference);
        const authenticated = obj(v.authenticated); fields(authenticated, ['principal', 'recordType', 'payload']);
        const identity = obj(authenticated.principal); fields(identity, ['id', 'kind']); text(identity.id, 'principal.id');
        one(identity.kind, ['person', 'agent', 'system'], 'principal.kind'); text(authenticated.recordType, 'recordType');
        const captured = c.captures[reference];
        if (captured !== undefined) requireThat(canonicalText(JSON.parse(captured)) === canonicalText(authenticated), 'historical authenticated record disagrees with capture');
        return seal({ ...v, verifiedAt: clock(v.verifiedAt, c) });
      }
      tagged(v, type, ['adapter', 'method', 'record', 'verifiedAt', 'machine', 'evidence']);
      ref(v.adapter, c, 'adapter'); one(v.method, c.register.methods, 'method'); ref(v.machine, c, 'machine');
      v.verifiedAt = clock(v.verifiedAt, c) as unknown as T.Json;
      const record = obj(v.record); fields(record, ['reference', 'hash']);
      const reference = text(record.reference, 'record.reference'); hash(record.hash, c, 'record.hash', reference);
      const raw = obj(snapshot(JSON.parse(c.captures[reference]!)), 'authenticated record');
      fields(raw, ['principal', 'recordType', 'payload']); const identity = obj(raw.principal); fields(identity, ['id', 'kind']);
      text(identity.id, 'principal.id'); one(identity.kind, ['person', 'agent', 'system'], 'principal.kind'); text(raw.recordType, 'recordType');
      const e = obj(v.evidence, 'authentication evidence');
      let authClass: 'verified' | 'channel-attested';
      if (e.kind === 'signature') {
        fields(e, ['kind', 'keyId', 'signature']); const key = c.register.keys[text(e.keyId, 'keyId')];
        requireThat(key && key.methods.includes(String(v.method)) && key.adapters.includes(String(v.adapter)), 'key: unregistered for adapter/method');
        const signature = text(e.signature, 'signature');
        if (key.algorithm === 'ed25519') {
          requireThat(/^[a-f0-9]{128}$/.test(signature), 'signature: malformed');
          requireThat(verify(null, Buffer.from(c.captures[reference]!, 'utf8'), key.publicKey, Buffer.from(signature, 'hex')), 'signature: verification failed');
        } else {
          requireThat(key.algorithm === 'hmac-sha256' && key.verificationKey.length >= 32 && /^[a-f0-9]{64}$/.test(signature), 'signature: malformed MAC or short key');
          const expected = createHmac('sha256', key.verificationKey).update(c.captures[reference]!, 'utf8').digest();
          requireThat(timingSafeEqual(expected, Buffer.from(signature, 'hex')), 'signature: verification failed');
        }
        authClass = 'verified';
      } else {
        fields(e, ['kind', 'authenticated']); one(e.kind, ['channel', 'fetched-record'], 'evidence.kind');
        requireThat(e.authenticated === true, 'channel: unauthenticated or sender came from content'); authClass = 'channel-attested';
      }
      const { evidence: _e, ...rest } = v;
      return seal({ ...rest, class: authClass, authenticated: raw });
    }
    case 'VerifiedPrincipal': {
      tagged(v, type, ['id', 'kind'], ['provenance', 'standing', 'verifiedBy']);
      const p = provenance(c, v.standing !== undefined && v.standing !== 'requester');
      if (v.standing !== undefined) one(v.standing, ['requester', 'operator', 'delegate'], 'standing');
      if (v.verifiedBy !== undefined) { one(v.verifiedBy, c.register.methods, 'verifiedBy'); requireThat(v.verifiedBy === p.method, 'verifiedBy: disagrees with provenance'); }
      const id = text(v.id, 'id'); const kind = one(v.kind, ['person', 'agent', 'system'], 'kind');
      requireThat(p.authenticated.principal.id === id && p.authenticated.principal.kind === kind, 'principal: id or kind disagrees with authenticated record');
      requireThat(canonicalText(p.authenticated.payload) === canonicalText({ id, kind }), 'principal: payload disagrees');
      if (v.standing && v.standing !== 'requester') requireThat(c.grants?.some(g => g.grantee.id === id && g.standing === v.standing && c.now && grantLiveForBody(c, g, c.now)), 'standing: non-requester requires recorded live grant');
      if (v.provenance !== undefined) requireThat(canonicalText(v.provenance) === canonicalText(p), 'provenance: field disagrees');
      return seal({ type, schemaVersion: 1, id, kind, provenance: p });
    }
    case 'StandingGrant': {
      tagged(v, type, ['id', 'grantee', 'standing', 'scope', 'grantor', 'source', 'issuedAt'], ['actions', 'expiresAt']);
      text(v.id, 'id'); const p = provenance(c, true); requireThat(canonicalText(v.source) === canonicalText(p), 'source: provenance disagrees');
      bound(v, p, ['source']);
      const grantee = principal(v.grantee, c); const s = scope(v.scope, c); const at = clock(v.issuedAt, c);
      one(v.standing, ['operator', 'delegate'], 'standing');
      if (v.standing === 'delegate') for (const a of list(v.actions, 'actions', true)) action(a, c);
      else requireThat(v.actions === undefined, 'operator grant has no actions field');
      const grantor = obj(v.grantor); one(grantor.kind, ['org-intent', 'principal'], 'grantor.kind');
      if (grantor.kind === 'org-intent') {
        fields(grantor, ['kind', 'documentVersion', 'approvedIn']); ref(grantor.documentVersion, c, 'documentVersion'); ref(grantor.approvedIn, c, 'approvedIn');
        requireThat(p.authenticated.recordType === 'intent-approval', 'grantor: org intent needs approval record');
      } else {
        fields(grantor, ['kind', 'who', 'authorization']); const who = principal(grantor.who, c);
        requireThat(p.authenticated.principal.id === who.id, 'grantor: authenticated principal differs');
        requireThat(v.expiresAt !== undefined, 'expiresAt: required for principal grantor');
        const a = c.authorizations?.find(a => a.id === grantor.authorization && trustedIn(c, a, 'Authorization'));
        requireThat(a && a.kind.kind === 'grant' && a.approver.id === who.id, 'grantor: missing delegation authorization');
        const g = grantAt(c, a.under, at);
        requireThat(g.grantee.id === who.id && scopeIncludes(g.scope, s) && scopeIncludes(a.action.scope, s), 'grantor: insufficient scope');
        requireThat(g.standing === 'operator' || (c.register.allowRedelegation && v.standing === 'delegate' && list(v.actions, 'actions').every(a => g.actions.includes(a))), 'grantor: cannot delegate requested standing/actions');
        requireThat(c.currentBase === a.base && c.artifact === a.artifact, 'grantor: delegation authorization base/artifact not current');
      }
      if (v.expiresAt !== undefined) requireThat(number(v.expiresAt, 'expiresAt') > at.value, 'expiresAt: must follow issuance');
      return seal({ ...v, grantee, scope: s, issuedAt: at, source: p });
    }
    case 'Revocation': {
      tagged(v, type, ['id', 'grantId', 'by', 'at', 'reason', 'source']); text(v.id, 'id'); text(v.reason, 'reason');
      const p = provenance(c, true); bound(v, p, ['source']); requireThat(canonicalText(v.source) === canonicalText(p), 'source: provenance disagrees');
      const by = principal(v.by, c); const at = clock(v.at, c); const target = c.grants?.find(g => g.id === v.grantId && trustedIn(c, g, 'StandingGrant'));
      requireThat(target, 'grantId: nonexistent'); requireThat(by.id === p.authenticated.principal.id, 'by: differs from provenance');
      requireThat(c.grants?.some(g => g.grantee.id === by.id && g.standing === 'operator' && scopeIncludes(g.scope, target.scope) && grantLiveForBody(c, g, at)), 'revocation: operator standing required');
      return seal({ ...v, by, at, source: p });
    }
    case 'Intent': {
      tagged(v, type, ['id', 'principal', 'receivedAt', 'via', 'raw', 'ask', 'under']); text(v.id, 'id');
      const p = principal(v.principal, c); const at = clock(v.receivedAt, c); ref(v.via, c, 'via'); hash(v.raw, c, 'raw');
      for (const id of list(v.under, 'under')) requireThat(c.directives?.some(d => d.id === id && !d.closedBy), 'under: missing or closed directive');
      requireThat(v.via === p.provenance.adapter, 'via: disagrees with principal provenance');
      return seal({ ...v, principal: p, receivedAt: at });
    }
    case 'Directive': {
      tagged(v, type, ['id', 'principal', 'scope', 'statement', 'issuedAt'], ['supersedes', 'closedBy']); text(v.id, 'id'); text(v.statement, 'statement');
      const p = principal(v.principal, c); const s = scope(v.scope, c); const at = clock(v.issuedAt, c);
      const grant = c.grants?.find(g => g.grantee.id === p.id && scopeIncludes(g.scope, s) && grantLiveForBody(c, g, at));
      requireThat(grant, 'directive: live scoped standing required');
      if (p.provenance.class !== 'verified') {
        const b = c.binding;
        requireThat(b && trustedIn(c, b.source, 'Provenance') && b.source.class === 'verified' && b.principalId === p.id && b.channel === p.provenance.adapter && b.grantId === grant.id && scopeIncludes(b.scope, s), 'directive: verified conversation binding required');
        requireThat(canonicalText(b.source.authenticated.payload) === canonicalText({ principalId: b.principalId, channel: b.channel, grantId: b.grantId, scope: b.scope }), 'binding: fields disagree with verified record');
      }
      const seen = new Set([text(v.id, 'id')]); let next = v.supersedes;
      while (next !== undefined) {
        const id = text(next, 'supersedes'); requireThat(!seen.has(id), 'supersedes: lineage cycle'); seen.add(id);
        const parent = c.directives?.find(d => d.id === id); requireThat(parent, 'supersedes: unresolved predecessor'); next = parent.supersedes;
      }
      if (v.closedBy !== undefined) {
        const closed = obj(v.closedBy); one(closed.kind, ['Superseded', 'Completed'], 'closedBy.kind');
        if (closed.kind === 'Superseded') { fields(closed, ['kind', 'by']); requireThat(c.directives?.some(d => d.id === closed.by && d.supersedes === v.id), 'closedBy: successor must cite this directive'); }
        else { fields(closed, ['kind', 'evidence']); knownEvidence(closed.evidence, c); }
      }
      return seal({ ...v, principal: p, scope: s, issuedAt: at });
    }
    case 'Result': {
      if (v.kind === 'Success') {
        tagged(v, type, ['kind', 'value', 'capacity']); const cap = obj(v.capacity); one(cap.kind, ['none', 'applied'], 'capacity.kind');
        if (cap.kind === 'applied') { fields(cap, ['kind', 'bound', 'action']); ref(cap.bound, c, 'capacity.bound'); text(cap.action, 'capacity.action'); }
        else fields(cap, ['kind']);
      } else {
        tagged(v, type, ['kind', 'reason', 'site', 'failDirection', 'preserved'], ['detail']); requireThat(v.kind === 'Refused', 'kind: expected Refused');
        one(v.reason, ['standing', 'decode', 'floor', 'stale-base', 'lease', 'budget-exhausted', 'integrity', 'policy'], 'reason');
        const site = text(v.site, 'site'); requireThat(Object.hasOwn(c.register.sites, site), 'site: unregistered');
        requireThat(v.failDirection === c.register.sites[site], 'failDirection: disagrees with site'); text(v.preserved, 'preserved');
        if (v.detail === undefined) v.detail = 'recorded refusal'; else text(v.detail, 'detail');
      }
      return seal(v);
    }
    case 'Profile': {
      tagged(v, type, ['consequence', 'reversibility', 'reach', 'surface', 'repeats']);
      one(v.consequence, ['none', 'attention', 'data', 'money', 'identity', 'control', 'security', 'external'], 'consequence');
      one(v.reversibility, ['reversible', 'costly', 'irreversible'], 'reversibility');
      one(v.reach, ['internal', 'agent', 'user', 'operator', 'world'], 'reach');
      one(v.surface, ['none', 'chat', 'dashboard', 'link', 'device'], 'surface');
      const repeats = obj(v.repeats); one(repeats.kind, ['no', 'bounded', 'unbounded'], 'repeats.kind');
      fields(repeats, repeats.kind === 'bounded' ? ['kind', 'by'] : ['kind']);
      if (repeats.kind === 'bounded') ref(repeats.by, c, 'repeats.by');
      requireThat(!(v.consequence === 'attention' && repeats.kind === 'unbounded'), 'attention: unbounded repetition is control'); return seal(v);
    }
    case 'Evidence': {
      tagged(v, type, ['id', 'claim', 'source', 'observedAt', 'freshFor', 'capture', 'strength']); text(v.id, 'id'); claim(v.claim);
      const source = typeof v.source === 'string' ? ref(v.source, c, 'source') : principal(v.source, c);
      const at = clock(v.observedAt, c); const fresh = number(v.freshFor, 'freshFor'); requireThat(fresh >= 0 && Number.isFinite(at.value + fresh), 'freshFor: invalid window');
      const capture = obj(v.capture); fields(capture, ['hash', 'reference']); hash(capture.hash, c, 'capture.hash', text(capture.reference, 'capture.reference'));
      one(v.strength, ['proof', 'observation', 'attestation', 'inference'], 'strength'); return seal({ ...v, source, observedAt: at });
    }
    case 'ActionFloor': {
      tagged(v, type, ['actions', 'default']); const actions = list(v.actions, 'actions', true); actions.forEach(a => action(a, c));
      requireThat(actions.includes(text(v.default, 'default')), 'default: outside floor'); return seal(v);
    }
    case 'Decision': {
      tagged(v, type, ['id', 'at', 'by', 'conclusion', 'reason'], ['floor', 'standsOn']); text(v.id, 'id'); const at = clock(v.at, c);
      const conclusion = obj(v.conclusion); const reason = obj(v.reason);
      for (const r of [conclusion, reason]) { fields(r, ['subject', 'predicate', 'value', 'evidence']); claim({ subject: r.subject, predicate: r.predicate, value: r.value }); knownEvidence(r.evidence, c); }
      const by = obj(v.by);
      if (by.type === 'VerifiedPrincipal') { v.by = principal(by, c) as unknown as T.Json; requireThat(v.floor === undefined, 'principal decision has no model floor'); }
      else {
        fields(by, ['judgment', 'model', 'route']); ref(by.judgment, c, 'judgment'); ref(by.model, c, 'model'); ref(by.route, c, 'route');
        const floor = obj(v.floor); fields(floor, ['allowed', 'chosen']); const allowed = decodeRecord('ActionFloor', obj(floor.allowed), c);
        requireThat(allowed.actions.includes(text(floor.chosen, 'chosen')), 'chosen: outside ActionFloor');
      }
      const standsOn = [...new Set([...list(conclusion.evidence, 'conclusion.evidence'), ...list(reason.evidence, 'reason.evidence')])].sort();
      requireThat(v.standsOn === undefined || canonicalText(v.standsOn) === canonicalText(standsOn), 'standsOn: disagrees with derived set');
      return seal({ ...v, at, standsOn });
    }
    case 'Authorization': {
      tagged(v, type, ['id', 'at', 'approver', 'under', 'action', 'artifact', 'base', 'kind', 'requestedBy', 'explicitYes', 'requestDigest']); text(v.id, 'id');
      const p = provenance(c, false); requireThat(canonicalText(v.explicitYes) === canonicalText(p), 'explicitYes: provenance differs');
      one(p.authenticated.recordType, [...verifiedYesRecordTypes, ...accountAssentRecordTypes], 'explicitYes.recordType');
      requireThat(isExplicitYes(p), 'provenance: verified required above requester (account-authenticated assent only under its enabled declaration)');
      bound(v, p, ['explicitYes']);
      const approver = principal(v.approver, c); const requestedBy = principal(v.requestedBy, c); const at = clock(v.at, c);
      requireThat(approver.id === p.authenticated.principal.id && approver.kind === p.authenticated.principal.kind, 'approver: differs from authenticated record');
      const a = obj(v.action); fields(a, ['kind', 'scope']); const aKind = action(a.kind, c); const s = scope(a.scope, c);
      const g = grantAt(c, v.under, at); requireThat(g.grantee.id === approver.id && covers(g, s, aKind), 'under: grant principal or scope/actions mismatch');
      const artifact = hash(v.artifact, c, 'artifact'); const base = text(v.base, 'base');
      const requestDigest = hashText(canonicalText({ type: 'AuthorizationRequest', schemaVersion: 1, approver: approver.id, action: aKind, scope: s, artifact, base }));
      requireThat(v.requestDigest === requestDigest, 'requestDigest: explicit yes does not bind this request');
      const policy = c.register.actions[aKind]!;
      if (policy.protected) {
        requireThat(approver.id !== requestedBy.id && approver.kind !== 'agent', 'protected: requester or agent cannot approve');
        if (policy.repository) requireThat(isRepositoryYes(p), 'repository: requires approval or review record');
      }
      const kind = obj(v.kind); one(kind.kind, ['approval', 'waiver', 'grant'], 'kind');
      fields(kind, kind.kind === 'waiver' ? ['kind', 'rule'] : ['kind']);
      if (kind.kind === 'waiver') { ref(kind.rule, c, 'waiver.rule'); requireThat(c.actAt && at.value < c.actAt.value, 'waiver: must precede the act'); }
      if (c.currentBase !== undefined) requireThat(base === c.currentBase, 'base-moved');
      if (c.artifact !== undefined) requireThat(artifact === c.artifact, 'artifact-moved');
      return seal({ ...v, at, approver, requestedBy, action: { kind: aKind, scope: s }, explicitYes: p });
    }
    case 'SecretRef': tagged(v, type, ['vault', 'name']); ref(v.vault, c, 'vault'); text(v.name, 'name'); return seal(v);
    case 'UnresolvedInput': tagged(v, type, ['raw', 'channel', 'at', 'reason']); hash(v.raw, c, 'raw'); text(v.channel, 'channel'); text(v.reason, 'reason'); return seal({ ...v, at: clock(v.at, c) });
    case 'Outcome': tagged(v, type, ['kind', 'evidence']); one(v.kind, ['happened', 'did-not-happen', 'uncertain'], 'kind'); knownEvidence(v.evidence, c); return seal(v);
    case 'Conflict': throw new Error('Conflict: derive through comparison, never accept arbitrary sides');
    default: throw new Error('unknown constitutional type');
  }
}

// Expected subject is caller knowledge checked against data, never inferred from unknown bytes.
export function decodeMeasurement<S extends string>(expectedSubject: S, input: unknown, context: DecodeContext): T.Result<T.Measurement<S>> {
  return runBoundary(input, context, shape => {
    text(expectedSubject, 'expected subject');
    return success(measurement(obj(shape), context, expectedSubject) as T.Measurement<S>);
  });
}
export function decode<N extends keyof T.Inventory>(type: N, input: unknown, context: DecodeContext): T.Result<T.Inventory[N]> {
  return runBoundary(input, context, (shape, original) => {
    requireThat(Object.hasOwn(schemaRegistry, type), 'type: outside constitutional inventory');
    // Identity is observable before copying; JSON cannot alias, but JS unknown inputs can.
    if (type === 'Decision' && original && typeof original === 'object') {
      const ds = Object.getOwnPropertyDescriptors(original);
      requireThat(!ds.reason || !ds.conclusion || ds.reason.value !== ds.conclusion.value, 'reason: must be separate from conclusion');
    }
    const value = decodeRecord(type, obj(shape), context);
    const subject = context.recordSubjects?.[hashText(canonicalText(value))];
    if (subject) {
      requireThat(trusted(subject, 'Scope'), 'record subject context requires a decoded Scope');
      bindRecordSubject(value, subject);
    }
    return success(value);
  });
}
