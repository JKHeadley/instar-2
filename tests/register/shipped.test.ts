// @ts-nocheck -- exercises the shipped JavaScript build adapter over an in-memory repository.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { shippedInventory } from '../../scripts/register-inventory.mjs';
import { capabilityBriefing, checkShipped } from '../../scripts/register-shipped.mjs';
import { scanSources } from '../../scripts/check-register-wiring.mjs';

const derivedFrom = JSON.parse(readFileSync('register-source/bootstrap-shape.json', 'utf8')).derivedFrom;
const chat = { type: 'Profile', schemaVersion: 1, consequence: 'control', reversibility: 'reversible', reach: 'user', surface: 'chat', repeats: { kind: 'no' } };
const internal = { ...chat, reach: 'internal', surface: 'none' };
const declared = (id, kind, path, extra = {}) => ({ declaration: { type: 'Declaration', schemaVersion: 1, id, kind, status: 'live', requiredFacts: {},
  standards: [], holds: [], declaredBy: { path, symbol: id }, ...extra } });
function world(edit = w => w) {
  const w = edit({
    files: {
      'package.json': JSON.stringify({ instar: { launchers: ['app/main.mjs'] } }),
      'tsconfig.build.json': JSON.stringify({ include: ['src'], compilerOptions: { rootDir: 'src', outDir: 'dist' } }),
      'src/core.ts': 'export const one = 1;\n', 'src/README.md': '# Core\n',
      'app/README.md': '# App\n\n## Capabilities\n\n- `app-answers`: answers the operator.\n',
      'app/main.mjs': "import { one } from '../dist/core.js';\nimport { openStore } from './store.mjs';\nimport { createWorker } from './worker.js';\nimport { parse } from './reader.js';\nopenStore('p'); createWorker().gate(); parse(String(one));\n",
      'app/store.mjs': "import { writeFileSync } from 'node:fs';\nexport function openStore(path) { writeFileSync(path, 'x'); }\n",
      'app/worker.ts': "import type { Shape } from './types.js';\nexport function createWorker() { const gate = (): Shape | void => undefined; return { gate }; }\n",
      'app/types.ts': 'export type Shape = { a: 1 };\n',
      'app/reader.ts': 'export function parse(text: string) { return JSON.parse(text); }\n',
      'other/README.md': '# Other\n\n## Capabilities\n\n- `other-dark`: an unloaded dark feature.\n',
    },
    entries: [
      declared('app.store.openStore', 'stores', 'app/store.declarations.json'),
      declared('app.worker.gate', 'blocking sites', 'app/worker.declarations.json'),
      declared('app.reader.parse', 'parsers', 'app/reader.declarations.json', { requiredFacts: { fixture: 'CAP-1' } }),
      declared('app-answers', 'features', 'app/main.declarations.json', { status: 'dark', profile: chat }),
    ],
    captures: [{ id: 'CAP-1', origin: 'captured', artifact: { path: 'fixtures/cap.json' } }],
    tests: ['tests/reader.test.ts'],
  });
  const show = path => { if (!(path in w.files)) throw new Error('missing ' + path); return w.files[path]; };
  const inventory = shippedInventory(Object.keys(w.files), show);
  const code = Object.fromEntries(inventory.files.map(p => [p, show(p)]));
  const register = { entries: w.entries, shape: { derivedFrom } };
  return { ...w, inventory, register,
    issues: () => checkShipped(register, inventory, scanSources(code).program, { captures: w.captures }, show, () => w.tests) };
}
const without = (files, path) => Object.fromEntries(Object.entries(files).filter(([p]) => p !== path));

