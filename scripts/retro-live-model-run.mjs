/** A REAL model run of the retrospective review's prepared ask, on a fixture root shaped like the recorded
 * live ones. Not a test and not part of any suite: a stub cannot prove a model completes a pass, so this
 * drives the SAME prompt the launcher sends (prepareJournalEnvelope + the conversation policy's own argv and
 * system prompt), parses it with the SAME reader (parseModelJson + the Decision floor + conclusionText), and
 * runs the answer through the SAME validateRetrospective, then prints the pass's recorded result.
 *
 * Usage: node --no-warnings --loader ./scripts/slice-ts-loader.mjs scripts/retro-live-model-run.mjs <out-dir> [calls]
 * Every verbatim model output is written to <out-dir>, one file per call. Bounded: `calls` (default 1, max 8).
 */
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const load = path => import(new URL(`../${path}`, import.meta.url).href);
const { createJournalWorker, openPreviewJournal, retrospectiveCases } = await load('tests/preview/journal.ts');
const { RETROSPECTIVE_DUTIES, RETROSPECTIVE_QUESTION, RETRO_STALE_CASE_MS, disciplineSource, retroAnswerBudget,
  retrospectiveStatusLine } = await load('tests/preview/retrospective.ts');
const { prepareJournalEnvelope } = await load('tests/preview/journal-envelope.ts');
const { parseModelJson, conclusionText } = await load('tests/preview/model-json.ts');
const { decisionWithinFloor } = await load('tests/preview/model-call-boundary.ts');
const { SUBSCRIPTION_MAX_OUTPUT_TOKENS, SUBSCRIPTION_THINKING_ENV, subscriptionConversationPolicy }
  = await load('src/assembly/production-provider.ts');

const outDir = process.argv[2];
if (!outDir) { process.stderr.write('usage: retro-live-model-run.mjs <out-dir> [calls]\n'); process.exit(2); }
const wanted = Math.min(8, Math.max(1, Number(process.argv[3] ?? '1')));
mkdirSync(outDir, { recursive: true });
const MODEL = process.env.RETRO_LIVE_MODEL ?? 'claude-sonnet-4-5';
const policy = subscriptionConversationPolicy(MODEL);

/** The live room's identity shape, so every case id is as long as it really is. */
const genesis = { kind: 'genesis', bot: '8994258214', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 4000, maxReplies: 4000, maxTurns: 4000, maxBytes: 409600, cursor: 0 };
const start = Date.UTC(2026, 8, 26, 17);
const root = realpathSync(mkdtempSync(join(tmpdir(), 'retro-live-model-')));
/** A clean cwd, so the CLI reads no project settings of this repository. */
const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'retro-live-cwd-')));
const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(53), genesis);
let now = start, next = 1, calls = 0;
const transcript = [];

const run = async stdin => await new Promise((resolve, reject) => {
  const child = execFile('/usr/bin/claude', [...policy.args], { cwd, maxBuffer: 1 << 22,
    env: { ...process.env, ...SUBSCRIPTION_THINKING_ENV, PATH: policy.path },
    timeout: policy.timeout + 60000 },
  (error, stdout, stderr) => error && !stdout ? reject(Object.assign(error, { stderr })) : resolve({ stdout, stderr }));
  child.stdin.end(stdin);
});

/** The retrospective port: the real prepared envelope, the real CLI, the real reader. */
const retrospect = async (state, id) => {
  calls++;
  const prepared = prepareJournalEnvelope({ question: RETROSPECTIVE_QUESTION, context: state, id },
    MODEL, genesis.grant, now, journal.view.limits.maxBytes);
  writeFileSync(join(outDir, `call-${String(calls)}-prepared.json`), prepared);
  const { stdout } = await run(prepared);
  writeFileSync(join(outDir, `call-${String(calls)}-stdout.json`), stdout);
  const frame = JSON.parse(stdout);
  const usage = { inputTokens: frame.usage?.input_tokens ?? null,
    outputTokens: frame.usage?.output_tokens ?? null, charge: null, inputComplete: true };
  writeFileSync(join(outDir, `call-${String(calls)}-result.txt`), String(frame.result ?? ''));
  // The retrospective role keeps the narrow reading: only a bare or whole-fence object is accepted.
  const extracted = parseModelJson(String(frame.result ?? ''), { wrapped: 'refuse' });
  const decision = extracted.ok ? extracted.value : null;
  const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
    && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
  transcript.push({ call: calls, id, promptBytes: Buffer.byteLength(prepared), outputTokens: usage.outputTokens,
    shape: extracted.ok ? extracted.shape : `malformed:${extracted.reason ?? 'unknown'}`,
    answerBytes: value === null ? null : Buffer.byteLength(value) });
  if (value === null) return { state: 'complete', failureClass: 'malformed', usage };
  return { state: 'complete', value, usage };
};

