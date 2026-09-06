import { describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadOwnerReferences, mergeOwnerReferences } from '../../scripts/register-owner-references.mjs';
import { scanSources } from '../../scripts/check-register-wiring.mjs';
import { installOwnerFixture, ownerDecoders } from './owner-fixture.js';
import { hash } from './fixtures.js';

describe('P3-P5 committed owner reference resolver', () => {
  it('resolves pinned fixtures/probes/documents and refuses hostile owner/hash/name inputs', () => {
    const root = mkdtempSync(join(tmpdir(), 'p3-owner-catalog-'));
    try {
      for (const path of ['docs', 'register-source']) cpSync(path, join(root, path), { recursive: true });
      installOwnerFixture(root);
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      git('init'); git('add', '.'); git('commit', '-qm', 'owner fixture');
      const commit = git('rev-parse', 'HEAD'); const files = git('ls-tree', '-r', '--name-only', commit).split('\n');
      const path = 'register-source/owner-references.json'; const original = JSON.parse(readFileSync(join(root, path), 'utf8'));
      const load = (manifest = original) => loadOwnerReferences(root, { commit, files, sources: { [path]: JSON.stringify(manifest) } });
      const owner = load();
      expect(owner.references.map(r => r.id)).toEqual(['P5-NF-54', 'P5-NF-55', ...ownerDecoders]);
      expect(owner.documents[0]?.id).toBe('rungraph.contract');
      expect(owner.catalog.probes[0]).toMatchObject({ execution: 'ci', cadence: 1000 });
      expect(mergeOwnerReferences({ catalog: { fixtures: [], probes: [] }, references: [] }, owner)).toMatchObject({ references: owner.references });
      expect(() => mergeOwnerReferences({ references: [{ provider: 'decoder', id: 'decodeRun', claimed: true }] }, owner)).toThrow('conflicting');
      // Ambient edits cannot redefine the committed bytes used by the resolver.
      writeFileSync(join(root, 'src/rungraph/records.ts'), 'export const decodeRun = () => true;');
      expect(load().artifacts['src/rungraph/records.ts']).not.toContain('=> true');
      const mutations = [
        (m: typeof original) => { m.owner = 'part-three'; },
        (m: typeof original) => { m.decoders[0].id = 'decodeInvented'; },
        (m: typeof original) => { m.decoders[0].artifact.path = 'src/register/records.ts'; },
        (m: typeof original) => { m.decoders[0].module.hash = hash('changed'); },
        (m: typeof original) => { m.fixtures[0].artifact.hash = hash('changed'); },
        (m: typeof original) => { m.probes[0].cadence = 0; },
        (m: typeof original) => { m.probes[0].execution = 'production'; },
        (m: typeof original) => { m.documents[0].artifact.hash = hash('changed'); },
        (m: typeof original) => { m.decoders.push(m.decoders[0]); },
      ];
      for (const mutate of mutations) { const manifest = structuredClone(original); mutate(manifest); expect(() => load(manifest)).toThrow(); }
      expect(() => loadOwnerReferences(root, { commit, files: [], sources: { [path]: JSON.stringify(original) } })).toThrow('missing artifact');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('follows actual public owner exports, direct imports, namespaces and aliases, never local impostors', () => {
    const records = Object.fromEntries(ownerDecoders.map(id => [id, `export const ${id} = (v: unknown) => v;`]));
    const source: Record<string, string> = {
      'src/rungraph/records.ts': Object.values(records).join('\n'),
      'src/rungraph/index.ts': `export { ${ownerDecoders.join(', ')} } from './records.js';`,
      'src/client.ts': `import { decodeRun as run, decodeRunStep } from './rungraph/index.js';
import * as owner from './rungraph/index.js';
import { decodeRunTransition } from './rungraph/records.js';
import { decodeRun as publicRun } from '@instar/constitutional-types/rungraph';
export function gate() { const alias = owner.decodeRunExit; run(x); decodeRunStep(x); decodeRunTransition(x); alias(x); owner.decodeSessionGrounding(x); }
export function publicGate() { publicRun(x); }
export function mutable() { let alias = run; alias = (v) => v; alias(x); }
export function spoof() { const decodeRun = (v: unknown) => v; decodeRun(x); }
export function computed(key: string) { owner[key](x); }`,
    };
    const bindings = ownerDecoders.map(id => ({ id, module: { path: 'src/rungraph/index.ts', hash: hash(source['src/rungraph/index.ts']) }, artifact: { path: 'src/rungraph/records.ts', hash: hash(source['src/rungraph/records.ts']) } }));
    const scanned = scanSources(source, bindings);
    expect(scanned.reports[2]?.scopes.gate?.invokes).toEqual(ownerDecoders);
    expect(scanned.reports[2]?.scopes.spoof?.invokes).toEqual([]);
    expect(scanned.reports[2]?.scopes.publicGate?.invokes).toEqual(['decodeRun']);
    expect(scanned.reports[2]?.scopes.mutable?.invokes).toEqual([]);
    expect(scanned.reports[2]?.scopes.computed?.invokes).toEqual([]);
    expect(scanned.residual).toContainEqual(expect.objectContaining({ reason: 'computed invocation is outside static port proof' }));
    for (const body of ['export const decodeRun = () => true;', "export { decodeRun } from '../impostor.js';", 'export const decodeRun = 1;']) {
      const fake = { ...source, 'src/rungraph/index.ts': body, 'src/impostor.ts': 'export const decodeRun = () => true;' };
      expect(() => scanSources(fake, bindings)).toThrow('unresolved public owner decoder');
    }
  }, 30_000);
  it('R1 proves the receiver binding, not a retained owner member type', () => {
    const client = `import * as owner from './rungraph/index.js';
import { decodeRun as direct } from './rungraph/index.js';
import * as aliases from './alias.js';
export function immutable(input: unknown) { const ns = owner; const next = ns; return next.decodeRun(input); }
export function imported(input: unknown) { return direct(input); }
export function extracted(input: unknown) { const ns = owner; const fn = ns.decodeRun; return fn(input); }
export function immutableMember(input: unknown) { const ns = aliases; return ns.call(input); }
export function mutableMember(input: unknown) { let ns = aliases; ns = { ...aliases, call: (_v: unknown) => 'impostor' }; const next = ns; return next.call(input); }
export function reassigned(input: unknown) { let ns = owner; ns = { ...owner, decodeRun: (_v: unknown) => 'impostor' }; return ns.decodeRun(input); }
export function parameter(input: unknown, ns: typeof owner) { return ns.decodeRun(input); }
export function defaultParameter(input: unknown, ns: typeof owner = owner) { return ns.decodeRun(input); }
export function mutableAlias(input: unknown) { let ns = owner; ns = { ...owner, decodeRun: (_v: unknown) => 'impostor' }; const next = ns; return next.decodeRun(input); }
export function extractedMutable(input: unknown) { let ns = owner; ns = { ...owner, decodeRun: (_v: unknown) => 'impostor' }; const fn = ns.decodeRun; return fn(input); }
export function copied(input: unknown) { const ns = { ...owner, decodeRun: (_v: unknown) => 'impostor' }; return ns.decodeRun(input); }`;
    const sources = { 'src/rungraph/records.ts': 'export const decodeRun = (v: unknown) => v;',
      'src/rungraph/index.ts': "export { decodeRun } from './records.js';", 'src/client.ts': client,
      'src/alias.ts': "import * as owner from './rungraph/index.js'; export const call = owner.decodeRun;" };
    const bindings = [{ id: 'decodeRun', module: { path: 'src/rungraph/index.ts', hash: hash(sources['src/rungraph/index.ts']) },
      artifact: { path: 'src/rungraph/records.ts', hash: hash(sources['src/rungraph/records.ts']) } }];
    const scopes = scanSources(sources, bindings).reports[2]!.scopes;
    let calls = 0;
    const real = Object.freeze({ decodeRun: (_input: unknown): string => { calls++; return 'real'; } });
    const fake = { decodeRun: (_input: unknown) => 'impostor' };
    const exported: Record<string, (input: unknown, ns?: typeof real) => string> = {};
    // Execute the exact scanned TypeScript as well: negative evidence must agree
    // with zero owner calls, not merely with the expected scanner report shape.
    new Function('require', 'exports', ts.transpileModule(client, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)((path: string) => path === './alias.js' ? { call: real.decodeRun } : real, exported);
    for (const name of ['immutable', 'imported', 'extracted', 'immutableMember']) {
      calls = 0; expect(exported[name]!('input')).toBe('real'); expect(calls).toBe(1);
      expect(scopes[name]?.invokes).toEqual(['decodeRun']);
    }
    for (const name of ['reassigned', 'parameter', 'defaultParameter', 'mutableAlias', 'extractedMutable', 'copied', 'mutableMember']) {
      calls = 0; expect(exported[name]!('input', fake)).toBe('impostor'); expect(calls).toBe(0);
      expect(scopes[name]?.invokes).toEqual([]);
    }
  });
  it.each(['src/rungraph/bridge.ts', 'src/rungraph/bridge.d.ts', 'helpers/bridge.ts'])('R2 never reads ambient intermediary %s', bridge => {
    const root = mkdtempSync(join(tmpdir(), 'p3-owner-closed-graph-')); const previous = process.cwd();
    try {
      process.chdir(root);
      const specifier = bridge.startsWith('src/') ? './bridge.js' : '../../helpers/bridge.js';
      const body = `export { decodeRun } from '${bridge.startsWith('src/') ? './records.js' : '../src/rungraph/records.js'}';`;
      const sources = { 'src/rungraph/records.ts': 'export const decodeRun = (v: unknown) => v;',
        'src/rungraph/index.ts': `export { decodeRun } from '${specifier}';`,
        'src/client.ts': "import { decodeRun } from '@instar/constitutional-types/rungraph'; export function gate() { decodeRun(input); }" };
      const bindings = [{ id: 'decodeRun', module: { path: 'src/rungraph/index.ts', hash: hash(sources['src/rungraph/index.ts']) },
        artifact: { path: 'src/rungraph/records.ts', hash: hash(sources['src/rungraph/records.ts']) } }];
      expect(() => scanSources(sources, bindings)).toThrow('unresolved public owner decoder');
      mkdirSync(join(root, bridge, '..'), { recursive: true }); writeFileSync(join(root, bridge), body);
      expect(() => scanSources(sources, bindings)).toThrow('unresolved public owner decoder');
      // The very same module is accepted once it belongs to the supplied graph.
      expect(scanSources({ ...sources, [bridge]: body }, bindings).reports[2]?.scopes.gate?.invokes).toEqual(['decodeRun']);
    } finally { process.chdir(previous); rmSync(root, { recursive: true, force: true }); }
  });
});
