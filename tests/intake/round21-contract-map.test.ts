import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function report(includeAdditive: boolean) {
  const design = readFileSync('docs/08-the-intake.md', 'utf8');
  const ids = [...design.matchAll(/^\| (P4-NF-\d+) \|/gm)].map(match => match[1]!);
  ids.push(...Array.from({ length: 9 }, (_, index) => `P4-VA-${String(index + 1).padStart(2, '0')}`));
  if (includeAdditive) ids.push('P4-VA-10');
  return { success: true, testResults: [{ name: resolve('tests/intake/round21-contract-map.test.ts'),
    assertionResults: ids.map(id => ({ fullName: `${id} executed owner fixture`, title: `${id} executed owner fixture`, status: 'passed' })) }] };
}

function run(includeAdditive: boolean) {
  const directory = mkdtempSync(join(tmpdir(), 'p11-r21-p4-map-'));
  directories.push(directory);
  symlinkSync(resolve('docs'), join(directory, 'docs'), 'dir');
  writeFileSync(join(directory, '.test-results.json'), JSON.stringify(report(includeAdditive)));
  return spawnSync(process.execPath, [resolve('scripts/check-p4-contract-map.mjs')], { cwd: directory, encoding: 'utf8' });
}

it('V86 P4-VA-10 the complete successful Part Four report including the additive exact-target check maps', () => {
  const result = run(true);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('| P4-VA-10 |');
});

it('V87 the clean legacy Part Four identifier neighbour remains accepted', () => {
  const result = run(false);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain('| P4-VA-09 |');
});
