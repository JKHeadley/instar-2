import type * as T from './values.js';
import type { DecodeContext } from './ports.js';
import { recordSubject, refusal, seal, success, trusted } from './internal.js';
import { canonicalText, hashText } from '../decode/canonical.js';
import { grantLiveness, scopeIncludes } from '../decode/decode.js';
import { schemaRegistry } from '../decode/schema.js';
import { sealInContext, sessionFor, trustedIn } from '../decode/session.js';

export function compareMeasurements<S extends string>(left: T.Measurement<S> & (string extends S ? never : unknown), right: T.Measurement<NoInfer<S>>, preserved: string, crossInstance = false): T.Result<number> {
  if (left.subject.kind !== right.subject.kind || left.unit !== right.unit || (!crossInstance && left.subject.instance !== right.subject.instance))
    return refusal('measurement comparison: subject, instance, or unit mismatch', preserved);
  const delta = left.value - right.value;
  return Number.isFinite(delta) ? success(delta) : refusal('measurement subtraction overflow', preserved);
}
export function isFresh(evidence: T.Evidence, now: T.Clock): boolean {
  return now.value >= evidence.observedAt.value && now.value <= evidence.observedAt.value + evidence.freshFor;
}
export function readEvidence(evidence: T.Evidence, now: T.Clock, preserved: string): T.Result<T.Claim> {
  return isFresh(evidence, now) ? success(evidence.claim) : refusal('evidence expired or observation lies in the future', preserved, 'stale-base');
}
export function aggregateStrength(evidence: readonly T.Evidence[], preserved: string): T.Result<T.Strength> {
  if (evidence.length === 0) return refusal('cannot aggregate empty evidence', preserved);
  const strengths: T.Strength[] = ['proof', 'observation', 'attestation', 'inference'];
  return success(strengths[Math.max(...evidence.map(e => strengths.indexOf(e.strength)))]!);
}
export function consumeOutcome<R>(outcome: T.Outcome, handlers: {
  happened: (evidence: readonly string[]) => R;
  'did-not-happen': (evidence: readonly string[]) => R;
  uncertain: (evidence: readonly string[]) => R;
}): R { return handlers[outcome.kind](outcome.evidence); }
export function retryPermission(outcome: T.Outcome, preserved: string): T.Result<'may-request-admission'> {
  return outcome.kind === 'did-not-happen' ? success('may-request-admission')
    : refusal(`retry requires non-occurrence; outcome is ${outcome.kind}`, preserved, 'integrity');
}
export type AuthorizationValidity = 'valid' | 'artifact-moved' | 'base-moved' | 'standing-not-live' | 'scope-mismatch';
export function isValid(authorization: T.Authorization, currentBase: string, artifactHash: T.Hash, now: T.Clock,
  context: Pick<DecodeContext, 'grants' | 'revocations'>): AuthorizationValidity {
  if (artifactHash !== authorization.artifact) return 'artifact-moved';
  if (currentBase !== authorization.base) return 'base-moved';
  const g = context.grants?.find(g => g.id === authorization.under && trusted(g, 'StandingGrant'));
  if (!g || now.value < authorization.at.value || grantLiveness(g, context.revocations ?? [], now) !== 'live') return 'standing-not-live';
  if (g.grantee.id !== authorization.approver.id || !scopeIncludes(g.scope, authorization.action.scope)
    || (g.standing === 'delegate' && !g.actions.includes(authorization.action.kind))) return 'scope-mismatch';
  return 'valid';
}
export function authorizationRequestDigest(request: {
  approver: T.VerifiedPrincipal; action: { kind: string; scope: T.Scope }; artifact: T.Hash; base: string;
}): T.Hash {
  return hashText(canonicalText({ type: 'AuthorizationRequest', schemaVersion: 1, approver: request.approver.id,
    action: request.action.kind, scope: request.action.scope, artifact: request.artifact, base: request.base }));
}
export function compare<N extends keyof T.Inventory>(type: N, left: T.Inventory[N], right: T.Inventory[NoInfer<N>],
  mode: 'identity' | 'version' | 'value', subject: T.Scope, preserved: string): T.Result<boolean | T.Conflict> {
  return compareImpl(type, left, right, mode, subject, preserved);
}
// Internal historical comparison; not exported by the package and requires a private session.
export function compareHistorical<N extends keyof T.Inventory>(type: N, left: T.Inventory[N], right: T.Inventory[N],
  subject: T.Scope, context: DecodeContext): T.Result<boolean | T.Conflict> {
  if (!sessionFor(context)) return refusal('historical comparison requires origin validation session', context.preserved);
  return compareImpl(type, left, right, 'identity', subject, context.preserved, context);
}
function compareImpl<N extends keyof T.Inventory>(type: N, left: T.Inventory[N], right: T.Inventory[N],
  mode: 'identity' | 'version' | 'value', subject: T.Scope, preserved: string, context?: DecodeContext): T.Result<boolean | T.Conflict> {
  const known = (value: unknown) => context ? trustedIn(context, value, type) : trusted(value, type);
  if (!known(left) || !known(right) || left.schemaVersion !== right.schemaVersion)
    return refusal('comparison domain: type or schema mismatch; migrate before comparison', preserved);
  const l = left as unknown as Record<string, unknown>; const r = right as unknown as Record<string, unknown>;
  for (const record of [left, right]) if ('scope' in record && !scopeIncludes(subject, record.scope))
    return refusal('comparison subject must cover both records scopes', preserved);
  if (type === 'VerifiedPrincipal' && subject.kind !== 'organization')
    return refusal('principal identity conflicts have organization scope', preserved);
  if (type === 'Measurement') {
    const a = left as T.Measurement; const b = right as T.Measurement;
    if (a.subject.kind !== b.subject.kind || a.subject.instance !== b.subject.instance || a.unit !== b.unit)
      return refusal('comparison domain: measurement subject, instance, or unit mismatch', preserved);
  }
  if (l.scope && canonicalText(l.scope) !== canonicalText(r.scope) && l.id !== r.id)
    return refusal('comparison domain: scope mismatch', preserved);
  const immutable: readonly string[] = schemaRegistry[type];
  const keys = immutable.includes('*') ? Object.keys(l).filter(k => !['schemaVersion', 'type'].includes(k)) : immutable;
  const differences = keys.filter(k => {
    // Absence is comparable; canonical JSON deliberately refuses undefined.
    if (l[k] === undefined || r[k] === undefined) return l[k] !== r[k];
    if (type === 'VerifiedPrincipal' && k === 'provenance')
      return canonicalText((left as T.VerifiedPrincipal).provenance.record) !== canonicalText((right as T.VerifiedPrincipal).provenance.record);
    return canonicalText(l[k]) !== canonicalText(r[k]);
  });
  if (typeof l.id === 'string' && l.id === r.id && differences.length) {
    const intrinsic = (v: T.ConstitutionalValue): T.Scope | undefined => {
      if ('scope' in v) return v.scope;
      if (v.type === 'Authorization') return v.action.scope;
      if (v.type === 'VerifiedPrincipal') return seal<T.Scope>({ type: 'Scope', schemaVersion: 1, kind: 'organization' });
      return recordSubject(v);
    };
    const a = intrinsic(left); const b = intrinsic(right);
    if (!a || !b) return refusal('conflict subject requires independent admission context for both records', preserved);
    const expected = a.kind === 'organization' || b.kind === 'organization' || a.kind !== b.kind
      ? { type: 'Scope', schemaVersion: 1, kind: 'organization' }
      : { type: 'Scope', schemaVersion: 1, kind: a.kind, members: [...new Set([...a.members, ...b.members])].sort() };
    if (canonicalText(subject) !== canonicalText(expected)) return refusal('conflict subject differs from authoritative record context', preserved);
    const fields = { type: 'Conflict', schemaVersion: 1, left, right,
      origins: [origin(left), origin(right)], fields: differences, subject };
    return success(context ? sealInContext<T.Conflict>(fields, context) : seal<T.Conflict>(fields));
  }
  if (mode !== 'value' && typeof l.id !== 'string') return refusal('comparison mode: this type supports value equality only', preserved);
  if (mode === 'version' && type === 'VerifiedPrincipal') return refusal('VerifiedPrincipal supports identity and value equality', preserved);
  if (mode === 'identity') return success(l.id === r.id);
  const withoutId = (v: Record<string, unknown>) => Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'id'));
  return success(mode === 'version' ? l.id === r.id && canonicalText(left) === canonicalText(right)
    : canonicalText(withoutId(l)) === canonicalText(withoutId(r)));
}
function origin(v: T.ConstitutionalValue): string {
  if ('provenance' in v) return v.provenance.machine;
  if ('source' in v && typeof v.source === 'object' && 'machine' in v.source) return v.source.machine;
  if ('observedAt' in v) return v.observedAt.subject.instance;
  if ('at' in v && typeof v.at === 'object') return v.at.subject.instance;
  return 'shared:unspecified-origin';
}
export function resolveConflict(conflict: T.Conflict, decision: T.Decision, grant: T.StandingGrant,
  now: T.Clock, context: DecodeContext): T.Result<T.ConstitutionalValue> {
  if (!trusted(conflict, 'Conflict') || !trusted(decision, 'Decision') || !trusted(grant, 'StandingGrant'))
    return refusal('resolution requires decoded conflict, decision, and grant', context.preserved, 'standing');
  if (!('type' in decision.by) || decision.by.type !== 'VerifiedPrincipal' || decision.by.id !== grant.grantee.id
    || decision.at.value > now.value || grantLiveness(grant, context.revocations ?? [], now) !== 'live' || !scopeIncludes(grant.scope, conflict.subject))
    return refusal('resolution requires live standing held by decision principal in conflict scope', context.preserved, 'standing');
  const authority = ['StandingGrant', 'Revocation', 'Authorization', 'VerifiedPrincipal'].includes(conflict.left.type);
  const required = authority ? context.register.conflictStanding.authority : context.register.conflictStanding.ordinary;
  if (required === 'operator' && grant.standing !== 'operator') return refusal('resolution requires operator standing', context.preserved, 'standing');
  // A decision names the exact conflict and exact selected content, never a loose left/right flag.
  const conflictHash = hashText(canonicalText(conflict));
  if (decision.conclusion.subject !== conflictHash || decision.conclusion.predicate !== 'resolve-to-hash')
    return refusal('decision does not name this conflict', context.preserved);
  const chosen = [conflict.left, conflict.right].find(side => hashText(canonicalText(side)) === decision.conclusion.value);
  return chosen ? success(chosen) : refusal('decision does not choose either recorded version', context.preserved);
}

