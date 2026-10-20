import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, normalize } from 'node:path';
import ts from 'typescript';
import { importClosure } from '../../scripts/import-closure.mjs';

/**
 * The one-line install (`npx github:JKHeadley/instar-2 setup`) installs this repository as a git
 * package. npm gives a git package its `dependencies` only, never its `devDependencies`, so every
 * package the setup entry loads at run time must be a declared dependency. On 2026-10-20 a clean
 * run failed on exactly this: the TypeScript loader that `bin/instar2.mjs` registers imports
 * `typescript`, which was declared dev-only.
 */
const read = (path: string) => { try { return readFileSync(path, 'utf8'); } catch { return null; } };
const builtins = new Set(builtinModules);
const packageOf = (specifier: string) => specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/');

/** The setup entry plus every loader it registers by literal relative path. */
function setupEntries(): string[] {
  const entry = 'bin/instar2.mjs', text = read(entry) ?? '';
  const loaders = [...text.matchAll(/register\(\s*'(\.{1,2}\/[^']+)'\s*,\s*import\.meta\.url\s*\)/gu)]
    .map(match => normalize(join(dirname(entry), String(match[1]))));
  return [entry, ...loaders];
}
/** Bare (package) imports reached from the setup entries, by package name. */
function packagesLoaded(): Set<string> {
  const closure = importClosure(setupEntries(), read, existsSync, () => false);
  const found = new Set<string>();
  for (const file of closure.files)
    for (const { fileName } of ts.preProcessFile(read(file) ?? '', true, true).importedFiles)
      if (!fileName.startsWith('.') && !fileName.startsWith('node:') && !builtins.has(fileName)) found.add(packageOf(fileName));
  return found;
}
/** Packages loaded at run time that a git install would not provide. */
const undeclared = (loaded: Iterable<string>, manifest: { dependencies?: Record<string, string> }) =>
  [...loaded].filter(name => !Object.hasOwn(manifest.dependencies ?? {}, name)).sort();

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));

it('finds the TypeScript loader that the setup entry registers, and its package import', () => {
  expect(setupEntries()).toEqual(['bin/instar2.mjs', 'scripts/slice-ts-loader.mjs']);
  expect([...packagesLoaded()]).toContain('typescript');
});

it('declares every package the setup entry loads as a run-time dependency', () => {
  expect(undeclared(packagesLoaded(), manifest)).toEqual([]);
});

it('refuses a manifest that declares a loaded package as dev-only (the 2026-10-20 clean-run failure)', () => {
  const devOnly = { dependencies: {}, devDependencies: { typescript: '~5.9.3', vitest: '~3.2.4' } };
  expect(undeclared(packagesLoaded(), devOnly)).toEqual(['typescript']);
});

it('keeps the lockfile in agreement, so a pinned install provides the same packages', () => {
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  expect(lock.packages[''].dependencies).toEqual(manifest.dependencies);
  for (const name of Object.keys(manifest.dependencies)) expect(lock.packages[`node_modules/${name}`].dev).toBeUndefined();
});

it('tells a reader the one-line install, from this repository rather than the unrelated npm name', () => {
  const readme = readFileSync('README.md', 'utf8');
  expect(readme).toContain('npx github:JKHeadley/instar-2 setup');
  expect(readme).toMatch(/package named `instar2`[^\n]*is not this project/u);
});
