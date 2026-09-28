/**
 * Design 10 §6 — the Threadline reference suite's key custody, through Node's
 * reviewed OpenSSL-backed primitives (never handwritten crypto): Ed25519
 * signatures, X25519 key agreement, HKDF-SHA256 key derivation and
 * ChaCha20-Poly1305 authenticated encryption. Private keys are handed in once by
 * the host (from its secret custody) and stay inside this closure; neither the
 * adapter nor any worker can read them. Randomness is injected, so captured
 * fixtures are reproducible.
 *
 * Bounded claim: static-static agreement with a fresh salt and nonce per frame
 * gives authenticated confidentiality under this key model, not forward secrecy
 * against a later compromise of either static key. XChaCha20 is unavailable in
 * the reviewed library, so the 96-bit nonce is random and the key is derived
 * per frame from a fresh 128-bit salt; a nonce is never reused under one key.
 */
import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, diffieHellman, hkdfSync, sign, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { THREADLINE_SUITE } from './threadline.js';
import type { ThreadlineKeys, ThreadlineSealedBox } from './threadline.js';

/** The public half of a peer's identity, bound by the governed peer-key record. */
export interface ThreadlinePeerKeys { readonly signing: KeyObject; readonly agreement: KeyObject }
export interface ThreadlineIdentity { readonly signing: KeyObject; readonly agreement: KeyObject; readonly public: ThreadlinePeerKeys }

const ED25519_PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex');
const X25519_PKCS8 = Buffer.from('302e020100300506032b656e04220420', 'hex');

/** Imports an identity from two 32-byte seeds held by the host's secret custody. */
export function threadlineIdentityFromSeeds(signingSeed: Uint8Array, agreementSeed: Uint8Array): ThreadlineIdentity {
  if (signingSeed.byteLength !== 32 || agreementSeed.byteLength !== 32) throw new Error('identity seeds must be 32 bytes');
  const signing = createPrivateKey({ key: Buffer.concat([ED25519_PKCS8, signingSeed]), format: 'der', type: 'pkcs8' });
  const agreement = createPrivateKey({ key: Buffer.concat([X25519_PKCS8, agreementSeed]), format: 'der', type: 'pkcs8' });
  return Object.freeze({ signing, agreement, public: Object.freeze({ signing: createPublicKey(signing), agreement: createPublicKey(agreement) }) });
}

export function createThreadlineKeyCustody(input: Readonly<{ principal: string; identity: ThreadlineIdentity;
  peer: (principal: string) => ThreadlinePeerKeys | undefined; random: (bytes: number) => Uint8Array }>): ThreadlineKeys {
  const { principal, identity } = input;
  const key = (peer: ThreadlinePeerKeys, sender: string, recipient: string, salt: Buffer): Buffer =>
    Buffer.from(hkdfSync('sha256', diffieHellman({ privateKey: identity.agreement, publicKey: peer.agreement }), salt,
      Buffer.from(`${THREADLINE_SUITE}|${sender}|${recipient}`, 'utf8'), 32));
  return Object.freeze({
    principal,
    sign: (bytes: string) => sign(null, Buffer.from(bytes, 'utf8'), identity.signing).toString('base64'),
    verify: (sender: string, bytes: string, signature: string) => {
      const peer = input.peer(sender);
      if (!peer) return 'unknown-key' as const;
      return verify(null, Buffer.from(bytes, 'utf8'), peer.signing, Buffer.from(signature, 'base64')) ? 'valid' as const : 'invalid' as const;
    },
    seal: (recipient: string, associated: string, plaintext: string) => {
      const peer = input.peer(recipient);
      if (!peer) return 'unknown-key' as const;
      const salt = Buffer.from(input.random(16)), nonce = Buffer.from(input.random(12));
      if (salt.length !== 16 || nonce.length !== 12) throw new Error('custody randomness refused');
      const cipher = createCipheriv('chacha20-poly1305', key(peer, principal, recipient, salt), nonce, { authTagLength: 16 });
      cipher.setAAD(Buffer.from(associated, 'utf8'), { plaintextLength: Buffer.byteLength(plaintext, 'utf8') });
      const sealed = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
      return Object.freeze({ salt: salt.toString('base64'), nonce: nonce.toString('base64'), sealed: sealed.toString('base64') });
    },
    open: (sender: string, associated: string, box: ThreadlineSealedBox) => {
      const peer = input.peer(sender);
      if (!peer) return 'unknown-key' as const;
      try {
        const salt = Buffer.from(box.salt, 'base64'), nonce = Buffer.from(box.nonce, 'base64'), sealed = Buffer.from(box.sealed, 'base64');
        if (salt.length !== 16 || nonce.length !== 12 || sealed.length < 16) return 'invalid' as const;
        const decipher = createDecipheriv('chacha20-poly1305', key(peer, sender, principal, salt), nonce, { authTagLength: 16 });
        decipher.setAAD(Buffer.from(associated, 'utf8'), { plaintextLength: sealed.length - 16 });
        decipher.setAuthTag(sealed.subarray(sealed.length - 16));
        return Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()]).toString('utf8');
      } catch { return 'invalid' as const; }
    },
  });
}
