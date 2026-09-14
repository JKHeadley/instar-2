import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const assemblyDispositions = Array.from({ length: 57 }, (_, index) => ({
  id: `P10-NF-${String(index + 1).padStart(2, '0')}`,
  status: 'partial',
  reason: 'Executable unit/full-port/lifecycle reference behavior is present; protected deployment activation and independently administered platform evidence remain deliberately dark.',
}));

export const assemblyOwnerSliceMap = [{
  id: 'P10-SEAM-CONDITIONAL-APPEND-58',
  operation: 'appendIfSubjectFrontier',
  tiers: ['unit', 'integration', 'lifecycle'],
  cases: 'typed current-frontier refusal, equal-frontier append, subject scoping, two-process mode race, and eight real-storage SIGKILL boundaries',
}];

export function checkAssemblyOwnerSlices(report, map = assemblyOwnerSliceMap) {
  if (!report.success) throw new Error('assembly owner-slice mapping requires a successful actual test run');
  const tierPath = { unit: '/tests/assembly/', integration: '/tests/integration/', lifecycle: '/tests/e2e/' };
  for (const row of map) {
    if (!row.id || !row.operation || !row.cases || new Set(row.tiers).size !== 3)
      throw new Error('malformed assembly owner-slice map entry');
    const tests = report.testResults.flatMap(file => (file.assertionResults ?? [])
      .filter(test => (test.fullName.match(/\bP10-SEAM-[A-Z0-9-]+-\d+\b/g) ?? []).includes(row.id)
        && test.fullName.includes(`[behavior:${row.operation}]`))
      .map(test => ({ file: file.name.replaceAll('\\', '/'), status: test.status })));
    for (const tier of row.tiers) if (!tests.some(test => test.status === 'passed' && test.file.includes(tierPath[tier])))
      throw new Error(`${row.id}: ${row.operation} lacks passing ${tier} evidence`);
    if (tests.some(test => test.status !== 'passed')) throw new Error(`${row.id}: mapped evidence did not pass`);
  }
  return map;
}

export function checkAssemblyCoverage(report, dispositions = assemblyDispositions) {
  if (!report.success) throw new Error('assembly mapping requires a successful actual test run');
  if (dispositions.length !== 57 || new Set(dispositions.map(row => row.id)).size !== 57) throw new Error('missing or duplicate P10 disposition');
  const tiers = new Set();
  const rows = dispositions.map(row => {
    if (row.status !== 'partial' || !row.reason) throw new Error(`invented held or unexplained P10 disposition: ${row.id}`);
    const tests = report.testResults.flatMap(file => (file.assertionResults ?? []).filter(test =>
      (test.fullName.match(/\bP10-NF-\d+\b/g) ?? []).includes(row.id)).map(test => ({ file: file.name, title: test.fullName, status: test.status })));
    if (!tests.length || tests.some(test => test.status !== 'passed')) throw new Error(`missing executed passing fixture: ${row.id}`);
    for (const test of tests) {
      if (test.file.includes('/tests/assembly/')) tiers.add('unit');
      if (test.file.includes('/tests/integration/')) tiers.add('integration');
      if (test.file.includes('/tests/e2e/')) tiers.add('lifecycle');
    }
    return { ...row, tests };
  });
  for (const tier of ['unit', 'integration', 'lifecycle']) if (!tiers.has(tier)) throw new Error(`P10 has no executed ${tier} tier`);
  return rows;
}

const owned = new Set(['AssemblyManifest', 'AssemblyAdmission', 'HarnessLaunchSpec', 'HarnessObservation',
  'AdapterEvidenceContract', 'AdapterConformance', 'StoreCustodyPolicy', 'StorageAccessObservation',
  'LocalCapabilityPackage', 'PackageTransition', 'GrowthPolicy', 'GrowthObservation',
  'HarnessAdapterPort', 'PersistenceAdapterPort']);
const imported = new Set(['ModelAdapterPort']);
export function inspectAssemblyCore(sources) {
  const issues = []; const counts = new Map([...owned].map(name => [name, 0]));
  for (const [path, source] of Object.entries(sources)) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
        const name = node.name.text;
        if (owned.has(name) && path.endsWith('/contracts.ts')) counts.set(name, counts.get(name) + 1);
        else if (owned.has(name)) issues.push(`${path}: duplicate ten-owned type ${name}`);
        if (imported.has(name)) issues.push(`${path}: Part Seven-owned ModelAdapterPort was redefined`);
      }
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        if (specifier.startsWith('../') && !specifier.endsWith('/index.js') && specifier !== '../index.js') issues.push(`${path}: private sibling import ${specifier}`);
        if (!specifier.startsWith('.') && !specifier.startsWith('node:')) issues.push(`${path}: external core dependency ${specifier}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const [name, count] of counts) if (count !== 1) issues.push(`contracts.ts: ${name} owner count ${count}`);
  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = Object.fromEntries(readdirSync('src/assembly').filter(name => name.endsWith('.ts'))
    .map(name => [`src/assembly/${name}`, readFileSync(`src/assembly/${name}`, 'utf8')]));
  const issues = inspectAssemblyCore(source); if (issues.length) throw new Error(issues.join('\n'));
  const declarations = JSON.parse(readFileSync('src/assembly/assembly.declarations.json', 'utf8'));
  if (!declarations.some(row => row.id === 'assembly.contract' && row.status === 'dark') || !declarations.some(row => row.id === 'assembly.source' && row.status === 'dark') || declarations.some(row => row.holds?.length))
    throw new Error('assembly declarations falsely claim live/held activation');
  const rows = checkAssemblyCoverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  const slices = checkAssemblyOwnerSlices(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  for (const row of rows) console.log(`${row.id}: ${row.status}; ${row.tests.length} executed fixtures; ${row.reason}`);
  for (const row of slices) console.log(`${row.id}: ${row.operation}; ${row.tiers.join('/')} — ${row.cases}`);
}
