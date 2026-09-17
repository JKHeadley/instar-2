import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { telegramBotApiCustodianContractMap } from '../dist/assembly/index.js';

export const assemblyDispositions = Array.from({ length: 57 }, (_, index) => ({
  id: `P10-NF-${String(index + 1).padStart(2, '0')}`,
  status: 'partial',
  reason: 'Executable unit/full-port/lifecycle reference behavior is present; protected deployment activation and independently administered platform evidence remain deliberately dark.',
}));

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

export const telegramCustodianExecutableArms = Object.freeze([
  'identity:getMe',
  'poll:long-poll-capture-before-offset',
  'authenticate:captured-update-bytes',
  'readCapture',
  'sendMessage:HTML:hiddenRetries=0',
]);
export const telegramCustodianHeldArms = Object.freeze([
  'NON-EXECUTABLE-UNTIL-webhook-mode-grant',
  'NON-EXECUTABLE-UNTIL-typed-media-payload-grant',
  'NON-EXECUTABLE-UNTIL-typed-edit-payload-grant',
  'NON-EXECUTABLE-UNTIL-typed-react-payload-grant',
  'NON-EXECUTABLE-UNTIL-typed-topic-creation-payload-grant',
  'NON-EXECUTABLE-UNTIL-slack-adapter-grant',
  'NON-EXECUTABLE-UNTIL-whatsapp-adapter-grant',
  'NON-EXECUTABLE-UNTIL-imessage-adapter-grant',
  'NON-EXECUTABLE-UNTIL-web-adapter-grant',
  'NON-EXECUTABLE-UNTIL-other-platform-adapter-grants',
  'NON-EXECUTABLE-UNTIL-rate-limit-backoff-grant',
  'F4-FREE-TEXT-REPRESENTATION-LONG-TAIL',
  'NON-EXECUTABLE-UNTIL-free-text-representation-extension-grant',
  'F4-MEDIATED-POLL-SEND-EVIDENCE',
  'F4-PROVIDER-COVERT-CHANNELS',
  'LIVE-REREVIEW4-TRANSPORT-CAUSE',
]);

export function checkTelegramCustodianMap(map) {
  for (const [name, expected] of [
    ['executable', telegramCustodianExecutableArms],
    ['held', telegramCustodianHeldArms],
  ]) {
    if (!Array.isArray(map[name]) || JSON.stringify(map[name]) !== JSON.stringify(expected))
      throw new Error(`Telegram custodian ${name} contract roster differs`);
  }
  return true;
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
  checkTelegramCustodianMap(telegramBotApiCustodianContractMap);
  const source = Object.fromEntries(readdirSync('src/assembly').filter(name => name.endsWith('.ts'))
    .map(name => [`src/assembly/${name}`, readFileSync(`src/assembly/${name}`, 'utf8')]));
  const issues = inspectAssemblyCore(source); if (issues.length) throw new Error(issues.join('\n'));
  const declarations = JSON.parse(readFileSync('src/assembly/assembly.declarations.json', 'utf8'));
  if (!declarations.some(row => row.id === 'assembly.contract' && row.status === 'dark') || !declarations.some(row => row.id === 'assembly.source' && row.status === 'dark') || declarations.some(row => row.holds?.length))
    throw new Error('assembly declarations falsely claim live/held activation');
  const rows = checkAssemblyCoverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  for (const row of rows) console.log(`${row.id}: ${row.status}; ${row.tests.length} executed fixtures; ${row.reason}`);
}
