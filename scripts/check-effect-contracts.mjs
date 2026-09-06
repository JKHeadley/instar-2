import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exercised = new Set(['01','02','03','04','05','06','08','09','10','13','14','15','16','17','18','19','20','21','22','23','24','25','26','31','35','37','38','39','40','42','46','49']);
const excluded = {
  '07': 'Free-form commands and partial batch modes are outside the one-reply slice.',
  '32': 'Target-conditional mutation is explicitly deferred per PR 23.',
  '33': 'Protected artifact mutation is explicitly outside this reply-only slice.',
  '36': 'Batches and compensation are outside one outbound reply.',
  '43': 'Independent infrastructure/repair domain is outside this one-reply assembly.',
  '48': 'Multi-tenant fair scheduling and fleet measurement are outside the one-domain fixture.',
};
const gaps = {
  '11': 'P10 credential confinement/maintenance isolation not implemented by this fixture.',
  '12': 'Full paid-supervision primitive composition is not available on this base.',
  '27': 'Response captures use two fsync directories; full origin-loss/custody policy matrix is not implemented.',
  '28': 'P4 stop owner is not merged on this base; fixture tests final local stop only.',
  '29': 'Transitive provisional/reconciliation dispatch matrix is not implemented; P2-NF-73 remains explicitly skipped.',
  '30': 'P2 status snapshot is consumed; complete evidence withdrawal/reconciliation integration remains unbuilt.',
  '34': 'Late receipt recording exists but separately scoped production observer standing is not implemented.',
  '41': 'Advisory P7 style/coalescing and attention-cap consumer are not composed here.',
  '44': 'Production credential custody and identity isolation are absent; fixture uses no secrets or actual destination.',
  '45': 'No live Telegram/independent witness or production isolation claim; explicitly dark.',
  '47': 'Bounded pure P2 scan is used; cross-architecture effect-view fixture not yet implemented.',
};
export const effectDispositions = Array.from({ length: 49 }, (_, i) => {
  const number = String(i + 1).padStart(2, '0');
  return { id: `P8-NF-${number}`, status: exercised.has(number) ? 'partial' : excluded[number] ? 'out-of-scope' : 'not-built',
    reason: excluded[number] ?? gaps[number] ?? 'Named executable slice assertions only; not full-design or production conformance.' };
});
export function checkEffectCoverage(report, dispositions = effectDispositions) {
  if (!report.success) throw new Error('effect coverage requires a successful actual test run');
  if (dispositions.length !== 49 || new Set(dispositions.map(r => r.id)).size !== 49) throw new Error('missing/duplicate disposition');
  return dispositions.map(row => {
    if (!['partial', 'out-of-scope', 'not-built'].includes(row.status) || !row.reason) throw new Error('unsupported held claim');
    const tests = report.testResults.flatMap(f => f.assertionResults.filter(t =>
      (t.fullName.match(/\bP8-NF-\d+\b/g) ?? []).includes(row.id)).map(t => ({ title: t.fullName, status: t.status })));
    if (row.status === 'partial' && (!tests.length || tests.some(t => t.status !== 'passed'))) throw new Error(`missing executed fixture ${row.id}`);
    return { ...row, tests };
  });
}
export function inspectEffects(sources) {
  const failures = [];
  for (const [path, source] of Object.entries(sources)) {
    if (/from ['"]\.\.\/(?:transport|facts|register)\/(?!index\.js)/.test(source)) failures.push(`${path}: private sibling import`);
    if (/\b(?:interface|type|class)\s+(?:Outcome|Result|AdmissionReservation|DispatchClaim|Run|EvidenceAcceptance)\b/.test(source)) failures.push(`${path}: foreign owner`);
    if (/\b(?:fetch|setTimeout|setInterval)\s*\(/.test(source)) failures.push(`${path}: ambient execution`);
  }
  return failures;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sources = Object.fromEntries(readdirSync('src/effects').filter(f => f.endsWith('.ts')).map(f => [f, readFileSync(`src/effects/${f}`, 'utf8')]));
  const issues = inspectEffects(sources); if (issues.length) throw new Error(issues.join('\n'));
  const rows = checkEffectCoverage(JSON.parse(readFileSync('.test-results.json', 'utf8')));
  console.log(`P8: ${rows.filter(r => r.status === 'partial').length} partially exercised checks; all ${rows.length} dispositions explicit; no held/live claim`);
}
