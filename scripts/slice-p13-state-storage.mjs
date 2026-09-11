import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { canonical, consumeResult } from '../src/index.js';

function hash(value) {
  return consumeResult(canonical(value), {
    Success: encoded => encoded.hash,
    Refused: refusal => { throw new Error(refusal.detail); },
  });
}

/** Exact-byte, atomic local custody for Part Thirteen's package-local journal. */
export function createHarnessAdapterFileState(path) {
  if (!path) throw new Error('harness adapter state path is required');
  const load = () => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  return Object.freeze({
    owner: 'part-thirteen',
    id: `file:${path}`,
    load,
    save(expected, snapshot) {
      const current = load();
      const actual = current === null ? null : hash(current);
      if (actual !== expected) throw new Error('harness adapter state compare-and-swap mismatch');
      const temporary = `${path}.pending-${process.pid}`;
      writeFileSync(temporary, `${JSON.stringify(snapshot)}\n`, { encoding: 'utf8', mode: 0o600 });
      const descriptor = openSync(temporary, 'r');
      try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
      renameSync(temporary, path);
    },
  });
}
