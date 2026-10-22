import { createPublicKey, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

// A bounded memo of the cryptographic predicate only, never standing or key policy.
// Envelope and historical-field readers verify the same signature consecutively.
// Exact public-key, message and signature bytes are the entire predicate input.
let key: { pem: string; parsed: KeyObject } | undefined;
let verified: { pem: string; message: string; signature: string } | undefined;
export function verifySignature(message: string, pem: string, signature: string): boolean {
  if (verified?.pem === pem && verified.message === message && verified.signature === signature) return true;
  if (key?.pem !== pem) key = { pem, parsed: createPublicKey(pem) };
  const valid = verify(null, Buffer.from(message, 'utf8'), key.parsed, Buffer.from(signature, 'hex'));
  if (valid) verified = { pem, message, signature };
  return valid;
}
