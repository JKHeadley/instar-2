import { createHash } from 'node:crypto';
import type { Hash, Json, Result } from '../types/values.js';
import { refusal, success } from '../types/internal.js';

// Sorted UTF-16 keys, JSON number/string encoding, UTF-8 hashing; schema 1 names SHA-256.
// Reject accessors, prototypes, cycles, sparse arrays and non-JSON inputs rather than invoking them.
export function snapshot(input: unknown, seen = new Set<object>(), depth = 0): Json {
  if (depth > 64) throw new Error('input exceeds 64 levels');
  if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
  if (typeof input === 'number' && Number.isFinite(input)) return Object.is(input, -0) ? 0 : input;
  if (!input || typeof input !== 'object') throw new Error('input is not finite JSON data');
  if (seen.has(input)) throw new Error('cyclic input');
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) throw new Error('non-data prototype');
  seen.add(input);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).some(k => typeof k !== 'string')) throw new Error('symbol field');
  const out: Record<string, Json> = Object.create(null) as Record<string, Json>;
  for (const key of Object.keys(descriptors).sort()) {
    if (Array.isArray(input) && key === 'length') continue;
    const descriptor = descriptors[key]!;
    if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('accessor or hidden field');
    out[key] = snapshot(descriptor.value, seen, depth + 1);
  }
  seen.delete(input);
  if (Array.isArray(input)) {
    if (Object.keys(out).length !== input.length) throw new Error('sparse or extended array');
    return Array.from({ length: input.length }, (_, i) => {
      if (!(String(i) in out)) throw new Error('sparse array');
      return out[String(i)]!;
    });
  }
  return out;
}
export function canonicalText(input: unknown): string {
  const encode = (value: Json): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(encode).join(',')}]`;
    const record = value as Record<string, Json>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${encode(record[key]!)}`).join(',')}}`;
  };
  return encode(snapshot(input));
}
export function hashText(bytes: string): Hash { return `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`; }
export function canonical(input: unknown, preserved = 'input://caller'): Result<{ bytes: string; hash: Hash }> {
  try { const bytes = canonicalText(input); return success({ bytes, hash: hashText(bytes) }); }
  catch { return refusal('canonical encoding requires finite, acyclic JSON data', preserved); }
}
