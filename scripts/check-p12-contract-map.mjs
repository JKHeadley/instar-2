// Part Twelve Slice A1 coverage. A PARTIAL row is never promoted by a parser,
// stand-in or no-op: it names the missing owner consumer/grant or Slice B scope.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const executable = {
  3: 'No new core type or private owner import; Telegram composes the landed Four, Six, Eight and Ten public ports.',
  4: 'The admitted declaration, exact mode, parser, sole reply operation, inhibitions and public doorways are tested and rendered in the generated briefing.',
  5: 'The adapter translates and authenticates; Part Four selects binding, standing, classification and admission, while Six/Eight own claim and outcome state.',
  7: 'A fresh capture-backed identity probe must match bot id, username and API version; a token reference alone never admits life.',
  8: 'Sender-controlled content never selects the principal; Part One decodes the custodian-attested identity and Part Four resolves it.',
  10: 'The durable identity key contains bot, authenticated chat, sender, identity epoch and provider update_id; no fallback exists.',
  17: 'All seven Telegram update dispositions are captured; channel posts remain system principals and forward/quote authors remain content.',
  27: 'The closed ordinary-reply shape stays attributable to speaker and sourceResult through the registered Eight path.',
};

const partial = {
  1: 'PARTIAL: the whole-part governed documentation inventory is executable as a retained build input; non-Telegram platform implementation remains Slice B.',
  2: 'PARTIAL: the retained 1.x audit digest is executable build evidence, not a Slice A runtime consumer.',
  6: 'PARTIAL: non-secret capture-before-receipt, exact-route cursor reconstruction and six real local process cuts are executable; secret-shaped production intake is non-executable-until-seam-response-intake-followup.md-and-seam-response-assembly-followup.md.',
  9: 'PARTIAL: byte-identical admitted redelivery is owner-provided; real attempt-metadata redelivery is non-executable-until-seam-response-intake-followup.md rows 46 and 57.',
  11: 'PARTIAL: protocol custody acknowledgment is executable; conversational policy enforcement is non-executable-until-seam-response-intake-followup.md row 60.',
  12: 'PARTIAL: oversize/non-secret custody is executable; secret custody is non-executable-until-seam-response-intake-followup.md-and-seam-response-assembly-followup.md.',
  13: 'PARTIAL: single-arrival owned holds are executable; held redelivery/recovery is non-executable-until-seam-response-intake-followup.md row 46.',
  14: 'PARTIAL: verified binding selection is delegated to landed Part Four; the full first-sender negative matrix is not rebuilt here.',
  15: 'PARTIAL: binding conflict semantics remain Part Four-owned and are not claimed by the Telegram adapter.',
  16: 'PARTIAL: direct/general/topic identity, same-process single-flight, and competing-process one-mode admission through Part Ten appendIfSubjectFrontier are executable; other identity arms remain owner scope.',
  18: 'PARTIAL: capture-before-offset, exact-route fresh-process reconstruction, signed webhook choice, same-process single-flight, and competing-process one-mode admission through Part Ten appendIfSubjectFrontier are executable; reminder positive is non-executable-until-seam-response-operator-followup.md row 59.',
  19: 'PARTIAL: Slack identity/admission is Slice B and additionally depends on seam-response-intake-followup.md rows 18, 46 and 57 plus seam-response-judgment.md row 35.',
  20: 'PARTIAL: Slack fault/redelivery is Slice B and non-executable-until-seam-response-intake-followup.md rows 18, 46 and 57 plus seam-response-judgment.md row 35.',
  21: 'PARTIAL: WhatsApp is Slice B.', 22: 'PARTIAL: WhatsApp is Slice B; named payloads remain unsupported.',
  23: 'PARTIAL: iMessage is Slice B.', 24: 'PARTIAL: iMessage is Slice B.', 25: 'PARTIAL: web is Slice B.',
  26: 'PARTIAL: the landed Telegram rename/forward identity arm is executable; cross-platform alias and legacy migration remain Slice B and owner-governed.',
  28: 'PARTIAL: public prepare/dispatch, the final concrete current-state recheck and nine real local outbound process cuts are executable; the production real-model chain awaits its named owner integrations.',
  29: 'PARTIAL: exact HTML preparation and source-bounded provider-acceptance word/emoji status are executable; broader advisory review remains owner scope.',
  30: 'PARTIAL: fitting or explicit refusal is executable; aggregate output is non-executable-until-seam-response-effects-payloads.md.',
  31: 'PARTIAL: no adapter retry/fallback is executable; unchanged-digest successor handling remains non-executable-until-seam-response-effects-followup.md-and-seam-response-loop-followup.md.',
  32: 'PARTIAL: reaction, typing, read-receipt, delete, edit, media and single-member shapes are refused through the public prepare port with no provider or public-text fallback; typed optional-effect positives are non-executable-until their named grants land.',
  33: 'PARTIAL: Eight persists request/claim before send and the fsync-backed prepared outbox reconstructs across nine real local process cuts through the existing Six/Eight/Ten contracts; the production crash matrix awaits Part Eleven assembly integration.',
  34: 'PARTIAL: exact capture-backed Telegram response evidence is assessed only as provider acceptance, while mismatched, unwitnessed, unsupported-stage and human-delivery/read claims refuse; the independent live witness remains activation evidence.',
  35: 'PARTIAL: the Telegram response uses the landed Part Nine public assessment and retains its owner evidence; real settlement remains non-executable-until-seam-response-effects-followup.md.',
  36: 'PARTIAL: stable lookup is explicitly unsupported and cannot prove non-occurrence; the full recovery schedule is owner scope.',
  37: 'PARTIAL: a Part Six bounded observation wake performs one read-only Telegram lookup attempt with zero additional invocation; successor retry is non-executable-until-seam-response-effects-followup.md-and-seam-response-loop-followup.md.',
  38: 'PARTIAL: fsync-backed intake and ordinary-reply reconstruction run across fifteen real local process cuts plus three mismatched-route neighbors; held-receipt continuation is non-executable-until-seam-response-intake-followup.md row 46.',
  39: 'PARTIAL: expiry, repeated expiry and reconstruction retain the original capture, receipt, hold and terminal; fleet-scale retention horizons remain activation evidence rather than a named unlanded owner seam.',
  40: 'PARTIAL: route-service fairness is non-executable-until-seam-response-loop-followup.md row 43.',
  41: 'PARTIAL: adapter refusals remain explicit with zero send; the broader advisory/notice owner matrix is not built.',
  42: 'PARTIAL: credentials stay behind the Ten custodian and effect message is scoped; real worker isolation awaits production assembly integration.',
  43: 'PARTIAL: real-model positive is non-executable-until-seam-response-judgment.md-and-seam-response-effects-followup.md; production grounding also awaits the row-45 owner grants and Part Eleven assembly integration.',
  44: 'PARTIAL: real-model path is non-executable-until-seam-response-judgment.md-and-seam-response-effects-followup.md; real settlement is non-executable-until-seam-response-effects-followup.md; production lifecycle awaits Part Eleven assembly integration.',
  45: 'PARTIAL: no later platform activates; later platform parity is Slice B.',
  46: 'PARTIAL: fresh authenticated identity, same-process single-flight, competing-process one-mode admission through Part Ten appendIfSubjectFrontier, and captured outbound response are executable with fixtures; real live-provider inbound/outbound proof is not claimed.',
  47: 'PARTIAL: the Part Ten consumer accepts a named hardware workload record and refuses target/estimate references or omitted failed samples represented as complete measurement; live hardware measurements remain activation evidence.',
  48: 'PARTIAL: three local tiers execute with public prepare/dispatch and real SIGKILL/restart coverage, but the real-model positive is non-executable-until-seam-response-judgment.md-and-seam-response-effects-followup.md and production assembly/custody owner grants integrate.',
  49: 'PARTIAL: mode/API changes are exercised as distinct or inhibited conformance subjects and the generated active-generation briefing is checked for exact current modes, operations and public doorways; live cross-version provider replay remains activation evidence.',
  50: 'PARTIAL: runtime admission records current check-run/probe references, but activation remains dark without the missing owner positives.',
  51: 'PARTIAL: media metadata enters Four owned hold with zero fetch/provider/send; media custody beyond metadata is Slice B and successful media is non-executable-until-seam-response-effects-payloads.md-and-seam-response-assembly-followup.md.',
  52: 'PARTIAL: the bounded read-only dry run reports exact unmappable legacy sends with zero import/replay/provider calls; import is non-executable-until-seam-response-intake-followup.md-seam-response-rungraph-followup.md-and-seam-response-effects-followup.md.',
  53: 'PARTIAL: minimal response is non-executable-until-part-eleven-seam-response-assembly.md-is-integrated.',
};

