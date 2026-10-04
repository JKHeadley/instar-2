// Shared, dependency-free core of the preview's independent approval surface (Eleven §§2, 4, 5;
// policy P-02). Both sides load it: the operator-run surface (scripts/approval-surface.mjs), which
// renders a request and records the operator's passkey-signed act in operator-owned storage, and the
// agent's runner client (tests/preview/approval-surface-client.mjs), which may only read that storage.
// The operator's private key never leaves the operator's device; both sides only verify signatures.
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const SURFACE = 'preview-approval-surface';
/** Finite bounds both sides share (Rule 60): the longest challenge (the day-long standing stop), open
 * requests per outbox, recorded acts, enrolled passkeys, in-flight approval steps, and their lifetimes. */
export const SURFACE_LIMITS = Object.freeze({ maxLifetime: 86_400_000, maxRequests: 64, maxActs: 4096, maxKeys: 8,
  maxNonces: 64, nonceMs: 300_000, enrolmentMs: 900_000, maxBody: 65536 });
export const ACT_RECORD = 'PreviewApprovalActRecord';
export const check = (condition, detail) => { if (!condition) throw Error(detail); };
const sorted = value => Array.isArray(value) ? value.map(sorted) : value !== null && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
/** Key-sorted JSON: both sides hash the exact same bytes for the same subject. */
export const canonical = value => JSON.stringify(sorted(value));
export const sha256 = bytes => createHash('sha256').update(bytes).digest();
export const hex = bytes => sha256(bytes).toString('hex');
/** A file name derived from a challenge id, never the id itself (bounded, path-safe). */
export const nameFor = id => hex(String(id));
export const b64u = bytes => Buffer.from(bytes).toString('base64url');
export const fromB64u = text => { check(typeof text === 'string' && text.length <= 65536 && /^[A-Za-z0-9_-]*$/u.test(text), 'base64url field required');
  return Buffer.from(text, 'base64url'); };

const FIELDS = 'action,artifact,audience,base,expiresAt,generation,id,issuedAt,operator,renderingDigest,request,requestDigest,requestedBy,scope,singleUse,surface';
const DIGEST = /^sha256:[a-f0-9]{64}$/u;
/** The closed challenge the surface will render and the act will bind (the fixed-installation host's
 * subject, plus its id). The emergency stop is the operator's own request with the stop audience and no
 * authority; every other action is requested by someone other than the operator. */
export function checkChallenge(challenge, { operator, maxLifetime, now }) {
  check(challenge !== null && typeof challenge === 'object' && !Array.isArray(challenge)
    && Object.keys(challenge).sort().join(',') === FIELDS, 'closed challenge subject required');
  check(typeof challenge.id === 'string' && /^challenge:[a-f0-9]{64}$/u.test(challenge.id), 'challenge id invalid');
  check(challenge.singleUse === true && challenge.surface === SURFACE && challenge.operator === operator, 'challenge surface or operator differs');
  check(Number.isSafeInteger(challenge.issuedAt) && Number.isSafeInteger(challenge.expiresAt) && challenge.expiresAt > challenge.issuedAt
    && challenge.expiresAt - challenge.issuedAt <= maxLifetime && challenge.issuedAt <= now + 60_000, 'challenge lifetime invalid');
  check(now < challenge.expiresAt, 'challenge expired');
  for (const field of ['artifact', 'requestDigest', 'renderingDigest']) check(DIGEST.test(challenge[field]), 'challenge digest missing');
  for (const field of ['request', 'action', 'audience', 'base', 'requestedBy']) check(typeof challenge[field] === 'string'
    && challenge[field].length > 0 && challenge[field].length <= 512, 'bounded challenge field required');
  const stop = challenge.action === 'emergency-stop' || challenge.audience === 'independent-emergency-stop';
  check(stop ? challenge.action === 'emergency-stop' && challenge.audience === 'independent-emergency-stop'
    && challenge.requestedBy === challenge.operator : challenge.action === 'raise-caps' && challenge.requestedBy !== challenge.operator,
  'challenge requester or emergency-stop tuple differs');
  return challenge;
}

const RAISE = /^Approve raising the (model call|reply|message) allowance from (\d{1,9}) to (\d{1,9})\? That adds (\d{1,9}) (model calls I may spend|replies I may send|messages I may take) in this trial\.$/u;
const EFFECTS = { 'model call': 'model calls I may spend', reply: 'replies I may send', message: 'messages I may take' };
/** What the operator is shown, derived by the surface itself. A raise's wording must match the one
 * fixed template exactly and hash to the challenge's rendering digest; anything else is refused, so no
 * requester prose ever reaches the page. */
