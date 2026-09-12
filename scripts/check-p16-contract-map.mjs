// Slice A1 maps only owned record/registration and resource/process/census
// validation. Every A2 semantic row is named exactly as structurally deferred.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const executable = new Set([1, 2, 5, 22, 23, 25, 26, 27, 28, 29, 30, 52]);
const mixed = new Set([3, 24]);
const sliceA2 = new Set([4, 12, 13, 14, 16, 33, 34, 36, 37, 38, 39, 40, 41, 47, 48, 50]);
const behaviors = new Map(Object.entries({
  1: ['contract-inventory', 'p16Dispositions'],
  2: ['architecture-boundary', 'checkP16Architecture'],
  3: ['registration-current-content', 'decodeMeasurementProducerContract'],
  5: ['measured-claim', 'renderMeasurementClaim'],
  22: ['quota-coalescing', 'coalesceUnknownQuotaEpisodes'],
  23: ['observational-port', 'createMeasurementLedger'],
  24: ['rate-event-populations', 'summarizeRateLimitEvents'],
  25: ['cpu-and-byte', 'cpuUtilization'],
  26: ['process-incarnation', 'reconcileProcessIncarnation'],
  27: ['limit-plus-one-census', 'planProcessCensus'],
  28: ['classified-and-unclassified', 'classifyProcesses'],
  29: ['resource-trend', 'resourceTrend'],
  30: ['fired-and-no-op', 'classifyFeatureOutcome'],
  52: ['non-executable-exclusion', 'p16Dispositions'],
  53: ['legacy-additivity', 'check-p16-additivity'],
}).map(([number, value]) => [Number(number), value]));
const dependencies = {
  3: ['seam-response-intake-followup.md', 'seam-response-assembly-followup.md',
    'seam-response-judgment.md', 'SEAM-LEDGER.md row 64'],
  6: ['seam-response-intake-followup.md'],
  7: ['seam-response-judgment.md', 'seam-response-assembly-followup.md',
    'named five/six/eight/nine production wiring'],
  8: ['seam-response-intake-followup.md'],
  9: ['seam-response-assembly-followup.md'],
  10: ['seam-response-assembly-followup.md'],
  11: ['seam-response-judgment.md', 'seam-response-loop-followup.md'],
  15: ['seam-response-declarations.md'],
  17: ['seam-response-declarations.md'],
  18: ['seam-response-declarations.md'],
  19: ['seam-response-declarations.md', 'seam-response-loop-followup.md', 'SEAM-LEDGER.md row 34',
    'seam-response-rungraph-followup.md', 'seam-response-effects-followup.md'],
  20: ['seam-response-declarations.md'],
  21: ['seam-response-intake-followup.md'],
  24: ['seam-response-intake-followup.md #12 observation admission',
    'seam-response-assembly-followup.md P16-P10-process-resource-observation-v1',
    'SEAM-LEDGER.md row 40', 'SEAM-LEDGER.md row 63'],
  31: ['seam-response-judgment.md', 'seam-response-assembly-followup.md'],
  32: ['seam-response-judgment.md', 'seam-response-assembly-followup.md', 'SEAM-LEDGER.md row 73'],
  35: ['seam-response-effects-followup.md'],
  42: ['seam-response-intake-followup.md'],
  43: ['seam-response-loop-followup.md item #25'],
  44: ['seam-response-intake-followup.md'],
  45: ['seam-response-intake-followup.md', 'seam-response-effects-followup.md'],
  46: ['seam-response-assembly-followup.md P16-P10-process-resource-observation-v1',
    'seam-response-intake-followup.md #12 observation admission', 'seam-response-loop-followup.md item #25'],
  49: ['seam-response-declarations.md #11 price/exchange declarations',
    'seam-response-intake-followup.md', 'seam-response-assembly-followup.md', 'seam-response-judgment.md',
    'seam-response-loop-followup.md', 'seam-response-rungraph-followup.md', 'seam-response-effects-followup.md',
    'SEAM-LEDGER.md row 40', 'SEAM-LEDGER.md row 63', 'SEAM-LEDGER.md row 64'],
  51: ['seam-response-effects-followup.md'],
};

