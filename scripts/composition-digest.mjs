// Rules 26, 45, 49, 69, 115 (D17 §2): the exact bytes a supported harness tuple was certified on. A
// tuple declares its composition's entry points and the resolved runtime; the composition is the
// static import closure of those entries (the existing `importClosure`, so no file list is kept by
// hand), and this digest covers the runtime line and each closure file's path and bytes. Changing
// any executed file — the driver, the owners and core it composes, the loader, the fixed runner — or
// the runtime changes it. The architecture lint recomputes it against the declared value, and the
// harness admits its declared conformance only when it equals the running closure's digest.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { importClosure } from './import-closure.mjs';

/**
 * The composition of declared entry points: every file of their static import closure (sorted), less
 * the declaration that carries the certification itself (a claim cannot be part of what it certifies).
 * It is complete only when every import resolved and none was computed; an incomplete closure certifies nothing.
 */
export function compositionClosure(entries, read, declaration, exists = path => read(path) !== null) {
  const closure = importClosure(entries, read, exists);
  return { files: closure.files.filter(path => path !== declaration), complete: closure.unresolved.length === 0 && closure.computed.length === 0 };
}

/** `read(path)` returns a repository file's text, or null when it is absent. */
export function compositionDigest(runtime, files, read) {
  const parts = [`runtime:${runtime}`];
  for (const path of files) {
    const text = read(path);
    if (typeof text !== 'string') return null;
    parts.push(`${path}\0${text}`);
  }
  return `sha256:${createHash('sha256').update(parts.join('\0\0'), 'utf8').digest('hex')}`;
}

const files = new Map();
/** The sha256 of a file's bytes (cached per path, size and modification time). */
export function fileDigest(path) {
  const info = statSync(path), key = `${path}\0${info.size}\0${info.mtimeMs}`;
  if (!files.has(key)) files.set(key, `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`);
  return files.get(key);
}
/** The resolved running runtime, in the form a tuple declares it: its exact version and the digest of its executable's bytes. */
export const currentRuntime = () => `node-${process.versions.node}@${fileDigest(realpathSync(process.execPath))}`;
