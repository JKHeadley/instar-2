// Part Twelve Slice A coverage. A PARTIAL row is never promoted by a parser,
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
  16: 'Direct/general/topic canonical forms and verified bot/chat scoping are exercised against captured updates.',
  17: 'All seven Telegram update dispositions are captured; channel posts remain system principals and forward/quote authors remain content.',
  27: 'The closed ordinary-reply shape stays attributable to speaker and sourceResult through the registered Eight path.',
};

const partial = {
  1: 'PARTIAL: the whole-part governed documentation inventory is executable as a retained build input; non-Telegram platform implementation remains Slice B.',
  2: 'PARTIAL: the retained 1.x audit digest is executable build evidence, not a Slice A runtime consumer.',
  6: 'PARTIAL: non-secret capture-before-receipt is executable; secret-shaped production intake is non-executable-until-seam-response-intake-followup.md-and-seam-response-assembly-followup.md.',
  9: 'PARTIAL: byte-identical admitted redelivery is owner-provided; real attempt-metadata redelivery is non-executable-until-seam-response-intake-followup.md rows 46 and 57.',
  11: 'PARTIAL: protocol custody acknowledgment is executable; conversational policy enforcement is non-executable-until-seam-response-intake-followup.md row 60.',
  12: 'PARTIAL: oversize/non-secret custody is executable; secret custody is non-executable-until-seam-response-intake-followup.md-and-seam-response-assembly-followup.md.',
  13: 'PARTIAL: single-arrival owned holds are executable; held redelivery/recovery is non-executable-until-seam-response-intake-followup.md row 46.',
  14: 'PARTIAL: verified binding selection is delegated to landed Part Four; the full first-sender negative matrix is not rebuilt here.',
  15: 'PARTIAL: binding conflict semantics remain Part Four-owned and are not claimed by the Telegram adapter.',
  18: 'PARTIAL: capture-before-offset and signed webhook choice are executable; reminder positive is non-executable-until-seam-response-operator-followup.md row 59.',
  19: 'PARTIAL: Slack identity/admission is Slice B and additionally depends on seam-response-intake-followup.md rows 18, 46 and 57 plus seam-response-judgment.md row 35.',
  20: 'PARTIAL: Slack fault/redelivery is Slice B and non-executable-until-seam-response-intake-followup.md rows 18, 46 and 57 plus seam-response-judgment.md row 35.',
  21: 'PARTIAL: WhatsApp is Slice B.', 22: 'PARTIAL: WhatsApp is Slice B; named payloads remain unsupported.',
  23: 'PARTIAL: iMessage is Slice B.', 24: 'PARTIAL: iMessage is Slice B.', 25: 'PARTIAL: web is Slice B.',
  26: 'PARTIAL: cross-platform alias/migration is Slice B and remains owner-governed.',
  28: 'PARTIAL: the landed reserve/claim/consume path, durable executor acceptance, direct-replay refusal, prepared recovery and specific uncertain-cut neighbors are executable; the complete production crash matrix and real-model chain await their named owner integrations.',
  29: 'PARTIAL: exact HTML bytes are executable; registered accessible emoji/tone review is not built in Slice A.',
  30: 'PARTIAL: fitting or explicit refusal is executable; aggregate output is non-executable-until-seam-response-effects-payloads.md.',
  31: 'PARTIAL: no adapter retry/fallback is executable; unchanged-digest successor handling remains non-executable-until-seam-response-effects-followup.md-and-seam-response-loop-followup.md.',
  32: 'PARTIAL: unsupported effects are declared inhibited; typed optional effects are non-executable-until-seam-response-effects-payloads.md.',
  33: 'PARTIAL: Eight persists request/claim before send and the fsync-backed prepared outbox reconstructs through the existing Four/Six/Eight/Ten contracts; the complete production crash matrix awaits Part Eleven assembly integration.',
  34: 'PARTIAL: response-stage provider bytes are captured without delivery/read inflation; independent delivery witness/emoji arms are not built.',
  35: 'PARTIAL: no adapter self-grade or fake settlement; real settlement is non-executable-until-seam-response-effects-followup.md.',
  36: 'PARTIAL: stable lookup is explicitly unsupported and cannot prove non-occurrence; the full recovery schedule is owner scope.',
  37: 'PARTIAL: a Part Six bounded observation wake performs one read-only Telegram lookup attempt with zero additional invocation; successor retry is non-executable-until-seam-response-effects-followup.md-and-seam-response-loop-followup.md.',
  38: 'PARTIAL: fsync-backed intake cursor rebuild and prepared ordinary-reply outbox reconstruction are executable; held-receipt continuation is non-executable-until-seam-response-intake-followup.md row 46.',
  39: 'PARTIAL: expiry, repeated expiry and reconstruction retain the original capture, receipt, hold and terminal; fleet-scale retention horizons remain activation evidence rather than a named unlanded owner seam.',
  40: 'PARTIAL: route-service fairness is non-executable-until-seam-response-loop-followup.md row 43.',
  41: 'PARTIAL: adapter refusals remain explicit with zero send; the broader advisory/notice owner matrix is not built.',
  42: 'PARTIAL: credentials stay behind the Ten custodian and effect message is scoped; real worker isolation awaits production assembly integration.',
  43: 'PARTIAL: real-model positive is non-executable-until-seam-response-judgment.md-and-seam-response-effects-followup.md; production grounding also awaits the row-45 owner grants and Part Eleven assembly integration.',
  44: 'PARTIAL: real-model path is non-executable-until-seam-response-judgment.md-and-seam-response-effects-followup.md; real settlement is non-executable-until-seam-response-effects-followup.md; production lifecycle awaits Part Eleven assembly integration.',
  45: 'PARTIAL: no later platform activates; later platform parity is Slice B.',
  46: 'PARTIAL: fresh authenticated identity and captured outbound response are executable with fixtures; real live-provider inbound/outbound proof is not claimed.',
  47: 'PARTIAL: the Part Ten consumer accepts a named hardware workload record and refuses target/estimate references or omitted failed samples represented as complete measurement; live hardware measurements remain activation evidence.',
  48: 'PARTIAL: three local tiers execute, but real-model positive is non-executable-until-seam-response-judgment.md-and-seam-response-effects-followup.md and production assembly/custody owner grants integrate.',
  49: 'PARTIAL: mode/API changes are exercised as distinct or inhibited conformance subjects and the generated active-generation briefing is checked for exact current modes, operations and public doorways; live cross-version provider replay remains activation evidence.',
  50: 'PARTIAL: runtime admission records current check-run/probe references, but activation remains dark without the missing owner positives.',
  51: 'PARTIAL: media metadata enters Four owned hold with zero fetch/provider/send; media custody beyond metadata is Slice B and successful media is non-executable-until-seam-response-effects-payloads.md-and-seam-response-assembly-followup.md.',
  52: 'PARTIAL: legacy import is non-executable-until-seam-response-intake-followup.md-seam-response-rungraph-followup.md-and-seam-response-effects-followup.md.',
  53: 'PARTIAL: minimal response is non-executable-until-part-eleven-seam-response-assembly.md-is-integrated.',
};