export function p16Dispositions(design = readFileSync(
  'docs/20-measurement-ledgers/13-non-functional-checks-and-activation.md', 'utf8')) {
  const ids = [...design.matchAll(/^\| (P16-NF-(\d+)) \|/gm)]
    .map(match => ({ id: match[1], number: Number(match[2]) }));
  if (ids.length !== 52 || ids.some((row, index) => row.number !== index + 1))
    throw new Error('Part Sixteen design must contain exactly one contiguous P16-NF-01..52 table');
  const rows = [...ids, { id: 'P16-NF-53', number: 53, supplemental: true }];
  return rows.map(row => {
    if (row.number === 53)
      return { ...row, status: 'SUPPLEMENTAL-EXECUTABLE-NON-GOVERNING', dependencies: [] };
    if (sliceA2.has(row.number))
      return { ...row, status: 'NON-EXECUTABLE-UNTIL-slice-A2', dependencies: ['slice-A2'] };
    if (executable.has(row.number)) return { ...row, status: 'EXECUTABLE', dependencies: [] };
    const blocked = dependencies[row.number];
    if (!blocked?.length) throw new Error(`${row.id}: non-executable row has no exact dependency`);
    if (mixed.has(row.number))
      return { ...row, status: `MIXED-EXECUTABLE-A1-PLUS-${blocked.join(' + ')}`, dependencies: blocked };
    return { ...row, status: `NON-EXECUTABLE-UNTIL-${blocked.join(' + ')}`, dependencies: blocked };
  });
}

const forbiddenPermissionExports = new Set(['allow', 'canRun', 'place', 'throttle']);

function collectBindingNames(name, found) {
  if (ts.isIdentifier(name)) {
    if (forbiddenPermissionExports.has(name.text)) found.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    collectBindingNames(element.name, found);
  }
}

export function findForbiddenMeasurementPermissionExports(sources) {
  const found = new Set();
  for (const [file, source] of Object.entries(sources)) {
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const statement of parsed.statements) {
      if (ts.isExportDeclaration(statement) && statement.exportClause) {
        if (ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements)
            if (forbiddenPermissionExports.has(element.name.text)) found.add(element.name.text);
        } else if (ts.isNamespaceExport(statement.exportClause)
          && forbiddenPermissionExports.has(statement.exportClause.name.text)) {
          found.add(statement.exportClause.name.text);
        }
      }
      const exported = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;
      if ('name' in statement && statement.name && ts.isIdentifier(statement.name)
        && forbiddenPermissionExports.has(statement.name.text)) found.add(statement.name.text);
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations)
        collectBindingNames(declaration.name, found);
    }
  }
  return [...found].sort();
}

