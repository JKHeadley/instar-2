import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error The executable contract checker intentionally ships as an ESM script without declarations.
import { checkP15Architecture, checkP15RequestedDependencies, p15Dispositions } from '../../scripts/check-p15-contract-map.mjs';
// @ts-expect-error The executable additivity checker intentionally ships as an ESM script without declarations.
import { checkP15Additivity, p15AdditivityBaseline } from '../../scripts/check-p15-additivity.mjs';

it('P15 round-fourteen map-strict reviewer cases refuse REQUESTED records as grant evidence', () => {
  const rows = p15Dispositions();
  for (const number of [6, 13, 22]) {
    const row = rows.find((candidate: { number: number }) => candidate.number === number)!;
    expect(row.held).toMatch(/^NON-EXECUTABLE-UNTIL-UNGRANTED-REQUEST-/);
    expect(() => checkP15Architecture([row])).toThrow(/REQUESTED dependency is not granted check-map evidence/);
    expect(() => checkP15RequestedDependencies([row])).not.toThrow();
  }
  expect(() => checkP15Architecture([rows.find((row: { number: number }) => row.number === 4)!])).not.toThrow();
});

it('P15 round-fourteen inventory contains exactly the 52 governed checks and no invented NF-53', () => {
  const design = readFileSync('docs/19-scheduled-work/09-negative-contract-fixtures.md', 'utf8');
  const rows = p15Dispositions(design);
  expect(rows).toHaveLength(52);
  expect(rows.map((row: { id: string }) => row.id)).toEqual(
    Array.from({ length: 52 }, (_, index) => `P15-NF-${String(index + 1).padStart(2, '0')}`));
  expect(design).not.toContain('P15-NF-53');
  expect(readFileSync('scripts/check-p15-contract-map.mjs', 'utf8')).not.toContain('P15-NF-53');
});

it('P15 round-fourteen additivity enumerates and compares every advanced-main source and test/fixture file', () => {
  const baseline = p15AdditivityBaseline();
  const independentlyListed = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline.mergeBase, '--', 'src', 'tests'],
    { encoding: 'utf8' }).trim().split('\n');
  expect(baseline.files.map((row: { file: string }) => row.file)).toEqual(independentlyListed);
  expect(baseline.files.map((row: { file: string }) => row.file)).toEqual(expect.arrayContaining([
    'src/harness-adapters/index.ts',
    'tests/harness-adapters/fixture.ts',
    'tests/assembly/fixture.ts',
  ]));
  expect(baseline.sourceCount).toBe(140);
  expect(baseline.testFixtureCount).toBe(196);
  expect(checkP15Additivity({ success: true })).toMatchObject({
    mergeBase: baseline.mergeBase,
    sourceCount: baseline.sourceCount,
    testFixtureCount: baseline.testFixtureCount,
  });
});
