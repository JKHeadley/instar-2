import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baseline = checkP15Additivity(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log(`P15 additivity proved merge-base ${baseline.mergeBase}: ${baseline.sourceCount} source files and ${baseline.testFixtureCount} test/fixture files are byte-identical.`);
}
