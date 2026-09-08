// Every P11-NF identifier in docs/15 resolves to an executed check. Dispositions
// remain partial until the independently administered live phone/provider evidence
// and the owner seams named in src/operator/README.md are present.
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const partialReason = 'Executable negative/positive-neighbour contract coverage is present; production activation remains dark pending the owner seams and independent live phone/provider evidence named by Part Eleven.';

export function p11Dispositions(design = readFileSync('docs/15-the-operator-surfaces.md', 'utf8')) {
  const ids = [...design.matchAll(/^\| (P11-NF-(\d+)) \|/gm)].map(m => ({ id: m[1], number: Number(m[2]) }));
  if (!ids.length) throw new Error('no P11-NF identifiers found in the design');
  return ids.map(({ id, number }) => {
    return { id, number, status: 'partial', reason: partialReason };
  });
}

export function checkP11Coverage(report, dispositions = p11Dispositions()) {
  if (!report.success) throw new Error('P11 mapping requires a successful actual test run');
  if (dispositions.length !== 53 || new Set(dispositions.map(row => row.id)).size !== 53) throw new Error('missing or duplicate P11 disposition');
  const tiers = new Set();
  const rows = dispositions.map(row => {
    const tests = report.testResults.flatMap(file => file.assertionResults
      .filter(t => (t.fullName.match(/\bP11-NF-\d+\b/g) ?? []).includes(row.id))
      .map(t => ({ file: relative(process.cwd(), file.name), title: t.title, status: t.status })));
    const passing = tests.filter(t => t.status === 'passed');
    const skipped = tests.filter(t => ['pending', 'skipped'].includes(t.status));
    if (tests.length !== passing.length + skipped.length) throw new Error(`${row.id}: a mapped test neither passed nor was explicitly skipped`);
    for (const test of skipped) if (!/out of slice scope:\s*\S.+/.test(test.title))
      throw new Error(`${row.id}: skipped without an explicit slice-scope reason`);
    if (row.status !== 'partial' || !row.reason) throw new Error(`${row.id}: invented held/live or unexplained disposition`);
    if (!passing.length) throw new Error(`${row.id}: no passing executable fixture`);
    for (const test of passing) {
      if (test.file.includes('tests/operator/')) tiers.add('unit');
      if (test.file.includes('tests/integration/')) tiers.add('integration');
      if (test.file.includes('tests/e2e/')) tiers.add('lifecycle');
    }
    return { ...row, tests, passing: passing.length, skipped: skipped.length };
  });
  for (const tier of ['unit', 'integration', 'lifecycle']) if (!tiers.has(tier)) throw new Error(`P11 has no executed ${tier} tier`);
  return rows;
}

const forbiddenOwnerNames = new Set(['Authorization', 'StandingGrant', 'Revocation', 'VerifiedPrincipal', 'Directive', 'Intent', 'Decision',
  'Result', 'Outcome', 'Evidence', 'Measurement', 'Conflict', 'FactEnvelope', 'ConversationBinding', 'DeliveryEvidence', 'VerificationAssessment', 'SessionLiveness']);
export function inspectOperatorCore(sources) {
  const issues = [];
  for (const [path, source] of Object.entries(sources)) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node)) && node.name
        && forbiddenOwnerNames.has(node.name.text)) issues.push(`${path}: redefines earlier-owned ${node.name.text}`);
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        if (specifier.startsWith('../') && !specifier.endsWith('/index.js') && specifier !== '../index.js') issues.push(`${path}: private sibling import ${specifier}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  return issues;
}

/**
 * Each SUPPORTED capability of each declared adapter names one specific executed test
 * as `<file>::<substring of its title>`. Naming a whole file would let a capability
 * inherit execution from unrelated tests, so this binds the capability to the test.
 */
export function checkCapabilityConformance(report, contracts = JSON.parse(readFileSync('scripts/slice-contracts.json', 'utf8'))) {
  const rows = [];
  for (const [adapter, contract] of Object.entries(contracts.adapters)) {
    for (const [name, capability] of Object.entries(contract.capabilities)) {
      if (capability.status !== 'supported') continue;
      const reference = capability.conformance;
      if (typeof reference !== 'string' || !reference.includes('::'))
        throw new Error(`${adapter}.${name}: a supported capability must name '<file>::<test title substring>'`);
      const [file, title] = [reference.slice(0, reference.indexOf('::')), reference.slice(reference.indexOf('::') + 2)];
      if (!title.trim()) throw new Error(`${adapter}.${name}: conformance names no test`);
      const suite = report.testResults.find(f => relative(process.cwd(), f.name) === file);
      if (!suite) throw new Error(`${adapter}.${name}: conformance names a file this run did not execute: ${file}`);
      const passing = suite.assertionResults.filter(t => t.fullName.includes(title) && t.status === 'passed');
      if (!passing.length) throw new Error(`${adapter}.${name}: no PASSING test in ${file} whose title contains '${title}'`);
      rows.push({ adapter, capability: name, file, title, passing: passing.length });
    }
  }
  if (!rows.length) throw new Error('no supported capability declared a conformance fixture');
  return rows;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sources = Object.fromEntries(readdirSync('src/operator').filter(name => name.endsWith('.ts'))
    .map(name => [`src/operator/${name}`, readFileSync(`src/operator/${name}`, 'utf8')]));
  const issues = inspectOperatorCore(sources); if (issues.length) throw new Error(issues.join('\n'));
  const declarations = JSON.parse(readFileSync('src/operator/operator.declarations.json', 'utf8'));
  if (!declarations.length || declarations.some(row => row.status !== 'dark' || row.holds?.length)) throw new Error('operator declarations falsely claim held/live activation');
  const rows = checkP11Coverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log('| Check | Status | Executed test files |'); console.log('|---|---|---|');
  for (const row of rows) console.log(`| ${row.id} | ${row.status} | ${[...new Set(row.tests.map(t => t.file))].join('; ') || '—'} |`);
  const conformance = checkCapabilityConformance(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log(`${conformance.length} supported adapter capabilities each bound to a specific PASSING test.`);
  console.log(`${rows.length} P11 checks mapped to passing executable fixtures across unit, integration and lifecycle tiers. `
    + 'All dispositions remain partial; no held or live activation claim is emitted.');
}
