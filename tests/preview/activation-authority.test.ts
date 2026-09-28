// Rules 94, 98, 103 and 104: an activation resolves against the operator's existing recorded
// authority. A renewal inside the standing grant needs no new yes; anything outside it refuses.
import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { PREVIEW_DESK, resolveActivationAuthority, type ActivationAuthorityRecord, type ActivationFacts,
  type OperatorMessageRecords } from './activation-authority.js';

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
const binding = { 52075: { platform: 'telegram', uid: '7654321', boundFrom: 'authenticated-inbound' } };
const owner = (change: Partial<OperatorMessageRecords> = {}): OperatorMessageRecords => ({
  messages: [message(1, GRANT_WORDS, NOW - 5000), message(2, WAIVER_WORDS, NOW - 9000)],
  provenance: [classified(1, GRANT_WORDS), classified(2, WAIVER_WORDS)], bindings: binding, ...change });
const resolve = (r: unknown, facts = activation, records: OperatorMessageRecords | null = owner()) =>
  resolveActivationAuthority(facts, r, '7654321', BASE, NOW, records);

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
  refused(record(), owner({ bindings: {} }), grantMessage);
  // The waiver resolves the same way: invented or altered waiver words refuse even under a real grant.
  refused(record({ waivers: [{ ...record().waivers[0]!, words: 'No waiver was issued.' }] }), owner(), /waiver/u);
  refused(record({ waivers: [{ ...record().waivers[0]!, source: { kind: 'telegram-message', topicId: 52075, messageId: 98 } }] }), owner(), /waiver/u);
  // The real existing grant still resolves under the same records.
  expect(resolve(record())).toMatchObject({ kind: 'resolved', grant: 'observer-note-30' });
});
