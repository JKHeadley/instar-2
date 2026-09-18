import { productionBindingHolds } from '../dist/assembly/production-holds.js';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, realpathSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { telegramBotApiCustodianContractMap } from '../dist/assembly/index.js';

export const assemblyDispositions = Array.from({ length: 57 }, (_, index) => ({
  id: `P10-NF-${String(index + 1).padStart(2, '0')}`,
  status: 'partial',
  reason: 'Executable unit/full-port/lifecycle reference behavior is present; protected deployment activation and independently administered platform evidence remain deliberately dark.',
}));

// GRANT U4-A: the unchanged model-provider roster still holds unproven routes.
// This additive constructor arm does not claim a live provider or a full boot.
export const productionBootCustodyContract = Object.freeze({
  executable: Object.freeze(['production route under confined credential custody']),
  evidence: 'tests/assembly/production-boot-preconditions.test.ts',
  held: productionBindingHolds,
});
export const productionBootPrerequisiteContract = Object.freeze({
  executable: Object.freeze(['immutable operator-authored installation configuration',
    'encrypted durable root custody and exclusive boot lease', 'confined bounded Claude Code transport',
    'switch-on names every U4-G missing real binding before network-capable composition']),
  evidence: Object.freeze(['tests/assembly/production-boot-storage.test.ts',
    'tests/assembly/production-boot-provider.test.ts', 'tests/assembly/production-boot-refusals.test.ts']),
  held: Object.freeze([...productionBindingHolds,
    'NON-EXECUTABLE-UNTIL-replicated-storage-second-machine', 'NON-EXECUTABLE-UNTIL-package-switch-rollback',
    'NON-EXECUTABLE-UNTIL-other-conversation-platforms', 'NON-EXECUTABLE-UNTIL-multiple-bots',
    'NON-EXECUTABLE-UNTIL-live-path-unit-compaction', 'NON-EXECUTABLE-UNTIL-traces-beyond-launch-message-provider-call']),
});

// U4-G: executable construction and recorded lifecycle coexist with explicit
// fixture admission of every unavailable installation binding. No LIVE claim.
export const productionBootLifecycleContract = Object.freeze({
  executable: Object.freeze(['bootProductionApplication and bin/instar-production.mjs compose the real owner constructors',
    'recorded Telegram through Four/Five/Seven/Eight/Six/Nine/Five and one minimal reply',
    'real SIGKILL and public restart at restored adjacent durable prefixes of that one trace']),
  evidence: Object.freeze(['tests/assembly/production-boot-public-entry.test.ts',
    'tests/assembly/production-boot-composition-refusals.test.ts', 'tests/assembly/production-boot-conversation.test.ts']),
  fixtureAdmitted: productionBindingHolds,
  held: productionBootPrerequisiteContract.held,
});

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

