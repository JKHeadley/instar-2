import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOwnerReferences } from '../../scripts/register-owner-references.mjs';
import { hash } from './fixtures.js';

describe('round-two owner enrollment regressions', () => {
  it('P3-NF-09 binds artifacts to the enrolled owner and retains the approved enrollment in committed source', () => {
    const root = mkdtempSync(join(tmpdir(), 'p3-owner-round-two-'));
    try {
      const manifestPath = 'register-source/owner-references/part-fourteen.json';
      const fixturePath = 'tests/e2e/sentinel-holders.test.ts';
      mkdirSync(join(root, 'register-source/owner-references'), { recursive: true });
      mkdirSync(join(root, 'tests/e2e'), { recursive: true });
      mkdirSync(join(root, 'tests/facts'), { recursive: true });
      writeFileSync(join(root, fixturePath), 'export const partFourteenFixture = true;\n');
      writeFileSync(join(root, 'tests/facts/admission.test.ts'), readFileSync('tests/facts/admission.test.ts'));
      const manifest = { schemaVersion: 1, owner: 'part-fourteen', fixtures: [{ id: 'P14-NF-50', stage: 'build',
        artifact: { path: fixturePath, hash: hash('export const partFourteenFixture = true;\n') } }], probes: [], decoders: [], documents: [] };
      writeFileSync(join(root, manifestPath), JSON.stringify(manifest));
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8' }).trim();
      git('init'); git('add', '.'); git('commit', '-qm', 'owner enrollment');
      const enrollment = { part: 14, owner: 'part-fourteen', manifest: { path: manifestPath, hash: hash(manifest) } };
      const readInput = () => { const commit = git('rev-parse', 'HEAD'); const files = git('ls-tree', '-r', '--name-only', commit).split('\n'); return { commit,
        files, sources: Object.fromEntries([manifestPath, 'register-source/owner-enrollments.json'].filter(path => files.includes(path))
          .map(path => [path, git('show', `${commit}:${path}`)])) }; };
      expect(() => loadOwnerReferences(root, readInput())).toThrow('unknown owner manifest path');
      expect(loadOwnerReferences(root, readInput(), [enrollment]).catalog.fixtures.map(row => row.id)).toEqual(['P14-NF-50']);

      writeFileSync(join(root, 'register-source/owner-enrollments.json'), JSON.stringify({ schemaVersion: 1, enrollments: [enrollment] }));
      git('add', '.'); git('commit', '-qm', 'retain approved enrollment');
      expect(() => loadOwnerReferences(root, readInput())).toThrow('unknown owner manifest path');
      expect(loadOwnerReferences(root, readInput(), [enrollment]).catalog.fixtures.map(row => row.id)).toEqual(['P14-NF-50']);

      const stolen = { ...manifest, fixtures: [{ id: 'P2-NF-32', stage: 'build', artifact: {
        path: 'tests/facts/admission.test.ts', hash: hash(readFileSync(join(root, 'tests/facts/admission.test.ts'), 'utf8')) } }] };
      writeFileSync(join(root, manifestPath), JSON.stringify(stolen));
      const stolenEnrollment = { ...enrollment, manifest: { path: manifestPath, hash: hash(stolen) } };
      writeFileSync(join(root, 'register-source/owner-enrollments.json'), JSON.stringify({ schemaVersion: 1, enrollments: [stolenEnrollment] }));
      git('add', '.'); git('commit', '-qm', 'wrong owner attempt');
      expect(() => loadOwnerReferences(root, readInput(), [stolenEnrollment])).toThrow('unknown owner fixture');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
