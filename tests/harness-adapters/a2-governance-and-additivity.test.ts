import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { checkP13A2Architecture, p13A2Dispositions, p13A2PathAllowed } from '../../scripts/check-p13-contract-map.mjs';

it('P13-A2-ADDITIVITY permanent main-vs-HEAD comparison keeps every touched owner legacy fixture byte-identical', () => {
  const prefixes = ['tests/rungraph/', 'tests/transport/', 'tests/effects/', 'tests/verification/', 'tests/assembly/'];
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', 'main'], { encoding: 'utf8' })
    .trim().split('\n').filter(path => prefixes.some(prefix => path.startsWith(prefix)));
  expect(paths.length).toBeGreaterThan(50);
  for (const path of paths) {
    const main = execFileSync('git', ['show', `main:${path}`]);
    expect(readFileSync(path), path).toEqual(main);
  }
  expect(p13A2PathAllowed('src/rungraph/a2-stand-in.ts')).toBe(false);
  expect(p13A2PathAllowed('tests/verification/rewrite.test.ts')).toBe(false);
  expect(checkP13A2Architecture().sourceFiles).toEqual(expect.arrayContaining([
    'adapter.ts', 'holder.ts', 'regression-boundaries.ts',
  ]));
});

it('P13-A2-MAP all 52 rows retain an exact executable or non-executable owner disposition', () => {
  const rows = p13A2Dispositions() as Array<{ id: string; number: number; status: string; heldArms?: string }>;
  expect(rows).toHaveLength(52);
  expect(new Set(rows.map(row => row.id)).size).toBe(52);
  expect(rows.filter(row => row.status === 'EXECUTABLE')).toHaveLength(21);
  expect(rows.filter(row => row.heldArms)).toHaveLength(8);
  expect(rows.find(row => row.number === 21)?.status).toContain('dated 08:48Z addenda');
  expect(rows.find(row => row.number === 31)?.heldArms)
    .toBe('NON-EXECUTABLE-UNTIL-design-17-harness-adapters-seam-request-part-two-capture-read.md');
});
