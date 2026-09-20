import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadOwnerReferences } from '../../scripts/register-owner-references.mjs';
import { hash } from './fixtures.js';

// Committed source fixtures exercise Three's real resolver. They confer no
// installation admission and are never put in the installation manifests.
describe('M3-A exact Ten and installed Five owner references', () => {
  let root: string, commit: string, files: string[];
  const tenPath = 'register-source/owner-references/part-ten.json';
  const fivePath = 'register-source/owner-references/part-five.json';
  const bindings = [
    ['decodeInstallationSelectionAtOrigin', 'assembly', 'installation-selection'],
    ['decodeHistoricalInstallationSelection', 'assembly', 'installation-selection'],
    ['decodeProductionSignerReferenceAtOrigin', 'assembly', 'production-signer-reference'],
    ['decodeHistoricalProductionSignerReference', 'assembly', 'production-signer-reference'],
    ['decodeInstalledRunGovernanceReferenceAtOrigin', 'rungraph', 'installed-governance'],
    ['decodeHistoricalInstalledRunGovernanceReference', 'rungraph', 'installed-governance'],
  ] as const;
  const artifact = (path: string) => ({ path, hash: hash(readFileSync(join(root, path), 'utf8')) });
  const manifest = (owner: string) => ({ schemaVersion: 1, owner, fixtures: [], probes: [], documents: [],
    decoders: bindings.filter(([, namespace]) => namespace === (owner === 'part-ten' ? 'assembly' : 'rungraph'))
      .map(([id, namespace, source]) => ({ id, module: artifact(`src/${namespace}/index.ts`),
        artifact: artifact(`src/${namespace}/${source}.ts`) })) });
  const load = (ten = manifest('part-ten'), five = manifest('part-five'), extra: Record<string, string> = {}) =>
    loadOwnerReferences(root, { commit, files, sources: {
      [tenPath]: JSON.stringify(ten), [fivePath]: JSON.stringify(five), ...extra,
    } });
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'm3-owner-reference-'));
    for (const namespace of ['assembly', 'rungraph']) {
      mkdirSync(join(root, 'src', namespace), { recursive: true });
      const selected = bindings.filter(([, ns]) => ns === namespace);
      writeFileSync(join(root, 'src', namespace, 'index.ts'), selected.map(([id, , source]) =>
        `export { ${id} } from './${source}.js';`).join('\n'));
      for (const source of new Set(selected.map(([, , source]) => source))) {
        const path = join(root, 'src', namespace, `${source}.ts`);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, selected.filter(([, , s]) => s === source).map(([id]) =>
          `export function ${id}(value: unknown) { return value; }`).join('\n'));
      }
    }
    const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture',
      '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-q'); git('add', '.'); git('commit', '-qm', 'owner artifacts');
    commit = git('rev-parse', 'HEAD'); files = git('ls-tree', '-r', '--name-only', commit).split('\n');
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('loads the exact four Ten and two Five decoders from committed owner artifacts', () => {
    expect(load().decoders.map(row => row.id).sort()).toEqual(bindings.map(([id]) => id).sort());
  });
  it('refuses a part-eleven manifest path', () => {
    expect(() => load(undefined, undefined, { 'register-source/owner-references/part-eleven.json': '{}' }))
      .toThrow('unknown owner manifest path');
  });
  it('refuses an unknown Ten decoder', () => {
    const ten = manifest('part-ten'); ten.decoders[0]!.id = 'decodeInvented' as typeof ten.decoders[number]['id'];
    expect(() => load(ten)).toThrow('unknown owner decoder');
  });
  it('refuses a Ten decoder pointing at a Five artifact', () => {
    const ten = manifest('part-ten'); ten.decoders[0]!.artifact = artifact('src/rungraph/installed-governance.ts');
    expect(() => load(ten)).toThrow('wrong-owner or missing artifact');
  });
  it('refuses a Five governance decoder pointing outside rungraph', () => {
    const five = manifest('part-five'); five.decoders[0]!.artifact = artifact('src/assembly/installation-selection.ts');
    expect(() => load(undefined, five)).toThrow('wrong-owner or missing artifact');
  });
  it('retains hash, duplicate-owner, and owner/path disagreement refusals', () => {
    const ten = manifest('part-ten'); ten.decoders[0]!.artifact.hash = hash('changed');
    expect(() => load(ten)).toThrow('reference artifact hash differs');
    expect(() => load(undefined, undefined, { 'register-source/owner-references.json': JSON.stringify(manifest('part-ten')) }))
      .toThrow('duplicate owner');
    expect(() => load({ ...manifest('part-ten'), owner: 'part-five' })).toThrow('owner manifest path disagrees');
  });
});
