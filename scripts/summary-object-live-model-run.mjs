/** A REAL model run of the summary-side object answers under plan #507's wording. Not a test and not part of any
 * suite: a stub cannot show what the real model writes, and the defect this fixes IS what the real model writes.
 *
 * Live cint-L49 ddfc8f67, proof room 1 RA3 (A-proofroom-20261004-105619): "Actually, cancel the bird feeder one."
 * was answered "I couldn't record that memory change. Please send it again." Both `summary:715673799` attempts ended
 * normally inside the output cap; the only envelope-level read failure recorded in the whole root was
 * `summary-review/verdict/malformed/not-json`, 10 ms after `summary:715673799:review` returned, and the span's last
 * `summary-failed` row carried no `reason` -- the summary's own field gate, which reads `memory` and `cancelReminders`
 * out of a JSON object the MODEL hand-writes. Under cint-L50's final flat prompt the real model still writes that
 * shape for the review: the recorded `summary:715673532:review` came back as
 * {"reasoning":...,"answer":"{\"verdict\":\"pass\",\"reason\":...}"} (tests/preview/fixtures/answer-flat-live-2026-10-04.json).
 *
 * So this drives the SAME worker on the SAME three-turn shape the proof check sends (two reminders, then the
 * withdrawal), with the SAME envelope (prepareJournalEnvelope), the SAME conversation policy and the SAME reader the
 * live launcher uses (answer-reading.ts readAnswer with this branch's `object` declaration). Only the answer turns and
 * the faithfulness Jev are canned; every `summary:` call -- the writer, both of its attempts, and its review -- is a
 * real call. For each one it records what the model wrote, how the reader read it, and whether the consumer's own
 * parse then succeeded.
 *
 * Usage: node --no-warnings --loader ./scripts/slice-ts-loader.mjs scripts/summary-object-live-model-run.mjs <out-dir>
 * Env: SUMMARY_OBJECT_LIVE_MODEL (default claude-sonnet-5, the recorded model); SUMMARY_OBJECT_CLAUDE_BIN (default
 * `claude` on PATH); SUMMARY_OBJECT_REPEATS (default 2) repeats the whole shape, since a recorded shape can be a coin flip.
 * Every verbatim model output is written to <out-dir>. */
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const load = path => import(new URL(`../${path}`, import.meta.url).href);
const { createJournalWorker, openPreviewJournal, SUMMARY_REASON_CHARS } = await load('tests/preview/journal.ts');
const { prepareJournalEnvelope } = await load('tests/preview/journal-envelope.ts');
const { readAnswer, taskFields } = await load('tests/preview/answer-reading.ts');
const { interpretSummaryReview } = await load('tests/preview/summary-check.ts');
const { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_THINKING_ENV, subscriptionConversationPolicy } =
  await load('src/assembly/production-provider.ts');

const outDir = process.argv[2];
if (!outDir) { process.stderr.write('usage: summary-object-live-model-run.mjs <out-dir>\n'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const MODEL = process.env.SUMMARY_OBJECT_LIVE_MODEL ?? 'claude-sonnet-5';
const policy = subscriptionConversationPolicy(MODEL);
const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'summary-object-cwd-')));
const run = async stdin => await new Promise((resolve, reject) => {
  const child = execFile(process.env.SUMMARY_OBJECT_CLAUDE_BIN ?? 'claude', [...policy.args], { cwd, maxBuffer: 1 << 22,
    env: { ...process.env, ...SUBSCRIPTION_THINKING_ENV, PATH: `${policy.path}:${process.env.PATH ?? ''}` },
    timeout: policy.timeout + 60000 },
  (error, stdout, stderr) => error && !stdout ? reject(Object.assign(error, { stderr })) : resolve({ stdout, stderr }));
  child.stdin.end(stdin);
});

// The proof check's own three messages and clock (2026-10-04, America/Los_Angeles).
const FEEDER = 'Remind me today at 11:16 am to refill the bird feeder';
const PLUMBER = 'Also remind me today at 11:16 am to call the plumber';
const CANCEL = 'Actually, cancel the bird feeder one.';
const START = Date.UTC(2026, 9, 4, 18, 0);
const genesis = { kind: 'genesis', bot: '8994258214', chat: '7812716706', operator: '7812716706',
  grant: 'grant:summary-object-live', configurationDigest: 'sha256:summary-object-live', expires: Date.UTC(2026, 9, 11),
  maxCalls: 200, maxReplies: 100, maxTurns: 60, maxBytes: 40000, cursor: 0 };
