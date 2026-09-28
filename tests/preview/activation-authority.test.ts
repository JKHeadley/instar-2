// Rules 94, 98, 103 and 104: an activation resolves against the operator's existing recorded
// authority. A renewal inside the standing grant needs no new yes; anything outside it refuses.
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { authoritySealKey, PREVIEW_DESK, resolveActivationAuthority, sealAuthorityRecord, type ActivationAuthorityRecord,
  type ActivationFacts, type OperatorMessageRecords } from './activation-authority.js';

const BASE = 1_790_628_000_000, WEEK = 604_800_000, NOW = 1_790_600_000_000;
const GRANT_WORDS = 'status-quo renewals preapproved', WAIVER_WORDS = 'trial waiver approved';
const activation: ActivationFacts = { trial: 'trial:1', profileDigest: 'sha256:p', invocationPolicyDigest: 'sha256:efe6',
  model: 'claude-test-1', expiresAt: BASE + WEEK, executable: '/bin/claude', artifact: 'sha256:a', version: '2.1.280',
  expectedAccount: 'echo@example.test', observedAt: NOW - 1000, waiver: 'trial-waiver' };
const { expiresAt: _e, observedAt: _o, waiver: _w, ...scope } = activation;
const record = (change: Partial<ActivationAuthorityRecord> = {}, grant: Record<string, unknown> = {}): ActivationAuthorityRecord => ({
  type: 'PreviewActivationAuthority', schemaVersion: 1,
  grants: [{ id: 'observer-note-30', grantor: '7654321', grantee: PREVIEW_DESK, words: GRANT_WORDS,
    source: { kind: 'telegram-message', topicId: 52075, messageId: 1 }, issuedAt: NOW - 5000, actions: ['renew-subscription-activation'], scope,
    renewal: { maxExtensionMs: WEEK, latestExpiresAt: BASE + 4 * WEEK }, ...grant }],
  waivers: [{ reference: 'trial-waiver', rules: ['rule:38'], grantor: '7654321', recordedAt: NOW - 9000,
    source: { kind: 'telegram-message', topicId: 52075, messageId: 2 }, words: WAIVER_WORDS }],
  revocations: [], ...change });
// The messaging owner's records, in its formats: the sender-authenticated log row, the provenance
// ledger's `human` row over the same body hash, and the topic's authenticated operator binding.
const message = (messageId: number, text: string, at: number, change: Record<string, unknown> = {}) => ({
  messageId, topicId: 52075, text, fromUser: true, timestamp: new Date(at).toISOString(), telegramUserId: 7654321,
  forwarded: false, provenance: 'user', ...change });
const classified = (messageId: number, text: string, change: Record<string, unknown> = {}) => ({ topicId: 52075, messageId,
  classification: 'human', bodyHash: createHash('sha256').update(text, 'utf8').digest('hex'), topicBound: true, ...change });
const evidence = { kind: 'authenticated-inbound', authorization: 'telegram-is-authorized-sender', ingress: 'telegram-lifeline-forward',
  senderUid: '7654321', messageId: '1' };
const binding = { 52075: { platform: 'telegram', uid: '7654321', boundFrom: 'authenticated-inbound', establishmentEvidence: evidence } };
const owner = (change: Partial<OperatorMessageRecords> = {}): OperatorMessageRecords => ({
  messages: [message(1, GRANT_WORDS, NOW - 5000), message(2, WAIVER_WORDS, NOW - 9000)],
  provenance: [classified(1, GRANT_WORDS), classified(2, WAIVER_WORDS)], bindings: binding, ...change });
// The desk's seal key for this trial, and another trial's.
const KEY = authoritySealKey(new Uint8Array(32).fill(5)), OTHER_KEY = authoritySealKey(new Uint8Array(32).fill(6));
const sealed = (r: unknown) => (r && typeof r === 'object' && Array.isArray((r as ActivationAuthorityRecord).grants)
  && Array.isArray((r as ActivationAuthorityRecord).waivers) && Array.isArray((r as ActivationAuthorityRecord).revocations)
  ? sealAuthorityRecord(JSON.parse(JSON.stringify(r)), KEY) : r); // as the desk's seal step reads it: JSON
/** Resolves `r` as the desk sealed it (the default) or exactly as given (`asGiven`). */
const resolve = (r: unknown, facts = activation, records: OperatorMessageRecords | null = owner(), asGiven = false,
  key: Uint8Array | null = KEY) => resolveActivationAuthority(facts, asGiven ? r : sealed(r), '7654321', BASE, NOW, records, key);

it('a status-quo renewal inside the recorded standing grant resolves without a new yes, and binds the grant and waiver', () => {
  expect(resolve(record())).toMatchObject({ kind: 'resolved', action: 'renew-subscription-activation', grant: 'observer-note-30',
    waiver: 'trial-waiver', digest: expect.stringMatching(/^sha256:/u) });
});