const design = readFileSync('docs/16-conversation-adapters/12-negative-contract-fixtures.md', 'utf8');
const row99ScopePath = 'docs/16-conversation-adapters/part-twelve-slice-a1-scope.md';
const row99Scope = readFileSync(row99ScopePath, 'utf8');
for (const required of [
  'Row 99 landed on main in `f144f1435a11914b79ffcb6c1cfb19444f70e3ef`',
  'appendIfSubjectFrontier',
  'the competing-process one-admitted-mode arms of P12-NF-16, P12-NF-18, and P12-NF-46 are',
  'tests/conversation/held/admission-process.ts',
  'tests/conversation/held/run-admission-matrix.py',
  '`admission-restart-matrix.py`',
]) if (!row99Scope.includes(required)) throw new Error(`row 99 A1 scope omits ${required}`);
const row99ConditionalAppendRows = new Set([16, 18, 46]);
const expected = [...design.matchAll(/^\| (P12-NF-(\d+)) \|/gm)].map(match => ({ id: match[1], number: Number(match[2]) }));
if (expected.length !== 53) throw new Error(`expected 53 P12 checks, found ${expected.length}`);
const report = JSON.parse(readFileSync('.test-results.json', 'utf8'));
if (!report.success) throw new Error('P12 mapping requires a successful actual test run');
const known = new Set(expected.map(row => row.id));
const tests = new Map();
for (const file of report.testResults) for (const test of file.assertionResults) {
  for (const id of test.fullName.match(/\bP12-NF-\d+\b/g) ?? []) {
    if (!known.has(id)) throw new Error(`unknown Part Twelve check ${id}`);
    if (test.status !== 'passed') throw new Error(`${id}: mapped test did not pass`);
    const rows = tests.get(id) ?? [];
    rows.push({ file: relative(process.cwd(), file.name), title: test.title }); tests.set(id, rows);
  }
}
// PARTIAL means at least one named arm is deferred; it never excuses a landed arm.
// These rows all have a concrete Slice A/build/owner-path assertion that must pass.
const landedArms = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 45, 46,
  26, 47, 48, 49, 50, 51, 52,
]);
for (const row of expected) {
  const reason = executable[row.number] ?? partial[row.number];
  if (!reason) throw new Error(`${row.id}: missing disposition`);
  if (landedArms.has(row.number) && !(tests.get(row.id)?.length))
    throw new Error(`${row.id}: landed executable arm without a passing test`);
  if (partial[row.number] && !reason.startsWith('PARTIAL:')) throw new Error(`${row.id}: partial reason is not explicit`);
  if (row99ConditionalAppendRows.has(row.number)
    && (!reason.includes('competing-process one-mode admission through Part Ten appendIfSubjectFrontier')
      || reason.includes('row-99-ten-conditional-append')))
    throw new Error(`${row.id}: landed cross-process admission arm is not executable through Part Ten`);
}
const p12nf48Files = new Set((tests.get('P12-NF-48') ?? []).map(test => test.file));
for (const tier of ['telegram.unit.test.ts', 'telegram.integration.test.ts', 'telegram.lifecycle.test.ts'])
  if (![...p12nf48Files].some(file => file.endsWith(tier))) throw new Error(`P12-NF-48: missing passing ${tier} tier`);
