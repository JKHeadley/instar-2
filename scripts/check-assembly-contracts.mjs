import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const assemblyDispositions = Array.from({ length: 57 }, (_, index) => ({
  id: `P10-NF-${String(index + 1).padStart(2, '0')}`,
  status: 'partial',
  reason: 'Executable unit/full-port/lifecycle reference behavior is present; protected deployment activation and independently administered platform evidence remain deliberately dark.',
}));

export const packageActivityContractMap = Object.freeze([
  { operation: 'resolvePackageActivity', check: 'P10-NF-41', tier: 'unit', status: 'executable',
    file: 'tests/assembly/package-activity.test.ts', title: 'package activity outcomes are closed, distinct, owner-issued, and canonically identified' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-43', tier: 'unit', status: 'executable',
    file: 'tests/assembly/package-activity.test.ts', title: 'a staged or recovered head and an incomplete causal transition are unresolved' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-44', tier: 'unit', status: 'executable',
    file: 'tests/assembly/package-activity.test.ts', title: 'malformed package activity values are typed refusals' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-08', tier: 'integration', status: 'executable',
    file: 'tests/integration/package-activity.test.ts', title: 'use-time re-resolution observes later activation and reports a moved frontier as unresolved' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-30', tier: 'integration', status: 'executable',
    file: 'tests/integration/package-activity.test.ts', title: 'full Part Ten runtime and Part Two store resolve every package lifecycle head' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-41', tier: 'integration', status: 'executable',
    file: 'tests/integration/package-activity.test.ts', title: 'full Part Ten runtime and Part Two store resolve every package lifecycle head' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-43', tier: 'integration', status: 'executable',
    file: 'tests/integration/package-activity.test.ts', title: 'conflicts, multi-heads, incomplete references, taint, and mismatched active artifacts remain unresolved' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-44', tier: 'integration', status: 'executable',
    file: 'tests/integration/package-activity.test.ts', title: 'full Part Ten runtime and Part Two store resolve every package lifecycle head' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-08', tier: 'lifecycle', status: 'executable',
    file: 'tests/e2e/package-activity.test.ts', title: 'real SIGKILL before and after every durable package boundary reconstructs the same witnessed activity' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-30', tier: 'lifecycle', status: 'executable',
    file: 'tests/e2e/package-activity.test.ts', title: 'real SIGKILL before and after every durable package boundary reconstructs the same witnessed activity' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-43', tier: 'lifecycle', status: 'executable',
    file: 'tests/e2e/package-activity.test.ts', title: 'missing prefixes and changed signed bytes refuse after durable restart' },
  { operation: 'resolvePackageActivity', check: 'P10-NF-44', tier: 'lifecycle', status: 'executable',
    file: 'tests/e2e/package-activity.test.ts', title: 'real SIGKILL before and after every durable package boundary reconstructs the same witnessed activity' },
]);

export const packageActivityNonExecutable = Object.freeze([
  { subject: 'part-fifteen-package-competition-consumer', status: 'non-executable',
    grant: 'NON-EXECUTABLE-UNTIL-P15-P10-package-resource-and-activity-v1',
    reason: 'Part Fifteen consumer wiring is outside the row-80 Part Ten grant and remains for its own slice.' },
]);

export function checkPackageActivityCoverage(report, rows = packageActivityContractMap) {
  if (!report.success) throw new Error('package activity mapping requires a successful actual test run');
  const tiers = new Set(), checks = new Set();
  for (const row of rows) {
    if (row.status !== 'executable' || row.operation !== 'resolvePackageActivity') throw new Error(`invalid package activity executable claim: ${row.check}`);
    if (!/^P10-NF-(08|30|41|43|44)$/.test(row.check)) throw new Error(`ungranted package activity check: ${row.check}`);
    const tests = report.testResults.flatMap(file => (file.assertionResults ?? []).filter(test =>
      file.name.endsWith(row.file) && test.status === 'passed' && test.fullName.includes(row.check) && test.fullName.includes(row.title)));
    if (tests.length !== 1) throw new Error(`package activity map row has ${tests.length} real passing tests: ${row.check}/${row.tier}`);
    tiers.add(row.tier); checks.add(row.check);
  }
  for (const tier of ['unit', 'integration', 'lifecycle']) if (!tiers.has(tier)) throw new Error(`package activity has no executable ${tier} mapping`);
  for (const check of ['P10-NF-08', 'P10-NF-30', 'P10-NF-41', 'P10-NF-43', 'P10-NF-44'])
    if (!checks.has(check)) throw new Error(`package activity check is unmapped: ${check}`);
  if (packageActivityNonExecutable.some(row => row.status !== 'non-executable'
    || row.grant !== 'NON-EXECUTABLE-UNTIL-P15-P10-package-resource-and-activity-v1' || !row.reason))
    throw new Error('package activity non-executable map contains an ungrounded claim');
  return rows;
}

const PART_TEN_ADDITIVITY_BASE = 'dcd7c0fbbd91a5d568f7ee988d8f219dc6f2b3f8';
export function checkPartTenAdditivity(base = PART_TEN_ADDITIVITY_BASE) {
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', base, '--', 'tests'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    .filter(path => /P10-NF-|src\/assembly|\/assembly\//.test(execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' })));
  if (!paths.length) throw new Error('Part Ten additivity baseline contains no tests or fixtures');
  const changed = paths.filter(path => !existsSync(path)
    || !readFileSync(path).equals(execFileSync('git', ['show', `${base}:${path}`])));
  if (changed.length) throw new Error(`Part Ten additivity violated; pre-existing tests/fixtures changed: ${changed.join(', ')}`);
  return Object.freeze({ base, checked: paths.length, changed: 0 });
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
  'HarnessAdapterPort', 'PersistenceAdapterPort', 'PackageActivityOutcome', 'PackageActivityResult', 'PackageActivityUnresolvedReason']);
const imported = new Set(['ModelAdapterPort', 'FactStorePort']);
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
  const packageRows = checkPackageActivityCoverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  const additive = checkPartTenAdditivity();
  for (const row of rows) console.log(`${row.id}: ${row.status}; ${row.tests.length} executed fixtures; ${row.reason}`);
  console.log(`resolvePackageActivity: ${packageRows.length} executable map rows; ${packageActivityNonExecutable.length} non-executable consumer row`);
  console.log(`Part Ten additivity: ${additive.checked}/${additive.checked} pre-existing tests/fixtures byte-identical to ${additive.base}; changed=${additive.changed}`);
}
