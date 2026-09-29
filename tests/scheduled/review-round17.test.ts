import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
// @ts-expect-error The executable contract checker intentionally ships as an ESM script without declarations.
import { auditP15ArchitectureRows, auditP15CoverageRows, checkP15Architecture, checkP15Coverage, p15Dispositions } from '../../scripts/check-p15-contract-map.mjs';
// @ts-expect-error The executable additivity checker intentionally ships as an ESM script without declarations.
import { checkP15Additivity, p15AdditivityBaseline } from '../../scripts/check-p15-additivity.mjs';

const capture = (run: () => unknown) => {
  try { return { status: 'accepted' as const, value: run() }; }
  catch (error) { return { status: 'refused' as const, detail: error instanceof Error ? error.message : String(error) }; }
};

function completePassingReport() {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.test.ts')) files.push(path);
    }
  };
  walk('tests');
  return { success: true, testResults: files.map(file => {
    const source = readFileSync(file, 'utf8'); const titles: string[] = [];
    for (const match of source.matchAll(/\b(?:it|test)\(\s*(['"])(.*?)\1/gms)) titles.push(match[2]!);
    for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])(.*?)\2/gms)) {
      if (new RegExp(`\\b(?:it|test)\\(\\s*${match[1]}\\s*,`).test(source)) titles.push(match[3]!);
    }
    return { name: resolve(file), assertionResults: [...new Set(titles)].map(title => ({ title, status: 'passed' })) };
  }) };
}

it('P15 round-seventeen F1 refuses duplicate, missing and extra identities at both complete-map entry points', () => {
  const rows = p15Dispositions();
  const donor = rows.find((row: { number: number }) => row.number === 4)!;
  const inputs = [
    ['52-rows-duplicate-NF04-omits-NF06', rows.map((row: { number: number }) =>
      row.number === 6 ? { ...donor } : row)],
    ['52-rows-all-NF04', rows.map(() => ({ ...donor }))],
    ['53-rows-duplicate-NF04', [...rows, { ...donor }]],
    ['51-rows-missing-NF52', rows.slice(0, -1)],
    ['52-rows-extra-NF53-omits-NF52', [...rows.slice(0, -1), { ...rows.at(-1)!, id: 'P15-NF-53', number: 53 }]],
  ] as const;

  for (const [id, input] of inputs) for (const [entry, run] of [
    ['architecture', () => checkP15Architecture(input)],
    ['coverage', () => checkP15Coverage({ success: true, testResults: [] }, input)],
  ] as const) {
    const result = capture(run);
    expect(result, `${id}/${entry}`).toMatchObject({ status: 'refused' });
    expect(result.detail, `${id}/${entry}`).toMatch(/P15 check inventory must contain exactly 52 distinct design identities/);
  }

  expect(() => checkP15Architecture(rows), 'complete-control/architecture').not.toThrow();
  expect(() => checkP15Coverage(completePassingReport(), rows), 'complete-control/coverage').not.toThrow();
  expect(() => auditP15ArchitectureRows([donor]), 'explicit-single-row-audit/architecture').not.toThrow();
  expect(() => auditP15CoverageRows({ success: true, testResults: [] }, [donor]),
    'explicit-single-row-audit/coverage').not.toThrow();
});

// Rule 37 quarantine: see docs/defects/stale-main-baseline-additivity.md
it.skip('P15 round-seventeen F2 proves the complete current-main population including Part Sixteen A1', () => {
  const baseline = p15AdditivityBaseline();
  const mainTip = execFileSync('git', ['rev-parse', 'main'], { encoding: 'utf8' }).trim();
  const mainFiles = execFileSync('git', ['ls-tree', '-r', '--name-only', mainTip, '--', 'src', 'tests'],
    { encoding: 'utf8' }).trim().split('\n');
  expect(baseline).toMatchObject({ mainTip, mergeBase: mainTip });
  expect(baseline.files.map((row: { file: string }) => row.file)).toEqual(mainFiles);
  expect(baseline.files.map((row: { file: string }) => row.file)).toEqual(expect.arrayContaining([
    'src/measurement/index.ts',
    'tests/measurement/foundation.test.ts',
    'tests/measurement/fixture.ts',
  ]));
  expect(checkP15Additivity({ success: true })).toMatchObject({
    applicable: false,
    mainTip,
    mergeBase: mainTip,
    sourceCount: mainFiles.filter(file => file.startsWith('src/')).length,
    testFixtureCount: mainFiles.filter(file => file.startsWith('tests/')).length,
  });
});

