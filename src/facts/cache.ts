// Local checkpoint certificates are not fact signatures or new live authority.
import { sign, verify } from 'node:crypto';
import type { Json } from '../index.js';
import { encoding, object, requireFact, fields, string } from './boundary.js';
export interface CacheKey { readonly id: string; readonly publicKey: string }
export function signCache(domain: string, value: unknown, keyId: string, privateKey: string): Json {
  const payload = JSON.parse(encoding({ domain, value, keyId }).bytes) as Json;
  const hash = encoding(payload).hash;
  return { payload, hash, signature: sign(null, Buffer.from(hash), privateKey).toString('hex') };
}
export function openCache(domain: string, input: Json, keys: readonly CacheKey[]): Json {
  const v = object(input); fields(v, ['payload', 'hash', 'signature']);
  const p = object(v.payload!); fields(p, ['domain', 'value', 'keyId']); requireFact(p.domain === domain, 'checkpoint domain mismatch');
  const key = keys.find(k => k.id === p.keyId); requireFact(key, 'checkpoint signer is not independently trusted');
  requireFact(encoding(p).hash === v.hash, 'checkpoint hash mismatch', 'integrity');
  const signature = string(v.signature, 'signature');
  requireFact(/^[a-f0-9]{128}$/.test(signature) && verify(null, Buffer.from(String(v.hash)), key.publicKey, Buffer.from(signature, 'hex')), 'checkpoint signature invalid', 'integrity');
  return p.value!;
}
