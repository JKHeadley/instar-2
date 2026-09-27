#!/usr/bin/env node
// Small, machine-local preview launcher. Only this file owns process, clock and
// physical ports. The worker owns all durable conversation/effect transitions.
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createProductionTelegramIO, createSubscriptionProviderIO, productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { createClaudeCodeSubscriptionRoute, SUBSCRIPTION_CONVERSATION_FRAMING,
  subscriptionConversationPolicy, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { redact } from '../../src/recall/redact.js';
import { durablePreviewWrite } from './state.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SOURCE_PINS, sourcePacket, deskStatusSource, readDeskStatus } from './briefing.js';
import { openPreviewJournal, createJournalWorker, importChannelFixture, raiseJournalCaps, PREVIEW_LIVE_LIMITS } from './journal.js';
import { appendRun, readRuns, selfState, selfStateSource, zoneFormatter } from './self-state.js';
import { awayDigest, awayDigestSource } from './away-digest.js';
import { JEV_MODEL, jevQuestions, REPLY_RULES, replyReviewContext } from './reply-check.js';
import { dueState } from './dated-memory.js';

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
const typesafeKey = () => {
  const value = process.env.INSTAR_SECRET_PREVIEW_TYPESAFE_KEY;
  if (!value || !value.trim()) throw Error('preview: TypeSafe SecretRef unavailable');
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
/** The exact sources every live turn carries; shared by run and the read-only inspect probe.
 * The self-state is recomputed at each turn from the journal and the run log; the desk's
 * report (optional) covers only other work. */
const turnSources = (root, options, view, runs, current = () => undefined) => {
  const sources = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
    { providerAttempts: view.limits.maxCalls, expiresAt: view.genesis.expires }).sources;
  const deskStatusPath = resolve(options['desk-status'] ?? join(root, 'desk-status.md'));
  return turn => {
    const now = Date.now(), log = runs();
    const desk = deskStatusSource(readDeskStatus(deskStatusPath), now, deskStatusPath);
    const digest = turn && awayDigest(view, log, now, turn, [desk]);
    return [...sources, selfStateSource(selfState(view, log, now, timeZoneOf(options), current())), desk,
      ...(digest ? [awayDigestSource(digest)] : [])];
  };
};
/** The operator's IANA time zone for "today"; UTC unless given. An unknown zone refuses. */
const timeZoneOf = options => { const zone = options['time-zone'] ?? 'UTC'; zoneFormatter(zone); return zone; };
/** Only the recall-relevant parts of a packet, never sources or history text. */
const recallView = packet => ({ historyMode: packet.historyMode, summaryThrough: packet.summary?.through ?? null,
  people: packet.people ?? [], commitments: packet.commitments ?? [], channelMemory: packet.channelMemory ?? [], memory: packet.memory ?? [],
  dated: packet.dated ?? [], moreDated: packet.moreDated ?? 0,
  datedPending: packet.datedPending ?? [], moreDatedPending: packet.moreDatedPending ?? 0,
  preferences: packet.preferences ?? [],
  openConflicts: packet.openConflicts ?? [],
  recalled: packet.recalled?.length ?? 0, history: packet.history?.length ?? 0,
  corrections: (packet.corrections ?? []).map(item => ({ update: item.update, date: item.date, rules: item.findings.map(f => f.rule),
    problems: item.findings.map(f => f.possibleProblem) })) });
const withheldView = view => {
  const preferenceKeys = new Set();
  for (const change of view.memory) {
    if (change.mode === 'prefer') preferenceKeys.add(JSON.stringify([change.source, change.quote]));
    else if (change.mode === 'correct' && preferenceKeys.has(JSON.stringify([change.source, change.quote])))
      preferenceKeys.add(JSON.stringify([change.trigger, change.replacement]));
  }
  return view.memory.filter(change => change.mode !== 'prefer').map(change => ({
    ...(change.source.startsWith('channel:')
      ? { channelSource: view.channelItems.get(change.source.slice('channel:'.length))?.source,
        channelSourceId: redact(view.channelItems.get(change.source.slice('channel:'.length))?.id ?? '').text }
      : { sourceUpdate: view.turns.get(change.source)?.update }),
    operatorUpdate: view.turns.get(change.trigger)?.update, quote: redact(change.quote).text,
    reason: preferenceKeys.has(JSON.stringify([change.source, change.quote]))
      ? change.mode === 'forget' ? 'verified operator removed this reply preference' : 'verified operator changed this reply preference'
      : change.mode === 'forget' ? 'verified operator requested forgetting' : 'verified operator corrected this fact' }));
};
const contextOf = prompt => JSON.parse(JSON.parse(prompt).messages.find(m => m.role === 'context').content).packet;

async function main() {
  const { command, options } = parse(process.argv.slice(2));
  if (!['run', 'status', 'stop', 'raise-caps', 'inspect', 'import-fixture'].includes(command)) throw Error('preview: unknown command');
  const root = resolve(required(options, 'root'));
  if (command === 'run') mkdirSync(root, { recursive: true, mode: 0o700 });
  if (realpathSync(root) !== root || lstatSync(root).isSymbolicLink()) throw Error('preview: substituted root');
  const stopPath = join(root, 'preview-stop.json');
  const journalPath = join(root, 'journal.encrypted');
  const importPath = join(root, 'preview-import.json');
  const runsPath = join(root, 'runs.jsonl');
  timeZoneOf(options);
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
      channelItems: view.view.channelItems.size,
      calls: view.view.calls, replies: view.view.replies, limits: view.view.limits,
      capAuthority: view.view.capAuthority,
      stop: existsSync(stopPath) ? JSON.parse(readFileSync(stopPath, 'utf8')) : view.view.stop,
      sourceStop: view.view.sourceStop,
      importComplete: importMarker
        ? view.view.genesis.importSource === importMarker.source && view.view.imported
        : view.view.genesis.importSource === undefined || view.view.imported,
      summaryThrough: view.view.summaries.at(-1)?.through ?? null,
      withheld: withheldView(view.view),
      conflicts: view.view.conflicts.map(item => ({ askedByUpdate: view.view.turns.get(item.askedBy)?.update,
        asked: item.asked, answeredByUpdate: item.answeredBy ? view.view.turns.get(item.answeredBy)?.update : null,
        first: { source: item.first.source, quote: redact(item.first.quote).text },
        second: { source: item.second.source, quote: redact(item.second.quote).text }, winner: item.winner ?? null })),
      holds: view.view.order.filter(t => t.held).map(t => ({ update: t.update, reason: t.held })),
      unknownCalls: view.view.order.filter(t => t.reserved && (t.modelState === 'uncertain' || t.answer === undefined)).length,
      modelFailureClasses: Object.fromEntries(view.view.failureClasses),
      modelResultStates: Object.fromEntries(view.view.providerStates),
      unknownSends: view.view.order.filter(t => t.intent && !t.sent).length,
      summaries: view.view.summaries.map(s => ({ through: s.through, people: s.people ? s.people.length : null,
        commitments: s.commitments ? s.commitments.length : null, closed: s.closed?.length ?? 0,
        memory: s.memory ? s.memory.length : null })),
      commitments: { total: view.view.commitments.length, open: view.view.commitments.length - view.view.closed.size },
      dated: view.view.dated.filter(item => !view.view.memory.some(change => change.mode !== 'prefer' && change.source === item.source
        && (item.quote.includes(change.quote) || change.quote.includes(item.quote)))).map(item => ({ sourceUpdate: view.view.turns.get(item.source)?.update,
        quote: redact(item.quote).text, when: redact(item.when).text, zone: item.zone, day: item.day ?? null,
        time: item.time ?? null, ambiguity: item.ambiguity ?? null, state: dueState(item, Date.now()) })),
      datedPending: view.view.order.filter(item => item.datedPending && !view.view.memory.some(change => change.mode !== 'prefer' && change.source === item.id))
        .map(item => ({ update: item.update, message: redact(item.text).text.slice(0, 500) })),
      summaryPending: [...view.view.summaryReservations].filter(through => !view.view.summaries.some(s => s.through === through)).length,
      coherence: { checked: view.view.order.filter(t => t.checked).length,
        unchecked: view.view.order.filter(t => t.intent !== undefined && !t.checked).length,
        failed: view.view.order.filter(t => t.checkFailed).length,
        pendingCorrections: view.view.corrections.length,
        findings: view.view.order.filter(t => t.checked?.length).map(t => ({ update: t.update, rules: t.checked.map(f => f.rule) })) },
      jevChecks: view.view.jevChecks, replyChecks: view.view.replyCheckCounts, replyCheckPaths: view.view.replyCheckPaths,
      lastReplyCheck: view.view.lastReplyCheck,
      people: [...new Set(view.view.people.filter(note => !view.view.memory.some(change =>
        note.source === change.source && note.quote.includes(change.quote))).map(note => note.name))],
      launches: readRuns(runsPath).launches.slice(-3),
      self: selfState(view.view, readRuns(runsPath), Date.now(), timeZoneOf(options)) })}\n`); }
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
        const probe = createJournalWorker(view, { now: Date.now, stopped: () => true, timeZone: timeZoneOf(options), sources: turnSources(root, options, view.view, () => readRuns(runsPath)),
          prepareModel: input => prepareJournalEnvelope(input, required(options, 'model'), view.view.genesis.grant, Date.now(), view.view.limits.maxBytes),
          model: refuse, send: refuse, checkOutbound: refuse }).probe(options.text);
        next = 'reason' in probe ? { held: probe.reason } : recallView(JSON.parse(probe.context));
      }
      process.stdout.write(`${redact(JSON.stringify({ last: last ? { update: last.update, answered: last.answer !== undefined,
        ...recallView(contextOf(last.prompt)) } : null, ...(next ? { next } : {}), withheld: withheldView(view.view),
        jevChecks: view.view.jevChecks, replyChecks: view.view.replyCheckCounts, replyCheckPaths: view.view.replyCheckPaths,
        lastReplyCheck: view.view.lastReplyCheck })).text}\n`);
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
  if (command === 'import-fixture') {
    let fixtureJournal;
    try {
      if (options['live-mail'] !== undefined && options['live-mail'] !== 'false')
        throw Error('preview: live mail source is disabled');
      if (existsSync(stopPath)) throw Error('preview: stop latched');
      const file = resolve(required(options, 'file'));
      if (realpathSync(file) !== file || !lstatSync(file).isFile()) throw Error('preview: substituted fixture');
      const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      let bytes;
      try {
        if (!fstatSync(fd).isFile()) throw Error('preview: substituted fixture');
        const buffer = Buffer.alloc(2 * 1024 * 1024 + 1);
        let length = 0;
        while (length < buffer.length) {
          const count = readSync(fd, buffer, length, buffer.length - length, length);
          if (count === 0) break;
          length += count;
        }
        if (length > 2 * 1024 * 1024) throw Error('preview: fixture capacity');
        bytes = buffer.subarray(0, length);
      } finally { closeSync(fd); }
      const rows = bytes.toString('utf8').split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line));
      fixtureJournal = openPreviewJournal(journalPath, key());
      if (fixtureJournal.view.genesis.importSource !== undefined && !fixtureJournal.view.imported)
        throw Error('preview: migration incomplete');
      const added = importChannelFixture(fixtureJournal, rows, required(options, 'agent-account'), Date.now(), () => existsSync(stopPath));
      process.stdout.write(`${JSON.stringify({ added, total: fixtureJournal.view.channelItems.size })}\n`);
    } finally { fixtureJournal?.close(); storage.close(); }
    return;
  }
  if (command === 'raise-caps') {
    let capJournal;
    try {
      if (existsSync(stopPath)) throw Error('preview: stop latched');
      capJournal = openPreviewJournal(journalPath, key());
      if (Date.now() >= capJournal.view.genesis.expires) throw Error('preview: expired');
      raiseJournalCaps(capJournal, { maxCalls: number(options['max-calls'] ?? String(capJournal.view.limits.maxCalls), 'max-calls'),
        maxReplies: number(options['max-replies'] ?? String(capJournal.view.limits.maxReplies), 'max-replies'),
        maxTurns: number(options['max-turns'] ?? String(capJournal.view.limits.maxTurns), 'max-turns'),
        maxBytes: number(options['max-context-bytes'] ?? String(capJournal.view.limits.maxBytes), 'max-context-bytes'),
        authority: required(options, 'authority'), at: Date.now() });
    } finally { capJournal?.close(); storage.close(); }
    return;
  }
  let journal, worker, signalled = false, signalName = null, launchedAt = null, endReason = null, runs = null;
  const workerStop = { value: false };
  const signal = name => { signalled = true; signalName ??= name; workerStop.value = true; };
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
      ['max-turns', maxTurns, g.maxTurns, journal.view.limits.maxTurns],
      ['max-context-bytes', maxBytes, g.maxBytes, journal.view.limits.maxBytes]])
      if (options[name] && supplied !== original && supplied !== current)
        throw Error(`preview: ${name} differs from journal`);
    if (g.importSource !== undefined && !journal.view.imported) throw Error('preview: migration incomplete');
    if (String(number(g.bot, 'bot-id')) !== g.bot || String(number(g.chat, 'chat-id')) !== g.chat
      || g.chat !== g.operator) throw Error('preview: private operator binding differs');
    for (const [name, value] of [['bot-id', g.bot], ['chat-id', g.chat], ['operator-sender-id', g.operator],
      ['grant-reference', g.grant], ['configuration-digest', g.configurationDigest]])
      if (options[name] && options[name] !== value) throw Error(`preview: ${name} differs from journal`);
    const modelEnvelope = input => prepareJournalEnvelope(input, required(options, 'model'), g.grant, Date.now(), journal.view.limits.maxBytes);
    const invokeSubscription = async (prepared, id, reviewTurnId) => {
      const route = modelRoute(), policy = subscriptionConversationPolicy(required(options, 'model'));
      const result = await route.invoke(prepared, { operation: id, deadline: Math.min(g.expires, Date.now() + 180000),
        timeout: policy.timeout, maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens,
        maxCharge: 0, automaticRetries: 0 });
      if (reviewTurnId) journal.append({ kind: 'reply-review-state', id: reviewTurnId, state: result.state, at: Date.now() });
      if (result.state === 'uncertain') return { state: 'uncertain', usage: result.usage };
      if (result.state === 'rejected') return { state: 'rejected', failureClass: 'rejected', usage: result.usage };
      if (result.state !== 'complete') throw Error('preview: model outcome unknown');
      if (!result.bytes) return { state: 'complete', failureClass: 'empty', usage: result.usage };
      let decision;
      try { decision = JSON.parse(result.bytes); } catch { return { state: 'complete', failureClass: 'malformed', usage: result.usage }; }
      if (decision?.type !== 'Decision' || decision.conclusion?.subject !== 'preview-stage2-answer'
        || typeof decision.conclusion.value !== 'string') return { state: 'complete', failureClass: 'malformed', usage: result.usage };
      if (!decision.conclusion.value.trim()) return { state: 'complete', failureClass: 'empty', usage: result.usage };
      return { state: 'complete', value: decision.conclusion.value, usage: result.usage };
    };
    worker = createJournalWorker(journal, { now: Date.now, stopped: () => workerStop.value || existsSync(stopPath), timeZone: timeZoneOf(options),
      sources: turnSources(root, options, journal.view, () => runs, () => launchedAt ?? undefined),
      prepareModel: modelEnvelope,
      checkOutbound: text => { if (redact(text).count) throw Error('preview: outbound secret refused'); },
      model: async ({ id, prepared }) => {
        if (typeof prepared !== 'string') throw Error('preview: prepared model input absent');
        const result = await invokeSubscription(prepared, id);
        if (result.state !== 'complete' || result.failureClass) return { ...result,
          ...(result.usage ? { usage: { inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens, charge: null } } : {}) };
        return { state: 'complete', text: result.value,
          usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, charge: null } };
      },
      replyCheck: {
        elapsedMs: () => performance.now(),
        jev: async text => {
          const start = performance.now();
          const response = await fetch('https://api.typesafe.ai/v1/systemone', {
            method: 'POST', signal: AbortSignal.timeout(2000),
            headers: { Authorization: `Bearer ${typesafeKey()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: text, model: JEV_MODEL, questions: jevQuestions }) });
          if (!response.ok) throw Error('preview: Jev unavailable');
          return { value: await response.json(), latencyMs: Math.round(performance.now() - start) };
        },
        escalate: async (text, id, originalPrompt) => {
          const start = performance.now();
          if (typeof originalPrompt !== 'string') throw Error('preview: full reply-review context absent');
          const question = `Judge this proposed reply using the full conversation context. Rules: ${JSON.stringify(REPLY_RULES)}. Return ONLY compact JSON {"verdict":"pass"|"violation","ruleIds":string[],"reason":string}. A violation requires an actual breach; uncertainty is a pass under the reachability fail direction. Give a short reason for either verdict.`;
          const prepared = modelEnvelope({ question,
            context: replyReviewContext(originalPrompt, text), id: `${id}:reply-review` });
          const result = await invokeSubscription(prepared, `${id}:reply-review`, id);
          if (result.state !== 'complete' || result.failureClass) throw Error('preview: reply review unavailable');
          const parsed = JSON.parse(result.value);
          if (!['pass', 'violation'].includes(parsed.verdict) || !Array.isArray(parsed.ruleIds)
            || parsed.ruleIds.some(rule => !Object.hasOwn(REPLY_RULES, rule))
            || (parsed.verdict === 'pass' && parsed.ruleIds.length !== 0)
            || (parsed.verdict === 'violation' && parsed.ruleIds.length === 0)
            || typeof parsed.reason !== 'string' || !parsed.reason.trim() || parsed.reason.length > 2000)
            throw Error('preview: review malformed');
          return { verdict: parsed.verdict, ruleIds: parsed.ruleIds, confidence: null,
            latencyMs: Math.round(performance.now() - start), reason: parsed.reason,
            usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, charge: null } };
        }
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
    // The run log is durable before the first poll; the self-state reads it from memory each turn.
    launchedAt = Date.now();
    appendRun(runsPath, { v: 1, launch: launchedAt, pid: process.pid });
    runs = readRuns(runsPath);
    let failedPolls = 0;
    const pollFailure = async () => {
      failedPolls++;
      if (failedPolls >= 20) { endReason = 'Telegram polling failed 20 times in a row'; return false; }
      const until = Date.now() + Math.min(30000, 250 * 2 ** Math.min(failedPolls - 1, 7));
      while (!workerStop.value && !existsSync(stopPath) && Date.now() < until)
        await delay(Math.min(100, until - Date.now()));
      return true;
    };
    let summaryJob = null;
    const summarizeLater = () => {
      // After the reply: the deterministic coherence check records its findings for the next
      // packet. It makes no call and cannot hold the reply already attempted;
      // its synchronous journal write can slightly delay the next poll.
      try { worker.checkCoherence(); } catch { /* the unchecked reply is retried after the next drain */ }
      if (summaryJob) return;
      summaryJob = worker.summarizeIfNeeded().catch(() => {}).finally(() => { summaryJob = null; });
    };
    for (let i = 0; i < cycles && !signalled; i++) {
      if (i > 0) await new Promise(done => setImmediate(done));
      if (signalled || workerStop.value || existsSync(stopPath)) break;
      worker.gate(); await worker.drain(); summarizeLater(); worker.gate();
      if (existsSync(stopPath) || Date.now() >= g.expires) break;
      try { worker.pollGate(); } catch {
        const v = journal.view;
        endReason = `${v.order.length >= v.limits.maxTurns ? 'update' : v.calls >= v.limits.maxCalls ? 'model attempt' : 'reply'} cap reached`;
        break;
      }
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
    endReason ??= 'cycle limit reached';
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
        io: createSubscriptionProviderIO({ repository: process.cwd(),
          stopped: () => workerStop.value || existsSync(stopPath) || !active() }),
        now: Date.now, active: () => !workerStop.value && !existsSync(stopPath) && active() && !journal.view.stop,
        adapterEvidenceContract: contract,
        ...(journal.view.limits.maxBytes > subscriptionConversationPolicy(options.model).maxPromptBytes
          ? { raisedPromptBytes: journal.view.limits.maxBytes, promptAuthority: journal.view.capAuthority } : {}) }));
    }
  } catch (error) { if (!signalled) throw error; }
  finally {
    if (launchedAt !== null) {
      const reason = signalName ? `paused by signal ${signalName}` : existsSync(stopPath) || journal?.view.stop ? 'operator stop latched'
        : journal && Date.now() >= journal.view.genesis.expires ? 'trial expired' : endReason ?? 'error (details suppressed)';
      try { appendRun(runsPath, { v: 1, launch: launchedAt, exit: Date.now(), reason }); } catch { /* the next launch reports an unrecorded end */ }
    }
    journal?.close(); storage.close(); process.removeListener('SIGINT', signal); process.removeListener('SIGTERM', signal); process.removeListener('SIGHUP', signal); }
}

try { await main(); } catch { process.stderr.write('preview refused to start or continue; details suppressed\n'); process.exitCode = 1; }