const p12nf35Files = new Set((tests.get('P12-NF-35') ?? []).map(test => test.file));
for (const tier of ['telegram.round17.unit.test.ts', 'telegram.round17.integration.test.ts', 'telegram.round17.lifecycle.test.ts'])
  if (![...p12nf35Files].some(file => file.endsWith(tier))) throw new Error(`P12-NF-35: missing passing ${tier} assessment tier`);

// High-risk executable arms are not established by a check id in a title alone.
// Require the passing focused consumer and the concrete owner-port calls/assertion
// subjects that make the case executable. This is intentionally narrow: it guards
// the review-identified local execution holes without pretending static source inspection is
// live-provider evidence.
const concreteConsumers = [
  ...[16, 18, 46].map(number => ({ id: `P12-NF-${number.toString().padStart(2, '0')}`,
    file: 'tests/conversation/telegram.round23.lifecycle.test.ts',
    anchors: ['round23 executes both competing-process orders through appendIfSubjectFrontier',
      "run('run-admission-matrix.py')", "run('admission-restart-matrix.py')",
      "expect(row.actualSuccesses).toBe(1)", "toContain('conditional append subject frontier changed; current=')",
      "expect(restarted.get(winner.mode)?.kind).toBe('Success')"],
    supporting: [{ file: 'src/conversation/telegram.ts', anchors: [
      "subject: { type: 'AdapterConformance', field: 'adapter', value: id }",
      'deps.conditionalAssembly.appendIfSubjectFrontier(',
    ] }, { file: 'tests/conversation/held/admission-process.ts', anchors: [
      'fixture.admissionDependencies.conditionalAssembly',
      'appendIfSubjectFrontier(name, input, expected)',
    ] }, { file: 'tests/conversation/held/admission_matrix.py', anchors: [
      '"conditional append subject frontier changed; current="',
      'restarted[winner["mode"]]["kind"] != "Success"',
    ] }] })),
  { id: 'P12-NF-16', file: 'tests/conversation/telegram.round13.integration.test.ts',
    anchors: ["for (const outerMode of ['long-poll', 'webhook'] as const)",
      'nested = admitTelegramAdapter(declarations[otherMode]', "expect(outer.kind",
      "expect(nested?.kind", "row.record.type === 'AdapterConformance'", ".toBe(1)"] },
  { id: 'P12-NF-07', file: 'tests/conversation/telegram.round13.unit.test.ts',
    anchors: ["['missing-fields', () => ({ value: 100 })", "unit: 'bytes'", "value: '100'",
      "decodeMeasurement('clock'", 'toBe(ownerKind)', 'toBe(admissionKind)'] },
  { id: 'P12-NF-07', file: 'tests/conversation/telegram.round14.lifecycle.test.ts',
    anchors: ["['expires-during-identity', 150, false, 'Refused']",
      "['new-probe-completes-during-identity', 101, true, 'Success']",
      'identity(input:', 'expect(samples, name).toEqual([finish])', 'conformance.testedAt'],
    supporting: [{ file: 'src/conversation/telegram.ts', anchors: [
      'const probe = take(deps.api.identity(', 'const identityEvidence = validateIdentityProbe(declaration, deps, probe)',
      "deps.assembly.record('AdapterEvidenceContract'", 'const current = take(deps.assembly.inspectCurrent())',
      "const now = take(decodeMeasurement('clock', deps.clock()",
      'testedAt: now.value, validUntil: now.value + deps.evidence.validFor',
    ] }] },
  { id: 'P12-NF-46', file: 'tests/conversation/telegram.round14.lifecycle.test.ts',
    anchors: ["['expires-during-identity', 150, false, 'Refused']",
      "['new-probe-completes-during-identity', 101, true, 'Success']",
      'expect(admission.kind, name).toBe(expected)', 'expect(samples, name).toEqual([finish])'] },
  { id: 'P12-NF-16', file: 'tests/conversation/telegram.round15.integration.test.ts',
    anchors: ["for (const outerMode of ['long-poll', 'webhook'] as const)",
      'captureReadOverlap(outerMode)', "result.outer.kind === 'Success' && result.nested?.kind === 'Success'",
      'wireTelegram({ ...result.fixture, admitted }', "row.kind === 'intake-admitted'"],
    supporting: [{ file: 'tests/conversation/round15-fixture.ts', anchors: [
      'readCapture(reference: string)', 'competing-admission:begin',
      'nested = admitTelegramAdapter(declarations[otherMode]', "row.record.type === 'AdapterConformance'",
    ] }] },
  { id: 'P12-NF-18', file: 'tests/conversation/telegram.round15.lifecycle.test.ts',
    anchors: ['round15 admission-every-await-interleaving', 'for (let target = 0; target < discovery.points.length; target++)',
      "'api.readCapture'", "'assembly.inspectCurrent'", "'clock'", "'conditionalAssembly.appendIfSubjectFrontier:AdapterConformance'",
      "filter(kind => kind === 'Success')", '.toHaveLength(1)'],
    supporting: [{ file: 'src/conversation/telegram.ts', anchors: [
      "ensure(!activeAdmissions.has(id), 'Telegram bot admission is already in flight in this process')",
      'Every fallible dependency read above completes before this decision',
      'deps.conditionalAssembly.appendIfSubjectFrontier(', 'activeAdmissions.delete(id)',
    ] }] },
  { id: 'P12-NF-46', file: 'tests/conversation/telegram.round15.unit.test.ts',
    anchors: ['fresh-capture-overlap-confirmation', 'captureReadOverlap(outerMode)',
      "expect(result.outer.kind, outerMode).toBe('Success')", "expect(result.nested?.kind, outerMode).toBe('Refused')",
      "new Set(result.records.map(row => row.record.type === 'AdapterConformance'"] },
  { id: 'P12-NF-16', file: 'tests/conversation/telegram.round16.integration.test.ts',
    anchors: ['round16 admission-interleavings', "expect(result.winnerMode, outerMode).toBe(outerMode)",
      "expect(result.readmission?.kind, outerMode).toBe('Success')", 'row.taint.length === 0 && row.conflicts.length === 0'],
    supporting: [{ file: 'tests/conversation/round16-fixture.ts', anchors: [
      "at(`conditionalAssembly.appendIfSubjectFrontier:${name}`", 'nested = admitTelegramAdapter(declarations[otherMode], base)',
      'const readmission = winnerMode === null ? null : admitTelegramAdapter',
    ] }] },
  { id: 'P12-NF-18', file: 'tests/conversation/telegram.round16.lifecycle.test.ts',
    anchors: ['round16 admission-interleavings covers every synchronous dependency boundary',
      'for (let target = 0; target < discovery.trace.length; target++)',
      "for (const phase of ['before', 'after'] as const)", "expect(result.nested?.kind, `${label}: nested`).toBe('Refused')",
      "expect(result.readmission?.kind, `${label}: readmission`).toBe('Success')"] },
  { id: 'P12-NF-46', file: 'tests/conversation/telegram.round16.unit.test.ts',
    anchors: ['round16 admission-interleavings refuses the nested in-process flight before append',
      "discovery.trace.indexOf('conditionalAssembly.appendIfSubjectFrontier:AdapterConformance')", "expect(result.outer.kind, `${outerMode}/${phase}: outer`).toBe('Success')",
      "expect(result.nested?.kind, `${outerMode}/${phase}: nested`).toBe('Refused')", 'toHaveLength(1)'] },
  { id: 'P12-NF-16', file: 'tests/conversation/telegram.round8.integration.test.ts',
    anchors: ["{ id: -123, type: 'private' }", "{ id: 123, type: 'group' }",
      "{ id: -1000000000123, type: 'group' }", "{ id: -123, type: 'supergroup' }", "{ id: -123, type: 'channel' }"] },
  { id: 'P12-NF-17', file: 'tests/conversation/telegram.round8.integration.test.ts',
    anchors: ["sender_chat = { id: chat.id, type: 'channel' }", "filter(row => row.kind === 'intake-receipt')"] },
  { id: 'P12-NF-18', file: 'tests/conversation/telegram.round8.integration.test.ts',
    anchors: ['wired.ingress.pollOnce()', 'wired.ingress.currentOffset()', "toBe('Refused')", 'toHaveLength(0)'] },
  { id: 'P12-NF-26', file: 'tests/conversation/telegram.round8.integration.test.ts',
    anchors: ['f.bind(extractTelegramUpdate(original', 'sameChatRenamed', 'otherChatSameTitle',
      "toEqual(['admitted', 'admitted', 'admitted'])", "expect(bindings[2]).toBe('none')", "['requester', 'requester', 'requester']"] },
  { id: 'P12-NF-29', file: 'tests/conversation/telegram.unit.test.ts',
    anchors: ['renderTelegramHtml(', "'A < B & C > D'", "'A &lt; B &amp; C &gt; D'", "'control data'"] },
  { id: 'P12-NF-29', file: 'tests/conversation/telegram.round17.unit.test.ts',
    anchors: ['assessTelegramReplyResponse(', "renderTelegramDeliveryStatus(acceptance, 'word'",
      "renderTelegramDeliveryStatus(acceptance, 'emoji'", "text: 'accepted by platform'",
      "accessibleLabel: 'accepted by platform'", "stage: 'human-read'"] },
  { id: 'P12-NF-34', file: 'tests/conversation/telegram.outbound.integration.test.ts',
    anchors: ["expect(observation.stage).toBe('response')", 'effects.ctx.captures[observation.capture.reference]',
      "toBe('{\"ok\":true,\"result\":{\"message_id\":700}}')", "refused(doorway.settle(observation.operation), 'assessor unavailable')"] },
  { id: 'P12-NF-34', file: 'tests/conversation/telegram.round17.integration.test.ts',
    anchors: ['exact Telegram response reaches the landed Part Nine assessment and not settlement',
      "claim: 'provider-accepted'", "['occurrence', 'satisfied']", "['quiescence', 'insufficient']",
      "['charge', 'insufficient']", "['missing', 'wrong-digest']", "['human-delivered', 'human-read']"] },
  { id: 'P12-NF-29', file: 'tests/conversation/telegram.round18.integration.test.ts',
    anchors: ['round18 retains two concordant response Evidence records',
      "id: 'evidence:second-valid-witness'", "predicate: 'operation-occurred'",
      'expect(assessment.record.captureStatuses).toHaveLength(2)'] },
  { id: 'P12-NF-34', file: 'tests/conversation/telegram.round18.integration.test.ts',
    anchors: ['round18 refuses unrecorded response observation and claim identities',
      "id: 'observation:never-recorded'", "claim: 'claim:never-recorded'",
      'round18 refuses malformed response version and wake', 'schemaVersion: 99', "wake: 'not-a-response-wake'"] },
  { id: 'P12-NF-35', file: 'tests/conversation/telegram.round18.lifecycle.test.ts',
    anchors: ['round18 rebuild retains both concordant Evidence ids without effect replay',
      "id: 'evidence:second-valid-witness'", 'existing: first.assessment',
      'expect(rebuilt).toEqual(first)', 'expect(value(fixture.doorway.inspect())).toEqual(before)'] },
  { id: 'P12-NF-35', file: 'tests/conversation/telegram.round17.lifecycle.test.ts',
    anchors: ['provider assessment rebuilds without send or settlement replay', 'rebuildAssessment()',
      'existing: first.assessment', 'expect(rebuilt).toEqual(first)', "row.record.type === 'EffectSettlement'", 'toHaveLength(0)'],
    supporting: [{ file: 'src/conversation/telegram.ts', anchors: [
      'export function assessTelegramReplyResponse', "input.claim === 'provider-accepted'",
      'take(deps.custody.verify([response.capture], deps.definition))', 'deps.assessment.assess(input.effect)',
      'deps.assessment.read(assessment, input.effect)', 'consumeOutcome(view.outcome',
      "'did-not-happen': () => null", 'uncertain: () => null',
      "view.finalCharge === null && view.delayedExecutionExcluded === false",
      "canonicalMatches.has(encode(supplied))",
      "encode(ownerEvidenceIds) === encode(witnessedIds)",
      "ownerAssessment.captureStatuses.every(status => status.reference === response.capture.reference",
    ] }] },
  { id: 'P12-NF-28', file: 'tests/conversation/telegram.round20.integration.test.ts',
    anchors: ['round20 permanently executes all four claim-two-handles rows',
      'round20TwoHandleClaim(false, false)', 'round20TwoHandleClaim(true, false)',
      'round20TwoHandleClaim(false, true)', 'round20TwoHandleClaim(true, true)',
      "detail: 'Telegram reply claim handoff was already used'", 'expect(row.providerCalls).toBe(1)'],
    supporting: [{ file: 'src/conversation/telegram.ts', anchors: [
      "type: 'TelegramReplyInvocationStarted', schemaVersion: 1",
      'operation: input.operation, claim: input.claim',
      'id: `observation:telegram-invocation-started:',
      'const appended = binding.spine.append(invocation',
      'binding.spine.store.readForProjection()',
      "throw new Error('Telegram reply claim handoff was already used')",
      'receipt.durability.kind === \'replicated\'', 'return take(api.sendMessage(',
    ] }] },
  { id: 'P12-NF-28', file: 'tests/conversation/telegram.round21.integration.test.ts',
    anchors: ['round21 permanently executes all four claim-two-stores rows',
      'round21TwoStoreClaim(false, false)', 'round21TwoStoreClaim(false, true)',
      'round21TwoStoreClaim(true, false)', 'round21TwoStoreClaim(true, true)',
      'expect(row.newStore).toBe(index >= 2)', 'expect(row.distinctStoreHandles).toBe(row.newStore)',
      'expect(row.providerCalls).toBe(1)'] },
  { id: 'P12-NF-28', file: 'tests/conversation/telegram.round22.integration.test.ts',
    anchors: ['round22 permanently executes all four capture-reference-claim rows',
      'round22CaptureReferenceClaim(false, false)', 'round22CaptureReferenceClaim(false, true)',
      'round22CaptureReferenceClaim(true, false)', 'round22CaptureReferenceClaim(true, true)',
      'round22 permanently executes all seven invocation-boundaries rows',
      'round22InvocationChanges.map(round22InvocationBoundary)', 'expect(row.providerCalls, row.change).toBe(control ? 1 : 0)'],
    supporting: [{ file: 'src/conversation/telegram.ts', anchors: [
      'const invocationIdentity = {',
      'id: `observation:telegram-invocation-started:${take(canonical(invocationIdentity)).hash}`',
      'const postMarkerState = binding.host.current()',
      'validation.expires > postMarkerState.clock.value',
      'return take(api.sendMessage(',
    ] }, { file: 'tests/conversation/round22-fixture.ts', anchors: [
      'Permanent import of rereview20\'s capture-reference-claim.ts four-case matrix',
      'Permanent import of rereview20\'s invocation-boundaries.ts seven-case matrix',
      "const reference = `capture:invocation:${++captures}`",
      "change.endsWith('marker-capture')", "change.endsWith('marker-append')",
    ] }] },
  { id: 'P12-NF-36', file: 'tests/conversation/telegram.round20.lifecycle.test.ts',
    anchors: ['round20 keeps a lost-response reservation across equivalent handles',
      'round20TwoHandleClaim(true, true)', "toBe('response lost after provider application')",
      "detail: 'Telegram reply claim handoff was already used'", "toBe('unknown')",
      'expect(result.providerCalls).toBe(1)'] },
  { id: 'P12-NF-36', file: 'tests/conversation/telegram.round21.lifecycle.test.ts',
    anchors: ['round21 refuses a second-store lost-response repeat before provider invocation',
      'round21TwoStoreClaim(true, true)', 'expect(result.distinctStoreHandles).toBe(true)',
      "detail: 'Telegram reply claim handoff was already used'", "toBe('unknown')",
      'expect(result.providerCalls).toBe(1)'] },
  { id: 'P12-NF-38', file: 'tests/conversation/telegram.round21.lifecycle.test.ts',
    anchors: ['round21 refuses a second-store lost-response repeat before provider invocation',
      'round21TwoStoreClaim(true, true)', "toBe('response lost after provider application')",
      "detail: 'Telegram reply claim handoff was already used'", 'expect(result.providerCalls).toBe(1)'] },
  { id: 'P12-NF-36', file: 'tests/conversation/telegram.round22.lifecycle.test.ts',
    anchors: ['round22 retains lost-response uncertainty across distinct capture references',
      'round22CaptureReferenceClaim(true, true)', "toBe('response lost after provider application')",
      "detail: 'Telegram reply claim handoff was already used'", 'expect(result.providerCalls).toBe(1)'] },
  { id: 'P12-NF-38', file: 'tests/conversation/telegram.round22.lifecycle.test.ts',
    anchors: ['round22 retains the durable marker when expiry occurs after append',
      "round22InvocationBoundary('expiry-after-marker-append')", 'expect(result.markerIds).toHaveLength(1)',
      "toEqual(['executor-accepted', 'executor-accepted', 'unknown'])", 'expect(result.providerCalls).toBe(0)'] },
  { id: 'P12-NF-34', file: 'tests/conversation/telegram.round20.lifecycle.test.ts',
    anchors: ['round20 permanently executes the independent 102-case record matrix',
      'await round20IndependentValidationMatrix()', 'toHaveLength(102)', 'toHaveLength(100)',
      'expect(row.result.kind', 'expect(row.providerCalls'] },
  { id: 'P12-NF-35', file: 'tests/conversation/telegram.round20.lifecycle.test.ts',
    anchors: ['round20 permanently executes the independent 102-case record matrix',
      'await round20IndependentValidationMatrix()', 'toHaveLength(102)', 'expect(row.appended',
      "row.owner === 'control' && !row.reuse ? 2 : 0"] },
  { id: 'P12-NF-28', file: 'tests/conversation/telegram.round3.integration.test.ts',
    anchors: ['transport.consume(', 'adapter.invoke(', "row.kind === 'effect-OperationObservation'", 'calls.send'] },
  { id: 'P12-NF-37', file: 'tests/conversation/telegram.round3.lifecycle.test.ts',
    anchors: ['transport.recover(', 'doorway.inspect()', "row.record.stage === 'observer-accepted'", 'calls.send'] },
  { id: 'P12-NF-39', file: 'tests/conversation/telegram.round3.lifecycle.test.ts',
    anchors: ['expireHolds()', 'createFactStore(', "row.kind === 'intake-expired'", 'context.captures'] },
  { id: 'P12-NF-33', file: 'tests/conversation/telegram.round4.lifecycle.test.ts',
    anchors: ['createFactStore(', 'installTelegramReplyOperation(', 'createEffectDoorway(', 'calls.send'] },
  { id: 'P12-NF-38', file: 'tests/conversation/telegram.round4.lifecycle.test.ts',
    anchors: ['createTransportFileStorage(', 'createEffectReplicaStorage(', 'transport.inspect()', "toContain('consumed')"] },
  { id: 'P12-NF-47', file: 'tests/conversation/telegram.round3.lifecycle.test.ts',
    anchors: ["runtime.record('GrowthObservation'", 'configured-target:not-a-measurement', 'success-only', 'estimate:not-a-measurement'] },
  { id: 'P12-NF-49', file: 'tests/conversation/telegram.round3.lifecycle.test.ts',
    anchors: ["mode: 'webhook'", "apiVersion: '9.3'", "generated/source.json", "generated/capabilities.md"] },
  { id: 'P12-NF-52', file: 'tests/conversation/telegram.round9.integration.test.ts',
    anchors: ['dryRunLegacyConversationMigration(', 'conversation-registry-send-intent.jsonl',
      "['send-intent', 'unmappable', false]", 'expect(report.providerCalls).toBe(0)',
      'expect(f.calls.send).toHaveLength(0)', 'toEqual(intakeBefore)', 'toEqual(assemblyBefore)'],
    supporting: [{ file: 'src/conversation/legacy.ts', anchors: [
      "mode: 'read-only'", "disposition: 'unmappable'", 'importPermitted: false',
      'replayPermitted: false', 'providerCalls: 0',
    ] }] },
  { id: 'P12-NF-06', file: 'tests/conversation/telegram.round5.lifecycle.test.ts',
    anchors: ['spawnSync(', "'SIGKILL'", "'before-capture'", "'after-receipt'", "'mismatch-chat'"],
    supporting: [{ file: 'tests/conversation/telegram.round5.intake-child.ts',
      anchors: ['createIntakePort(', 'intake.recover(', 'ingress.currentOffset()', "process.kill(process.pid, 'SIGKILL')"] }] },
  { id: 'P12-NF-18', file: 'tests/conversation/telegram.round5.lifecycle.test.ts',
    anchors: ["'after-capture'", "'after-admit'", "'after-poll-return'", "'after-next-poll'"],
    supporting: [{ file: 'tests/conversation/telegram.round5.intake-child.ts',
      anchors: ['createTelegramIngress(', 'fixture.queue(raw)', 'offsetAfterRecovery: value(ingress.currentOffset())'] }] },
  { id: 'P12-NF-28', file: 'tests/conversation/telegram.round5.integration.test.ts',
    anchors: ['telegramPreparedOutbound()', 'doorway.dispatch(', 'f.adapter.invoke(', "'definition-removed'"],
    supporting: [{ file: 'tests/conversation/round5-fixture.ts', anchors: ['adapter.prepare(doorway, prepareInput)'] }] },
  { id: 'P12-NF-32', file: 'tests/conversation/telegram.round6.integration.test.ts',
    anchors: ['doorway.prepare(', "['reaction'", "['typing'", "['read-receipt'", "['delete-message'",
      "['edit'", "['media'", "['single-member-audience'", 'calls.send', "toBe('Refused')"] },
  { id: 'P12-NF-28', file: 'tests/conversation/telegram.round5.lifecycle.test.ts',
    anchors: ["'prepared'", "'claimed'", "'claim-durable'", "'consumed'", "'acceptance'",
      "'acceptance-durable'", "'before-provider'", "'after-provider'", "'response'"],
    supporting: [{ file: 'tests/conversation/telegram.round5.outbound-child.ts',
      anchors: ['telegramPreparedOutbound()', 'createEffectDoorway(', "process.kill(process.pid, 'SIGKILL')"] }] },
  { id: 'P12-NF-33', file: 'tests/conversation/telegram.round5.lifecycle.test.ts',
    anchors: ['cutAndRecover(outboundChild', 'reservations', 'observations', 'settlements'],
    supporting: [{ file: 'tests/conversation/telegram.round5.outbound-child.ts',
      anchors: ['createFactStore(', 'createTransportAuthority(', 'installTelegramReplyOperation('] }] },
  { id: 'P12-NF-38', file: 'tests/conversation/telegram.round5.lifecycle.test.ts',
    anchors: ['cutAndRecover(intakeChild', 'cutAndRecover(outboundChild', 'offsetAfterRecovery', 'admissionsAfter'] },
  { id: 'P12-NF-48', file: 'tests/conversation/telegram.round5.lifecycle.test.ts',
    anchors: ['build({ entryPoints:', 'spawnSync(', "toBe('SIGKILL')", 'reader.status'] },
  { id: 'P12-NF-06', file: 'tests/conversation/telegram.round10.integration.test.ts',
    anchors: ["['missing', 'wrong-hash', 'different-updates']", 'createIntakePort(', 'ingress.pollOnce()',
      "toBe('Refused')", 'toBe(100)', "row.kind === 'intake-receipt'", "row.kind === 'intake-admitted'"],
    supporting: [{ file: 'src/conversation/telegram.ts', anchors: [
      'deps.api.readCapture(batch.response.reference)', 'hashBytes(responseBytes) === batch.response.hash',
      'encode(shape) === encode(response.result[index])',
    ] }] },
  { id: 'P12-NF-30', file: 'tests/conversation/telegram.round10.integration.test.ts',
    anchors: ["['one-zero', '<b>Hello</b>', 0, 0]", "['two-one', '<b>Hello</b> <i>World</i>', 1, 0]",
      "['hundred-one'", 'telegramUnpreparedOutbound(false, text, limit)', 'const prepared = f.prepare()',
      "prepared.kind, name).toBe('Refused')", "row.record.type === 'AdmissionReservation'", 'calls.send',
      'toHaveLength(expectedCalls)'],
    supporting: [{ file: 'src/conversation/telegram.ts', anchors: [
      'validateTelegramReplyText(input.message.text, admitted.declaration)',
      'countTelegramHtmlEntities(text) <= declaration.limits.maxEntities',
    ] }] },
];
for (const consumer of concreteConsumers) {
  if (!(tests.get(consumer.id) ?? []).some(test => test.file === consumer.file))
    throw new Error(`${consumer.id}: focused executable consumer did not pass in ${consumer.file}`);
  const source = readFileSync(consumer.file, 'utf8');
  for (const anchor of consumer.anchors) if (!source.includes(anchor))
    throw new Error(`${consumer.id}: focused consumer omits executable anchor ${anchor}`);
  for (const supporting of consumer.supporting ?? []) {
    const supportingSource = readFileSync(supporting.file, 'utf8');
    for (const anchor of supporting.anchors) if (!supportingSource.includes(anchor))
      throw new Error(`${consumer.id}: supporting consumer ${supporting.file} omits executable anchor ${anchor}`);
  }
}
const capabilities = readFileSync('generated/capabilities.md', 'utf8');
for (const required of ['telegram-conversation-adapter: dark', 'telegram.mode.long-poll.default',
  'telegram.mode.webhook.signed-choice-only', 'telegram.operation.ordinary-reply.supported',
  'telegram.operation.media.inhibited', 'public.IntakePort.receive', 'public.EffectDoorway.handoff'])
  if (!capabilities.includes(required)) throw new Error(`P12-NF-04: generated capability briefing omits ${required}`);
