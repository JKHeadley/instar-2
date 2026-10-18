/** A REAL model run of recorded answer inputs under the flat answer protocol (plan #491). Not a test and not part of
 * any suite: a stub cannot show whether the real model writes the flat object reliably, so this replays the EXACT
 * recorded stdin envelopes (the reserve prompt, or the format-retry prompt with this branch's defect-naming reminder)
 * through this branch's system prompt and reads each result with the runner's own reader (answer-reading.ts).
 *
 * The recorded turns were tool turns that made no tool calls; the replay sends the same tools system prompt with no
 * tools granted (the conversation policy's `--tools ''`, one turn), so no unsandboxed tool can run.
 * Usage: node --no-warnings --loader ./scripts/slice-ts-loader.mjs scripts/answer-flat-live-model-run.mjs <cases.json> <out-dir>
 * cases.json: [{ "label", "rows" (decoded journal rows, JSONL), "id" (turn id), "attempt": "reserve" | "format-retry" }], or a
 * runner task: { "label", "rows", "call" (model-call id), "rewrite": [[recorded wording, this branch's wording], ...] }, replayed
 * from the recorded model-call input through the conversation system prompt (no tools), read with the role's wrap policy.
 * Env: FLAT_LIVE_MODEL (default claude-sonnet-5, the recorded model); FLAT_CLAUDE_BIN (default /usr/local/bin/claude).
 * Every verbatim model output is written to <out-dir>. One call per case.
 */
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const load = path => import(new URL(`../${path}`, import.meta.url).href);
const { readAnswer } = await load('tests/preview/answer-reading.ts');
const { answerFormatReminder } = await load('tests/preview/journal.ts');
const { encoded } = await load('tests/preview/canonical.ts');
const { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_THINKING_ENV, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT, subscriptionConversationPolicy } = await load('src/assembly/production-provider.ts');
const { parseReplyReviewVerdict } = await load('tests/preview/reply-check.ts');

const [casesPath, outDir] = process.argv.slice(2);
if (!casesPath || !outDir) { process.stderr.write('usage: answer-flat-live-model-run.mjs <cases.json> <out-dir>\n'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const MODEL = process.env.FLAT_LIVE_MODEL ?? 'claude-sonnet-5';
const policy = subscriptionConversationPolicy(MODEL);
const argsFor = system => { const args = [...policy.args]; args[args.indexOf('--system-prompt') + 1] = system; return args; };

/** A clean cwd, so the CLI reads no project settings of this repository. */
const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'answer-flat-cwd-')));
const run = async (stdin, system = SUBSCRIPTION_TOOLS_SYSTEM_PROMPT) => await new Promise((resolve, reject) => {
  const child = execFile(process.env.FLAT_CLAUDE_BIN ?? '/usr/local/bin/claude', argsFor(system), { cwd, maxBuffer: 1 << 22,
    env: { ...process.env, ...SUBSCRIPTION_THINKING_ENV, PATH: policy.path }, timeout: policy.timeout + 60000 },
  (error, stdout, stderr) => error && !stdout ? reject(Object.assign(error, { stderr })) : resolve({ stdout, stderr }));
  child.stdin.end(stdin);
});

/** The recorded prompt, with a format-retry packet's reminder replaced by the one this branch sends for the recorded
 * first attempt's defect. */
const promptOf = (rows, id, attempt) => {
  const row = rows.find(item => item.kind === attempt && item.id === id && typeof item.prompt === 'string');
  if (!row) throw Error(`no ${attempt} prompt for ${id}`);
  if (attempt === 'reserve') return { prompt: row.prompt, defect: null };
  const first = rows.find(item => item.kind === 'model-call' && item.inputRef === `reserve:${id}`);
  const reading = readAnswer(first?.output ?? '', { wrapped: 'accept', evidence: [id] });
  const defect = reading.ok ? null : reading.defect;
  const envelope = JSON.parse(row.prompt);
  const context = envelope.messages.find(message => message.role === 'context');
  const value = JSON.parse(context.content);
  context.content = encoded({ ...value, packet: { ...value.packet, formatReminder: answerFormatReminder(defect ?? undefined) } }).bytes;
  return { prompt: encoded(envelope).bytes, defect };
};

