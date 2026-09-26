import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
/** Additive seam dispositions. These never relabel whole-owner or P12 contracts. */
export const modelProviderHolds = Object.freeze([
  'NON-EXECUTABLE-UNTIL-production-boot-credential-custody',
  'NON-EXECUTABLE-UNTIL-six-retry-eligibility-row-26',
  'NON-EXECUTABLE-UNTIL-delete-message-and-typed-payload-seam',
  'NON-EXECUTABLE-UNTIL-P12-owner-relabeling',
  'NON-EXECUTABLE-UNTIL-spend-cap-freeze-unfreeze-row-15',
  'NON-EXECUTABLE-UNTIL-worker-input-and-approval-prompt-row-21',
  'NON-EXECUTABLE-UNTIL-harness-operation-variants-row-29',
  'NON-EXECUTABLE-UNTIL-post-compaction-continuity-row-8',
  'NON-EXECUTABLE-UNTIL-inert-legacy-send-evidence-row-16',
  'NON-EXECUTABLE-UNTIL-maximum-disposition-row-19',
  'NON-EXECUTABLE-UNTIL-six-readCurrentAuthority-consumption',
  'NON-EXECUTABLE-UNTIL-single-recipient-ephemeral-audience',
  'NON-EXECUTABLE-UNTIL-effect-checkpoint-and-bounded-maintenance',
]);
export const modelProviderArms = Object.freeze({
  seven: ['versioned preparation before admission', 'guarded Eight receipt recording', 'version-one request remains readable'],
  eight: ['closed provider payload beside ordinary reply', 'Six preparation/adoption/one-use claim', 'Seven receipt and Eight observation', 'settlement from Nine guarded owner view'],
  nine: ['real object-valued digest Evidence assessment', 'current synchronous effect assessment consumption'],
  ten: ['confined local HTTP test route', 'consumed claim plus persisted Eight acceptance', 'exact submitted bytes and one captured return; zero retries'],
});
export function checkModelProviderCoverage(report, owner) {
  if (!report.success) throw new Error('model-provider seam requires successful actual gate; never label red green');
  if (!modelProviderArms[owner]) throw new Error('unknown model-provider owner');
  const defect = 'docs/defects/model-provider-return-capture-flake.md';
  const quarantineTitle = `MODEL-PROVIDER-PATH REVIEW lifecycle SIGKILL return-capture — SKIPPED: Rule 37 return-capture flake; ${defect}`;
  const quarantineFile = resolve('tests/e2e/model-provider-review.test.ts');
  const tests = report.testResults.flatMap(file => file.assertionResults.filter(t => t.fullName.includes('MODEL-PROVIDER-PATH'))
    .map(t => ({ file: file.name, title: t.fullName, status: t.status })));
  const quarantined = tests.filter(t => resolve(t.file) === quarantineFile && t.title === quarantineTitle
    && (t.status === 'pending' || t.status === 'skipped'));
  if (quarantined.length !== 1 || !existsSync(defect))
    throw new Error('model-provider return-capture quarantine requires the exact skipped case and defect record');
  for (const tier of ['unit refusal:', 'integration real owners', 'lifecycle SIGKILL']) {
    const matching = tests.filter(t => t.title.includes(tier));
    if (!matching.length || matching.some(t => t.status !== 'passed' && t !== quarantined[0]))
      throw new Error(`model-provider ${owner}: missing passing ${tier}`);
  }
  for (const refusal of ['missing submitted bytes', 'changed submitted bytes', 'mismatched request', 'mismatched attempt',
    'mismatched operation', 'stale generation', 'stale fence', 'stale standing', 'unavailable capture', 'unapproved provider route',
    'exceeded input bound', 'missing consumed claim', 'hidden retry', 'provider timeout', 'missing receipt', 'unknown charge', 'absent Nine assessment',
    'stale assessment', 'tainted assessment', 'withdrawn assessment', 'differently-bound assessment']) {
    if (!tests.some(t => t.title.includes(refusal) && t.status === 'passed')) throw new Error(`model-provider missing executed refusal ${refusal}`);
  }
  const cuts = ['seven-request', 'seven-prepared', 'eight-request', 'prepared', 'dispatch-claimed', 'consumed',
    'executor-accepted', 'return-capture', 'seven-receipt', 'nine-request', 'seven-resolution'];
  for (const cut of cuts) {
    const matching = tests.filter(t => t.title === `MODEL-PROVIDER-PATH REVIEW lifecycle SIGKILL ${cut}`
      || (cut === 'return-capture' && t.title === quarantineTitle));
    if (matching.length !== 1 || (cut === 'return-capture' ? matching[0] !== quarantined[0] : matching[0].status !== 'passed'))
      throw new Error(`model-provider missing executed lifecycle cut ${cut}`);
  }
  const cases = [...Array.from({ length: 12 }, (_, i) => `V${i + 1}`),
    ...Array.from({ length: 5 }, (_, i) => `V${i + 13}L`),
    ...['taints', 'captureStatuses', 'predecessors'].map(field => `V18-${field}`),
    ...Array.from({ length: 6 }, (_, i) => `V${i + 19}`), 'F6-reply',
    ...cuts.map(cut => `cut-${cut}`)];
  const proofs = cases.filter(id => id !== 'cut-return-capture').map(id => {
    const proof = JSON.parse(readFileSync(`.model-provider-review-proofs/${id}.json`, 'utf8'));
    if (proof.id !== id || !proof.passed || proof.assertions < 1 || proof.startedAt < report.startTime
      || proof.finishedAt < proof.startedAt) throw new Error(`model-provider missing current assertion proof ${id}`);
    for (const [path, hash] of Object.entries(proof.sources)) {
      if (createHash('sha256').update(readFileSync(path)).digest('hex') !== hash)
        throw new Error(`model-provider proof source changed: ${id} ${path}`);
    }
    return { id, assertions: proof.assertions };
  });
  return { owner, status: 'executable-local-test-only-with-rule-37-quarantine', arms: modelProviderArms[owner], holds: modelProviderHolds,
    proofs, quarantine: [{ id: 'cut-return-capture', status: quarantined[0].status, defect }],
    providerCalls: 'one in positive and each executed post-invocation SIGKILL fixture; return-capture unexecuted, zero replay', tests };
}
