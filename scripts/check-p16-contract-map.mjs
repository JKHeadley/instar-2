// Part Sixteen's approved foundation is intentionally narrower than the full
// measurement-ledger design. Every design row is either executable in all three
// test tiers or names the exact unlanded grant artifact that keeps it out.
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const executable = new Set([1, 2, 5, 12, 13, 22, 23, 25, 26, 27, 28, 29, 30, 34, 39, 40, 41, 52]);
const mixed = new Set([16, 24, 33, 36, 37, 38, 46, 47, 48, 50]);
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
  16: ['seam-response-declarations.md #11 price/exchange declarations'],
  17: ['seam-response-declarations.md'],
  18: ['seam-response-declarations.md'],
  19: ['seam-response-declarations.md', 'seam-response-loop-followup.md', 'SEAM-LEDGER.md row 34', 'seam-response-rungraph-followup.md', 'seam-response-effects-followup.md'],
  20: ['seam-response-declarations.md'],
  21: ['seam-response-intake-followup.md'],
  24: ['seam-response-intake-followup.md #12 observation admission', 'seam-response-assembly-followup.md P16-P10-process-resource-observation-v1', 'SEAM-LEDGER.md row 40', 'SEAM-LEDGER.md row 63'],
  31: ['seam-response-judgment.md', 'seam-response-assembly-followup.md'],
  32: ['seam-response-judgment.md', 'seam-response-assembly-followup.md', 'SEAM-LEDGER.md row 73'],
  35: ['seam-response-effects-followup.md'],
  33: ['seam-response-assembly-followup.md #14 expanded usage categories'],
  36: ['seam-response-declarations.md #11 price/exchange declarations', 'seam-response-loop-followup.md accountingWindow addendum', 'SEAM-LEDGER.md row 34'],
  37: ['seam-response-loop-followup.md accountingWindow addendum', 'SEAM-LEDGER.md row 34'],
  38: ['seam-response-loop-followup.md #20 qualified accounting'],
  42: ['seam-response-intake-followup.md'],
  43: ['seam-response-loop-followup.md item #25'],
  44: ['seam-response-intake-followup.md'],
  45: ['seam-response-intake-followup.md', 'seam-response-effects-followup.md'],
  46: ['seam-response-assembly-followup.md P16-P10-process-resource-observation-v1', 'seam-response-intake-followup.md #12 observation admission', 'seam-response-loop-followup.md item #25'],
  47: ['seam-response-operator-followup.md P16-P11-measurement-spend-surface-v1', 'SEAM-LEDGER.md row 64'],
  48: ['seam-response-operator-followup.md P16-P11-measurement-spend-surface-v1', 'SEAM-LEDGER.md row 64'],
  49: ['seam-response-declarations.md #11 price/exchange declarations', 'seam-response-intake-followup.md', 'seam-response-assembly-followup.md', 'seam-response-judgment.md',
    'seam-response-loop-followup.md', 'seam-response-rungraph-followup.md', 'seam-response-effects-followup.md',
    'SEAM-LEDGER.md row 40', 'SEAM-LEDGER.md row 63', 'SEAM-LEDGER.md row 64'],
  50: ['seam-response-loop-followup.md'],
  51: ['seam-response-effects-followup.md'],
};

export function p16Dispositions(design = readFileSync('docs/20-measurement-ledgers/13-non-functional-checks-and-activation.md', 'utf8')) {
  const ids = [...design.matchAll(/^\| (P16-NF-(\d+)) \|/gm)].map(match => ({ id: match[1], number: Number(match[2]) }));
  if (ids.length !== 52 || ids.some((row, index) => row.number !== index + 1))
    throw new Error('Part Sixteen design must contain exactly one contiguous P16-NF-01..52 table');
  // The governing design intentionally ends at 52. Keep the historic harness label visible,
  // but never present it as an invented design acceptance rule.
  const rows = [...ids, { id: 'P16-NF-53', number: 53, supplemental: true }];
  return rows.map(row => {
    if (row.number === 53) return { ...row, status: 'SUPPLEMENTAL-EXECUTABLE-NON-GOVERNING', dependencies: [] };
    if (executable.has(row.number)) return { ...row, status: 'EXECUTABLE', dependencies: [] };
    const blocked = dependencies[row.number];
    if (!blocked?.length) throw new Error(`${row.id}: non-executable row has no exact grant dependency`);
    if (mixed.has(row.number)) return { ...row, status: `MIXED-EXECUTABLE-FOUNDATION-PLUS-${blocked.join(' + ')}`, dependencies: blocked };
    return { ...row, status: `NON-EXECUTABLE-UNTIL-${blocked.join(' + ')}`, dependencies: blocked };
  });
}

