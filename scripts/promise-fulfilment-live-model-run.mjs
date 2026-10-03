/** A REAL model run of the recorded A5/A5b promise-and-fulfilment exchange (live-proof group A, room two,
 * results A-proofroom2-20261003-022222, where check A5b FAILED). Not a test and not part of any suite: a
 * stub cannot show what the answering model does with the fulfilment branch, so this drives the SAME
 * envelope the live launcher sends (prepareJournalEnvelope with the real ANSWER_INSTRUCTIONS and the real
 * conversation policy), reads the answer with the SAME reader (parseModelJson + the Decision floor +
 * conclusionText), feeds it to the SAME worker, and prints whether the promise closed.
 *
 * Turn 1 (the promise) is replayed from the live answer shape; only turn 2 — the A5b packet — is a real call.
 * Usage: node --no-warnings --loader ./scripts/slice-ts-loader.mjs scripts/promise-fulfilment-live-model-run.mjs <out-dir>
 * Env: A5_LIVE_MODEL (default claude-sonnet-5, the model the recorded run used).
 * Every verbatim model output is written to <out-dir>. One call per run.
 */
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const load = path => import(new URL(`../${path}`, import.meta.url).href);
const { createJournalWorker, openPreviewJournal } = await load('tests/preview/journal-test-worker.ts');
const { prepareJournalEnvelope } = await load('tests/preview/journal-envelope.ts');
const { parseModelJson, conclusionText } = await load('tests/preview/model-json.ts');
const { decisionWithinFloor } = await load('tests/preview/model-call-boundary.ts');
const { SUBSCRIPTION_THINKING_ENV, subscriptionConversationPolicy } = await load('src/assembly/production-provider.ts');

const outDir = process.argv[2];
if (!outDir) { process.stderr.write('usage: promise-fulfilment-live-model-run.mjs <out-dir>\n'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const MODEL = process.env.A5_LIVE_MODEL ?? 'claude-sonnet-5';
const policy = subscriptionConversationPolicy(MODEL);
const recorded = JSON.parse(readFileSync(new URL('../tests/preview/fixtures/promise-fulfilment-a5b-2026-10-03.json',
  import.meta.url), 'utf8'));
const [A5, A5B] = recorded.turns;
const PROMISE = recorded.agentPromisesAfterA5[0].quote;

/** The live room's identity shape, so the packet and every id are as long as they really are. */
const genesis = { kind: 'genesis', bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 400, maxReplies: 200, maxTurns: 200, maxBytes: 409600, cursor: 0 };
const now = 1791019493578;
const update = (id, text) => ({ update_id: id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text, date: Math.floor(now / 1000) } });

/** A clean cwd, so the CLI reads no project settings of this repository. */
const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'promise-fulfilment-cwd-')));
const run = async stdin => await new Promise((resolve, reject) => {
  const child = execFile('/usr/bin/claude', [...policy.args], { cwd, maxBuffer: 1 << 22,
    env: { ...process.env, ...SUBSCRIPTION_THINKING_ENV, PATH: policy.path }, timeout: policy.timeout + 60000 },
  (error, stdout, stderr) => error && !stdout ? reject(Object.assign(error, { stderr })) : resolve({ stdout, stderr }));
  child.stdin.end(stdin);
});

const root = realpathSync(mkdtempSync(join(tmpdir(), 'promise-fulfilment-')));
const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(53), genesis);
let calls = 0;
const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
  prepareModel: input => prepareJournalEnvelope(input, MODEL, genesis.grant, now, journal.view.limits.maxBytes),
  model: async ({ question, context, prepared }) => {
    if (question === A5.message) return JSON.stringify({ reply: A5.answer, memory: [], promises: [{ quote: PROMISE }] });
    if (question !== A5B.message) return 'Noted.';
    calls++;
    writeFileSync(join(outDir, `call-${calls}-packet.json`), context);
    writeFileSync(join(outDir, `call-${calls}-prepared.json`), prepared);
    const { stdout, stderr } = await run(prepared);
    writeFileSync(join(outDir, `call-${calls}-stdout.json`), stdout || stderr);
    const frame = JSON.parse(stdout);
    const raw = String(frame.result ?? '');
    writeFileSync(join(outDir, `call-${calls}-result.txt`), raw);
    const extracted = parseModelJson(raw, { wrapped: 'refuse' });
    const decision = extracted.ok ? extracted.value : null;
    const value = decision?.type === 'Decision' && decision.conclusion?.subject === 'preview-stage2-answer'
      && decisionWithinFloor(decision) ? conclusionText(decision.conclusion.value) : null;
    writeFileSync(join(outDir, `call-${calls}-answer.txt`),
      value === null ? `MALFORMED ${extracted.ok ? 'floor-or-subject' : extracted.reason}` : value);
    if (value === null) throw Error('promise-fulfilment: malformed decision');
    return { state: 'complete', text: value, usage: { inputTokens: frame.usage?.input_tokens ?? null,
      outputTokens: frame.usage?.output_tokens ?? null, charge: null, inputComplete: true } };
  },
  send: async () => 1, checkOutbound: () => {} });

worker.intake([update(A5.update, A5.message)]); await worker.drain();
const promised = journal.view.commitments.findIndex(note => note.agentPromise !== undefined);
worker.intake([update(A5B.update, A5B.message)]); await worker.drain();
const last = journal.view.order.at(-1);
const report = { model: MODEL, calls, promised, closed: journal.view.closed.has(promised),
  rejectedDeclarations: journal.view.rejectedObligations,
  proposedFulfills: last?.proposedFulfills ?? null, intentFulfills: last?.intentFulfills ?? null,
  replyBytes: last?.intent === undefined ? null : Buffer.byteLength(last.intent), reply: last?.intent ?? null };
writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 1)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
journal.close();
rmSync(root, { recursive: true, force: true });
rmSync(cwd, { recursive: true, force: true });
