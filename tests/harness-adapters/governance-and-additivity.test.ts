import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('P13-NF-02 the complete Part Thirteen design passes the governed-document checker', () => {
  expect(execFileSync(process.execPath, ['scripts/check-governed-docs.mjs', 'docs/17-harness-adapters.md', 'docs/17-harness-adapters'], {
    encoding: 'utf8',
  })).toContain('governed-document check OK');
});

it('P13-ADDITIVITY keeps all legacy owner fixtures consumed through public ports byte-identical to main', () => {
  const base = execFileSync('git', ['merge-base', 'main', 'HEAD'], { encoding: 'utf8' }).trim();
  const ownerFixtures = [
    'tests/fixtures.ts',
    'tests/decode',
    'tests/transport',
    'tests/effects',
    'tests/assembly',
    'tests/integration/transport.test.ts',
    'tests/integration/effects.test.ts',
    'tests/integration/assembly.test.ts',
    'tests/e2e/transport.test.ts',
    'tests/e2e/effects.test.ts',
    'tests/e2e/assembly.test.ts',
  ];
  expect(execFileSync('git', ['diff', '--name-only', base, '--', ...ownerFixtures], { encoding: 'utf8' })).toBe('');
});
