import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
// @ts-expect-error the executable checker is intentionally plain ESM
import { assemblyDispositions, checkPartTenAdditivity, partTenAdditivityPaths } from '../../scripts/check-assembly-contracts.mjs';

it('R3-F7 P10-NF-02 permanent-additivity-current-main enumerates every pre-existing test and fixture and prints the current baseline', () => {
  const main = execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim();
  const paths = partTenAdditivityPaths(execFileSync('git', ['merge-base', 'HEAD', main], { encoding: 'utf8' }).trim());
  expect(paths).toContain('tests/facts/fixtures.ts');
  expect(paths).toContain('tests/harness-adapters/fixture.ts');
  expect(paths).toEqual(execFileSync('git', ['ls-tree', '-r', '--name-only', main, '--', 'tests'], { encoding: 'utf8' }).trim().split('\n'));
  expect(checkPartTenAdditivity('origin/main')).toMatchObject({ baseline: main, mergeBase: main, checked: paths.length, changed: 0 });
});

it('R3-F8 P10-NF-18 P10-NF-57 every design row names its executable split or exact non-executable grant', () => {
  expect(assemblyDispositions).toHaveLength(57);
  expect(new Set(assemblyDispositions.map((row: { id: string }) => row.id)).size).toBe(57);
  for (const row of assemblyDispositions as { id: string; status: string; reason: string }[]) {
    expect(row.status === 'EXECUTABLE' || row.status.startsWith('NON-EXECUTABLE-UNTIL-'), row.id).toBe(true);
    expect(row.reason, row.id).toContain('design case:');
  }
  expect(assemblyDispositions[17]).toMatchObject({
    id: 'P10-NF-18', status: 'NON-EXECUTABLE-UNTIL-design-sentinel-holders-seam-request-assembly.md',
  });
  expect(assemblyDispositions[17]!.reason).toContain('Filesystem/IPC/debug/descriptor/child escape');
  expect(assemblyDispositions[56]).toMatchObject({
    id: 'P10-NF-57', status: 'NON-EXECUTABLE-UNTIL-design-conversation-adapters-seam-request-model-provider-effect.md',
  });
  expect(assemblyDispositions[56]!.reason).toContain('SDK retries known rejection or uncertain timeout');
  for (const number of [8, 30, 41, 43, 44])
    expect(assemblyDispositions[number - 1]).toMatchObject({ status: 'EXECUTABLE', heldArms: expect.stringMatching(/^NON-EXECUTABLE-UNTIL-/) });
});
