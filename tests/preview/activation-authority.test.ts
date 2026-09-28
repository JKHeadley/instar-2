// Rules 94, 98, 103 and 104: an activation resolves against the operator's existing recorded
// authority. A renewal inside the standing grant needs no new yes; anything outside it refuses.
import { expect, it } from 'vitest';
import { PREVIEW_DESK, resolveActivationAuthority, type ActivationAuthorityRecord, type ActivationFacts } from './activation-authority.js';

const BASE = 1_790_628_000_000, WEEK = 604_800_000, NOW = 1_790_600_000_000;
const activation: ActivationFacts = { trial: 'trial:1', profileDigest: 'sha256:p', invocationPolicyDigest: 'sha256:efe6',
  model: 'claude-test-1', expiresAt: BASE + WEEK, executable: '/bin/claude', artifact: 'sha256:a', version: '2.1.280',
  expectedAccount: 'echo@example.test', observedAt: NOW - 1000, waiver: 'trial-waiver' };
const { expiresAt: _e, observedAt: _o, waiver: _w, ...scope } = activation;
const record = (change: Partial<ActivationAuthorityRecord> = {}, grant: Record<string, unknown> = {}): ActivationAuthorityRecord => ({
  type: 'PreviewActivationAuthority', schemaVersion: 1,
  grants: [{ id: 'observer-note-30', grantor: '7654321', grantee: PREVIEW_DESK, words: 'status-quo renewals preapproved',
    source: 'telegram topic 102965 message 1', issuedAt: NOW - 5000, actions: ['renew-subscription-activation'], scope,
    renewal: { maxExtensionMs: WEEK, latestExpiresAt: BASE + 4 * WEEK }, ...grant }],
  waivers: [{ reference: 'trial-waiver', rules: ['rule:38'], grantor: '7654321', recordedAt: NOW - 9000,
    source: 'telegram topic 52075 message 2', words: 'trial waiver approved' }],
  revocations: [], ...change });
const resolve = (r: unknown, facts = activation) => resolveActivationAuthority(facts, r, '7654321', BASE, NOW);

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
