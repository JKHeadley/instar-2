import { canonical } from '../../src/index.js';

/** Canonical bytes and hash of a value; refuses anything the core encoder refuses. */
export function encoded(value: unknown) {
  const result = canonical(value);
  if (result.kind !== 'Success') throw new Error('preview: canonical encoding refused');
  return result.value;
}
