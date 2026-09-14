import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error the executable repository checker is intentionally plain ESM
import { checkP13A2Architecture, checkP13DependencyCitations, p13A2Dispositions, p13A2PathAllowed } from '../../scripts/check-p13-contract-map.mjs';

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
  const stateHost = readFileSync('scripts/slice-p13-state-storage.mjs', 'utf8');
  expect(stateHost).toContain('createFactStore(');
  expect(stateHost).toContain('createTransportFileStorage(');
  expect(stateHost).not.toMatch(/symlinkSync|readlinkSync|recoverDeadWriter|randomUUID/);
});

it('R2-F08 R2-F10 P13-A2-MAP all 52 rows retain exact real-owner dispositions and held remainders', () => {
  const rows = p13A2Dispositions() as Array<{ id: string; number: number; status: string; heldArms?: string }>;
  expect(rows).toHaveLength(52);
  expect(new Set(rows.map(row => row.id)).size).toBe(52);
  expect(rows.filter(row => row.status === 'EXECUTABLE')).toHaveLength(22);
  expect(rows.filter(row => row.heldArms)).toHaveLength(12);
  expect(rows.find(row => row.number === 3)?.status).toBe('NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md');
  expect(rows.find(row => row.number === 8)?.status).toBe('NON-EXECUTABLE-UNTIL-seam-response-effects-followup.md');
  expect(rows.find(row => row.number === 46)?.heldArms).toContain('dated 07:10Z addenda');
  expect(rows.find(row => row.number === 46)?.heldArms).not.toContain('HELD-REMAINDER');
  expect(rows.find(row => row.number === 51)?.heldArms).toContain('seam-response-effects-followup.md');
  expect(rows.find(row => row.number === 21)?.status).toContain('dated 08:48Z addenda');
  expect(rows.find(row => row.number === 31)?.heldArms)
    .toContain('NON-EXECUTABLE-UNTIL-design-17-harness-adapters-seam-request-part-two-capture-read.md');
  expect(rows.find(row => row.number === 31)?.heldArms)
    .toContain('NON-EXECUTABLE-UNTIL-row-83-run-admission-production');
  expect(rows.find(row => row.number === 31)?.heldArms).toContain('SEAM-LEDGER.md row 38');
  expect(rows.find(row => row.number === 31)?.heldArms).toContain('SEAM-LEDGER.md row 45');
});

it('R2-F11 P13-A2-MAP dependency validation covers A2 held arms and refuses an invented grant', () => {
  const rows = p13A2Dispositions() as Array<{ id: string; number: number; status: string; heldArms?: string }>;
  expect(() => checkP13DependencyCitations(rows.map(row => row.number === 31
    ? { ...row, heldArms: 'NON-EXECUTABLE-UNTIL-seam-response-NO-SUCH-GRANT.md' }
    : row))).toThrow('seam-response-NO-SUCH-GRANT.md');
  for (const heldArms of ['NON-EXECUTABLE-UNTIL-not-a-grant', 'HELD-REMAINDER-unimplemented-check']) {
    expect(() => checkP13DependencyCitations(rows.map(row => row.number === 31 ? { ...row, heldArms } : row)), heldArms)
      .toThrow();
  }
  expect(checkP13DependencyCitations(rows).citations)
    .toContain('design-17-harness-adapters-seam-request-part-two-capture-read.md');
});
