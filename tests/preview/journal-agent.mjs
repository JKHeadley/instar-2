#!/usr/bin/env node
// Small, machine-local preview launcher. Only this file owns process, clock and
// physical ports. The worker owns all durable conversation/effect transitions.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createProductionTelegramIO, createSubscriptionProviderIO, productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { createClaudeCodeSubscriptionRoute, SUBSCRIPTION_CONVERSATION_FRAMING,
  subscriptionConversationPolicy, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { redact } from '../../src/recall/redact.js';
import { openPreviewJournal, createJournalWorker } from './journal.js';

const parse = values => {
  const command = values[0] ?? 'run', options = {};
  for (let i = 1; i < values.length; i += 2) {
    if (!values[i]?.startsWith('--') || values[i + 1] === undefined) throw Error('preview: malformed arguments');
    options[values[i].slice(2)] = values[i + 1];
  }
  return { command, options };
};
const required = (options, name) => { if (!options[name]) throw Error(`preview: missing --${name}`); return options[name]; };
const number = (value, name, minimum = 1) => {
  const n = Number(value); if (!Number.isSafeInteger(n) || n < minimum) throw Error(`preview: invalid ${name}`); return n;
};
const expiry = value => {
  const numeric = Number(value), parsed = Number.isSafeInteger(numeric) && numeric > 0 ? numeric : Date.parse(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw Error('preview: invalid expiry'); return parsed;
};
const key = () => {
  const value = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY;
  if (!value) throw Error('preview: storage SecretRef unavailable');
  const bytes = Buffer.from(value, /^[a-f0-9]{64}$/iu.test(value) ? 'hex' : 'base64');
  if (bytes.length !== 32) throw Error('preview: storage SecretRef malformed'); return bytes;
};
const token = () => {
  const value = process.env.INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN;
  if (!value || !/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(value)) throw Error('preview: Telegram SecretRef unavailable');
  return value;
};
const context = { site: 'preview.journal', preserved: 'preview:host', register: {
  generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
  entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
  sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
  conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
const take = result => { if (result.kind !== 'Success') throw Error(`preview: adapter refused ${result.detail ?? ''}`); return result.value; };
const secretRef = name => ({ type: 'SecretRef', schemaVersion: 1, vault: 'preview', name });
const digest = value => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const delay = ms => new Promise(done => setTimeout(done, ms));

async function main() {
  const { command, options } = parse(process.argv.slice(2));
  if (!['run', 'status', 'stop'].includes(command)) throw Error('preview: unknown command');
  const root = resolve(required(options, 'root'));
  const machine = options.machine ?? 'preview-local-machine';
  const storage = take(openProductionStorage({ root: join(root, '.writer'), machine,
    key: key(), policy: 'preview-journal', store: 'preview-journal', context, io: productionStorageIO }));
  let journal;
  try {
    const initial = command !== 'run' ? undefined : {
      kind: 'genesis', bot: required(options, 'bot-id'), chat: required(options, 'chat-id'),
      operator: required(options, 'operator-sender-id'), grant: required(options, 'grant-reference'),
      configurationDigest: required(options, 'configuration-digest'), expires: expiry(required(options, 'expires-at')),
      maxCalls: number(options['max-calls'] ?? '16', 'max-calls'), maxReplies: number(options['max-replies'] ?? '16', 'max-replies'),
      maxTurns: number(options['max-turns'] ?? '20', 'max-turns'), maxBytes: number(options['max-context-bytes'] ?? '32768', 'max-context-bytes'), cursor: 0 };
    journal = openPreviewJournal(join(root, 'journal.encrypted'), key(), initial);
    const g = journal.view.genesis;
    for (const [name, value] of [['bot-id', g.bot], ['chat-id', g.chat], ['operator-sender-id', g.operator],
      ['grant-reference', g.grant], ['configuration-digest', g.configurationDigest]])
      if (options[name] && options[name] !== value) throw Error(`preview: ${name} differs from journal`);
    if (command === 'status') {
      process.stdout.write(`${JSON.stringify({ cursor: journal.view.cursor, turns: journal.view.order.length,
        calls: journal.view.calls, replies: journal.view.replies, stop: journal.view.stop, sourceStop: journal.view.sourceStop,
        unknownCalls: journal.view.order.filter(t => t.reserved && !t.answer).length,
        unknownSends: journal.view.order.filter(t => t.intent && !t.sent).length })}\n`); return;
    }
    const workerStop = { value: false };
    const worker = createJournalWorker(journal, { now: Date.now, stopped: () => workerStop.value,
      checkOutbound: text => { if (redact(text).count) throw Error('preview: outbound secret refused'); },
      model: async ({ question, context: packet, id }) => {
        const route = modelRoute(), policy = subscriptionConversationPolicy(required(options, 'model'));
        const bindings = { at: Date.now(), by: { judgment: 'judgment', model: options.model, route: 'preview-subscription' },
          floor: { actions: ['answer'] }, evidence: [id] };
        const bytes = JSON.stringify({ provider: 'anthropic', model: options.model, route: 'preview-subscription',
          messages: [{ role: 'user', content: question }, { role: 'context', content: JSON.stringify({ bindings, packet: JSON.parse(packet) }) }],
          attachments: [], tools: [], settings: { automaticRetries: 0, maxTokens: policy.maxTokens },
          outputSchema: { type: 'Decision' }, floor: bindings.floor, evidence: bindings.evidence, point: 'judgment', generation: g.grant });
        if (Buffer.byteLength(bytes) + 2500 > policy.maxPromptBytes) throw Error('preview: full prompt overflow');
        const result = await route.invoke(bytes, { operation: id, deadline: Math.min(g.expires, Date.now() + 180000),
          timeout: policy.timeout, maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens,
          maxCharge: 0, automaticRetries: 0 });
        if (result.state !== 'complete' || !result.bytes) throw Error('preview: model UNKNOWN');
        const decision = JSON.parse(result.bytes);
        if (decision.type !== 'Decision' || decision.conclusion?.subject !== 'preview-stage2-answer'
          || typeof decision.conclusion.value !== 'string') throw Error('preview: model answer malformed');
        return decision.conclusion.value;
      },
      send: async ({ text, chat }) => {
        if (workerStop.value || Date.now() >= g.expires || journal.view.stop) return null;
        const reply = physical.invoke({ token: secretRef('telegram-bot-token'), method: 'sendMessage',
          body: { chat_id: chat, text: text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'), parse_mode: 'HTML' }, timeoutMs: 30000 }, token());
        if (reply.kind !== 'response' || reply.status !== 200) return null;
        const payload = JSON.parse(reply.bytes);
        return payload.ok === true && String(payload.result?.chat?.id) === chat && Number.isSafeInteger(payload.result?.message_id)
          ? payload.result.message_id : null;
      } });
    if (command === 'stop') { worker.stop('operator'); return; }
    const activationPath = required(options, 'activation-record');
    const activationBytes = readFileSync(activationPath, 'utf8');
    const activation = JSON.parse(activationBytes), profile = Object.freeze(JSON.parse(readFileSync(required(options, 'login-profile'), 'utf8')));
    const active = () => { try { return readFileSync(activationPath, 'utf8') === activationBytes; } catch { return false; } };
    validateSubscriptionActivation(activation, profile, required(options, 'model'), Date.now(), SUBSCRIPTION_CONVERSATION_FRAMING);
    if (activation.trial !== g.grant || activation.baseConfigurationDigest !== g.configurationDigest || activation.expiresAt !== g.expires)
      throw Error('preview: activation differs from journal');
    const captures = new Map();
    const physical = createProductionTelegramIO(join(root, '.writer'), { preserve(ref, bytes) {
      if (captures.has(ref) && captures.get(ref) !== bytes) return false; captures.set(ref, bytes); return true;
    }, read: ref => captures.get(ref) ?? null });
    const identity = physical.invoke({ token: secretRef('telegram-bot-token'), method: 'getMe', body: {}, timeoutMs: 30000,
      identityBinding: { id: number(g.bot, 'bot-id'), username: required(options, 'bot-username').replace(/^@/, '') } }, token());
    if (identity.kind !== 'identity' || identity.identity.id !== Number(g.bot)) throw Error('preview: bot identity refused');
    let signalled = false;
    const signal = () => { signalled = true; workerStop.value = true; try { worker.stop('signal'); } catch {} };
    process.once('SIGINT', signal); process.once('SIGTERM', signal);
    const cycles = number(options['max-cycles'] ?? '1000', 'max-cycles');
    let summaryJob = null;
    const summarizeLater = () => {
      if (summaryJob) return;
      summaryJob = worker.summarizeIfNeeded().catch(() => {}).finally(() => { summaryJob = null; });
    };
    for (let i = 0; i < cycles && !signalled; i++) {
      worker.gate(); await worker.drain(); summarizeLater(); worker.gate();
      const result = physical.invoke({ token: secretRef('telegram-bot-token'), method: 'getUpdates',
        body: { offset: journal.view.cursor, limit: 1, timeout: number(options['max-poll-seconds'] ?? '5', 'max-poll-seconds') },
        timeoutMs: 12000 }, token());
      if (result.kind !== 'response' || result.status !== 200) { await delay(500); continue; }
      const updates = JSON.parse(result.bytes);
      if (updates.ok !== true || !Array.isArray(updates.result)) throw Error('preview: poll malformed');
      worker.intake(updates.result); await worker.drain(); summarizeLater();
    }
    await summaryJob;
    function modelRoute() {
      if (!active() || workerStop.value) throw Error('preview: activation stopped');
      const policy = subscriptionConversationPolicy(options.model);
      const contract = { reference: activation.reference, version: activation.profileDigest,
        parserReference: 'claude-code-json-result', parserVersion: '1', endpoint: profile.loginProfileIdentity,
        account: profile.expectedAccount, credentialReference: profile.reference, controller: 'preview-journal',
        sourceEvidence: [activation.reference], terminalEvidence: activation.reference, terminalReasonField: 'subtype',
        successfulFinalReplyReasons: ['success'], strength: 'attestation', maxMetadataBytes: policy.maxMetadataBytes,
        maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes };
      return take(createClaudeCodeSubscriptionRoute({ context, credential: secretRef(profile.reference), profile,
        resolveProfile: () => profile, provider: 'anthropic', model: options.model, route: 'preview-subscription',
        disclosure: 'Subscription preview; charge UNKNOWN', activation, framing: SUBSCRIPTION_CONVERSATION_FRAMING,
        io: createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => workerStop.value || !active() }),
        now: Date.now, active: () => !workerStop.value && active() && !journal.view.stop,
        adapterEvidenceContract: contract }));
    }
  } finally { journal?.close(); storage.close(); }
}

try { await main(); } catch { process.stderr.write('preview refused to start or continue; details suppressed\n'); process.exitCode = 1; }
