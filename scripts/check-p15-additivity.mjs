import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const inheritedScopeTest = 'tests/harness-adapters/contract-map.test.ts';

export function p15AdditivityBaseline(mainRef = 'main', headRef = 'HEAD', root = process.cwd()) {
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const mainTip = git(['rev-parse', mainRef]);
  const mergeBase = git(['merge-base', headRef, mainRef]);
  if (mergeBase !== mainTip)
    throw new Error(`P15 additivity: stale baseline ${mergeBase}; current ${mainRef} tip is ${mainTip} and is not contained in ${headRef}`);
  const tree = execFileSync('git', ['-C', root, 'ls-tree', '-r', '-z', mergeBase, '--', 'src', 'tests']);
  const files = tree.toString('utf8').split('\0').filter(Boolean).map(entry => {
    const match = /^(\d+) blob ([0-9a-f]{40})\t(.+)$/.exec(entry);
    if (!match) throw new Error(`P15 additivity: malformed merge-base tree entry: ${entry}`);
    return { mode: match[1], object: match[2], file: match[3] };
  });
  return {
    mainRef,
    mainTip,
    mergeBase,
    files,
    sourceCount: files.filter(row => row.file.startsWith('src/')).length,
    testFixtureCount: files.filter(row => row.file.startsWith('tests/')).length,
  };
}

export function p15AdditivityApplies(baseline) {
  return !baseline.files.some(row => row.file === 'src/scheduled/index.ts');
}

export function checkP15Additivity(report, mainRef = 'main', headRef = 'HEAD', root = process.cwd()) {
  if (!report.success) throw new Error('P15 additivity requires a successful actual test run');
  const baseline = p15AdditivityBaseline(mainRef, headRef, root);
  const applicable = p15AdditivityApplies(baseline);
  if (!applicable) return { ...baseline, applicable };
  for (const row of baseline.files) {
    const expected = execFileSync('git', ['-C', root, 'cat-file', 'blob', row.object]);
    let current;
    try { current = readFileSync(resolve(root, row.file)); }
    catch { throw new Error(`P15 additivity: pre-existing owner file is missing: ${row.file}`); }
    if (!expected.equals(current)) throw new Error(`P15 additivity: pre-existing owner file bytes changed: ${row.file}`);
  }
  return { ...baseline, applicable };
}

export function checkP15InheritedScopeTest(report, headRef = 'HEAD') {
  if (!report.success) throw new Error('P15 inherited scope requires a successful actual HEAD test run');
  const suite = report.testResults.find(result => resolve(result.name) === resolve(inheritedScopeTest));
  if (!suite) throw new Error(`P15 inherited scope: actual HEAD report omits ${inheritedScopeTest}`);
  if (suite.assertionResults.length !== 6 || suite.assertionResults.some(test => test.status !== 'passed'))
    throw new Error(`P15 inherited scope: ${inheritedScopeTest} did not pass all 6 assertions on ${headRef}`);
  const head = execFileSync('git', ['rev-parse', headRef], { encoding: 'utf8' }).trim();
  return { file: inheritedScopeTest, passed: 6, head };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = JSON.parse(readFileSync('.test-results.json', 'utf8'));
  const baseline = checkP15Additivity(report);
  const inherited = checkP15InheritedScopeTest(report);
  console.log(baseline.applicable
    ? `P15 additivity proved current-main base ${baseline.mergeBase}: ${baseline.sourceCount} source files and ${baseline.testFixtureCount} test/fixture files are byte-identical.`
    : `P15 additivity: scheduled unit already present on current-main baseline ${baseline.mergeBase}; first-landing byte comparison is not applicable.`);
  console.log(`P15 inherited owner-scope proof: ${inherited.file} passed all ${inherited.passed} tests on HEAD ${inherited.head}.`);
}
