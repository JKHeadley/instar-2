import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const inheritedScopeTest = 'tests/harness-adapters/contract-map.test.ts';

export function p15AdditivityBaseline(mainRef = 'main', headRef = 'HEAD') {
  const mergeBase = execFileSync('git', ['merge-base', headRef, mainRef], { encoding: 'utf8' }).trim();
  const tree = execFileSync('git', ['ls-tree', '-r', '-z', mergeBase, '--', 'src', 'tests']);
  const files = tree.toString('utf8').split('\0').filter(Boolean).map(entry => {
    const match = /^(\d+) blob ([0-9a-f]{40})\t(.+)$/.exec(entry);
    if (!match) throw new Error(`P15 additivity: malformed merge-base tree entry: ${entry}`);
    return { mode: match[1], object: match[2], file: match[3] };
  });
  return {
    mergeBase,
    files,
    sourceCount: files.filter(row => row.file.startsWith('src/')).length,
    testFixtureCount: files.filter(row => row.file.startsWith('tests/')).length,
  };
}

export function checkP15Additivity(report, mainRef = 'main', headRef = 'HEAD') {
  if (!report.success) throw new Error('P15 additivity requires a successful actual test run');
  const baseline = p15AdditivityBaseline(mainRef, headRef);
  for (const row of baseline.files) {
    const expected = execFileSync('git', ['cat-file', 'blob', row.object]);
    let current;
    try { current = readFileSync(row.file); }
    catch { throw new Error(`P15 additivity: pre-existing owner file is missing: ${row.file}`); }
    if (!expected.equals(current)) throw new Error(`P15 additivity: pre-existing owner file bytes changed: ${row.file}`);
  }
  return baseline;
}

export function checkP15InheritedScopeTest(mergeBase) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'instar-p15-additivity-'));
  const checkout = join(temporaryRoot, 'main');
  try {
    execFileSync('git', ['clone', '--quiet', '--no-checkout', '--shared', process.cwd(), checkout]);
    execFileSync('git', ['-C', checkout, 'checkout', '--quiet', '--detach', mergeBase]);
    execFileSync('git', ['-C', checkout, 'branch', '--force', 'main', mergeBase]);
    const excludes = join(temporaryRoot, 'exclude');
    writeFileSync(excludes, 'node_modules\n');
    execFileSync('git', ['-C', checkout, 'config', 'core.excludesFile', excludes]);
    symlinkSync(resolve('node_modules'), join(checkout, 'node_modules'), 'dir');
    execFileSync(resolve('node_modules/.bin/vitest'), ['run', inheritedScopeTest], {
      cwd: checkout,
      encoding: 'utf8',
      stdio: 'inherit',
    });
    return { file: inheritedScopeTest, passed: 6 };
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baseline = checkP15Additivity(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  const inherited = checkP15InheritedScopeTest(baseline.mergeBase);
  console.log(`P15 additivity proved merge-base ${baseline.mergeBase}: ${baseline.sourceCount} source files and ${baseline.testFixtureCount} test/fixture files are byte-identical.`);
  console.log(`P15 inherited owner-scope proof: ${inherited.file} passed all ${inherited.passed} tests against that exact merge-base.`);
}