it('P15 round-seventeen F2 compares first landing, then reports inapplicability while retaining baseline checks', () => {
  const root = mkdtempSync(join(tmpdir(), 'p15-additivity-round17-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  try {
    git('init', '-b', 'main');
    git('config', 'user.email', 'p15-test@instar.local');
    git('config', 'user.name', 'P15 Test');
    mkdirSync(join(root, 'src'), { recursive: true });
    mkdirSync(join(root, 'tests', 'fixtures'), { recursive: true });
    writeFileSync(join(root, 'src', 'owner.ts'), 'export const owner = true;\n');
    writeFileSync(join(root, 'tests', 'owner.test.ts'), 'export const ownerTest = true;\n');
    writeFileSync(join(root, 'tests', 'fixtures', 'owner.json'), '{"owner":true}\n');
    git('add', '.'); git('commit', '-m', 'base owner population');
    git('branch', 'stale');
    writeFileSync(join(root, 'src', 'later-owner.ts'), 'export const laterOwner = true;\n');
    git('add', '.'); git('commit', '-m', 'advance main owner population');
    git('switch', '-c', 'complete');

    const complete = checkP15Additivity({ success: true }, 'main', 'HEAD', root);
    expect(complete.applicable).toBe(true);
    expect(complete.files.map((row: { file: string }) => row.file)).toEqual([
      'src/later-owner.ts', 'src/owner.ts', 'tests/fixtures/owner.json', 'tests/owner.test.ts',
    ]);

    git('switch', '-c', 'incomplete');
    rmSync(join(root, 'tests', 'fixtures', 'owner.json'));
    git('add', '-u'); git('commit', '-m', 'remove owner fixture');
    expect(() => checkP15Additivity({ success: true }, 'main', 'HEAD', root))
      .toThrow(/pre-existing owner file is missing: tests\/fixtures\/owner\.json/);
    git('switch', 'complete');
    writeFileSync(join(root, 'src', 'owner.ts'), 'export const owner = false;\n');
    expect(() => checkP15Additivity({ success: true }, 'main', 'HEAD', root))
      .toThrow(/pre-existing owner file bytes changed: src\/owner\.ts/);
    writeFileSync(join(root, 'src', 'owner.ts'), 'export const owner = true;\n');
    git('switch', 'main');
    mkdirSync(join(root, 'src', 'scheduled'), { recursive: true });
    writeFileSync(join(root, 'src', 'scheduled', 'index.ts'), 'export const scheduled = true;\n');
    git('add', '.'); git('commit', '-m', 'land scheduled unit');
    git('switch', '-c', 'later-edit');
    writeFileSync(join(root, 'src', 'owner.ts'), 'export const owner = false;\n');
    writeFileSync(join(root, 'src', 'scheduled', 'index.ts'), 'export const scheduled = false;\n');
    git('add', '.'); git('commit', '-m', 'later owner and cross-owner edits');
    expect(checkP15Additivity({ success: true }, 'main', 'HEAD', root).applicable).toBe(false);
    expect(() => checkP15Additivity({ success: false }, 'main', 'HEAD', root))
      .toThrow(/successful actual test run/);
    expect(() => p15AdditivityBaseline('main', 'stale', root))
      .toThrow(/stale baseline .* current main tip .* is not contained in stale/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