export function checkP16Architecture() {
  const changed = execFileSync('git', ['diff', '--name-only', 'main'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const allowedGenerated = new Set(['generated/capabilities.md', 'generated/coverage.md', 'generated/glossary.md',
    'generated/register.json', 'generated/rules.md', 'generated/source.json']);
  const allowedExact = new Set(['scripts/check-p16-additivity.mjs', 'scripts/check-p16-contract-map.mjs',
    'tests/integration/measurement.test.ts', 'tests/e2e/measurement.test.ts']);
  const outsideScope = [...new Set([...changed, ...untracked])].filter(file => !file.startsWith('src/measurement/')
    && !file.startsWith('tests/measurement/') && !allowedGenerated.has(file) && !allowedExact.has(file));
  if (outsideScope.length) throw new Error(`P16 changed-file scope exceeded: ${outsideScope.join(', ')}`);
  const files = readdirSync('src/measurement').filter(file => file.endsWith('.ts'));
  const sources = Object.fromEntries(files.map(file => [
    `src/measurement/${file}`, readFileSync(`src/measurement/${file}`, 'utf8'),
  ]));
  const source = Object.values(sources).join('\n');
  const forbiddenExports = findForbiddenMeasurementPermissionExports(sources);
  if (forbiddenExports.length)
    throw new Error(`P16 forbidden measurement permission exports: ${forbiddenExports.join(', ')}`);
  const imports = [...source.matchAll(/from ['"](\.\.\/[^'"]+)['"]/g)].map(match => match[1]);
  const allowed = new Set(['../index.js', '../facts/index.js', '../projections/index.js', '../assembly/index.js']);
  const privateImports = imports.filter(path => !allowed.has(path));
  if (privateImports.length)
    throw new Error(`P16 private earlier-part imports: ${[...new Set(privateImports)].join(', ')}`);
  const index = readFileSync('src/measurement/index.ts', 'utf8');
  const operations = readFileSync('src/measurement/operations.ts', 'utf8');
  const removed = ['createQuantityWitness', 'resolveQuantity', 'aggregateMeasurements', 'resolveAttribution',
    'mergePeerMeasurements', 'createBurnWindow', 'evaluateBurn', 'renderBoundedRead',
    'bindMeasurementReadSource', 'renderCurrentMeasurementRead', 'measurementProjectionDefinition',
    'growthInvestigationLink', 'createBoundedReadCache'];
  for (const name of removed) {
    if (index.includes(name) || operations.includes(`function ${name}`))
      throw new Error(`slice A2 operation remains executable: ${name}`);
  }
  for (const name of ['admitMeasurementAmount', 'reconcileProcessIncarnation',
    'coalesceUnknownQuotaEpisodes', 'resourceTrend']) {
    if (!index.includes(name) || !operations.includes(`function ${name}`))
      throw new Error(`slice A1 operation is not publicly implemented: ${name}`);
  }
  const declarations = JSON.parse(readFileSync('src/measurement/measurement.declarations.json', 'utf8'));
  if (!Array.isArray(declarations) || !declarations.length
    || declarations.some(row => row.status !== 'dark' || row.holds?.length))
    throw new Error('P16 A1 declarations must remain dark and hold-free');
  const proofFiles = [
    ...readdirSync('tests/measurement').filter(file => file.endsWith('.test.ts')).map(file => `tests/measurement/${file}`),
    'tests/integration/measurement.test.ts', 'tests/e2e/measurement.test.ts',
  ];
  const proofIds = [...executable, ...mixed, 53].map(number => `P16-NF-${String(number).padStart(2, '0')}`);
  const tierFiles = [proofFiles.filter(file => file.startsWith('tests/measurement/')),
    proofFiles.filter(file => file.startsWith('tests/integration/')),
    proofFiles.filter(file => file.startsWith('tests/e2e/'))];
  for (const filesForTier of tierFiles) {
    const proof = filesForTier.map(file => readFileSync(file, 'utf8')).join('\n');
    for (const id of proofIds) {
      const number = Number(id.slice(-2)); const [marker, operation] = behaviors.get(number) ?? [];
      if (!marker || !operation || !proof.includes(id) || !proof.includes(`[behavior:${marker}]`)
        || !proof.includes(operation))
        throw new Error(`${filesForTier[0]}: ${id} lacks its executed behavior binding`);
    }
  }
  return { sourceFiles: files.length, imports: [...new Set(imports)].sort(), declarations: declarations.length,
    proofFiles: proofFiles.length, executable: executable.size, mixed: mixed.size, sliceA2: sliceA2.size };
}

export function checkP16Coverage(report, dispositions = p16Dispositions()) {
  if (!report.success) throw new Error('P16 mapping requires a successful actual test run');
  const tiers = ['tests/measurement/', 'tests/integration/', 'tests/e2e/'];
  return dispositions.map(row => {
    const tests = report.testResults.flatMap(file => file.assertionResults
      .filter(test => (test.fullName.match(/\bP16-NF-\d+\b/g) ?? []).includes(row.id))
      .map(test => ({ file: relative(process.cwd(), file.name), title: test.title, status: test.status })));
    const behavior = behaviors.get(row.number);
    const passed = tests.filter(test => test.status === 'passed');
    const passing = tests.filter(test => test.status === 'passed'
      && behavior !== undefined && test.title.includes(`[behavior:${behavior[0]}]`));
    if (row.status === 'EXECUTABLE' || row.status.startsWith('MIXED-EXECUTABLE-')
      || row.status.startsWith('SUPPLEMENTAL-EXECUTABLE-')) {
      for (const tier of tiers) if (!passing.some(test => test.file.startsWith(tier)))
        throw new Error(`${row.id}: A1 row lacks a passing ${tier} fixture`);
    } else if (passed.length) throw new Error(`${row.id}: non-executable row was counted as a pass`);
    return { ...row, tests, passing: passing.length };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkP16Architecture();
  const rows = checkP16Coverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log('| Check | Status | Passing test files |');
  console.log('|---|---|---|');
  for (const row of rows)
    console.log(`| ${row.id} | ${row.status} | ${[...new Set(row.tests.map(test => test.file))].join('; ') || '—'} |`);
  console.log(`${rows.length} labels mapped: ${rows.filter(row => row.status === 'EXECUTABLE').length} executable; ${rows.filter(row => row.status.startsWith('MIXED-EXECUTABLE-')).length} mixed; ${rows.filter(row => row.status === 'NON-EXECUTABLE-UNTIL-slice-A2').length} slice-A2; ${rows.filter(row => row.status.startsWith('NON-EXECUTABLE-') && row.status !== 'NON-EXECUTABLE-UNTIL-slice-A2').length} other blocked; 1 supplemental.`);
}