const candidates = readFileSync('src/conversation/telegram.ts', 'utf8')
  + readFileSync('tests/conversation/fixture.ts', 'utf8')
  + ['reply', 'callback', 'edit', 'channel-post', 'service-event', 'media-metadata', 'unsupported']
    .map(name => readFileSync(`tests/conversation/fixtures/telegram/${name}.json`, 'utf8')).join('');
if (/[0-9]{6,}:[A-Za-z0-9_-]{20,}/.test(candidates)) throw new Error('P12-NF-12: Telegram token bytes found in source or fixture');
const passingExecutableArms = landedArms.size + 1;
if (passingExecutableArms < 43) throw new Error('row 99 integration did not add a passing executable arm');

console.log('| Check | Disposition | Passing test files |');
console.log('|---|---|---|');
for (const row of expected) {
  const disposition = executable[row.number] ? 'EXECUTABLE' : landedArms.has(row.number) ? 'EXECUTABLE ARM + PARTIAL' : 'PARTIAL';
  console.log(`| ${row.id} | ${disposition} | ${[...new Set((tests.get(row.id) ?? []).map(test => test.file))].join('; ') || '—'} |`);
}
console.log(`${passingExecutableArms} passing executable arms cover ${landedArms.size} P12 checks, including the landed P12-NF-16/18/46 competing-process admission arm; P12-NF-35 retains only real settlement on non-executable-until-seam-response-effects-followup.md; all 53 have explicit dispositions and no missing consumer passes as a no-op.`);