it('refuses absent, revoked, expired, out-of-scope and unbounded authority, a changed subject and a wrong-rule waiver', () => {
  const refused = (r: unknown, why: RegExp, facts = activation) => expect(resolve(r, facts)).toMatchObject({ kind: 'refused', reason: expect.stringMatching(why) });
  refused(null, /absent/u);                                                                    // no record: a reference string alone never authorizes
  refused(record({ grants: [] }), /no recorded operator grant/u);                              // silence is not a grant
  refused(record({}, { grantor: '99' }), /no recorded operator grant/u);                       // not the operator's yes
  refused(record({}, { grantee: 'someone-else' }), /no recorded operator grant/u);             // not delegated to the desk
  refused(record({}, { actions: ['activate-subscription-preview'] }), /no recorded operator grant/u); // another act class
  refused(record({ revocations: [{ grantId: 'observer-note-30', at: NOW - 10, by: '7654321', source: 'telegram 3' }] }), /revoked or expired/u);
  refused(record({}, { expiresAt: NOW - 1 }), /revoked or expired/u);
  refused(record(), /does not cover/u, { ...activation, model: 'claude-other-1' });            // changed, uncovered subject
  refused(record(), /does not cover/u, { ...activation, invocationPolicyDigest: 'sha256:other' });
  refused(record(), /exceeds/u, { ...activation, expiresAt: BASE + WEEK + 1 });                // longer than one bounded renewal
  refused(record({}, { renewal: undefined }), /exceeds/u);                                     // a one-expiry grant covers no other
  refused(record({ waivers: [{ ...record().waivers[0]!, rules: ['rule:116'] }] }), /waiver/u); // wrong-rule waiver
  refused(record({ waivers: [{ ...record().waivers[0]!, recordedAt: NOW }] }), /waiver/u);     // waiver after the act
  refused(record(), /waiver/u, { ...activation, waiver: 'other-waiver' });
  // A revocation recorded by someone other than the operator does not revoke; the grant still resolves.
  expect(resolve(record({ revocations: [{ grantId: 'observer-note-30', at: NOW - 10, by: '99', source: 'x' }] })).kind).toBe('resolved');
});

it('the original activation needs a grant for that act; the renewal grant alone does not cover it', () => {
  const original = { ...activation, expiresAt: BASE };
  expect(resolve(record(), original)).toMatchObject({ kind: 'refused' });
  expect(resolve(record({}, { actions: ['activate-subscription-preview'] }), original)).toMatchObject({ kind: 'resolved', action: 'activate-subscription-preview' });
});

it('refuses a grant or waiver that does not resolve to the operator\'s authenticated message, with its exact words and time', () => {
  const refused = (r: unknown, records: OperatorMessageRecords | null, why: RegExp) =>
    expect(resolve(r, activation, records)).toMatchObject({ kind: 'refused', reason: expect.stringMatching(why) });
  const grantMessage = /does not resolve to an authenticated operator message/u;
  // Astra's probe: an invented grant and waiver with an unresolvable source and prose that is not an approval.
  const invented = record({ waivers: [{ reference: 'trial-waiver', rules: ['rule:38'], grantor: '7654321', recordedAt: NOW - 9000,
    source: 'nonexistent:review-probe' as never, words: 'No waiver was issued.' }] },
  { id: 'invented-grant', words: 'This is not an operator approval.', source: 'nonexistent:review-probe' });
  refused(invented, owner(), grantMessage);
  refused(record(), null, grantMessage);                                                            // the owner's records are unavailable
  refused(record({}, { source: { kind: 'telegram-message', topicId: 52075, messageId: 99 } }), owner(), grantMessage); // no such message
  refused(record({}, { words: 'status-quo renewals and new spend preapproved' }), owner(), grantMessage); // words the operator never sent
  refused(record({}, { issuedAt: NOW - 4000 }), owner(), grantMessage);                             // another time
  refused(record(), owner({ messages: [message(1, GRANT_WORDS, NOW - 5000, { telegramUserId: 99 }), message(2, WAIVER_WORDS, NOW - 9000)] }), grantMessage);
  refused(record(), owner({ messages: [message(1, GRANT_WORDS, NOW - 5000, { forwarded: true }), message(2, WAIVER_WORDS, NOW - 9000)] }), grantMessage);
  refused(record(), owner({ messages: [message(1, GRANT_WORDS, NOW - 5000, { provenance: 'agent' }), message(2, WAIVER_WORDS, NOW - 9000)] }), grantMessage);
  refused(record(), owner({ messages: [...owner().messages, message(1, GRANT_WORDS, NOW - 5000)] }), grantMessage); // ambiguous: two log rows
  refused(record(), owner({ provenance: [classified(2, WAIVER_WORDS)] }), grantMessage);            // no provenance row
  refused(record(), owner({ provenance: [classified(1, GRANT_WORDS, { classification: 'agent-verified' }), classified(2, WAIVER_WORDS)] }), grantMessage);
  refused(record(), owner({ provenance: [classified(1, 'other bytes'), classified(2, WAIVER_WORDS)] }), grantMessage); // body hash disagrees
  refused(record(), owner({ bindings: { 52075: { ...binding[52075], uid: '99' } } }), grantMessage); // topic bound to someone else
  refused(record(), owner({ bindings: { 52075: { ...binding[52075], boundFrom: 'manual-assertion' } } }), grantMessage);
  // The topic-operator owner's oracle: the `authenticated-inbound` label without its establishment
  // evidence, or with evidence for another sender or an unknown ingress, is not a verified binding.
  const { establishmentEvidence: _dropped, ...labelOnly } = binding[52075];
  refused(record(), owner({ bindings: { 52075: labelOnly } }), grantMessage);
  refused(record(), owner({ bindings: { 52075: { ...binding[52075], establishmentEvidence: { ...evidence, senderUid: '99' } } } }), grantMessage);
  refused(record(), owner({ bindings: { 52075: { ...binding[52075], establishmentEvidence: { ...evidence, ingress: 'dashboard' } } } }), grantMessage);
  refused(record(), owner({ bindings: { 52075: { ...binding[52075], establishmentEvidence: { ...evidence, authorization: undefined } } } }), grantMessage);
  refused(record(), owner({ bindings: {} }), grantMessage);
  // The waiver resolves the same way: invented or altered waiver words refuse even under a real grant.
  refused(record({ waivers: [{ ...record().waivers[0]!, words: 'No waiver was issued.' }] }), owner(), /waiver/u);
  refused(record({ waivers: [{ ...record().waivers[0]!, source: { kind: 'telegram-message', topicId: 52075, messageId: 98 } }] }), owner(), /waiver/u);
  // The real existing grant still resolves under the same records.
  expect(resolve(record())).toMatchObject({ kind: 'resolved', grant: 'observer-note-30' });
});

