/** Bounded real-model evidence for S11: no live journal input or Telegram transport.
 * Run with slice-ts-loader after the desk's test-login guard; see the ELI16 note. */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';
import { createClaudeCodeSubscriptionRoute, SUBSCRIPTION_CONVERSATION_FRAMING,
  subscriptionConversationPolicy, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { harnessGate } from './harness-user.mjs';
import { installRecallStopSignals } from './real-model-recall-sample.ts';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.ts';
import { genesis, sourceId, update } from './recall-rank-room.ts';

const options = Object.fromEntries(Array.from({ length: (process.argv.length - 2) / 2 }, (_, i) =>
  [process.argv[2 + i * 2].replace(/^--/u, ''), process.argv[3 + i * 2]]));
for (const name of ['login-profile', 'activation-record', 'output']) if (!options[name]) throw Error(`missing --${name}`);
const output = resolve(options.output), model = 'claude-sonnet-5';
const profile = Object.freeze(JSON.parse(readFileSync(options['login-profile'], 'utf8')));
const activationBytes = readFileSync(options['activation-record'], 'utf8');
const activation = JSON.parse(activationBytes);
validateSubscriptionActivation(activation, profile, model, Date.now(), SUBSCRIPTION_CONVERSATION_FRAMING);
const fixtureBytes = readFileSync(new URL('./fixtures/s-recall-meaning-2026-10-25.json', import.meta.url), 'utf8');
const fixture = JSON.parse(fixtureBytes);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const policy = subscriptionConversationPolicy(model);
const stop = installRecallStopSignals();
const active = () => {
  try { return !stop.stopped() && readFileSync(options['activation-record'], 'utf8') === activationBytes; }
  catch { return false; }
};
const report = { status: 'started', model, startedAt: new Date().toISOString(), pid: process.pid,
  method: 'Real production envelope, subscription route and journal worker; local reply capture only.',
  fixture: 's-recall-meaning-2026-10-25.json', fixtureSha256: sha256(fixtureBytes),
  sourceHead: options['source-head'] ?? null,
  promptSha256: Object.fromEntries(['briefing.ts', 'journal.ts'].map(file =>
    [file, sha256(readFileSync(new URL(file, import.meta.url)))])),
  activationSha256: sha256(activationBytes), profileReference: profile.reference,
  limits: { questions: 7, callsPerQuestion: 2, totalCalls: 14, retries: 0, maxCharge: 0,
    charge: 'UNKNOWN (subscription)', timeoutPerCallMs: policy.timeout, maxPromptBytes: genesis.maxBytes },
  reconstruction: '24 verbatim scrubbed recorded turns and concept lists, recorded summary; 44 synthetic garden turns force the summary/recent boundary. Fresh journal and random encryption key per question. No prior question or expected answer is injected.',
  calls: 0, cases: [] };
// Exclusive reservation makes interruption visible, before any paid call.
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
const save = () => writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
const context = { site: 'preview.journal', preserved: 'preview:host', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
const contract = { reference: activation.reference, version: activation.profileDigest,
  parserReference: 'claude-code-json-result', parserVersion: '1', endpoint: profile.loginProfileIdentity,
  account: profile.expectedAccount, credentialReference: profile.reference, controller: 'preview-journal',
  sourceEvidence: [activation.reference], terminalEvidence: activation.reference, terminalReasonField: 'subtype',
  successfulFinalReplyReasons: ['success'], strength: 'attestation', maxMetadataBytes: policy.maxMetadataBytes,
  maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes };

function seed(journal) {
  const rows = [...fixture.candidates, ...Array.from({ length: 44 }, (_, i) => ({
    update: 6236574 + i, text: 'Daily garden observation. '.repeat(100), reply: 'Noted.', at: fixture.now - 1000 }))];
  for (const row of rows) {
    const id = sourceId(row.update);
    journal.append({ kind: 'intake', id, update: row.update, text: row.text, raw: JSON.stringify(update(row.update, row.text)),
      accepted: true, cursor: row.update + 1, at: row.at });
    journal.append({ kind: 'reserve', id, at: row.at });
    journal.append({ kind: 'answer', id, text: row.reply, at: row.at });
    journal.append({ kind: 'intent', id, text: row.reply, chat: genesis.chat, update: row.update, grant: genesis.grant, at: row.at });
    journal.append({ kind: 'sent', id, message: row.update, at: row.at });
  }
  for (let i = 0; i < fixture.candidates.length; i += 4) {
    const batch = fixture.candidates.slice(i, i + 4), through = batch.at(-1).update;
    journal.append({ kind: 'summary-reserve', through, at: fixture.now });
    journal.append({ kind: 'summary', through, text: fixture.summary,
      concepts: batch.map(c => ({ source: sourceId(c.update), terms: c.cues })), at: fixture.now });
  }
}

try {
  const harness = harnessGate({ profile, denied: [homedir(), process.cwd()], clock: () => performance.now() });
  const { user, launcher, login, plan } = harness.current();
  const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => !active(),
    runAs: { user, launcher, login, plan } });
  const route = createClaudeCodeSubscriptionRoute({ context,
    credential: { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: profile.reference },
    profile, resolveProfile: () => profile, provider: 'anthropic', model, route: 'preview-subscription',
    disclosure: 'Subscription preview; charge UNKNOWN', activation, framing: SUBSCRIPTION_CONVERSATION_FRAMING,
    io, now: Date.now, active, adapterEvidenceContract: contract,
    raisedPromptBytes: genesis.maxBytes,
    promptAuthority: 'Operator s-recall-meaning-1026-s2 brief: bounded seven-question offline replay of the recorded fixture at its existing 409600-byte journal context cap' });
  if (route.kind !== 'Success') throw Error('subscription route refused');
  const questions = [...Array.from({ length: 3 }, (_, i) => ({ kind: 'paraphrase', repetition: i + 1, text: fixture.query })),
    ...Array.from({ length: 3 }, (_, i) => ({ kind: 'never-said', repetition: i + 1, text: fixture.questions[1].text })),
    { kind: 'early-fact', repetition: 1, text: 'Who did I say looks after my teeth?' }];
  for (const question of questions) {
    if (!active()) throw Error('replay stopped');
    const root = realpathSync(mkdtempSync(join(tmpdir(), 's-recall-meaning-real-')));
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), randomBytes(32), genesis);
    const row = { ...question, outputs: [], delivered: [], lookup: null, recalledIds: [], verdict: 'pending-review' };
    report.cases.push(row); save();
    try {
      seed(journal);
      const worker = createJournalWorker(journal, { now: () => fixture.now, stopped: () => !active(),
        prepareModel: input => prepareJournalEnvelope(input, model, genesis.grant, fixture.now, genesis.maxBytes),
        model: async input => {
          if (!active() || !input.prepared || row.outputs.length >= 2 || report.calls >= 14 || input.id.startsWith('summary:'))
            throw Error('replay call bound or stop');
          const packet = JSON.parse(input.context);
          const call = { id: input.id, packet, prepared: input.prepared, state: 'reserved', rawOutput: null, usage: null };
          row.outputs.push(call); report.calls++; save();
          const result = await route.value.invoke(input.prepared, { operation: input.id,
            deadline: Math.min(activation.expiresAt, Date.now() + policy.timeout), timeout: policy.timeout,
            maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 });
          call.failure = result.failure ?? null; call.state = result.state; call.rawOutput = result.bytes; call.usage = result.usage ?? null; save();
          if (result.state !== 'complete' || !result.bytes) return { state: result.state === 'complete' ? 'rejected' : result.state };
          const reading = readAnswer(result.bytes, { evidence: [input.id] });
          call.reading = reading; save();
          return reading.ok ? reading.value : { state: 'rejected' };
        }, send: async input => { row.delivered.push(input.text); return input.update; }, checkOutbound: () => {} });
      worker.intake([update(6236619, question.text)]);
      await worker.drain();
      const turn = journal.view.turns.get(sourceId(6236619));
      row.lookup = turn?.lookup ?? null;
      row.recalledIds = row.outputs.flatMap(call => call.packet.recalled?.map(item => item.id) ?? []);
      row.answer = turn?.answer ?? null;
      row.endedAt = new Date().toISOString();
      save();
      process.stdout.write(`${row.kind} ${row.repetition}: ${row.outputs.length} calls; lookup ${JSON.stringify(row.lookup)}; ${JSON.stringify(row.delivered)}\n`);
    } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
  }
  report.status = 'complete-pending-review'; report.endedAt = new Date().toISOString(); save();
} finally { stop.close(); }