const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
  sources: () => [disciplineSource(journal.view)],
  // Replies and summaries are stubbed: this run exists to prove the RETROSPECTIVE ask, and every reply call
  // would be another real call against the same quota.
  model: async input => input.id.startsWith('summary:')
    ? JSON.stringify({ summary: 'The operator chatted about the preview.', people: [], memory: [], commitments: [], questions: [] })
    : JSON.stringify({ reply: 'Noted — here is a reply of ordinary length for this preview conversation.', memory: [], dated: [] }),
  send: async () => 7, checkOutbound: () => {}, retrospect });

const update = (id, text, at) => ({ update_id: 715672478 + id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, date: Math.floor(at / 1000) + id, text } });
// No preference or memory cue among them: a correction holds its turn and cascades, and this run exists to
// exercise the ordinary case where each message has its own judged answer to grade.
const questions = ['How does this preview keep what I tell it?', 'What happens to a message you cannot answer?',
  'What is the difference between this preview and production?', 'Who can see this conversation?', 'What did I ask you first?',
  'Can you act on anything outside this chat?', 'How long does this preview run?', 'What do you do when you are unsure?',
  'Does a restart lose the conversation?', 'What is the riskiest thing you could get wrong here?',
  'How do you know who I am?', 'What would you change about how you answer me?',
  'Did any of my questions go unanswered?', 'Summarise what we have covered.'];
worker.intake(questions.map(text => update(next++, text, now)));
await worker.drain();

const population = retrospectiveCases(journal.view);
const summary = { model: MODEL, outDir, cwd, owed: population.length,
  budget: retroAnswerBudget(journal.view.retroPasses), passes: [], transcript, calls: 0 };
for (let attempt = 0; attempt < wanted; attempt++) {
  summary.budget = retroAnswerBudget(journal.view.retroPasses);
  await worker.retrospect('sha256:config-a');
  const pass = journal.view.retroPasses.at(-1);
  if (!pass) break;
  if (summary.passes.some(row => row.pass === pass.pass)) break;
  summary.passes.push({ pass: pass.pass, state: pass.state ?? 'in-flight', reason: pass.reason ?? null,
    askedAtBudget: summary.budget,
    eligible: pass.eligible, supplied: pass.cases.length, namedDeferrals: pass.omitted.length,
    estimatedAnswerBytes: pass.estimatedAnswerBytes ?? null, outputTokens: pass.outputTokens ?? null,
    outputCap: SUBSCRIPTION_MAX_OUTPUT_TOKENS,
    inspected: pass.result ? pass.result.inspected.length : null,
    omittedByReview: pass.result ? pass.result.omitted.length : null,
    duties: pass.result ? pass.result.duties.map(row => `${row.duty}:${row.disposition}`) : [],
    dutyRows: pass.result ? pass.result.duties.length : 0,
    expectedDutyRows: RETROSPECTIVE_DUTIES.length,
    efficiency: pass.result?.efficiency.summary ?? null,
    gravityWellsObserved: pass.result ? pass.result.gravityWells.filter(row => row.observed).map(row => row.well) : [],
    findings: pass.result ? pass.result.findings.map(row => ({ duty: row.duty, refs: row.refs.length })) : [],
    grades: pass.result ? pass.result.grades.length : 0,
    feedback: pass.result ? pass.result.feedback.length : 0 });
  summary.statusLine = retrospectiveStatusLine(journal.view, 'sha256:config-a');
  // Past the stale window, so the cases this pass deferred are due again and a second pass really runs.
  now += pass.state === 'complete' ? RETRO_STALE_CASE_MS : 6 * 3_600_000;
}
summary.calls = calls;
journal.close();
rmSync(root, { recursive: true, force: true });
rmSync(cwd, { recursive: true, force: true });
writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 1)}\n`);
