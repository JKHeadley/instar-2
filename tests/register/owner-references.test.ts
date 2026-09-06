import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
});
