import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('P13-NF-02 the complete Part Thirteen design passes the governed-document checker', () => {
  expect(execFileSync(process.execPath, ['scripts/check-governed-docs.mjs', 'docs/17-harness-adapters.md', 'docs/17-harness-adapters'], {
    encoding: 'utf8',
  })).toContain('governed-document check OK');
});

it('P13-ADDITIVITY keeps every pre-existing test/fixture byte-identical and confines source to the Part Thirteen package', () => {
  const base = execFileSync('git', ['merge-base', 'main', 'HEAD'], { encoding: 'utf8' }).trim();
  const legacyTests = execFileSync('git', ['ls-tree', '-r', '--name-only', base, '--', 'tests'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  expect(execFileSync('git', ['diff', '--name-only', base, '--', ...legacyTests], { encoding: 'utf8' })).toBe('');

  const changedSource = execFileSync('git', ['diff', '--name-only', base, '--', 'src'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  expect(changedSource.every(path => path.startsWith('src/harness-adapters/'))).toBe(true);
  expect(existsSync('src/intake/pending-custody.ts')).toBe(false);
});
