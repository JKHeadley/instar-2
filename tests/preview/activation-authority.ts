// Rules 94, 98, 103 and 104: an activation is exercised under an EXISTING recorded operator
// authority, never under its own reference strings. The authority record holds the operator's
// earlier explicit yes as a standing grant (for example, the standing preapproval of bounded
// status-quo renewals) and the continuing waiver of the rules this preview departs from. A
// renewal inside that grant's scope needs no new yes (Rule 104); a grant never stretches past its
// scope (Rule 103); anything outside it needs a new verified approval, which this adapter does
// not construct. Liveness is the core grant rule (`grantLiveness`): issued, unrevoked, unexpired.
import { canonical, grantLiveness } from '../../src/index.js';
import type { Clock, Revocation, StandingGrant } from '../../src/index.js';

/** Rules the preview activation departs from, per the recorded trial waiver's waived safeguards
 * (preview-trial-waiver-record.md): no Rule-38 model supervisor on the reply pipeline. A waiver
 * resolves only when it names these rules; a waiver for any other rule covers nothing here. */
export const PREVIEW_ACTIVATION_DEPARTURES: readonly string[] = Object.freeze(['rule:38']);
/** The delegate that exercises the grant: the desk that operates the preview. */
export const PREVIEW_DESK = 'echo-desk';
export type ActivationAction = 'activate-subscription-preview' | 'renew-subscription-activation';

export interface ActivationFacts { trial: string; profileDigest: string; invocationPolicyDigest: string; model: string;
  expiresAt: number; executable: string; artifact: string; version: string; expectedAccount: string; observedAt: number;
  waiver: string }
/** The operator's recorded earlier yes, with the exact words and the verified channel record it came from. */
export interface ActivationGrant { id: string; grantor: string; grantee: string; words: string; source: string;
  issuedAt: number; expiresAt?: number; actions: readonly ActivationAction[];
  /** The exact subject the yes covers: a changed field is a different act. */
  scope: { trial: string; model: string; expectedAccount: string; executable: string; artifact: string; version: string;
    invocationPolicyDigest: string; profileDigest: string };
  /** Bounded recurrence: each renewal extends by at most this much, never past the latest expiry. */
  renewal?: { maxExtensionMs: number; latestExpiresAt: number } }
export interface ActivationWaiver { reference: string; rules: readonly string[]; grantor: string; recordedAt: number; source: string; words: string }
export interface ActivationRevocation { grantId: string; at: number; by: string; source: string }
export interface ActivationAuthorityRecord { type: 'PreviewActivationAuthority'; schemaVersion: 1;
  grants: readonly ActivationGrant[]; waivers: readonly ActivationWaiver[]; revocations: readonly ActivationRevocation[] }
export type AuthorityResolution =
  | { kind: 'resolved'; action: ActivationAction; grant: string; waiver: string; digest: string }
  | { kind: 'refused'; reason: string };

const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
const time = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const clock = (value: number) => ({ type: 'Measurement', schemaVersion: 1, subject: { kind: 'clock', instance: 'preview-desk-clock' },
  value, unit: 'unix-ms', at: value, by: 'preview-desk' }) as unknown as Clock;
/** Core liveness over the recorded grant: the same issued / revoked / expired rule every grant obeys. */
const live = (grant: ActivationGrant, revocations: readonly ActivationRevocation[], at: number) =>
  grantLiveness({ id: grant.id, issuedAt: clock(grant.issuedAt), ...(grant.expiresAt === undefined ? {} : { expiresAt: grant.expiresAt }) } as unknown as StandingGrant,
    revocations.filter(r => r.grantId === grant.id).map(r => ({ grantId: r.grantId, at: clock(r.at) }) as unknown as Revocation), clock(at)) === 'live';

export function authorityDigest(record: unknown): string {
  const result = canonical(record);
  if (result.kind !== 'Success') throw Error('activation authority: uncanonical record');
  return result.value.hash;
}

/** Resolves the activation's act against the recorded authority. `baseExpiry` is the trial's own
 * genesis expiry: an activation ending there is the original activation; a later one is a renewal. */
export function resolveActivationAuthority(activation: ActivationFacts, record: unknown, operator: string,
  baseExpiry: number, now: number): AuthorityResolution {
  const refuse = (reason: string): AuthorityResolution => ({ kind: 'refused', reason });
  const r = record as Partial<ActivationAuthorityRecord> | null;
  if (r?.type !== 'PreviewActivationAuthority' || r.schemaVersion !== 1 || !Array.isArray(r.grants) || !Array.isArray(r.waivers)
    || !Array.isArray(r.revocations)) return refuse('activation authority record absent or malformed');
  if (!time(now) || !time(baseExpiry) || !time(activation.observedAt) || activation.observedAt > now
    || !time(activation.expiresAt) || activation.expiresAt < baseExpiry) return refuse('activation act is not a bounded activation of this trial');
  const revocations = r.revocations.filter(v => v && text(v.grantId) && time(v.at) && v.by === operator && text(v.source));
  const action: ActivationAction = activation.expiresAt === baseExpiry ? 'activate-subscription-preview' : 'renew-subscription-activation';
  const covering = r.grants.filter(g => g && text(g.id) && g.grantor === operator && g.grantee === PREVIEW_DESK && text(g.words)
    && text(g.source) && time(g.issuedAt) && g.issuedAt < activation.observedAt && (g.expiresAt === undefined || time(g.expiresAt))
    && Array.isArray(g.actions) && g.actions.includes(action));
  if (!covering.length) return refuse(`no recorded operator grant covers ${action}; a new verified approval is required`);
  const current = covering.filter(g => live(g, revocations, now));
  if (!current.length) return refuse(`the recorded grant for ${action} is revoked or expired`);
  const s = activation;
  const inScope = current.filter(g => g.scope && g.scope.trial === s.trial && g.scope.model === s.model
    && g.scope.expectedAccount === s.expectedAccount && g.scope.executable === s.executable && g.scope.artifact === s.artifact
    && g.scope.version === s.version && g.scope.invocationPolicyDigest === s.invocationPolicyDigest && g.scope.profileDigest === s.profileDigest);
  if (!inScope.length) return refuse('the activation changes a subject the recorded grant does not cover; a new verified approval is required');
  const bounded = action === 'activate-subscription-preview' ? inScope : inScope.filter(g => g.renewal
    && Number.isSafeInteger(g.renewal.maxExtensionMs) && g.renewal.maxExtensionMs > 0 && time(g.renewal.latestExpiresAt)
    && s.expiresAt - baseExpiry <= g.renewal.maxExtensionMs && s.expiresAt <= g.renewal.latestExpiresAt);
  if (!bounded.length) return refuse('the renewal exceeds the recorded grant\'s bounds; a new verified approval is required');
  const waiver = r.waivers.find(w => w && w.reference === s.waiver && w.grantor === operator && text(w.words) && text(w.source)
    && time(w.recordedAt) && w.recordedAt < s.observedAt && Array.isArray(w.rules)
    && PREVIEW_ACTIVATION_DEPARTURES.every(rule => w.rules.includes(rule)));
  if (!waiver) return refuse('the activation waiver does not resolve to a prior operator waiver of the rules this preview departs from');
  return { kind: 'resolved', action, grant: bounded[0]!.id, waiver: waiver.reference, digest: authorityDigest(record) };
}