// The terms resolver (part three) supplies the derivedFrom data; this package only evaluates it.
export type ProfileExpression =
  | Readonly<{ field: 'consequence' | 'reversibility' | 'reach' | 'surface'; in: readonly string[] }>
  | Readonly<{ any: readonly ProfileExpression[] }> | Readonly<{ all: readonly ProfileExpression[] }>;
export interface ProfileTermsReadPort {
  readonly owner: 'part-three';
  readonly derivedFrom: Readonly<Record<'critical' | 'significant' | 'userFacing' | 'irreversible', ProfileExpression>>;
}
export function deriveProfile(profile: T.Profile, terms: ProfileTermsReadPort, preserved: string): T.Result<Record<keyof ProfileTermsReadPort['derivedFrom'], boolean>> {
  try {
    const evaluate = (e: ProfileExpression, depth = 0): boolean => {
      if (depth > 32) throw new Error('term expression exceeds bound');
      if ('field' in e) return e.in.includes(profile[e.field]);
      if ('any' in e) return e.any.some(child => evaluate(child, depth + 1));
      return e.all.every(child => evaluate(child, depth + 1));
    };
    return success({ critical: evaluate(terms.derivedFrom.critical), significant: evaluate(terms.derivedFrom.significant),
      userFacing: evaluate(terms.derivedFrom.userFacing), irreversible: evaluate(terms.derivedFrom.irreversible) });
  } catch { return refusal('malformed terms derivedFrom', preserved); }
}
