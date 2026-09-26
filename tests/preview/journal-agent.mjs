#!/usr/bin/env node
// Small, machine-local preview launcher. Only this file owns process, clock and
// physical ports. The worker owns all durable conversation/effect transitions.
import { existsSync, readFileSync, lstatSync, realpathSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createProductionTelegramIO, createSubscriptionProviderIO, productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { createClaudeCodeSubscriptionRoute, SUBSCRIPTION_CONVERSATION_FRAMING,
  subscriptionConversationPolicy, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { redact } from '../../src/recall/redact.js';
import { durablePreviewWrite } from './state.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SOURCE_PINS, sourcePacket, deskStatusSource, readDeskStatus } from './briefing.js';
import { openPreviewJournal, createJournalWorker, raiseJournalCaps, PREVIEW_LIVE_LIMITS } from './journal.js';

const parse = values => {
  const command = values[0] ?? 'run', options = {};
  for (let i = 1; i < values.length; i += 2) {
    if (!values[i]?.startsWith('--') || values[i + 1] === undefined) throw Error('preview: malformed arguments');
    options[values[i].slice(2)] = values[i + 1];
  }
  return { command, options };
};
const required = (options, name) => { if (!options[name]) throw Error(`preview: missing --${name}`); return options[name]; };
const number = (value, name, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) => {
  const n = Number(value); if (!Number.isSafeInteger(n) || n < minimum || n > maximum) throw Error(`preview: invalid ${name}`); return n;
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
const delay = ms => new Promise(done => setTimeout(done, ms));
/** The exact sources every live turn carries; shared by run and the read-only inspect probe. */
const turnSources = (root, options, view) => {
  const sources = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
    { providerAttempts: view.limits.maxCalls, expiresAt: view.genesis.expires }).sources;
  const deskStatusPath = resolve(options['desk-status'] ?? join(root, 'desk-status.md'));
  return () => [...sources, deskStatusSource(readDeskStatus(deskStatusPath), Date.now(), deskStatusPath)];
};
/** Only the recall-relevant parts of a packet, never sources or history text. */
const recallView = packet => ({ historyMode: packet.historyMode, summaryThrough: packet.summary?.through ?? null,
  people: packet.people ?? [], commitments: packet.commitments ?? [], recalled: packet.recalled?.length ?? 0, history: packet.history?.length ?? 0 });
const contextOf = prompt => JSON.parse(JSON.parse(prompt).messages.find(m => m.role === 'context').content).packet;

async function main() {
  const { command, options } = parse(process.argv.slice(2));
  if (!['run', 'status', 'stop', 'raise-caps', 'inspect'].includes(command)) throw Error('preview: unknown command');
  const root = resolve(required(options, 'root'));
  if (command === 'run') mkdirSync(root, { recursive: true, mode: 0o700 });
  if (realpathSync(root) !== root || lstatSync(root).isSymbolicLink()) throw Error('preview: substituted root');
  const stopPath = join(root, 'preview-stop.json');
  const journalPath = join(root, 'journal.encrypted');
  const importPath = join(root, 'preview-import.json');
  const importMarker = existsSync(importPath) ? JSON.parse(readFileSync(importPath, 'utf8')) : null;
  if (importMarker && (importMarker.version !== 1 || typeof importMarker.source !== 'string'))
    throw Error('preview: import marker malformed');
  if (command === 'stop') {
    if (!existsSync(journalPath)) throw Error('preview: journal absent');
    if (!existsSync(stopPath)) durablePreviewWrite(stopPath, { latchedAt: Date.now(), reason: 'operator' });
    return;
  }
  if (command === 'status') {
    let view;
    try { view = openPreviewJournal(journalPath, key(), undefined, undefined, true); }
    catch (error) {
      if (!importMarker) throw error;
      process.stdout.write(`${JSON.stringify({ cursor: null, importComplete: false })}\n`);
      return;
    }
    try { process.stdout.write(`${JSON.stringify({ cursor: view.view.cursor, turns: view.view.order.length,
      calls: view.view.calls, replies: view.view.replies, limits: view.view.limits,
      capAuthority: view.view.capAuthority,
      stop: existsSync(stopPath) ? JSON.parse(readFileSync(stopPath, 'utf8')) : view.view.stop,
      sourceStop: view.view.sourceStop,
      importComplete: importMarker
        ? view.view.genesis.importSource === importMarker.source && view.view.imported
        : view.view.genesis.importSource === undefined || view.view.imported,
      summaryThrough: view.view.summaries.at(-1)?.through ?? null,
      holds: view.view.order.filter(t => t.held).map(t => ({ update: t.update, reason: t.held })),
      unknownCalls: view.view.order.filter(t => t.reserved && !t.answer).length,
      unknownSends: view.view.order.filter(t => t.intent && !t.sent).length,
      summaries: view.view.summaries.map(s => ({ through: s.through, people: s.people ? s.people.length : null,
        commitments: s.commitments ? s.commitments.length : null, closed: s.closed?.length ?? 0 })),
      commitments: { total: view.view.commitments.length, open: view.view.commitments.length - view.view.closed.size },
      summaryPending: [...view.view.summaryReservations].filter(through => !view.view.summaries.some(s => s.through === through)).length,
      people: [...new Set(view.view.people.map(note => note.name))] })}\n`); }
    finally { view.close(); }
    return;
  }
  if (command === 'inspect') {
    // Read-only: the last persisted model prompt's recall view and, with --text, what a next
    // message would get now. No append, no model call, no send.
    const view = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try {
      const last = view.view.order.filter(t => t.prompt !== undefined).at(-1);
      let next;
      if (options.text !== undefined) {
        const refuse = () => { throw Error('preview: inspect never calls or sends'); };
        const probe = createJournalWorker(view, { now: Date.now, stopped: () => true, sources: turnSources(root, options, view.view),
          prepareModel: input => prepareJournalEnvelope(input, required(options, 'model'), view.view.genesis.grant, Date.now()),
          model: refuse, send: refuse, checkOutbound: refuse }).probe(options.text);
        next = 'reason' in probe ? { held: probe.reason } : recallView(JSON.parse(probe.context));
      }
      process.stdout.write(`${redact(JSON.stringify({ last: last ? { update: last.update, answered: last.answer !== undefined,
        ...recallView(contextOf(last.prompt)) } : null, ...(next ? { next } : {}) })).text}\n`);
    } finally { view.close(); }
    return;
  }
  if (importMarker) {
    const check = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try {
      if (check.view.genesis.importSource !== importMarker.source || !check.view.imported)
        throw Error('preview: migration incomplete');
    } finally { check.close(); }
  }
  const machine = options.machine ?? 'preview-local-machine';
  const storage = take(openProductionStorage({ root: join(root, '.writer'), machine,
    key: key(), policy: 'preview-journal', store: 'preview-journal', context, io: productionStorageIO }));
  if (command === 'raise-caps') {
    let capJournal;
    try {
      if (existsSync(stopPath)) throw Error('preview: stop latched');
      capJournal = openPreviewJournal(journalPath, key());
      if (Date.now() >= capJournal.view.genesis.expires) throw Error('preview: expired');
      raiseJournalCaps(capJournal, { maxCalls: number(required(options, 'max-calls'), 'max-calls'),
        maxReplies: number(required(options, 'max-replies'), 'max-replies'),
        maxTurns: number(required(options, 'max-turns'), 'max-turns'),
        authority: required(options, 'authority'), at: Date.now() });
    } finally { capJournal?.close(); storage.close(); }
    return;
  }
  let journal, worker, signalled = false;
  const workerStop = { value: false };
  const signal = () => { signalled = true; workerStop.value = true; };
  process.once('SIGINT', signal); process.once('SIGTERM', signal); process.once('SIGHUP', signal);
  try {
    const maxCalls = number(options['max-calls'] ?? '16', 'max-calls');
    const maxReplies = number(options['max-replies'] ?? '16', 'max-replies');
    const maxTurns = number(options['max-turns'] ?? '20', 'max-turns');
    const maxBytes = number(options['max-context-bytes'] ?? '32768', 'max-context-bytes');
    if (!existsSync(journalPath) && (maxCalls > PREVIEW_LIVE_LIMITS.calls || maxReplies > PREVIEW_LIVE_LIMITS.replies
      || maxTurns > PREVIEW_LIVE_LIMITS.turns || maxBytes > PREVIEW_LIVE_LIMITS.contextBytes))
      throw Error('preview: live allowance outside approved bound');
    const initial = command !== 'run' ? undefined : {
      kind: 'genesis', bot: required(options, 'bot-id'), chat: required(options, 'chat-id'),
      operator: required(options, 'operator-sender-id'), grant: required(options, 'grant-reference'),
      configurationDigest: required(options, 'configuration-digest'), expires: expiry(required(options, 'expires-at')),
      maxCalls, maxReplies, maxTurns, maxBytes, cursor: 0 };
    journal = openPreviewJournal(journalPath, key(), initial);
    const g = journal.view.genesis;
    for (const [name, supplied, original, current] of [
      ['max-calls', maxCalls, g.maxCalls, journal.view.limits.maxCalls],
      ['max-replies', maxReplies, g.maxReplies, journal.view.limits.maxReplies],
      ['max-turns', maxTurns, g.maxTurns, journal.view.limits.maxTurns]])
      if (options[name] && supplied !== original && supplied !== current)
        throw Error(`preview: ${name} differs from journal`);
    if (g.importSource !== undefined && !journal.view.imported) throw Error('preview: migration incomplete');
    if (String(number(g.bot, 'bot-id')) !== g.bot || String(number(g.chat, 'chat-id')) !== g.chat
      || g.chat !== g.operator) throw Error('preview: private operator binding differs');
    for (const [name, value] of [['bot-id', g.bot], ['chat-id', g.chat], ['operator-sender-id', g.operator],
      ['grant-reference', g.grant], ['configuration-digest', g.configurationDigest]])
      if (options[name] && options[name] !== value) throw Error(`preview: ${name} differs from journal`);
    const modelEnvelope = input => prepareJournalEnvelope(input, required(options, 'model'), g.grant, Date.now());
    worker = createJournalWorker(journal, { now: Date.now, stopped: () => workerStop.value || existsSync(stopPath),
      sources: turnSources(root, options, journal.view),
      prepareModel: modelEnvelope,
      checkOutbound: text => { if (redact(text).count) throw Error('preview: outbound secret refused'); },
      model: async ({ id, prepared }) => {
        if (typeof prepared !== 'string') throw Error('preview: prepared model input absent');
        const route = modelRoute(), policy = subscriptionConversationPolicy(required(options, 'model'));
        const result = await route.invoke(prepared, { operation: id, deadline: Math.min(g.expires, Date.now() + 180000),
          timeout: policy.timeout, maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens,
          maxCharge: 0, automaticRetries: 0 });
        if (result.state !== 'complete' || !result.bytes) throw Error('preview: model UNKNOWN');
        const decision = JSON.parse(result.bytes);
        if (decision.type !== 'Decision' || decision.conclusion?.subject !== 'preview-stage2-answer'
          || typeof decision.conclusion.value !== 'string') throw Error('preview: model answer malformed');
        return { text: decision.conclusion.value,
          usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, charge: null } };
      },
      send: async ({ text, expectedText, chat, thread }) => {
        if (workerStop.value || existsSync(stopPath) || Date.now() >= g.expires || journal.view.stop) return null;
        const reply = physical.invoke({ token: secretRef('telegram-bot-token'), method: 'sendMessage',
          body: { chat_id: chat, text, parse_mode: 'HTML', ...(thread === undefined ? {} : { message_thread_id: thread }) },
          timeoutMs: 30000 }, token());
        if (reply.kind !== 'response' || reply.status !== 200) return null;
        const payload = JSON.parse(reply.bytes);
        return payload.ok === true && String(payload.result?.chat?.id) === chat && payload.result?.text === expectedText
          && (thread === undefined || payload.result?.message_thread_id === thread)
          && Number.isSafeInteger(payload.result?.message_id)
          ? payload.result.message_id : null;
      } });
    if (existsSync(stopPath)) throw Error('preview: stop latched');
    const activationPath = required(options, 'activation-record');
    const activationBytes = readFileSync(activationPath, 'utf8');
    const activation = JSON.parse(activationBytes), profile = Object.freeze(JSON.parse(readFileSync(required(options, 'login-profile'), 'utf8')));
    const active = () => { try { return readFileSync(activationPath, 'utf8') === activationBytes; } catch { return false; } };
    validateSubscriptionActivation(activation, profile, required(options, 'model'), Date.now(), SUBSCRIPTION_CONVERSATION_FRAMING);
    if (activation.trial !== g.grant || activation.baseConfigurationDigest !== g.configurationDigest || activation.expiresAt !== g.expires)
      throw Error('preview: activation differs from journal');
    const captures = new Map();
    const offlineEndpoint = process.env.INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT;
    if (offlineEndpoint && (token() !== '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      || !/^http:\/\/127\.0\.0\.1:[0-9]+$/u.test(offlineEndpoint))) throw Error('preview: offline endpoint refused');
    const physical = createProductionTelegramIO(join(root, '.writer'), { preserve(ref, bytes) {
      if (captures.has(ref) && captures.get(ref) !== bytes) return false; captures.set(ref, bytes); return true;
    }, read: ref => captures.get(ref) ?? null }, offlineEndpoint);
    if (signalled || existsSync(stopPath)) return;
    const identity = physical.invoke({ token: secretRef('telegram-bot-token'), method: 'getMe', body: {}, timeoutMs: 30000,
      identityBinding: { id: number(g.bot, 'bot-id'), username: required(options, 'bot-username').replace(/^@/, '') } }, token());
    if (identity.kind !== 'identity' || identity.identity.id !== Number(g.bot)) throw Error('preview: bot identity refused');
    const cycles = number(options['max-cycles'] ?? '1000', 'max-cycles', 1, 1_000_000);
    let failedPolls = 0;
    const pollFailure = async () => {
      failedPolls++;
      if (failedPolls >= 20) return false;
      const until = Date.now() + Math.min(30000, 250 * 2 ** Math.min(failedPolls - 1, 7));
      while (!workerStop.value && !existsSync(stopPath) && Date.now() < until)
        await delay(Math.min(100, until - Date.now()));
      return true;
    };
    let summaryJob = null;
    const summarizeLater = () => {
      if (summaryJob) return;
      summaryJob = worker.summarizeIfNeeded().catch(() => {}).finally(() => { summaryJob = null; });
    };
    for (let i = 0; i < cycles && !signalled; i++) {
      if (i > 0) await new Promise(done => setImmediate(done));
      if (signalled || workerStop.value || existsSync(stopPath)) break;
      worker.gate(); await worker.drain(); summarizeLater(); worker.gate();
      if (existsSync(stopPath) || Date.now() >= g.expires) break;
      try { worker.pollGate(); } catch { break; }
      if (signalled || workerStop.value || existsSync(stopPath)) break;
      let result;
      try { result = physical.invoke({ token: secretRef('telegram-bot-token'), method: 'getUpdates',
        body: { offset: journal.view.cursor, limit: 1, timeout: number(options['max-poll-seconds'] ?? '5', 'max-poll-seconds', 1, 5) },
        timeoutMs: 12000 }, token()); }
      catch { if (!await pollFailure()) break; continue; }
      await new Promise(done => setImmediate(done));
      if (signalled || workerStop.value || existsSync(stopPath)) break;
      if (result.kind !== 'response' || result.status !== 200) { if (!await pollFailure()) break; continue; }
      let updates;
      try { updates = JSON.parse(result.bytes); } catch { if (!await pollFailure()) break; continue; }
      if (updates.ok !== true || !Array.isArray(updates.result)) { if (!await pollFailure()) break; continue; }
      failedPolls = 0;
      worker.intake(updates.result); await worker.drain(); summarizeLater();
    }
    await summaryJob;
    function modelRoute() {
      if (!active() || workerStop.value || existsSync(stopPath)) throw Error('preview: activation stopped');
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
        io: createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => workerStop.value || existsSync(stopPath) || !active() }),
        now: Date.now, active: () => !workerStop.value && !existsSync(stopPath) && active() && !journal.view.stop,
        adapterEvidenceContract: contract }));
    }
  } catch (error) { if (!signalled) throw error; }
  finally { journal?.close(); storage.close(); process.removeListener('SIGINT', signal); process.removeListener('SIGTERM', signal); process.removeListener('SIGHUP', signal); }
}

try { await main(); } catch { process.stderr.write('preview refused to start or continue; details suppressed\n'); process.exitCode = 1; }