const design = readFileSync('docs/16-conversation-adapters/12-negative-contract-fixtures.md', 'utf8');
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
  47, 48, 49, 50, 51,
]);
for (const row of expected) {
  const reason = executable[row.number] ?? partial[row.number];
  if (!reason) throw new Error(`${row.id}: missing disposition`);
  if (landedArms.has(row.number) && !(tests.get(row.id)?.length))
    throw new Error(`${row.id}: landed executable arm without a passing test`);
  if (partial[row.number] && !reason.startsWith('PARTIAL:')) throw new Error(`${row.id}: partial reason is not explicit`);
}
const p12nf48Files = new Set((tests.get('P12-NF-48') ?? []).map(test => test.file));
for (const tier of ['telegram.unit.test.ts', 'telegram.integration.test.ts', 'telegram.lifecycle.test.ts'])
  if (![...p12nf48Files].some(file => file.endsWith(tier))) throw new Error(`P12-NF-48: missing passing ${tier} tier`);

// High-risk executable arms are not established by a check id in a title alone.
// Require the passing focused consumer and the concrete owner-port calls/assertion
// subjects that make the case executable. This is intentionally narrow: it guards
// the five review-identified holes without pretending static source inspection is
// live-provider evidence.
const concreteConsumers = [
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
];
for (const consumer of concreteConsumers) {
  if (!(tests.get(consumer.id) ?? []).some(test => test.file === consumer.file))
    throw new Error(`${consumer.id}: focused executable consumer did not pass in ${consumer.file}`);
  const source = readFileSync(consumer.file, 'utf8');
  for (const anchor of consumer.anchors) if (!source.includes(anchor))
    throw new Error(`${consumer.id}: focused consumer omits executable anchor ${anchor}`);
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

console.log('| Check | Disposition | Passing test files |');
console.log('|---|---|---|');
for (const row of expected) console.log(`| ${row.id} | ${executable[row.number] ? 'EXECUTABLE' : landedArms.has(row.number) ? 'EXECUTABLE ARM + PARTIAL' : 'PARTIAL'} | ${[...new Set((tests.get(row.id) ?? []).map(test => test.file))].join('; ') || '—'} |`);
console.log(`${landedArms.size} P12 checks have passing executable arms; all 53 have explicit dispositions and no missing consumer passes as a no-op.`);