const owned = new Set(['AssemblyManifest', 'AssemblyAdmission', 'HarnessLaunchSpec', 'ContextDeliverySpecification', 'HarnessObservation',
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
        // GRANT U3-A: only Ten's exact non-public identity-resolver registration import.
        const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
        const bindings = clause?.namedBindings;
        const elements = bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
        const sealedIdentityRegistration = path === 'src/assembly/telegram-bot-api-custodian.ts'
          && specifier === '../conversation/telegram.js' && clause && !clause.isTypeOnly && !clause.name
          && elements.length === 1 && !elements[0].isTypeOnly && !elements[0].propertyName
          && elements[0].name.text === 'registerTelegramIdentityCaptureResolver';
        if (specifier.startsWith('../') && !specifier.endsWith('/index.js') && specifier !== '../index.js'
          && !sealedIdentityRegistration) issues.push(`${path}: private sibling import ${specifier}`);
        if (!specifier.startsWith('.') && !specifier.startsWith('node:')) issues.push(`${path}: external core dependency ${specifier}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  for (const [name, count] of counts) if (count !== 1) issues.push(`contracts.ts: ${name} owner count ${count}`);
  return issues;
}

export const productionGroundingAssemblyContract = Object.freeze({
  executable: Object.freeze([
    'ContextDeliverySpecification:initial',
    'ContextDeliverySpecification:live-input',
    'HarnessAdapterPort.deliver(contextDelivery)',
    'HarnessObservation.contextDelivery:input-accepted',
    'HarnessObservation.contextDelivery:context-consumed',
    'createConfinedContextDeliveryDriver',
  ]),
  held: 'NON-EXECUTABLE-UNTIL-live-path-unit-compaction',
  compatibilityOnly: 'flat-consumption-receipt-excluded-from-production-activation-evidence',
});
export function productionGroundingDependencyDigest(root = realpathSync(fileURLToPath(new URL('..', import.meta.url)))) {
  const hash = createHash('sha256');
  const visit = path => { for (const entry of readdirSync(resolve(root, path), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const name = `${path}/${entry.name}`;
    if (entry.isDirectory()) visit(name);
    else if (/\.(?:js|mjs|cjs|json)$/.test(name)) { hash.update(name); hash.update(readFileSync(resolve(root, name))); }
  } };
  for (const path of ['node_modules/vitest', 'node_modules/@vitest/expect', 'node_modules/@vitest/runner',
    'node_modules/@vitest/snapshot', 'node_modules/@vitest/utils', 'node_modules/chai', 'node_modules/typescript']) visit(path);
  return hash.digest('hex');
}
export function productionGroundingSourceDigest(root = realpathSync(fileURLToPath(new URL('..', import.meta.url)))) {
  const hash = createHash('sha256');
  const visit = path => { for (const entry of readdirSync(resolve(root, path), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const name = `${path}/${entry.name}`;
    if (entry.isDirectory()) visit(name);
    else if (/\.(?:ts|js|mjs|json)$/.test(name)) { hash.update(name); hash.update(readFileSync(resolve(root, name))); }
  } };
  hash.update(productionGroundingDependencyDigest(root));
  for (const path of ['src', 'tests', 'scripts', 'generated', 'dist']) if (existsSync(resolve(root, path))) visit(path);
  for (const path of ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'vitest.config.ts', 'tsconfig.json', 'tsconfig.build.json'])
    if (existsSync(resolve(root, path))) { hash.update(path); hash.update(readFileSync(resolve(root, path))); }
  return hash.digest('hex');
}
const REVIEWED_GROUNDING_INVENTORY = 'd894d2e8a8d0c27647355ae79c7a09273827f35c8706ca8636713d143797173b';
export function checkProductionGroundingAssemblyEvidence(report) {
  const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
  if (!report.success || report.numFailedTests || report.numFailedTestSuites || !Number.isFinite(report.startTime))
    throw new Error('production grounding evidence requires a completed successful actual run');
  const inventoryBytes = readFileSync(resolve(root, 'tests/assembly/production-grounding-inventory.json'), 'utf8');
  if (createHash('sha256').update(inventoryBytes).digest('hex') !== REVIEWED_GROUNDING_INVENTORY)
    throw new Error('production grounding inventory differs from the reviewed obligations');
  const inventory = JSON.parse(inventoryBytes);
  if (inventory.reviewedDependencyDigest !== productionGroundingDependencyDigest(root))
    throw new Error('reviewed test runner/compiler/assertion dependencies changed');
  if (inventory.cases.length !== 127 || new Set(inventory.cases.map(row => `${row.landedFile}\0${row.fullName}`)).size !== 127)
    throw new Error('production grounding requires all 121 review/boot identities plus six real owner controls');
  for (const [name, digest] of Object.entries(inventory.reviewedSupportSources)) {
    const path = resolve(root, name);
    if (!path.startsWith(root + '/') || !existsSync(path) || realpathSync(path) !== path
      || createHash('sha256').update(readFileSync(path)).digest('hex') !== digest)
      throw new Error(`reviewed owner/factory/runner source changed: ${name}`);
  }
  const auditPath = resolve(root, '.instar/lanes/round4b-artifacts/assertions.jsonl');
  const audit = existsSync(auditPath) ? readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  const sourceDigest = productionGroundingSourceDigest(root);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const processPath = resolve(root, '.instar/lanes/round4c-artifacts/process-exits.jsonl');
  const reportDigest = createHash('sha256').update(JSON.stringify(report)).digest('hex');
  const completed = existsSync(processPath) ? readFileSync(processPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const exits = completed.filter(row => row.root === root && row.revision === revision && row.sourceDigest === sourceDigest
    && row.reportDigest === reportDigest && row.reportStart === report.startTime);
  if (exits.length !== 1 || exits[0].code !== 0)
    throw new Error('production grounding requires one actual successful Vitest process exit, not its JSON success flag');
  const files = new Set();
  for (const required of inventory.cases) {
    const path = resolve(root, required.landedFile);
    if (!existsSync(path) || realpathSync(path) !== path || !path.startsWith(root + '/')) throw new Error(`wrong rooted evidence file: ${required.landedFile}`);
    const matches = report.testResults.flatMap(file => file.name === path ? (file.assertionResults ?? [])
      .filter(test => test.fullName === required.fullName).map(test => ({ file, test })) : []);
    if (matches.length !== 1 || matches[0].test.status !== 'passed') throw new Error(`missing unique passing production grounding case: ${required.fullName}`);
    const { file, test } = matches[0];
    const runs = audit.filter(row => row.file === path && row.fullName === required.fullName
      && row.start >= report.startTime && row.start >= file.startTime && row.end <= file.endTime + 100
      && row.revision === revision && row.sourceDigest === sourceDigest);
    if (runs.length !== 1 || runs[0].assertionCalls < required.minimumExecutedAssertions || !runs[0].assertions.length || runs[0].state !== 'pass')
      throw new Error(`missing current executed assertion evidence: ${required.fullName}`);
    if (!required.assertionSites?.length) throw new Error(`unreviewed assertion obligations: ${required.fullName}`);
    for (const site of required.assertionSites) if (!runs[0].assertions.some(actual => JSON.stringify(actual) === JSON.stringify(site)))
      throw new Error(`required final assertion was not executed: ${required.fullName}`);
    for (const condition of required.checkpoints ?? []) {
      const { name, minimum = 1, evidence = {} } = typeof condition === 'string' ? { name: condition } : condition;
      const reached = (runs[0].checkpoints ?? []).filter(row => row.name === name
        && Object.entries(evidence).every(([key, expected]) => row.evidence?.[key] === expected));
      if (reached.length < minimum) throw new Error(`required owner path was not executed: ${required.fullName}: ${name}`);
    }
    for (const detail of required.refusalDetails ?? []) if (!runs[0].refusals?.some(actual => actual.includes(detail)))
      throw new Error(`intended refusal was not reached: ${required.fullName}: ${detail}`);
    if (!required.reviewedSourceSha256 || createHash('sha256').update(readFileSync(path)).digest('hex') !== required.reviewedSourceSha256)
      throw new Error(`tested source differs from reviewed case: ${required.fullName}`);
    files.add(path);
  }
  if (productionGroundingAssemblyContract.held !== 'NON-EXECUTABLE-UNTIL-live-path-unit-compaction') throw new Error('compaction hold changed');
  return { ...productionGroundingAssemblyContract, files: [...files] };
}

/** Negative controls run against the same accepted, rooted full-run evidence.
 * Every source substitution is restored synchronously, including on failure. */
export function exerciseProductionGroundingEvidence(report) {
  checkProductionGroundingAssemblyEvidence(report);
  const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
  const inventory = JSON.parse(readFileSync(resolve(root, 'tests/assembly/production-grounding-inventory.json'), 'utf8'));
  const target = inventory.cases[0], path = resolve(root, target.landedFile), results = [];
  const reject = (name, candidate) => {
    let detail;
    try { checkProductionGroundingAssemblyEvidence(candidate); } catch (error) { detail = error.message; }
    if (!detail) throw new Error(`F9 mutation was incorrectly certified: ${name}`);
    results.push({ name, refused: true, detail });
  };
  const processPath = resolve(root, '.instar/lanes/round4c-artifacts/process-exits.jsonl');
  const processBytes = readFileSync(processPath, 'utf8');
  const reportDigest = createHash('sha256').update(JSON.stringify(report)).digest('hex');
  try {
    const exits = processBytes.trim().split('\n').filter(Boolean).map(JSON.parse);
    for (const row of exits) if (row.reportDigest === reportDigest) row.code = 1;
    writeFileSync(processPath, exits.map(row => JSON.stringify(row)).join('\n') + '\n');
    reject('failed-process-with-successful-vitest-json', report);
    writeFileSync(processPath, '');
    reject('missing-main-process-exit', report);
  } finally { writeFileSync(processPath, processBytes); }
  const compiledPath = resolve(root, 'dist/assembly/production.js'), compiledBytes = readFileSync(compiledPath);
  try {
    writeFileSync(compiledPath, Buffer.concat([compiledBytes, Buffer.from('\n// changed executable owner input\n')]));
    reject('changed-compiled-owner-after-run', report);
  } finally { writeFileSync(compiledPath, compiledBytes); }
  for (const mode of ['delete', 'duplicate', 'failed', 'skipped', 'pending', 'renamed', 'wrong-root', 'stale']) {
    const changed = structuredClone(report), file = changed.testResults.find(row => row.name === path);
    const index = file.assertionResults.findIndex(row => row.fullName === target.fullName), test = file.assertionResults[index];
    if (mode === 'delete') file.assertionResults.splice(index, 1);
    if (mode === 'duplicate') file.assertionResults.push(structuredClone(test));
    if (['failed', 'skipped', 'pending'].includes(mode)) test.status = mode;
    if (mode === 'renamed') test.fullName += ' renamed';
    if (mode === 'wrong-root') file.name = `/tmp/counterfeit/${target.landedFile}`;
    if (mode === 'stale') changed.startTime = Date.now() + 1;
    reject(mode, changed);
  }
  const caseBytes = readFileSync(path, 'utf8');
  const artifactDir = resolve(root, '.instar/lanes/round4b-artifacts');
  mkdirSync(artifactDir, { recursive: true });
  const six = inventory.cases.filter(row => row.landedFile === target.landedFile).slice(0, 6);
  if (six.length !== 6) throw new Error('six rooted empty-case controls required');
  const configPath = resolve(artifactDir, 'rooted-empty.config.mjs'), reportPath = resolve(artifactDir, 'rooted-empty-results.json');
  writeFileSync(configPath, `export default {test:{include:[${JSON.stringify(target.landedFile)}],pool:'forks',fileParallelism:false,maxWorkers:1,testTimeout:30000}};`);
  let emptyReport;
  try {
    writeFileSync(path, `import {it} from 'vitest';\n` + six.map(row => `it(${JSON.stringify(row.fullName)},()=>{});`).join('\n'));
    execFileSync(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', '--root', root,
      '--config', configPath, '--reporter=json', '--outputFile', reportPath], { cwd: root, stdio: 'pipe', timeout: 60000 });
    emptyReport = JSON.parse(readFileSync(reportPath, 'utf8'));
    if (!emptyReport.success || emptyReport.numPassedTests !== 6 || emptyReport.numFailedTests !== 0)
      throw new Error('rooted six-empty negative control did not execute cleanly');
    reject('six-actually-executed-empty-cases-at-required-root', emptyReport);
  } finally { writeFileSync(path, caseBytes); }
  reject('six-empty-case-report-after-source-restored', emptyReport);
  for (const [name, source] of [
    ['zero-body-at-required-root', `import {it} from 'vitest';\nit(${JSON.stringify(target.fullName)},()=>{});`],
    ['unreachable-final-assertions', `import {it,expect} from 'vitest';\nit(${JSON.stringify(target.fullName)},()=>{if(false)expect(false).toBe(true)});`],
    ['assertion-only-placeholder', `import {it,expect} from 'vitest';\nit(${JSON.stringify(target.fullName)},()=>{expect(true).toBe(true)});`],
  ]) {
    try { writeFileSync(path, source); reject(name, report); } finally { writeFileSync(path, caseBytes); }
  }
  const fixture = resolve(root, 'tests/assembly/genuine-production-fixture.ts'), fixtureBytes = readFileSync(fixture, 'utf8');
  for (const [name, source] of [
    ['private-issuer-factory-replacement', "import {issueProductionGroundedGraph} from '../../src/rungraph/types.js';\nexport const genuineProductionComposition = () => issueProductionGroundedGraph({}, 'scope:minimal');"],
    ['foreign-store-graph-transplant', "import {paired} from '../rungraph/astra-production-grounding-fixture.js';\nexport const genuineProductionComposition = () => ({run:{port:paired().graph}});"],
    ['fake-owner-registration', "export const genuineProductionComposition = () => ({owner:'part-ten',runtime:{owner:'part-ten'},harness:{owner:'part-ten'},ownedBodies:[{owner:'part-eight',decodeCurrent:x=>x}]});"],
  ]) {
    try { writeFileSync(fixture, source); reject(name, report); } finally { writeFileSync(fixture, fixtureBytes); }
  }
  checkProductionGroundingAssemblyEvidence(report);
  mkdirSync(resolve(root, '.instar/lanes/round4b-artifacts'), { recursive: true });
  writeFileSync(resolve(root, '.instar/lanes/round4b-artifacts/checker-mutations.json'), JSON.stringify(results, null, 2) + '\n');
  return results;
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
  const grounding = checkProductionGroundingAssemblyEvidence(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  const mutations = exerciseProductionGroundingEvidence(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log(`production grounding F9: ${mutations.length} counterfeit evidence mutations refused`);
  console.log(`production grounding executable: ${grounding.executable.join(', ')}; held: ${grounding.held}; compatibility: ${grounding.compatibilityOnly}`);
}
