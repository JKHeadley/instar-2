import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOwnerReferences } from '../../scripts/register-owner-references.mjs';
import { hash } from '../register/fixtures.js';

describe.skip('round-six governed owner enrollment loading SKIPPED: HELD-BY-SCOPE:SEAM-LEDGER-row-124', () => {
  it('P3-NF-09 refuses a missing manifest still pinned by the retained enrollment ledger', () => {
    const root = mkdtempSync(join(tmpdir(), 'register-missing-owner-manifest-'));
    try {
      const git = (...args: string[]) => execFileSync('git', ['-C', root, '-c', 'user.name=Fixture',
        '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8' }).trim();
      const inputAt = (commit: string) => {
        const files = git('ls-tree', '-r', '--name-only', commit).split('\n');
        const selected = files.filter(path => path.startsWith('register-source/') && path.endsWith('.json'));
        return { commit, files, code: {}, sources: Object.fromEntries(selected.map(path => [path, git('show', `${commit}:${path}`)])) };
      };
      const manifestPath = 'register-source/owner-references/part-fourteen.json';
      const fixturePath = 'tests/e2e/sentinel-holders.test.ts', probePath = 'tests/sentinel-holders/core.test.ts';
      const fixtureBytes = '// P14-NF-50 enrolled build fixture\n', probeBytes = '// part fourteen CI probe fixture\n';
      const manifest = { schemaVersion: 1, owner: 'part-fourteen',
        fixtures: [{ id: 'P14-NF-50', stage: 'build', artifact: { path: fixturePath, hash: hash(fixtureBytes) } }],
        probes: [{ id: 'sentinel-holders.package-loop-policy.probe', cadence: 60_000, execution: 'ci',
          artifact: { path: probePath, hash: hash(probeBytes) } }], decoders: [], documents: [] };
      const enrollment = { part: 14, owner: 'part-fourteen', manifest: { path: manifestPath, hash: hash(manifest) } };
      for (const path of ['docs', 'register-source/owner-references', 'tests/e2e', 'tests/sentinel-holders'])
        mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, 'docs/01-the-rules.md'), '| 1 | rule | statement | check |\n');
      writeFileSync(join(root, 'docs/02-the-register.md'), '# register\n');
      writeFileSync(join(root, 'docs/03-the-glossary.md'), '# glossary\n');
      writeFileSync(join(root, 'register-source/bootstrap-shape.json'), '{}\n');
      writeFileSync(join(root, fixturePath), fixtureBytes); writeFileSync(join(root, probePath), probeBytes);
      writeFileSync(join(root, manifestPath), JSON.stringify(manifest));
      writeFileSync(join(root, 'register-source/owner-enrollments.json'), JSON.stringify({ schemaVersion: 1, enrollments: [enrollment] }));
      git('init'); git('add', '.'); git('commit', '-qm', 'enrolled manifest present');
      const present = inputAt(git('rev-parse', 'HEAD'));
      expect(loadOwnerReferences(root, present, [enrollment]).catalog.fixtures).toHaveLength(1);
      git('rm', manifestPath); git('commit', '-qm', 'enrolled manifest missing');
      const missing = inputAt(git('rev-parse', 'HEAD'));
      expect(() => loadOwnerReferences(root, missing, [enrollment])).toThrow(`missing governed owner enrollment manifest ${manifestPath}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
