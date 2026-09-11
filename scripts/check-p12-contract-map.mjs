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
  1: 'PARTIAL: whole-part governed documentation inventory remains a build/docs check outside Slice A implementation.',
  2: 'PARTIAL: the retained 1.x audit is design evidence, not a Slice A runtime consumer.',
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
  28: 'PARTIAL: the landed reserve/claim/consume path is executable; the complete adjacent-cut production matrix awaits the production assembly.',
  29: 'PARTIAL: exact HTML bytes are executable; registered accessible emoji/tone review is not built in Slice A.',
  30: 'PARTIAL: fitting or explicit refusal is executable; aggregate output is non-executable-until-seam-response-effects-payloads.md.',
  31: 'PARTIAL: no adapter retry/fallback is executable; unchanged-digest successor handling remains non-executable-until-seam-response-effects-followup.md-and-seam-response-loop-followup.md.',
  32: 'PARTIAL: unsupported effects are declared inhibited; typed optional effects are non-executable-until-seam-response-effects-payloads.md.',
  33: 'PARTIAL: Eight persists request/claim before send; full production outbox crash reconstruction awaits Part Eleven assembly integration.',
  34: 'PARTIAL: response-stage provider bytes are captured without delivery/read inflation; independent delivery witness/emoji arms are not built.',
  35: 'PARTIAL: no adapter self-grade or fake settlement; real settlement is non-executable-until-seam-response-effects-followup.md.',
  36: 'PARTIAL: stable lookup is explicitly unsupported and cannot prove non-occurrence; the full recovery schedule is owner scope.',
  37: 'PARTIAL: a repeat dispatch invokes once; successor retry is non-executable-until-seam-response-effects-followup.md-and-seam-response-loop-followup.md.',
  38: 'PARTIAL: fsync-backed intake cursor rebuild is executable; held-receipt continuation is non-executable-until-seam-response-intake-followup.md row 46.',
  39: 'PARTIAL: facts and captures remain retained in tested custody; a whole-retention horizon fixture is not built.',
  40: 'PARTIAL: route-service fairness is non-executable-until-seam-response-loop-followup.md row 43.',
  41: 'PARTIAL: adapter refusals remain explicit with zero send; the broader advisory/notice owner matrix is not built.',
  42: 'PARTIAL: credentials stay behind the Ten custodian and effect message is scoped; real worker isolation awaits production assembly integration.',
  43: 'PARTIAL: real-model positive is non-executable-until-seam-response-judgment.md-and-seam-response-effects-followup.md; production grounding also awaits the row-45 owner grants and Part Eleven assembly integration.',
  44: 'PARTIAL: real-model path is non-executable-until-seam-response-judgment.md-and-seam-response-effects-followup.md; real settlement is non-executable-until-seam-response-effects-followup.md; production lifecycle awaits Part Eleven assembly integration.',
  45: 'PARTIAL: no later platform activates; later platform parity is Slice B.',
  46: 'PARTIAL: fresh authenticated identity and captured outbound response are executable with fixtures; real live-provider inbound/outbound proof is not claimed.',
  47: 'PARTIAL: measured hardware workload evidence is not produced by Slice A.',
  48: 'PARTIAL: three local tiers execute, but real-model positive is non-executable-until-seam-response-judgment.md-and-seam-response-effects-followup.md and production assembly/custody owner grants integrate.',
  49: 'PARTIAL: current modes/operations/inhibitions are regenerated; cross-version upgrade replay is not built.',
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
for (const row of expected) {
  const reason = executable[row.number] ?? partial[row.number];
  if (!reason) throw new Error(`${row.id}: missing disposition`);
  if (executable[row.number] && !(tests.get(row.id)?.length)) throw new Error(`${row.id}: EXECUTABLE without a passing test`);
  if (partial[row.number] && !reason.startsWith('PARTIAL:')) throw new Error(`${row.id}: partial reason is not explicit`);
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
for (const row of expected) console.log(`| ${row.id} | ${executable[row.number] ? 'EXECUTABLE' : 'PARTIAL'} | ${[...new Set((tests.get(row.id) ?? []).map(test => test.file))].join('; ') || '—'} |`);
console.log(`${Object.keys(executable).length} executable and ${Object.keys(partial).length} PARTIAL P12 checks mapped; no missing consumer passes as a no-op.`);
