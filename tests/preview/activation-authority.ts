// Rules 94, 98, 103 and 104: an activation is exercised under an EXISTING recorded operator
// authority, never under its own reference strings. The authority record holds the operator's
// earlier explicit yes as a standing grant (for example, the standing preapproval of bounded
// status-quo renewals) and the continuing waiver of the rules this preview departs from. A
// renewal inside that grant's scope needs no new yes (Rule 104); a grant never stretches past its
// scope (Rule 103); anything outside it needs a new verified approval, which this adapter does
// not construct. Liveness is the core grant rule (`grantLiveness`): issued, unrevoked, unexpired.
//
// Rules 28 and 82: the record's grant and waiver are not authority by themselves. Each must resolve
// to the operator's actual message as authenticated by the existing messaging owner (the Instar
// Telegram intake): its sender-authenticated message log, its provenance ledger's `human`
// classification over the same body hash, and the topic's operator binding established from an
// authenticated inbound message. The record's words and time must equal that message exactly.
// An invented grant, an unresolvable source or words the operator never sent refuse.
import { createHash } from 'node:crypto';
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
/** A reference to one operator message held by the messaging owner. */
export interface OperatorMessageRef { kind: 'telegram-message'; topicId: number; messageId: number }
/** The messaging owner's records, as read from its state directory: the message log, the provenance
 * classification ledger and the topic-operator bindings. Parsed, never trusted beyond the checks below. */
export interface OperatorMessageRecords { messages: readonly unknown[]; provenance: readonly unknown[]; bindings: unknown }
/** The operator's recorded earlier yes, with the exact words and the authenticated message it came from. */
export interface ActivationGrant { id: string; grantor: string; grantee: string; words: string; source: OperatorMessageRef;
  issuedAt: number; expiresAt?: number; actions: readonly ActivationAction[];
  /** The exact subject the yes covers: a changed field is a different act. */
  scope: { trial: string; model: string; expectedAccount: string; executable: string; artifact: string; version: string;
    invocationPolicyDigest: string; profileDigest: string };
  /** Bounded recurrence: each renewal extends by at most this much, never past the latest expiry. */
  renewal?: { maxExtensionMs: number; latestExpiresAt: number } }
export interface ActivationWaiver { reference: string; rules: readonly string[]; grantor: string; recordedAt: number; source: OperatorMessageRef; words: string }
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

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const row = (value: unknown) => (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
/** Resolves one operator message through the messaging owner's three records. Exactly one log row
 * and one provenance row must name it; the sender, the classification, the body hash and the topic's
 * authenticated operator binding must all agree on this operator. Anything else is unresolved. */
export function resolveOperatorMessage(ref: unknown, operator: string, records: OperatorMessageRecords | null):
  { text: string; at: number } | null {
  const r = row(ref);
  if (!records || r.kind !== 'telegram-message' || !Number.isSafeInteger(r.topicId) || !Number.isSafeInteger(r.messageId)) return null;
  const names = (item: unknown) => row(item).topicId === r.topicId && row(item).messageId === r.messageId;
  const logged = records.messages.filter(names), classified = records.provenance.filter(names);
  if (logged.length !== 1 || classified.length !== 1) return null;
  const m = row(logged[0]), c = row(classified[0]), binding = row(row(records.bindings)[String(r.topicId)]);
  const at = typeof m.timestamp === 'string' ? Date.parse(m.timestamp) : Number.NaN;
  if (typeof m.text !== 'string' || !time(at) || m.fromUser !== true || m.provenance !== 'user' || m.forwarded !== false
    || String(m.telegramUserId) !== operator) return null;
  if (c.classification !== 'human' || c.topicBound !== true || c.bodyHash !== sha256(m.text)) return null;
  if (binding.platform !== 'telegram' || binding.uid !== operator || binding.boundFrom !== 'authenticated-inbound') return null;
  return { text: m.text, at };
}
/** The record's words and time are the authenticated message's, exactly. */
const authentic = (source: unknown, words: unknown, at: unknown, operator: string, records: OperatorMessageRecords | null) => {
  const message = resolveOperatorMessage(source, operator, records);
  return message !== null && message.text === words && message.at === at;
};

export function authorityDigest(record: unknown): string {
  const result = canonical(record);
  if (result.kind !== 'Success') throw Error('activation authority: uncanonical record');
  return result.value.hash;
}

/** Resolves the activation's act against the recorded authority. `baseExpiry` is the trial's own
 * genesis expiry: an activation ending there is the original activation; a later one is a renewal. */
export function resolveActivationAuthority(activation: ActivationFacts, record: unknown, operator: string,
  baseExpiry: number, now: number, records: OperatorMessageRecords | null): AuthorityResolution {
  const refuse = (reason: string): AuthorityResolution => ({ kind: 'refused', reason });
  const r = record as Partial<ActivationAuthorityRecord> | null;
  if (r?.type !== 'PreviewActivationAuthority' || r.schemaVersion !== 1 || !Array.isArray(r.grants) || !Array.isArray(r.waivers)
    || !Array.isArray(r.revocations)) return refuse('activation authority record absent or malformed');
  if (!time(now) || !time(baseExpiry) || !time(activation.observedAt) || activation.observedAt > now
    || !time(activation.expiresAt) || activation.expiresAt < baseExpiry) return refuse('activation act is not a bounded activation of this trial');
  const revocations = r.revocations.filter(v => v && text(v.grantId) && time(v.at) && v.by === operator && text(v.source));
  const action: ActivationAction = activation.expiresAt === baseExpiry ? 'activate-subscription-preview' : 'renew-subscription-activation';
  const covering = r.grants.filter(g => g && text(g.id) && g.grantor === operator && g.grantee === PREVIEW_DESK && text(g.words)
    && time(g.issuedAt) && g.issuedAt < activation.observedAt && (g.expiresAt === undefined || time(g.expiresAt))
    && Array.isArray(g.actions) && g.actions.includes(action));
  if (!covering.length) return refuse(`no recorded operator grant covers ${action}; a new verified approval is required`);
  const sourced = covering.filter(g => authentic(g.source, g.words, g.issuedAt, operator, records));
  if (!sourced.length) return refuse('the recorded grant does not resolve to an authenticated operator message with its exact words and time');
  const current = sourced.filter(g => live(g, revocations, now));
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
  const waiver = r.waivers.find(w => w && w.reference === s.waiver && w.grantor === operator && text(w.words)
    && time(w.recordedAt) && authentic(w.source, w.words, w.recordedAt, operator, records) && w.recordedAt < s.observedAt && Array.isArray(w.rules)
    && PREVIEW_ACTIVATION_DEPARTURES.every(rule => w.rules.includes(rule)));
  if (!waiver) return refuse('the activation waiver does not resolve to a prior operator waiver of the rules this preview departs from');
  return { kind: 'resolved', action, grant: bounded[0]!.id, waiver: waiver.reference, digest: authorityDigest(record) };
}