describe('shipped inventory and register (Rules 5, 7, 32, 36, 66, 69, 78, 84)', () => {
  it('enumerates the launcher runtime closure from package and build inputs, mapping dist to src and skipping type-only imports', () => {
    const w = world();
    expect(w.inventory.launchers['app/main.mjs']).toEqual(['app/main.mjs', 'app/reader.ts', 'app/store.mjs', 'app/worker.ts', 'src/core.ts']);
    expect(w.inventory.files).not.toContain('app/types.ts');
    expect(Object.keys(w.inventory.modules).sort()).toEqual(['app', 'src']);
    expect(() => world(x => ({ ...x, files: { ...x.files, 'app/main.mjs': "import './gone.js';\n" } }))).toThrow('does not resolve');
    expect(() => world(x => ({ ...x, files: { ...x.files, 'package.json': JSON.stringify({ instar: { launchers: ['app/absent.mjs'] } }) } }))).toThrow('instar.launchers');
  });
  it('a clean shipped surface has no findings', () => {
    expect(world().issues()).toEqual([]);
  }, 30_000);
  it('R5: a shipped module without a documentation entry fails; its README passes', () => {
    expect(world(x => ({ ...x, files: without(x.files, 'src/README.md') })).issues()).toEqual([expect.stringContaining('R5: shipped module src')]);
  }, 30_000);
  it('R7/R32: a shipped durable writer without a declared store fails; a store beside a non-writer fails', () => {
    expect(world(x => ({ ...x, entries: x.entries.filter(e => e.declaration.kind !== 'stores') })).issues())
      .toEqual([expect.stringContaining('R7/R32: app/store.mjs writes durable state but declares no store')]);
    expect(world(x => ({ ...x, entries: [...x.entries, declared('app.reader.parse2', 'stores', 'app/reader.declarations.json')] })).issues())
      .toContain('R66: app.reader.parse2 names parse2, which is not exactly one binding in app/reader.ts');
  }, 30_000);
  it('R66: a declared boundary must be used by shipped code, following object-literal shorthand from a JS caller', () => {
    const unused = world(x => ({ ...x, files: { ...x.files, 'app/main.mjs': x.files['app/main.mjs'].replace('createWorker().gate();', 'createWorker();') } }));
    expect(unused.issues()).toEqual(['R66: no shipped code uses app.worker.gate (app/worker.ts#gate)']);
    const orphan = world(x => ({ ...x, entries: [...x.entries, declared('app.gone.gate', 'blocking sites', 'app/gone.declarations.json')] }));
    expect(orphan.issues()).toEqual(['R66: app.gone.gate is declared beside app/gone.declarations.json, which describes no shipped source']);
  }, 30_000);
  it('R36: a parser needs an executed test on genuinely captured bytes, or a deferred Rule 36 loop', () => {
    const synthetic = x => ({ ...x, captures: [{ ...x.captures[0], origin: 'synthetic' }] });
    expect(world(synthetic).issues()).toEqual([expect.stringContaining('R36: parser app.reader.parse')]);
    expect(world(x => ({ ...x, tests: [] })).issues()).toEqual([expect.stringContaining('R36: parser app.reader.parse')]);
    const deferred = { rule: 36, class: 'deferred', part: 4, ceiling: 1, owner: 'o', overdueAction: 'a' };
    expect(world(x => synthetic({ ...x, entries: x.entries.map(e => e.declaration.kind === 'parsers'
      ? { declaration: { ...e.declaration, holds: [deferred] } } : e) })).issues()).toEqual([]);
  }, 30_000);
  it('R78/R84: every feature has exactly one capability line in its module README, and no line describes an undeclared feature', () => {
    expect(world(x => ({ ...x, files: { ...x.files, 'app/README.md': '# App\n' } })).issues())
      .toEqual([expect.stringContaining('R78/R84: feature app-answers needs exactly one')]);
    expect(world(x => ({ ...x, files: { ...x.files, 'app/README.md': x.files['app/README.md'] + '- `app-ghost`: not declared.\n' } })).issues())
      .toEqual(['R78/R84: app/README.md describes app-ghost, which is not a declared feature of that module']);
  }, 30_000);
  it('generates the installation-filtered briefing: own module available, other loaded features by status, unloaded honest', () => {
    const w = world(x => ({ ...x, entries: [...x.entries,
      declared('core-live', 'features', 'src/core.declarations.json', { profile: internal }),
      declared('core-dark', 'features', 'src/core-dark.declarations.json', { status: 'dark', profile: chat }),
      declared('other-dark', 'features', 'other/thing.declarations.json', { status: 'dark', profile: chat })] }));
    const briefed = capabilityBriefing(w.register, w.inventory, path => w.files[path]).launchers['app/main.mjs'];
    expect(briefed.map(f => [f.id, f.availability, f.userFacing, f.text])).toEqual([
      ['app-answers', 'available', true, 'answers the operator.'], ['core-dark', 'switched-off', true, null],
      ['core-live', 'available', false, null], ['other-dark', 'not-loaded', true, 'an unloaded dark feature.']]);
  });
});
