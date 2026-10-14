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
// Validate and encode in one walk. snapshot() remains the independent mutable-copy
// boundary; encoding needs no intermediate copy or second traversal of every field.
export function canonicalText(input: unknown): string {
  const seen = new Set<object>();
  const encode = (value: unknown, depth: number): string => {
    if (depth > 64) throw new Error('input exceeds 64 levels');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(Object.is(value, -0) ? 0 : value);
    if (!value || typeof value !== 'object') throw new Error('input is not finite JSON data');
    if (seen.has(value)) throw new Error('cyclic input');
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) throw new Error('non-data prototype');
    seen.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(value).some(k => typeof k !== 'string')) throw new Error('symbol field');
    const parts: Record<string, string> = Object.create(null) as Record<string, string>;
    const keys = Object.keys(descriptors).sort(), array = Array.isArray(value);
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = descriptors[key]!;
      if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('accessor or hidden field');
      parts[key] = encode(descriptor.value, depth + 1);
    }
    seen.delete(value);
    if (array) {
      if (Object.keys(parts).length !== value.length) throw new Error('sparse or extended array');
      return `[${Array.from({ length: value.length }, (_, i) => {
        if (!(String(i) in parts)) throw new Error('sparse array');
        return parts[String(i)]!;
      }).join(',')}]`;
    }
    return `{${keys.map(key => `${JSON.stringify(key)}:${parts[key]!}`).join(',')}}`;
  };
  return encode(input, 0);
}
export function hashText(bytes: string): Hash { return `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`; }
export function canonical(input: unknown, preserved = 'input://caller'): Result<{ bytes: string; hash: Hash }> {
  try { const bytes = canonicalText(input); return success({ bytes, hash: hashText(bytes) }); }
  catch { return refusal('canonical encoding requires finite, acyclic JSON data', preserved); }
}
