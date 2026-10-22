import { expect, it } from 'vitest';
import { verify } from 'node:crypto';
import { verifySignature } from '../../src/decode/signature.js';
import { factsFixture, publicKey } from '../facts/fixtures.js';

it('memoized cryptographic predicates equal native verification after each input changes', () => {
  const f = factsFixture(), a = f.fact(), b = f.fact({ body: { identity: 'two', amount: '20' } });
  const otherKey = f.ctx.keys[1]!.publicKey;
  for (const [message, pem, signature] of [
    [a.contentHash, publicKey, a.signature], [a.contentHash, publicKey, a.signature],
    [b.contentHash, publicKey, a.signature], [a.contentHash, publicKey, b.signature],
    [a.contentHash, otherKey, a.signature], [a.contentHash, publicKey, a.signature],
    [b.contentHash, publicKey, b.signature], [a.contentHash, publicKey, a.signature],
  ] as const) {
    expect(verifySignature(message, pem, signature)).toBe(verify(null, Buffer.from(message), pem, Buffer.from(signature, 'hex')));
  }
});