export function renderChallenge(challenge, text) {
  if (challenge.action === 'emergency-stop') return { kind: 'stop', title: 'Stop this preview agent permanently?',
    effect: 'It stops at once. Nothing more will be sent or spent in this trial, and it cannot be restarted from here.',
    approve: 'Stop now', decline: null };
  const match = typeof text === 'string' ? RAISE.exec(text) : null;
  check(match !== null && EFFECTS[match[1]] === match[5] && Number(match[3]) > Number(match[2])
    && Number(match[3]) - Number(match[2]) === Number(match[4]), 'request wording is not the fixed raise template');
  check(`sha256:${hex(text)}` === challenge.renderingDigest, 'request wording differs from the challenge');
  return { kind: 'raise', title: text, effect: 'Approving lets this trial continue past its current allowance. Your saved messages are then answered. You can still stop the trial at any time.',
    approve: 'Approve', decline: 'Decline' };
}

/** The exact bytes the operator's passkey signs: the whole challenge, the decision and the surface's
 * fresh nonce. A proof for one subject or decision can never stand for another. */
export const actChallenge = (challenge, decision, nonce) =>
  sha256(canonical({ type: 'PreviewApprovalAct', schemaVersion: 1, challenge, decision, nonce }));
/** The exact bytes the operator's passkey signs to open the dashboard: a different type than an act, so a sign-in
 * assertion can never stand for an approval, and an approval can never open a session. */
export const signInChallenge = (operator, nonce) =>
  sha256(canonical({ type: 'PreviewDashboardSignIn', schemaVersion: 1, operator, nonce }));

const authenticatorData = (bytes, rpId, required) => {
  check(bytes.length >= 37 && bytes.subarray(0, 32).equals(sha256(rpId)), 'authenticator data names another site');
  // User present (0x01) and user verified (0x04): the device's own unlock, not a bare tap.
  check((bytes[32] & required) === required, 'user presence and verification required');
  return bytes;
};
const clientData = (text, type, expected, origin) => {
  const bytes = fromB64u(text), data = JSON.parse(bytes.toString('utf8'));
  check(data?.type === type && data.challenge === b64u(expected) && data.origin === origin && data.crossOrigin !== true,
    'client data differs from the exact challenge or origin');
  return bytes;
};
const p256 = der => { const key = createPublicKey({ key: der, format: 'der', type: 'spki' });
  check(key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails?.namedCurve === 'prime256v1', 'P-256 passkey required');
  return key; };

/** A WebAuthn assertion by one enrolled passkey over exactly `expected`. Returns the credential id. */
export function verifyAssertion({ keys, origin, rpId, expected, assertion }) {
  check(assertion !== null && typeof assertion === 'object', 'assertion required');
  const key = Array.isArray(keys) ? keys.find(item => item?.id === assertion.credentialId) : undefined;
  check(key !== undefined && typeof key.publicKey === 'string', 'passkey not enrolled');
  const client = clientData(assertion.clientDataJSON, 'webauthn.get', expected, origin);
  const auth = authenticatorData(fromB64u(assertion.authenticatorData), rpId, 0x05);
  check(verifySignature('sha256', Buffer.concat([auth, sha256(client)]), p256(fromB64u(key.publicKey)), fromB64u(assertion.signature)),
    'passkey signature invalid');
  return key.id;
}

/** A passkey enrolment: an ES256 credential created for this site over the enrolment nonce. The
 * credential id is read from the attested credential data itself. */
export function verifyRegistration({ origin, rpId, expected, registration }) {
  check(registration !== null && typeof registration === 'object' && registration.alg === -7, 'ES256 passkey required');
  clientData(registration.clientDataJSON, 'webauthn.create', expected, origin);
  const auth = authenticatorData(fromB64u(registration.authenticatorData), rpId, 0x45);
  check(auth.length >= 55, 'attested credential data missing');
  const length = auth.readUInt16BE(53), id = auth.subarray(55, 55 + length);
  check(length > 0 && length <= 1023 && id.length === length && b64u(id) === registration.id, 'credential id differs');
  p256(fromB64u(registration.publicKey));
  return { id: registration.id, publicKey: registration.publicKey };
}

/** Reads a file only if it and its directory belong to `owner` and nobody else can write them; the
 * reader must be a different identity (the agent never reads its own approvals as authority). */
export function readOwnedFile(path, owner, reader) {
  check(Number.isSafeInteger(owner) && Number.isSafeInteger(reader) && owner !== reader, 'surface must be administered outside the agent identity');
  for (const [target, directory] of [[dirname(path), true], [path, false]]) {
    const stat = lstatSync(target);
    check(realpathSync(target) === target && !stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile())
      && stat.uid === owner && (stat.mode & 0o022) === 0, 'surface storage ownership or mode invalid');
    if (!directory) check(stat.size <= 262144, 'surface record too large');
  }
  return readFileSync(path, 'utf8');
}

/** Write-once, fsynced record plus its directory: a claim that survives a crash and never reopens. */
export function writeOnce(directory, name, bytes, mode = 0o600) {
  const fd = openSync(join(directory, name), 'wx', mode);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  const dir = openSync(directory, 'r');
  try { fsyncSync(dir); } finally { closeSync(dir); }
}
