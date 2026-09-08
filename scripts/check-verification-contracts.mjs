import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const seam = new Set([8, 11, 13, 26, 27, 29, 30, 32, 33, 34, 37, 38, 40, 44, 45, 46, 47, 58, 60, 62]);
const protection = new Set([15, 16, 51, 52, 53, 54, 55, 56]);
export const verificationDispositions = Array.from({ length: 63 }, (_, index) => {
  const n = index + 1;
  const reason = seam.has(n)
    ? 'Executable owner-side reference behavior is present, but a filed Part Five/Six/Seven seam or independently approved production activation remains unresolved.'
    : protection.has(n)
      ? 'Transactional prevention and negative fixtures execute; actual OS/service administrative separation remains deployment evidence and the declaration stays dark.'
      : 'Executable unit/full-port/lifecycle reference behavior is present; the draft contract forbids treating author tests as production certification.';
  return { id: `P9-NF-${String(n).padStart(2, '0')}`, status: 'partial', reason };
});

export function checkVerificationCoverage(report, dispositions = verificationDispositions) {
  if (!report.success) throw new Error('verification mapping requires a successful actual test run');
  if (dispositions.length !== 63 || new Set(dispositions.map(row => row.id)).size !== 63) throw new Error('missing or duplicate P9 disposition');
  return dispositions.map(row => {
    if (row.status !== 'partial' || !row.reason) throw new Error(`invented held or unexplained P9 disposition: ${row.id}`);
    const tests = report.testResults.flatMap(file => (file.assertionResults ?? []).filter(test =>
      (test.fullName.match(/\bP9-NF-\d+\b/g) ?? []).includes(row.id)).map(test => ({ file: file.name, title: test.fullName, status: test.status })));
    if (!tests.length || tests.some(test => test.status !== 'passed')) throw new Error(`missing executed passing fixture: ${row.id}`);
    return { ...row, tests };
  });
}

const owned = new Set(['VerificationPlan', 'VerificationRequest', 'VerificationAssessment', 'ProbeRecord',
  'RetrospectiveReviewRecord', 'SemanticReviewRecord', 'Grade', 'AssessmentClosure', 'FeedbackDisposition', 'BenchmarkEvaluation']);
const foreign = new Set(['Decision', 'Measurement', 'Evidence', 'Result', 'Outcome', 'Authorization', 'Conflict',
  'Run', 'RunExit', 'Lease', 'FenceToken', 'AdmissionReservation', 'LoopPolicy', 'JudgmentRequest', 'BenchmarkRecord',
  'BenchmarkScenario', 'BenchmarkRunRecord', 'EffectRequest', 'EffectSettlement']);
export function inspectVerificationCore(sources) {
  const issues = [];
  const counts = new Map([...owned].map(name => [name, 0]));
  for (const [path, source] of Object.entries(sources)) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
        if (owned.has(node.name.text) && path.endsWith('/contracts.ts')) counts.set(node.name.text, counts.get(node.name.text) + 1);
        else if (owned.has(node.name.text)) issues.push(`${path}: duplicate nine-owned type ${node.name.text}`);
        if (foreign.has(node.name.text)) issues.push(`${path}: foreign-owned type ${node.name.text}`);
      }
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        if (specifier.startsWith('../') && (specifier.includes('/doorway') || specifier.includes('/authority') || specifier.includes('/service')))
          issues.push(`${path}: private sibling import ${specifier}`);
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
  const source = Object.fromEntries(readdirSync('src/verification').filter(name => name.endsWith('.ts'))
    .map(name => [`src/verification/${name}`, readFileSync(`src/verification/${name}`, 'utf8')]));
  const issues = inspectVerificationCore(source); if (issues.length) throw new Error(issues.join('\n'));
  const declarations = JSON.parse(readFileSync('src/verification/verification.declarations.json', 'utf8'));
  if (declarations.some(row => row.id === 'verification.core' || row.holds?.length))
    throw new Error('verification activation/declaration honesty changed before the protected owner-reference seam');
  const rows = checkVerificationCoverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  for (const row of rows) console.log(`${row.id}: ${row.status}; ${row.tests.length} executed fixtures; ${row.reason}`);
}
