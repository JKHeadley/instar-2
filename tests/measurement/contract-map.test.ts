import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error Repository contract checker is intentionally JavaScript.
import * as contractMap from '../../scripts/check-p16-contract-map.mjs';

it('P16 first-landing fixture permits additions, rejects inherited edits, then keeps structural mapping active', () => {
  const root = mkdtempSync(join(tmpdir(), 'p16-first-landing-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const check = () => execFileSync(process.execPath, [join(process.cwd(), 'scripts/check-p16-additivity.mjs')],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git('init', '-b', 'main');
    git('config', 'user.email', 'p16-fixture@instar.local');
    git('config', 'user.name', 'P16 Fixture');
    mkdirSync(join(root, 'src'), { recursive: true });
    mkdirSync(join(root, 'tests'), { recursive: true });
    writeFileSync(join(root, 'tests', 'owner.test.ts'), 'inherited fixture\n');
    git('add', '.'); git('commit', '-m', 'inherited tests');
    git('switch', '-c', 'unlanded');
    mkdirSync(join(root, 'src', 'measurement'), { recursive: true });
    writeFileSync(join(root, 'src', 'measurement', 'index.ts'), 'new measurement unit\n');
    writeFileSync(join(root, 'tests', 'new.test.ts'), 'permitted addition\n');
    expect(check()).toContain('pre-existing test files are byte-identical');
    writeFileSync(join(root, 'tests', 'owner.test.ts'), 'violating mutation\n');
    expect(check).toThrow(/changed pre-existing test files/);
    writeFileSync(join(root, 'tests', 'owner.test.ts'), 'inherited fixture\n');
    rmSync(join(root, 'src', 'measurement'), { recursive: true, force: true });
    rmSync(join(root, 'tests', 'new.test.ts'));
    git('switch', 'main');
    mkdirSync(join(root, 'src', 'measurement'), { recursive: true });
    writeFileSync(join(root, 'src', 'measurement', 'index.ts'), 'landed measurement unit\n');
    git('add', '.'); git('commit', '-m', 'land measurement');
    git('switch', '-c', 'later');
    writeFileSync(join(root, 'tests', 'owner.test.ts'), 'later cross-owner edit\n');
    writeFileSync(join(root, 'src', 'measurement', 'index.ts'), 'later owner edit\n');
    expect(check()).toContain('first-landing additivity inapplicable');
    const held = contractMap.p16Dispositions().find((row: { id: string }) => row.id === 'P16-NF-04')!;
    expect(() => contractMap.checkP16Coverage({ success: true, testResults: [{
      name: `${process.cwd()}/tests/measurement/contract-map.test.ts`,
      assertionResults: [{ fullName: 'P16-NF-04 invented pass', title: 'invented pass', status: 'passed' }],
    }] }, [held])).toThrow(/non-executable row was counted as a pass/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('P16-NF-01 [behavior:contract-inventory] P16-NF-52 [behavior:non-executable-exclusion] P16-NF-53 [behavior:legacy-additivity] contract inventory retains all labels and structural exclusions', () => {
  const rows = contractMap.p16Dispositions() as { id: string; status: string; dependencies: string[] }[];
  expect(rows).toHaveLength(53);
  expect(rows.filter(row => row.status === 'NON-EXECUTABLE-UNTIL-slice-A2').map(row => row.id)).toEqual([
    'P16-NF-04', 'P16-NF-12', 'P16-NF-13', 'P16-NF-14', 'P16-NF-16', 'P16-NF-33', 'P16-NF-34',
    'P16-NF-36', 'P16-NF-37', 'P16-NF-38', 'P16-NF-39', 'P16-NF-40', 'P16-NF-41',
    'P16-NF-47', 'P16-NF-48', 'P16-NF-50',
  ]);
  expect(rows.find(row => row.id === 'P16-NF-53')?.status).toBe('SUPPLEMENTAL-EXECUTABLE-NON-GOVERNING');
  expect(execFileSync(process.execPath, ['scripts/check-p16-additivity.mjs'], { encoding: 'utf8' }))
    .toContain('first-landing additivity inapplicable');
});

it('structural re-slice defers both architecture obligations to slice-A1-arch', () => {
  const rows = contractMap.p16Dispositions() as Array<{ id: string; status: string; dependencies: string[];
    arms?: Array<{ name: string; status: string; dependencies: string[] }> }>;
  expect(rows.find(row => row.id === 'P16-NF-02')).toMatchObject({
    status: 'NON-EXECUTABLE-UNTIL-slice-A1-arch', dependencies: ['slice-A1-arch'],
  });
  expect(rows.find(row => row.id === 'P16-NF-23')).toMatchObject({
    status: 'MIXED-EXECUTABLE-A1-OBSERVATIONAL-READ-PLUS-NON-EXECUTABLE-UNTIL-slice-A1-arch',
    dependencies: ['slice-A1-arch'],
    arms: [
      { name: 'observational-read', status: 'EXECUTABLE', dependencies: [] },
      { name: 'architecture', status: 'NON-EXECUTABLE-UNTIL-slice-A1-arch', dependencies: ['slice-A1-arch'] },
    ],
  });
  expect(Object.keys(contractMap)).not.toContain('checkP16Architecture');
  expect(readFileSync('scripts/check-p16-contract-map.mjs', 'utf8')).not.toContain('checkP16Architecture');
});