/** A runner task's recorded input, its question reworded exactly as this branch's code now writes it. */
const taskOf = (rows, item) => {
  const row = rows.find(entry => entry.kind === 'model-call' && entry.id === item.call && typeof entry.input === 'string');
  if (!row || row.replay !== 'faithful') throw Error(`no faithful recorded input for ${item.call}`);
  const envelope = JSON.parse(row.input);
  let question = envelope.messages[0].content;
  for (const [from, to] of item.rewrite) { if (!question.includes(from)) throw Error(`${item.label}: wording not found`); question = question.replace(from, to); }
  envelope.messages[0].content = question;
  return { prompt: encoded(envelope).bytes, recorded: row.output, gate: /review$/u.test(item.call) || /^retrospective:/u.test(item.call) };
};
const rulesOf = question => Object.keys(JSON.parse(/rules on its own: (\{.*?\})\. For raw_path/u.exec(question)?.[1] ?? '{}'));

const report = [];
for (const item of JSON.parse(readFileSync(casesPath, 'utf8'))) {
  const rows = readFileSync(item.rows, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  if (item.call) {
    const task = taskOf(rows, item);
    const { stdout, stderr } = await run(task.prompt, SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT);
    writeFileSync(join(outDir, `${item.label}-stdout.json`), stdout || stderr);
    const frame = JSON.parse(stdout), raw = String(frame.result ?? '');
    writeFileSync(join(outDir, `${item.label}-result.txt`), raw);
    const reading = readAnswer(raw, { wrapped: task.gate ? 'refuse' : 'accept', evidence: [item.call] });
    let consumer = null;
    if (reading.ok && item.call.endsWith(':reply-review')) {
      try { const verdict = parseReplyReviewVerdict(reading.value, rulesOf(JSON.parse(task.prompt).messages[0].content)); consumer = `verdict ${verdict.verdict} [${verdict.ruleIds.join(',')}]`; }
      catch (error) { consumer = `verdict refused: ${error.message}`; }
    } else if (reading.ok) { try { consumer = `fields ${Object.keys(JSON.parse(reading.value)).join(',')}`; } catch { consumer = 'text'; } }
    const entry = { label: item.label, call: item.call, gate: task.gate, outputTokens: frame.usage?.output_tokens ?? null, ok: reading.ok,
      shape: reading.shape, ...(reading.ok ? { envelope: reading.envelope, consumer } : { defect: reading.defect }) };
    report.push(entry);
    process.stdout.write(`${JSON.stringify(entry)}\n`);
    continue;
  }
  const { prompt, defect } = promptOf(rows, item.id, item.attempt);
  const recorded = rows.find(row => row.kind === 'model-call' && row.inputRef === `${item.attempt}:${item.id}`)?.output ?? null;
  const toolCalls = rows.filter(row => row.kind === 'tool-turn' && row.phase === 'trace' && row.id === item.id).map(row => row.calls?.length ?? null);
  const { stdout, stderr } = await run(prompt);
  writeFileSync(join(outDir, `${item.label}-stdout.json`), stdout || stderr);
  const frame = JSON.parse(stdout);
  const raw = String(frame.result ?? '');
  writeFileSync(join(outDir, `${item.label}-result.txt`), raw);
  const reading = readAnswer(raw, { wrapped: 'accept', evidence: [item.id] });
  const before = readAnswer(recorded ?? '', { wrapped: 'accept', evidence: [item.id] });
  const entry = { label: item.label, id: item.id, attempt: item.attempt, recordedToolCalls: toolCalls, retryDefect: defect,
    recordedReading: before.ok ? 'ok' : `${before.shape}: ${before.defect}`,
    outputTokens: frame.usage?.output_tokens ?? null, ok: reading.ok,
    ...(reading.ok ? { shape: reading.shape, envelope: reading.envelope, value: reading.value } : { shape: reading.shape, defect: reading.defect }) };
  report.push(entry);
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}
writeFileSync(join(outDir, 'report.json'), `${JSON.stringify({ model: MODEL, calls: report.length, cases: report }, null, 1)}\n`);
rmSync(cwd, { recursive: true, force: true });
