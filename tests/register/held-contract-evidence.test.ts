import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

test('a held assertion must pass in its owner-catalog artifact', () => {
  const root = mkdtempSync(join(tmpdir(), 'instar-held-evidence-'));
  const save = (path: string, value: unknown) => {
    const full = join(root, path);
    mkdirSync(resolve(full, '..'), { recursive: true });
    writeFileSync(full, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const catalogPath = 'tests/rungraph/governance.test.ts';
  const scopePath = 'tests/rungraph/scope.test.ts';
  const assertion = (path: string, status: string) => ({ name: join(root, path), assertionResults: [
    { fullName: 'P5-NF-54-PARTIAL blocking gate', title: 'P5-NF-54-PARTIAL blocking gate', status },
  ] });
  try {
    save('docs/07-the-declarations.md', '');
    save(catalogPath, ''); save(scopePath, '');
    save('generated/register.json', { entries: [{ declaration: { holds: [{ class: 'partial',
      evidence: { kind: 'fixture', id: 'P5-NF-54-PARTIAL' } }] } }] });
    for (const owner of ['part-four', 'part-seven', 'part-nine', 'part-ten'])
      save(`register-source/owner-references/${owner}.json`, { fixtures: [], probes: [] });
    save('register-source/owner-references.json', { fixtures: [{ id: 'P5-NF-54-PARTIAL',
      artifact: { path: catalogPath } }], probes: [] });
    const check = (results: ReturnType<typeof assertion>[]) => {
      save('.test-results.json', { success: true, testResults: results });
      return spawnSync(process.execPath, [resolve('scripts/check-register-contract-map.mjs')],
        { cwd: root, encoding: 'utf8' });
    };
    const passed = check([assertion(catalogPath, 'passed')]);
    expect(passed.status, passed.stderr).toBe(0);
    expect(check([assertion(scopePath, 'passed')]).status).not.toBe(0);
    expect(check([assertion(catalogPath, 'skipped')]).status).not.toBe(0);
    expect(check([assertion(catalogPath, 'passed'), assertion(catalogPath, 'skipped')]).status).not.toBe(0);
    save('register-source/owner-references.json', { fixtures: [], probes: [] });
    expect(check([assertion(catalogPath, 'passed')]).status).not.toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