const update = (id, text) => ({ update_id: id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text, date: Math.floor(START / 1000) + id * 60 } });
const packetOf = prompt => JSON.parse(JSON.parse(prompt).messages.find(m => m.role === 'context').content).packet;

const records = [];
/** How this branch's reader reads one answer text, and whether the consumer's own parse then succeeds. */
function readingRecord(raw, id, wrapped) {
  const reading = readAnswer(raw, { wrapped, evidence: [id], object: true });
  let top = null;
  try { top = Object.keys(JSON.parse(raw)); } catch { top = null; }
  const record = { topLevelFields: top, ok: reading.ok,
    ...(reading.ok ? { envelope: reading.envelope, shape: reading.shape, objectAsText: reading.objectAsText === true }
      : { shape: reading.shape, defect: reading.defect }) };
  if (!reading.ok) return record;
  if (id.endsWith(':review')) {
    const verdict = interpretSummaryReview({ state: 'complete', value: reading.value }, 1);
    return { ...record, consumer: { kind: 'summary-review', verdict: verdict.verdict, retryable: verdict.retryable === true } };
  }
  let parsed = null;
  try { parsed = JSON.parse(reading.value); } catch { parsed = null; }
  return { ...record, consumer: { kind: 'summary-writer', parsed: parsed !== null,
    fields: parsed === null ? null : Object.keys(parsed),
    memory: parsed === null ? null : Array.isArray(parsed.memory),
    cancelReminders: parsed === null ? null : Array.isArray(parsed.cancelReminders) ? parsed.cancelReminders : null } };
}

/** One real call for a `summary:` id, read exactly as the launcher reads it. */
async function realCall(label, id, question, context, wrapped) {
  const prepared = prepareJournalEnvelope({ question, context, id }, MODEL, genesis.grant, START, genesis.maxBytes);
  writeFileSync(join(outDir, `${label}-prepared.json`), prepared);
  const { stdout, stderr } = await run(prepared);
  writeFileSync(join(outDir, `${label}-stdout.json`), stdout || stderr);
  const frame = JSON.parse(stdout), raw = String(frame.result ?? '');
  writeFileSync(join(outDir, `${label}-output.txt`), raw);
  const record = readingRecord(raw, id, wrapped);
  records.push({ label, id, outputTokens: frame.usage?.output_tokens ?? null, ...record });
  const reading = readAnswer(raw, { wrapped, evidence: [id], object: true });
  return reading.ok ? reading.value : { failureClass: 'malformed', state: 'complete', defect: reading.defect };
}

const request = text => ({ quote: text, when: 'today at 11:16 am', remind: true });
/** The recorded cint-L33 summary output of 2026-10-02's RA3 (tests/preview/fixtures/cancel2-live-2026-10-02.json,
 * summaryOutputsAtRa3[1]), re-serialized: the summary writer answered in the CONVERSATION protocol's shape instead of
 * its own -- `reply` and `cancelReminders` as {id, quote} objects, and no `memory` at all. Two of those settled the
 * turn undecided. Replaying it as the first attempt puts the live retry shape on the second: the trigger is then
 * memory-pending, so the packet carries `reminderDecision` and the field gate requires `cancelReminders` as ids. */
const RECORDED_FAILING_SUMMARY = JSON.stringify({
  reply: 'Cancelled the bird feeder reminder. The plumber call reminder for 11:16 am today stays active.',
  cancelReminders: [{ id: 'reminder-c55ad3832d', quote: 'Actually, cancel the bird feeder one.' }],
  summary: 'The operator asked for two reminders at 11:16 am and then withdrew the bird feeder one.',
  people: [], personAttributes: [], commitments: [], closed: [], questions: [], memoryItems: [], concepts: [] });

