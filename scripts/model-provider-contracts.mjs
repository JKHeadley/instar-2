/** Additive seam dispositions. These never relabel whole-owner or P12 contracts. */
export const modelProviderHolds = Object.freeze([
  'NON-EXECUTABLE-UNTIL-production-boot-credential-custody',
  'NON-EXECUTABLE-UNTIL-six-retry-eligibility-row-26',
  'NON-EXECUTABLE-UNTIL-delete-message-and-typed-payload-seam',
  'NON-EXECUTABLE-UNTIL-P12-owner-relabeling',
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
  const tests = report.testResults.flatMap(file => file.assertionResults.filter(t => t.fullName.includes('MODEL-PROVIDER-PATH'))
    .map(t => ({ file: file.name, title: t.fullName, status: t.status })));
  for (const tier of ['unit refusal:', 'integration real owners', 'lifecycle SIGKILL']) {
    const matching = tests.filter(t => t.title.includes(tier));
    if (!matching.length || matching.some(t => t.status !== 'passed')) throw new Error(`model-provider ${owner}: missing passing ${tier}`);
  }
  for (const refusal of ['missing submitted bytes', 'changed submitted bytes', 'mismatched request', 'mismatched attempt',
    'mismatched operation', 'stale generation', 'stale fence', 'stale standing', 'unavailable capture', 'unapproved provider route',
    'exceeded input bound', 'missing consumed claim', 'hidden retry', 'provider timeout', 'missing receipt', 'unknown charge', 'absent Nine assessment',
    'stale assessment', 'tainted assessment', 'withdrawn assessment', 'differently-bound assessment']) {
    if (!tests.some(t => t.title.includes(refusal) && t.status === 'passed')) throw new Error(`model-provider missing executed refusal ${refusal}`);
  }
  return { owner, status: 'executable-local-test-only', arms: modelProviderArms[owner], holds: modelProviderHolds,
    providerCalls: 'one in positive and each post-invocation SIGKILL fixture, zero replay', tests };
}
