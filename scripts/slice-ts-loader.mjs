import ts from 'typescript';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OPTIONS = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext };

// Transpiling the slice's TypeScript graph in-process costs ~20 CPU-seconds per launch, and the
// preview launcher tests boot that graph in several child processes inside one bounded test case
// (the SIGINT/SIGTERM/SIGHUP pause cases boot it six times), so on a host whose cores are slower
// or already busy the case ran out of wall clock before its first poll — the failure was the boot
// cost, never the signal. transpileModule's output is a pure function of the file bytes, the
// TypeScript version and the options above, so it is cached by content digest: a changed byte is a
// different key, so a stale hit is not representable. The cache is an optimization only — an
// unreadable or unwritable cache directory falls back to transpiling, and INSTAR_SLICE_TS_CACHE=off
// disables it outright.
const FINGERPRINT = `slice-ts-loader/1 ${ts.version} ${OPTIONS.target} ${OPTIONS.module}`;
const setting = process.env.INSTAR_SLICE_TS_CACHE;
const directory = setting === 'off' ? null
  : setting || join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.cache', 'slice-ts-loader');
let usable = directory !== null;

const cached = path => {
  if (!usable) return undefined;
  try { return existsSync(path) ? readFileSync(path, 'utf8') : undefined; }
  catch { return undefined; }
};

const remember = (path, source) => {
  if (!usable) return;
  // Write then rename: concurrent child processes transpiling the same file publish the same bytes,
  // and a reader never observes a partial file.
  try {
    mkdirSync(dirname(path), { recursive: true });
    const pending = `${path}.${process.pid}.pending`;
    writeFileSync(pending, source);
    renameSync(pending, path);
  } catch { usable = false; }
};

export async function resolve(specifier, context, next) {
  if (specifier.endsWith('.js') && (specifier.startsWith('.') || specifier.startsWith('file:'))) {
    const url = new URL(specifier, context.parentURL); const source = `${url.href.slice(0, -3)}.ts`;
    if (existsSync(fileURLToPath(source))) return { url: source, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith('.ts')) {
    const text = readFileSync(fileURLToPath(url), 'utf8');
    const digest = createHash('sha256').update(FINGERPRINT).update(' ').update(text).digest('hex');
    const path = directory === null ? null : join(directory, digest.slice(0, 2), `${digest.slice(2)}.mjs`);
    const hit = path === null ? undefined : cached(path);
    if (hit !== undefined) return { format: 'module', shortCircuit: true, source: hit };
    const source = ts.transpileModule(text, { compilerOptions: OPTIONS }).outputText;
    if (path !== null) remember(path, source);
    return { format: 'module', shortCircuit: true, source };
  }
  return next(url, context);
}