it('resolves only the desk\'s sealed disposition: a substituted grant, waiver, subject or dropped revocation refuses', () => {
  const refusedSeal = (r: unknown, facts = activation, key: Uint8Array | null = KEY) => expect(resolve(r, facts, owner(), true, key))
    .toMatchObject({ kind: 'refused', reason: expect.stringMatching(/not the desk's sealed disposition/u) });
  const desk = sealAuthorityRecord(record(), KEY);
  expect(resolve(desk, activation, owner(), true)).toMatchObject({ kind: 'resolved', grant: 'observer-note-30', waiver: 'trial-waiver' });
  // Astra's round-3 probes. A genuine operator check-in, authenticated by all three owner records,
  // substituted as the grant or as the waiver: the words are real, but the desk never decided they
  // were a yes to anything, so the record is no longer the desk's.
  const CHECK_IN = 'Checking in I just wanna make sure we\'re still moving forward here';
  const records = owner({ messages: [...owner().messages, message(3, CHECK_IN, NOW - 7000)],
    provenance: [...owner().provenance, classified(3, CHECK_IN)] });
  const checkIn = { kind: 'telegram-message' as const, topicId: 52075, messageId: 3 };
  const asGrant = { ...desk, grants: [{ ...desk.grants[0]!, id: 'invented-grant-from-check-in', source: checkIn, words: CHECK_IN, issuedAt: NOW - 7000 }] };
  const asWaiver = { ...desk, waivers: [{ ...desk.waivers[0]!, source: checkIn, words: CHECK_IN, recordedAt: NOW - 7000 }] };
  for (const substituted of [asGrant, asWaiver])
    expect(resolveActivationAuthority(activation, substituted, '7654321', BASE, NOW, records, KEY)).toMatchObject({ kind: 'refused',
      reason: expect.stringMatching(/not the desk's sealed disposition/u) });
  // The genuine source reused with a changed account and profile in both the activation and the grant.
  const changed = { ...activation, expectedAccount: 'unapproved@example.test', profileDigest: 'sha256:unapproved-profile' };
  refusedSeal({ ...desk, grants: [{ ...desk.grants[0]!, scope: { ...desk.grants[0]!.scope, expectedAccount: changed.expectedAccount,
    profileDigest: changed.profileDigest } }] }, changed);
  expect(resolve(desk, changed, owner(), true)).toMatchObject({ kind: 'refused', reason: expect.stringMatching(/does not cover/u) });
  // Revocation is the desk's current disposition: a sealed revocation revokes, and dropping it from
  // the sealed record breaks the seal instead of reviving the grant.
  const revoked = sealAuthorityRecord(record({ revocations: [{ grantId: 'observer-note-30', at: NOW - 10, by: '7654321', source: 'telegram 3' }] }), KEY);
  expect(resolve(revoked, activation, owner(), true)).toMatchObject({ kind: 'refused', reason: expect.stringMatching(/revoked/u) });
  refusedSeal({ ...revoked, revocations: [] });
  // Unsealed, sealed for another trial, a forged seal, or no seal key: nothing resolves.
  refusedSeal(record());
  refusedSeal(sealAuthorityRecord(record(), OTHER_KEY));
  refusedSeal({ ...desk, seal: `hmac-sha256:${'0'.repeat(64)}` });
  refusedSeal(desk, activation, null);
  // Resealing is the desk's own recording step and yields the same seal for the same decision.
  expect(sealAuthorityRecord(desk, KEY).seal).toBe(desk.seal);
});
