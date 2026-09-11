// Part Sixteen's approved foundation is intentionally narrower than the full
// measurement-ledger design. Every design row is either executable in all three
// test tiers or names the exact unlanded grant artifact that keeps it out.
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const executable = new Set([1, 2, 5, 12, 13, 22, 23, 25, 26, 27, 28, 29, 30, 33, 34, 39, 40, 41, 46, 47, 48, 52]);
const dependencies = {
  3: ['seam-response-intake-followup.md', 'seam-response-assembly-followup.md', 'seam-response-judgment.md', 'SEAM-LEDGER.md row 64'],
  4: ['seam-response-intake-followup.md', 'seam-response-assembly-followup.md', 'seam-response-judgment.md'],
  6: ['seam-response-intake-followup.md'],
  7: ['seam-response-judgment.md', 'seam-response-assembly-followup.md', 'named five/six/eight/nine production wiring'],
  8: ['seam-response-intake-followup.md'],
  9: ['seam-response-assembly-followup.md'],
  10: ['seam-response-assembly-followup.md'],
  11: ['seam-response-judgment.md', 'seam-response-loop-followup.md'],
  14: ['seam-response-assembly-followup.md'],
  15: ['seam-response-declarations.md'],
  16: ['seam-response-declarations.md'],
  17: ['seam-response-declarations.md'],
  18: ['seam-response-declarations.md'],
  19: ['seam-response-declarations.md', 'seam-response-loop-followup.md', 'SEAM-LEDGER.md row 34', 'seam-response-rungraph-followup.md', 'seam-response-effects-followup.md'],
  20: ['seam-response-declarations.md'],
  21: ['seam-response-intake-followup.md'],
  24: ['seam-response-intake-followup.md', 'SEAM-LEDGER.md row 40', 'SEAM-LEDGER.md row 63'],
  31: ['seam-response-judgment.md', 'seam-response-assembly-followup.md'],
  32: ['seam-response-judgment.md', 'seam-response-assembly-followup.md', 'SEAM-LEDGER.md row 73'],
  35: ['seam-response-effects-followup.md'],
  36: ['seam-response-declarations.md', 'seam-response-loop-followup.md', 'SEAM-LEDGER.md row 34'],
  37: ['seam-response-loop-followup.md', 'SEAM-LEDGER.md row 34'],
  38: ['seam-response-loop-followup.md'],
  42: ['seam-response-intake-followup.md'],
  43: ['seam-response-loop-followup.md item #25'],
  44: ['seam-response-intake-followup.md'],
  45: ['seam-response-intake-followup.md', 'seam-response-effects-followup.md'],
  49: ['seam-response-intake-followup.md', 'seam-response-assembly-followup.md', 'seam-response-judgment.md',
    'seam-response-loop-followup.md', 'seam-response-rungraph-followup.md', 'seam-response-effects-followup.md',
    'SEAM-LEDGER.md row 40', 'SEAM-LEDGER.md row 63', 'SEAM-LEDGER.md row 64'],
  50: ['seam-response-loop-followup.md'],
  51: ['seam-response-effects-followup.md'],
};

export function p16Dispositions(design = readFileSync('docs/20-measurement-ledgers/13-non-functional-checks-and-activation.md', 'utf8')) {
  const ids = [...design.matchAll(/^\| (P16-NF-(\d+)) \|/gm)].map(match => ({ id: match[1], number: Number(match[2]) }));
  if (ids.length !== 52 || ids.some((row, index) => row.number !== index + 1))
    throw new Error('Part Sixteen design must contain exactly one contiguous P16-NF-01..52 table');
  return ids.map(row => {
    if (executable.has(row.number)) return { ...row, status: 'EXECUTABLE', dependencies: [] };
    const blocked = dependencies[row.number];
    if (!blocked?.length) throw new Error(`${row.id}: non-executable row has no exact grant dependency`);
    return { ...row, status: `NON-EXECUTABLE-UNTIL-${blocked.join(' + ')}`, dependencies: blocked };
  });
}

export function checkP16Architecture() {
  const files = readdirSync('src/measurement').filter(file => file.endsWith('.ts'));
  const source = files.map(file => readFileSync(`src/measurement/${file}`, 'utf8')).join('\n');
  const imports = [...source.matchAll(/from ['"](\.\.\/[^'"]+)['"]/g)].map(match => match[1]);
  const allowed = new Set(['../index.js', '../facts/index.js', '../projections/index.js', '../assembly/index.js']);
  const privateImports = imports.filter(path => !allowed.has(path));
  if (privateImports.length) throw new Error(`P16 private earlier-part imports: ${[...new Set(privateImports)].join(', ')}`);
  if (/\b(?:canRun|place|throttle|allow|retry|unfreeze|invokeEffect)\s*:/.test(readFileSync('src/measurement/service.ts', 'utf8')))
    throw new Error('P16 public holder exports another owner\'s authority operation');
  const declarations = JSON.parse(readFileSync('src/measurement/measurement.declarations.json', 'utf8'));
  if (!Array.isArray(declarations) || !declarations.length || declarations.some(row => row.status !== 'dark' || row.holds?.length))
    throw new Error('P16 foundation declarations must remain dark and hold-free');
  return { sourceFiles: files.length, imports: [...new Set(imports)].sort(), declarations: declarations.length };
}

export function checkP16Coverage(report, dispositions = p16Dispositions()) {
  if (!report.success) throw new Error('P16 mapping requires a successful actual test run');
  const tiers = ['tests/measurement/', 'tests/integration/', 'tests/e2e/'];
  return dispositions.map(row => {
    const tests = report.testResults.flatMap(file => file.assertionResults
      .filter(test => (test.fullName.match(/\bP16-NF-\d+\b/g) ?? []).includes(row.id))
      .map(test => ({ file: relative(process.cwd(), file.name), title: test.title, status: test.status })));
    const passing = tests.filter(test => test.status === 'passed');
    if (row.status === 'EXECUTABLE') {
      for (const tier of tiers) if (!passing.some(test => test.file.startsWith(tier)))
        throw new Error(`${row.id}: executable foundation row lacks a passing ${tier} fixture`);
    } else if (passing.length) throw new Error(`${row.id}: follow-on row was counted as an executable pass`);
    return { ...row, tests, passing: passing.length };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkP16Architecture();
  const rows = checkP16Coverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log('| Check | Status | Passing test files |');
  console.log('|---|---|---|');
  for (const row of rows) console.log(`| ${row.id} | ${row.status} | ${[...new Set(row.tests.map(test => test.file))].join('; ') || '—'} |`);
  console.log(`${rows.length} P16 checks mapped: ${rows.filter(row => row.status === 'EXECUTABLE').length} executable in unit/integration/lifecycle; ${rows.filter(row => row.status !== 'EXECUTABLE').length} excluded until exact named grants.`);
}