async function shape(pass, seed = []) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'summary-object-live-')));
  const sent = [], seeded = [...seed];
  let summaryCalls = 0;
  const ports = { now: () => START, stopped: () => false, timeZone: 'America/Los_Angeles',
    prepareModel: input => prepareJournalEnvelope(input, MODEL, genesis.grant, START, genesis.maxBytes),
    model: async input => {
      if (input.id.startsWith('summary:')) {
        const attempt = `${pass}-summary-${++summaryCalls}`;
        // A recorded output stands in for the attempt it was recorded as; later attempts are real calls.
        if (seeded.length) { const recorded = seeded.shift();
          records.push({ label: attempt, id: input.id, recorded: true, ...readingRecord(recorded, input.id, 'accept') });
          return recorded; }
        const packet = packetOf(input.prepared ?? prepareJournalEnvelope(input, MODEL, genesis.grant, START, genesis.maxBytes));
        writeFileSync(join(outDir, `${attempt}-packet.json`), JSON.stringify(packet, null, 1));
        return await realCall(attempt, input.id, input.question, input.context, 'accept');
      }
      const text = input.question;
      // Canned answer turns: only the summary side is under test here.
      return text.startsWith('Remind me') || text.startsWith('Also remind me')
        ? JSON.stringify({ reply: 'Okay.', memory: [], dated: [request(text)] })
        : JSON.stringify({ reply: 'Noted.', memory: [], dated: [], cancelReminders: [] });
    },
    // Undecided, so the faithfulness cascade escalates to the real full-context review, as it did live.
    summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.5 } } }),
    replyCheck: { elapsedMs: () => 0, jev: async () => { throw Error('not used'); },
      summaryReview: async (state, through) => {
        const id = `summary:${through}:review`;
        const question = REVIEW_QUESTION;
        const value = await realCall(`${pass}-review-${through}`, id, question, state, 'refuse');
        return interpretSummaryReview(typeof value === 'string' ? { state: 'complete', value } : value, 1);
      } },
    checkOutbound: () => {},
    send: async value => { sent.push(value.expectedText); return sent.length; } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(71), genesis);
  const worker = createJournalWorker(journal, ports);
  let id = 1;
  for (const text of [FEEDER, PLUMBER]) { worker.intake([update(id++, text)]); await worker.drain(); }
  worker.intake([update(id, CANCEL)]);
  await worker.drain(); await worker.drain();
  const cancel = journal.view.order.find(turn => turn.text === CANCEL);
  const result = { pass, summaryThrough: journal.view.summaries.at(-1)?.through ?? null,
    lastSummaryFailure: journal.view.lastSummaryFailure
      ? { through: journal.view.lastSummaryFailure.through, reason: journal.view.lastSummaryFailure.reason ?? journal.view.lastSummaryFailure.failureClass }
      : null,
    memoryUndecided: cancel?.memoryUndecided === true, reminderCancels: journal.view.reminderCancels.length,
    sent: sent.at(-1) ?? null };
  journal.close();
  rmSync(root, { recursive: true, force: true });
  return result;
}

// The live review question, exactly as journal-agent.mjs summaryReview builds it (the runner-task protocol, plan #510).
const REVIEW_QUESTION = 'Review this rolling summary against its full supplied conversation packet. Check every commitment, person, correction and dated item, and reject invented facts. It also violates if it loses or contradicts a still-active fact, preference or person detail, or keeps a claim the operator corrected or asked to forget. Active memory records and open commitments are carried separately, so their absence from the prose alone is not loss, and greetings or repeated wording need not be kept. Pass only when coverage is faithful; uncertainty is a violation. Give a brief evidence-based reason. '
  + taskFields('{"verdict":"pass"|"violation","reason":string}', SUMMARY_REASON_CHARS);

const passes = [];
for (let pass = 1; pass <= Number(process.env.SUMMARY_OBJECT_REPEATS ?? 2); pass++) {
  passes.push(await shape(`p${pass}`));
  // The live retry shape: the recorded failing output first, so the real second attempt is asked for `cancelReminders`.
  passes.push(await shape(`p${pass}-retry`, [RECORDED_FAILING_SUMMARY]));
}
rmSync(cwd, { recursive: true, force: true });
const report = { model: MODEL, calls: records, passes };
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 1));
process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
