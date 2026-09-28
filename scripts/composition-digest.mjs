// Rules 26, 45, 49, 69, 115 (D17 §2): the exact bytes a supported harness tuple was certified on. A
// tuple declares its composition's entry points and the resolved runtime; the composition is the
// static import closure of those entries (the existing `importClosure`, so no file list is kept by
// hand), and this digest covers the runtime line and each closure file's path and bytes. Changing
// any executed file — the driver, the owners and core it composes, the loader, the fixed runner — or
// the runtime changes it. The architecture lint recomputes it against the declared value, and the
// harness admits its declared conformance only when it equals the running closure's digest.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import ts from 'typescript';
import { importClosure } from './import-closure.mjs';

/** The file a bare package import loads, from the repository's `node_modules`: its `package.json` and the
 * entry it names (`exports` string or `.` import/default condition, else `main`, else `index.js`). Null when
 * that cannot be resolved to present files — an unresolved package leaves the composition incomplete. */
function packageFiles(spec, read) {
  const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  if (name !== spec) return null; // a package subpath is not resolved here: the composition is then incomplete
  const manifest = `node_modules/${name}/package.json`, text = read(manifest);
  if (text === null) return null;
  let pkg; try { pkg = JSON.parse(text); } catch { return null; }
  const root = pkg.exports?.['.'] ?? pkg.exports;
  const target = typeof root === 'string' ? root : root?.import ?? root?.default ?? pkg.main ?? 'index.js';
  if (typeof target !== 'string') return null;
  const entry = `node_modules/${name}/${target.replace(/^\.\//u, '')}`;
  return read(entry) === null ? null : [manifest, entry];
}

/**
 * The composition of declared entry points: every file of their static import closure (sorted), less
 * the declaration that carries the certification itself (a claim cannot be part of what it certifies).
 * Everything the composition executes is in it: built core output (`dist/`) is walked like source rather
 * than assumed to match it, and each bare package it imports (the loader's compiler) contributes the
 * resolved entry file and manifest it actually loads. It is complete only when every import resolved and
 * none was computed; an incomplete closure certifies nothing.
 */
export function compositionClosure(entries, read, declaration, exists = path => read(path) !== null) {
  const closure = importClosure(entries, read, exists, () => false);
  const files = new Set(closure.files.filter(path => path !== declaration));
  let complete = closure.unresolved.length === 0 && closure.computed.length === 0;
  for (const file of closure.files) for (const { fileName } of ts.preProcessFile(read(file) ?? '', true, true).importedFiles) {
    if (fileName.startsWith('.') || isBuiltin(fileName)) continue;
    const resolved = packageFiles(fileName, read);
    if (resolved) for (const path of resolved) files.add(path); else complete = false;
  }
  return { files: [...files].sort(), complete };
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