export function checkP16Architecture() {
  const files = readdirSync('src/measurement').filter(file => file.endsWith('.ts'));
  const source = files.map(file => readFileSync(`src/measurement/${file}`, 'utf8')).join('\n');
  const imports = [...source.matchAll(/from ['"](\.\.\/[^'"]+)['"]/g)].map(match => match[1]);
  const allowed = new Set(['../index.js', '../facts/index.js', '../projections/index.js', '../assembly/index.js', '../judgment/index.js']);
  const privateImports = imports.filter(path => !allowed.has(path));
  if (privateImports.length) throw new Error(`P16 private earlier-part imports: ${[...new Set(privateImports)].join(', ')}`);
  if (/\b(?:canRun|place|throttle|allow|retry|unfreeze|invokeEffect)\s*:/.test(readFileSync('src/measurement/service.ts', 'utf8')))
    throw new Error('P16 public holder exports another owner\'s authority operation');
  const declarations = JSON.parse(readFileSync('src/measurement/measurement.declarations.json', 'utf8'));
  if (!Array.isArray(declarations) || !declarations.length || declarations.some(row => row.status !== 'dark' || row.holds?.length))
    throw new Error('P16 foundation declarations must remain dark and hold-free');
  const proofFiles = ['tests/measurement/contract-map.test.ts', 'tests/integration/measurement-round2-map.test.ts',
    'tests/e2e/measurement-round2-map.test.ts'];
  const proofIds = [...mixed, 53].map(number => `P16-NF-${String(number).padStart(2, '0')}`);
  for (const file of proofFiles) {
    const proof = readFileSync(file, 'utf8');
    if (!proof.includes('verifyP16MixedRuntimeProof(exerciseP16MixedRuntimeProof())') || !proofIds.every(id => proof.includes(id)))
      throw new Error(`${file}: mixed-arm coverage must execute the shared runtime proof and name every mapped arm`);
  }
  const runtime = readFileSync('tests/measurement/mixed-runtime-proof.ts', 'utf8');
  if (!runtime.includes('p16MixedRuntimeReceiptMap') || !proofIds.every(id => runtime.includes(`'${id}'`)))
    throw new Error('mixed runtime proof lacks its per-row executable receipt map');
  for (const operation of ['createTransportFileStorage(', 'foldProjection(', 'bindMeasurementReadSource(', 'renderCurrentMeasurementRead(',
    'summarizeRateLimitEvents(', 'createQuantityWitness(',
    'aggregateMeasurements(', 'mergePeerMeasurements(', 'evaluateBurn(', 'renderBoundedRead(', 'resourceTrend(',
    'classifyLegacyResourceObservation(', 'growthInvestigationLink(', 'createBoundedReadCache('])
    if (!runtime.includes(operation)) throw new Error(`mixed runtime proof omits ${operation}`);
  for (const receipt of ['sourceHistory:', 'historicalRead:', 'rateEvents:', 'aggregation:', 'peerUnion:', 'missingPeer:', 'burn:', 'read:', 'resource:',
    'observerCost:', 'growth:', 'cacheRows:']) if (!runtime.includes(receipt)) throw new Error(`mixed runtime proof omits receipt ${receipt}`);
  const foundation = readFileSync('tests/measurement/foundation.test.ts', 'utf8');
  if (!foundation.includes('P16-NF-13 owner-issued incompatible multi-match')
    || !foundation.includes("state).toBe('conflicted')")) throw new Error('P16-NF-13 omits its owner-issued incompatible multi-match neighbor');
  return { sourceFiles: files.length, imports: [...new Set(imports)].sort(), declarations: declarations.length, proofFiles: proofFiles.length };
}

export function checkP16Coverage(report, dispositions = p16Dispositions()) {
  if (!report.success) throw new Error('P16 mapping requires a successful actual test run');
  const tiers = ['tests/measurement/', 'tests/integration/', 'tests/e2e/'];
  return dispositions.map(row => {
    const tests = report.testResults.flatMap(file => file.assertionResults
      .filter(test => (test.fullName.match(/\bP16-NF-\d+\b/g) ?? []).includes(row.id))
      .map(test => ({ file: relative(process.cwd(), file.name), title: test.title, status: test.status })));
    const passing = tests.filter(test => test.status === 'passed');
    if (row.status === 'EXECUTABLE' || row.status.startsWith('MIXED-EXECUTABLE-') || row.status.startsWith('SUPPLEMENTAL-EXECUTABLE-')) {
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
  console.log(`${rows.length} labels mapped: ${rows.filter(row => row.status === 'EXECUTABLE').length} governing wholly executable; ${rows.filter(row => row.status.startsWith('MIXED-EXECUTABLE-')).length} governing mixed; ${rows.filter(row => row.status.startsWith('NON-EXECUTABLE-')).length} governing wholly excluded until exact named grants; 1 supplemental non-governing harness label.`);
}
