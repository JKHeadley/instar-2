#!/usr/bin/env node
// Small, machine-local preview launcher. Only this file owns process, clock and
// physical ports. The worker owns all durable conversation/effect transitions.
import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createProductionTelegramIO, createSubscriptionProviderIO, productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { createClaudeCodeSubscriptionRoute, SUBSCRIPTION_CONVERSATION_FRAMING,
  subscriptionConversationPolicy, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { redact } from '../../src/recall/redact.js';
import { durablePreviewWrite } from './state.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { SOURCE_PINS, sourcePacket, deskStatusSource, readDeskStatus, verifyMindRules } from './briefing.js';
import { openPreviewJournal as openJournal, createJournalWorker, importChannelFixture, raiseJournalCaps, renewJournalExpiry, activationMatchesJournal, activePersonMerges, openQuestionCandidates, projectMemoryText, unansweredCue, reportJournalCap, unknownCallCounts, journalPollLimit, replyTimings, pendingRequestedReminders, reminderDue, activeSummaryGrants, PREVIEW_LIVE_LIMITS, activeMemoryConflicts, TOO_LONG_INPUT_NOTICE, TOO_LONG_REPLY_NOTICE } from './journal.js';
import { createPreviewClock } from './clock.js';
import { appendRun, heldNotices, heldRepliesToday, memoryHealthLine, readRuns, restartHandoff, selfState, selfStateSource, zoneFormatter } from './self-state.js';
import { awayDigest, awayDigestSource } from './away-digest.js';
import { JEV_MODEL, jevQuestions, replyReviewContext, replyReviewQuestion, replyReviewRules, parseReplyReviewVerdict, replyReviewDiagnostics, parseJevResponse } from './reply-check.js';
import { interpretSummaryReview } from './summary-check.js';
import { failureShapeOf, parseModelJson } from './model-json.js';
import { SUMMARY_FAITHFULNESS_QUESTION } from './summary-faithfulness.js';


import { dueState } from './dated-memory.js';
import { observedSubscriptionIO } from './call-diagnostics.mjs';
import { agentState, importStorePass } from './channel-source.mjs';
import { exhaustedPollReason } from './poll-failure-reason.mjs';

const clock = createPreviewClock(() => Date.now(), () => performance.now());
const wallNow = clock.now;
const openPreviewJournal = (...args) => {
  const journal = openJournal(...args);
  clock.seed(journal.view.clockFloor);
  return journal;
};

const importSource = (journal, state, source, stopped) => {
  try {
    const result = importStorePass(journal, state, source, wallNow(), stopped);
    if (journal.view.channelSourceErrors.has(source))
      journal.append({ kind: 'channel-source-error', source, error: null, at: wallNow() });
    return result;
  } catch (error) {
    if (!stopped() && !journal.view.stop && wallNow() < journal.view.expires
      && journal.view.channelSourceErrors.get(source) !== 'import refused')
      journal.append({ kind: 'channel-source-error', source, error: 'import refused', at: wallNow() });
    throw error;
  }
};

import { auditJournal } from './journal-audit.mjs';


import { memoryReport } from './memory-export.js';

import { operatorDigest } from './operator-digest.js';
import { stepQuestions } from './step-check.js';



const parse = values => {
  const command = values[0] ?? 'run', options = {};
  for (let i = 1; i < values.length; i += 2) {
    if (!values[i]?.startsWith('--') || values[i + 1] === undefined) throw Error('preview: malformed arguments');
    options[values[i].slice(2)] = values[i + 1];
  }
  // A trial-wide grant would push unrequested dated items; each reminder is granted by its own operator request.
  if (options['reminder-grant-reference'] !== undefined)
    throw Error('preview: --reminder-grant-reference is retired; the operator grants each reminder by asking for it');
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
const askJev = async (state, questions, timeoutMs) => {
  const start = performance.now();
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST', signal: AbortSignal.timeout(Math.min(2000, timeoutMs ?? 2000)),
    headers: { Authorization: `Bearer ${typesafeKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, model: JEV_MODEL, questions }) });
  if (!response.ok) throw Error('preview: Jev unavailable');
  return { value: parseJevResponse(await response.text()), latencyMs: Math.round(performance.now() - start) };
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
const turnSources = (root, options, view, runs, current = () => undefined, handoff = () => null) => {
  // The standing mind-held instructions ride every prepared envelope; a changed rule book refuses launch.
  verifyMindRules(path => readFileSync(resolve(process.cwd(), path), 'utf8'));
  const ordinarySources = sourcePacket(path => readFileSync(resolve(process.cwd(), path), 'utf8'), SOURCE_PINS,
    { providerAttempts: view.limits.maxCalls, expiresAt: view.expires }).sources;
  const deskStatusPath = resolve(options['desk-status'] ?? join(root, 'desk-status.md'));
  return turn => {
    const now = wallNow(), log = runs();
    const sources = ordinarySources;
    const desk = deskStatusSource(readDeskStatus(deskStatusPath), now, deskStatusPath);
    const digest = turn && awayDigest(view, log, now, turn, [desk]);
    const note = handoff();
    return [...sources, selfStateSource(selfState(view, log, now, timeZoneOf(options), current())), desk, operatorDigest(view, log, desk),
      ...(digest ? [awayDigestSource(digest)] : []), ...(note ? [note] : [])];
  };
};
/** The operator's IANA time zone for "today"; UTC unless given. An unknown zone refuses. */
const timeZoneOf = options => { const zone = options['time-zone'] ?? 'America/Los_Angeles'; zoneFormatter(zone); return zone; };
/** Recall metadata and labels, never static sources or history text. */
const recallView = packet => ({ historyMode: packet.historyMode, summaryThrough: packet.summary?.through ?? null, summarySourceKind: packet.summary?.sourceKind ?? null,
  replyTo: packet.replyTo ?? null,
  ...(packet.period ? { period: packet.period, periodGuide: packet.periodGuide } : {}),
  people: packet.people ?? [], personAttributes: packet.personAttributes ?? [], personMergeCandidates: packet.personMergeCandidates ?? [], personMerges: packet.personMerges ?? [], commitments: packet.commitments ?? [], openQuestions: packet.openQuestions ?? [], channelMemory: packet.channelMemory ?? [], memory: packet.memory ?? [],
  lastNamedPerson: packet.lastNamedPerson ?? null,
  dated: packet.dated ?? [], datedScope: packet.datedScope ?? null, moreDated: packet.moreDated ?? 0,
  datedPending: packet.datedPending ?? [], moreDatedPending: packet.moreDatedPending ?? 0,
  preferences: packet.preferences ?? [],
  openConflicts: packet.openConflicts ?? [],
  inventory: packet.inventory ?? null,
  memorySearch: packet.memorySearch ?? { items: [], forgotten: 0 },
  meaningIndexCoverage: packet.meaningIndexCoverage ?? null,
  continuity: packet.continuity ?? null,

  contradictions: packet.contradictions ?? [],
  crossTopicDigest: packet.crossTopicDigest ?? null,
  restartHandoff: packet.sources?.find(source => source.id === 'restart-handoff')?.text ?? null,
  recalled: packet.recalled?.length ?? 0, recalledIds: (packet.recalled ?? []).map(item => item.id ?? null), recalledSourceKinds: (packet.recalled ?? []).map(item => item.sourceKind), history: packet.history?.length ?? 0, historySourceKinds: (packet.history ?? []).map(item => item.sourceKind),
  replyProvenance: packet.replyProvenance ? { update: packet.replyProvenance.update,
    recorded: packet.replyProvenance.recorded !== null,
    history: packet.replyProvenance.recorded?.history?.length ?? 0,
    recalled: packet.replyProvenance.recorded?.recalled?.length ?? 0,
    channelSourceIds: (packet.replyProvenance.recorded?.channelMemory ?? []).map(item => item.sourceId) } : null,
  sourceLabels: Object.fromEntries(['summary', 'memorySummary', 'history', 'recalled', 'people', 'commitments',
    'channelMemory', 'memory', 'memoryCandidates'].map(part => [part, (Array.isArray(packet[part]) ? packet[part]
      : packet[part] ? [packet[part]] : []).map(item => item.sourceLabel ?? null)])),
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
    operatorUpdate: view.turns.get(change.trigger)?.update,
    ...(change.mode === 'correct' ? { quote: redact(change.quote).text } : {}),
    ...(change.in === 'reply' ? { in: 'reply' } : {}),
    reason: preferenceKeys.has(JSON.stringify([change.source, change.quote]))
      ? change.mode === 'forget' ? 'verified operator removed this reply preference' : 'verified operator changed this reply preference'
      : change.mode === 'forget' ? 'verified operator requested forgetting'
        : change.historical ? 'newer verified operator statement updated this fact'
        : change.in === 'reply' ? 'verified operator corrected this answer' : 'verified operator corrected this fact' }));
};

// Content-free counts of how model JSON arrived: malformed shapes (why a result was
// refused) and tolerated wrappers. Diagnostics only: never model text, never an outcome input.
const readShapes = path => {
  try { const saved = JSON.parse(readFileSync(path, 'utf8')); return saved.version === 1 ? saved : null; }
  catch { return null; }
};
const recordShape = (path, role, layer, outcome, shape) => {
  try {
    const saved = readShapes(path) ?? { version: 1, counts: {}, last: null };
    const key = `${role}/${layer}/${outcome}/${shape}`;
    saved.counts[key] = (saved.counts[key] ?? 0) + 1;
    if (outcome === 'malformed') saved.last = { role, layer, shape, at: wallNow() };
    durablePreviewWrite(path, saved);
  } catch { /* a diagnostics write never changes a model outcome */ }
};
const roleOf = id => id.endsWith(':reply-review') ? 'reply-review' : /^summary:.*:review$/u.test(id) ? 'summary-review' : 'answer';

const contextOf = prompt => JSON.parse(JSON.parse(prompt).messages.find(m => m.role === 'context').content).packet;
/** Rules 3, 17 and 47: which standing instructions the prepared prompt carried, by digest and rule number. */
const instructionsOf = prompt => {
  const message = JSON.parse(prompt).messages.find(m => m.role === 'instructions');
  return message ? { sha256: `sha256:${createHash('sha256').update(message.content, 'utf8').digest('hex')}`,
    rules: [...message.content.matchAll(/^Rule (\d+) — /gmu)].map(match => Number(match[1])) } : null;
};
const lastReplyReview = view => {
  const turn = view.order.filter(item => item.reviewState !== undefined).at(-1);
  return turn ? { update: turn.update, state: turn.reviewState, diagnostics: turn.reviewDiagnostics ?? null } : null;
};
const packetStatus = view => {
  const last = view.order.filter(turn => turn.reserved).at(-1);
  if (!last) return null;
  return { update: last.update, bytes: last.prompt === undefined ? null : Buffer.byteLength(last.prompt),
    limit: last.packetLimit ?? view.limits.maxBytes,
    dropped: last.packetDropped ?? 'unavailable in earlier reservation' };
};

const stepCheckView = view => ({ total: view.stepChecks.size,
  unchecked: [...view.stepChecks.values()].filter(item => !item.reserved).length,
  verdicts: [...view.stepChecks].map(([step, item]) => ({ step,
    reserved: item.reserved === true, result: item.result ?? null })) });


async function main() {
  const { command, options } = parse(process.argv.slice(2));
  if (options['step-check'] !== undefined && !['true', 'false'].includes(options['step-check'])) throw Error('preview: --step-check must be true or false');
  const stepCheckEnabled = options['step-check'] === 'true';
  if (!['run', 'status', 'stop', 'raise-caps', 'renew-expiry', 'inspect', 'import-fixture', 'import-store', 'audit', 'export-memory'].includes(command)) throw Error('preview: unknown command');

  const root = resolve(required(options, 'root'));
  if (command === 'run') mkdirSync(root, { recursive: true, mode: 0o700 });
  if (realpathSync(root) !== root || lstatSync(root).isSymbolicLink()) throw Error('preview: substituted root');
  const stopPath = join(root, 'preview-stop.json');
  const journalPath = join(root, 'journal.encrypted');
  const importPath = join(root, 'preview-import.json');
  const runsPath = join(root, 'runs.jsonl');
  const shapesPath = join(root, 'model-json-shapes.json');
  timeZoneOf(options);
  const importMarker = existsSync(importPath) ? JSON.parse(readFileSync(importPath, 'utf8')) : null;
  if (importMarker && (importMarker.version !== 1 || typeof importMarker.source !== 'string'))
    throw Error('preview: import marker malformed');
  if (command === 'stop') {
    if (!existsSync(journalPath)) throw Error('preview: journal absent');
    if (!existsSync(stopPath)) durablePreviewWrite(stopPath, { latchedAt: wallNow(), reason: 'operator' });
    return;
  }
  if (command === 'audit') {
    const journal = openPreviewJournal(journalPath, key(), undefined, undefined, true, undefined, true);
    try {
      const report = auditJournal(journal.view);
      process.stdout.write(`${JSON.stringify(report)}\n`);
      if (report.findings.length) process.exitCode = 1;
    } finally { journal.close(); }
    return;
  }
  if (command === 'export-memory') {
    const journal = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try { process.stdout.write(memoryReport(journal.view)); }
    finally { journal.close(); }

    return;
  }
  if (command === 'status') {
    const statusNow = wallNow(), statusZone = timeZoneOf(options);
    let view;
    try { view = openPreviewJournal(journalPath, key(), undefined, undefined, true); }
    catch (error) {
      if (!importMarker) throw error;
      process.stdout.write(`${JSON.stringify({ cursor: null, importComplete: false })}\n`);
      return;
    }
    try {
      const now = wallNow(), log = readRuns(runsPath);
      const deskPath = resolve(options['desk-status'] ?? join(root, 'desk-status.md'));
      const desk = deskStatusSource(readDeskStatus(deskPath), now, deskPath);
      const lastSent = view.view.order.filter(turn => turn.sentAt !== undefined).at(-1);
      process.stdout.write(`${JSON.stringify({ cursor: view.view.cursor, turns: view.view.order.length,
      channelItems: view.view.channelItems.size,
      channelSources: Object.fromEntries(['telegram', 'slack'].map(source => [source, {
        ...(view.view.channelSources.get(source) ?? { offset: 0, scanned: 0, imported: 0, skipped: 0 }),
        error: view.view.channelSourceErrors.get(source) ?? null }])),
      calls: view.view.calls, replies: view.view.replies, limits: view.view.limits,
      tokens: view.view.tokenTotals,
      tokenTotal: Object.values(view.view.tokenTotals).reduce((total, kind) => ({
        calls: total.calls + kind.calls, inputTokens: total.inputTokens + kind.inputTokens,
        outputTokens: total.outputTokens + kind.outputTokens, unknownCalls: total.unknownCalls + kind.unknownCalls }),
      { calls: 0, inputTokens: 0, outputTokens: 0, unknownCalls: 0 }),
      capAuthority: view.view.capAuthority,
      expires: view.view.expires, expiryAuthority: view.view.expiryAuthority,
      stop: existsSync(stopPath) ? JSON.parse(readFileSync(stopPath, 'utf8')) : view.view.stop,
      sourceStop: view.view.sourceStop,
      importComplete: importMarker
        ? view.view.genesis.importSource === importMarker.source && view.view.imported
        : view.view.genesis.importSource === undefined || view.view.imported,
      summaryThrough: view.view.summaries.at(-1)?.through ?? null,
      lastSummaryFaithfulness: view.view.lastSummaryFailure?.faithfulness
        && view.view.lastSummaryFailure.at >= (view.view.summaries.at(-1)?.at ?? -1)
        ? { through: view.view.lastSummaryFailure.through, ...view.view.lastSummaryFailure.faithfulness,
          reason: view.view.lastSummaryFailure.reason }
        : view.view.summaries.at(-1)?.faithfulness
          ? { through: view.view.summaries.at(-1).through, ...view.view.summaries.at(-1).faithfulness }
          : null,
      packet: packetStatus(view.view),

      memoryHealth: memoryHealthLine(view.view),

      withheld: withheldView(view.view),
      heldRepliesToday: heldRepliesToday(view.view, statusNow, statusZone),
      conflicts: activeMemoryConflicts(view.view).map(item => ({ askedByUpdate: view.view.turns.get(item.askedBy)?.update,
        asked: item.asked, answeredByUpdate: item.answeredBy ? view.view.turns.get(item.answeredBy)?.update : null,
        first: { source: item.first.source, quote: redact(item.first.quote).text },
        second: { source: item.second.source, quote: redact(item.second.quote).text }, winner: item.winner ?? null })),
      undos: view.view.undos.map(item => ({ operatorUpdate: view.view.turns.get(item.trigger)?.update,
        change: item.change, kind: view.view.changeHistory[item.change]?.kind })),
      holds: heldNotices(view.view, existsSync(stopPath) || view.view.stop !== null || wallNow() >= view.view.expires),
      tooLong: view.view.order.filter(t => t.noticeClass === 'too-long-input' || t.intent === TOO_LONG_REPLY_NOTICE)
        .map(t => ({ update: t.update, kind: t.noticeClass === 'too-long-input' ? 'input' : 'reply',
          delivery: t.sent ? (t.noticeClass === 'too-long-input' && t.intent !== TOO_LONG_INPUT_NOTICE
            ? 'holding reply Telegram API accepted' : 'Telegram API accepted')
            : t.intent ? (t.noticeClass === 'too-long-input' && t.intent !== TOO_LONG_INPUT_NOTICE
              ? 'holding reply UNKNOWN' : 'UNKNOWN') : 'pending' })),
      heldNotices: view.view.order.filter(t => t.heldNoticeIntent !== undefined).map(t => ({ update: t.update,
        state: t.heldNoticeSent === undefined ? 'UNKNOWN' : 'api-accepted' })),
      unknownCalls: unknownCallCounts(view.view).total,
      unknownCallBreakdown: unknownCallCounts(view.view),
      capReports: [...view.view.capReports],

      modelFailureClasses: Object.fromEntries(view.view.failureClasses),
      modelJsonShapes: readShapes(shapesPath),
      modelResultStates: Object.fromEntries(view.view.providerStates),
      callOutcomeCounts: Object.fromEntries(view.view.callOutcomeCounts),
      lastCallOutcomes: view.view.callOutcomes.map(({ id, role, outcome, at }) => ({ id, role, ...outcome, at })),
      unknownSends: view.view.order.reduce((count, t) => count + Number(t.intent !== undefined && t.sent === undefined) + Number(t.heldNoticeIntent !== undefined && t.heldNoticeSent === undefined), 0)
        + [...view.view.reminders.values()].filter(item => item.sent === undefined).length,
      replyGrounding: { recorded: view.view.order.filter(t => t.intent && t.grounding).length,
        unavailableLegacy: view.view.order.filter(t => t.intent && !t.grounding).length },
      answerProvenance: { unlabeledRecallReplies: view.view.order.filter(t => t.unlabeledRecall
        && t.answer !== undefined && t.intent === `PREVIEW — ${t.answer}`).length },

      summaries: view.view.summaries.map(s => ({ through: s.through, people: s.people ? s.people.length : null,
        commitments: s.commitments ? s.commitments.length : null, closed: s.closed?.length ?? 0,
        memory: s.memory ? s.memory.length : null })),
      commitments: { total: view.view.commitments.length, open: view.view.commitments.length - view.view.closed.size },
      mentionedDates: view.view.mentionedDates.size,
      reminders: { intents: view.view.reminders.size,
        accepted: [...view.view.reminders.values()].filter(item => item.sent !== undefined).length,
        unknown: [...view.view.reminders.values()].filter(item => item.sent === undefined).length,
        grant: view.view.reminderGrant,
        requested: view.view.dated.filter(item => item.remind).length,
        pending: pendingRequestedReminders(view.view).map(item => ({ sourceUpdate: view.view.turns.get(item.source)?.update,
          quote: redact(item.quote).text, due: `${reminderDue(item)} ${item.zone}` })),
        cancelled: view.view.reminderCancels.length },
      requestedSummaries: { requested: view.view.summaryGrants.length, cancelled: view.view.summaryCancels.length,
        active: activeSummaryGrants(view.view).map(grant => ({ id: grant.id, sourceUpdate: view.view.turns.get(grant.source)?.update,
          quote: redact(grant.quote).text, covers: grant.period, repeat: grant.repeat, time: grant.time, first: grant.first, zone: grant.zone })),
        slots: view.view.order.filter(t => t.requestedSummary).map(t => ({ grant: t.requestedSummary.grant, slot: t.requestedSummary.slot,
          late: t.requestedSummary.late ?? null, state: t.sent !== undefined ? 'accepted' : t.intent !== undefined ? 'UNKNOWN send'
            : !activeSummaryGrants(view.view).some(grant => grant.id === t.requestedSummary.grant) ? 'withdrawn, not sent'
            : t.held ? `held (${t.held})` : t.reserved && t.answer === undefined && t.modelState === undefined ? 'model UNKNOWN' : 'pending' })) },
      dated: view.view.dated.filter(item => !view.view.memory.some(change => change.mode !== 'prefer' && change.in !== 'reply' && change.source === item.source
        && (item.quote.includes(change.quote) || change.quote.includes(item.quote)))).map(item => ({ sourceUpdate: view.view.turns.get(item.source)?.update,

        quote: redact(item.quote).text, when: redact(item.when).text, zone: item.zone, day: item.day ?? null,
        time: item.time ?? null, repeat: item.repeat ?? null, ambiguity: item.ambiguity ?? null, state: dueState(item, wallNow()) })),
      datedPending: view.view.order.filter(item => item.datedPending && !view.view.memory.some(change => change.mode !== 'prefer' && change.in !== 'reply' && change.source === item.id))
        .map(item => ({ update: item.update, message: redact(item.text).text.slice(0, 500) })),
      summaryPending: view.view.summaryReservations.size,

      summaryChecks: view.view.summaryCheckCounts,
      lastSummaryCheck: view.view.lastSummaryCheck && { verdict: view.view.lastSummaryCheck.verdict,
        path: view.view.lastSummaryCheck.path, latencyMs: view.view.lastSummaryCheck.latencyMs,
        usage: view.view.lastSummaryCheck.usage ?? null },

      openQuestions: openQuestionCandidates(view.view).map(item => ({ update: view.view.turns.get(item.source)?.update,
        question: projectMemoryText(view.view, redact(item.quote).text), reason: item.reason })),
      pendingQuestionReviews: view.view.order.filter(t => t.accepted && t.intent && !view.view.questionsReviewed.has(t.id)
        && unansweredCue(t.intent)).length,
      coherence: { checked: view.view.order.filter(t => t.checked).length,
        unchecked: view.view.order.filter(t => t.intent !== undefined && !t.checked).length,
        failed: view.view.order.filter(t => t.checkFailed).length,
        pendingCorrections: view.view.corrections.length,
        findings: view.view.order.filter(t => t.checked?.length).map(t => ({ update: t.update, rules: t.checked.map(f => f.rule) })) },
      jevChecks: view.view.jevChecks, replyChecks: view.view.replyCheckCounts, replyCheckPaths: view.view.replyCheckPaths,
      replyTimings: replyTimings(view.view),
      lastReplyCheck: view.view.lastReplyCheck,
      lastReplyReview: lastReplyReview(view.view),
      lastReplyTiming: lastSent ? { update: lastSent.update,
        intakeToApiAcceptedMs: Math.max(0, lastSent.sentAt - lastSent.at),
        checkMs: Math.round((lastSent.replyChecks ?? []).reduce((total, result) => total + result.latencyMs, 0)) } : null,
      ...(view.view.stepCheckStarted ? { stepChecks: stepCheckView(view.view) } : {}),
      people: [...new Set([...view.view.people.filter(note => !view.view.memory.some(change =>
        change.in !== 'reply' && note.source === change.source && note.quote.includes(change.quote))).map(note => note.name),
        ...[...view.view.channelItems.values()].map(item => item.from.split('<')[0].trim().split('@')[0].replace(/[._-]+/gu, ' ')).filter(Boolean)])],
      personMerges: activePersonMerges(view.view).map(link => ({ left: view.view.people[link.left]?.name,
        leftSource: view.view.people[link.left]?.source, right: view.view.people[link.right]?.name,
        rightSource: view.view.people[link.right]?.source, triggerUpdate: view.view.turns.get(link.trigger)?.update })),

      launches: readRuns(runsPath).launches.slice(-3),
      digest: operatorDigest(view.view, log, desk).text,
      self: selfState(view.view, readRuns(runsPath), wallNow(), timeZoneOf(options), undefined,
        existsSync(stopPath) || view.view.stop !== null) })}\n`);
    }
    finally { view.close(); }
    return;
  }
  if (command === 'inspect') {
    // Read-only: the last persisted model prompt's recall view and, with --text, what a next
    // message would get now. No append, no model call, no send.
    const view = openPreviewJournal(journalPath, key(), undefined, undefined, true);
    try {
      const last = view.view.order.filter(t => t.prompt !== undefined).at(-1);
      const reply = options.update === undefined ? view.view.order.filter(t => t.intent).at(-1)
        : view.view.order.find(t => t.update === number(options.update, 'update', 0));
      let next;
      if (options.text !== undefined) {
        const refuse = () => { throw Error('preview: inspect never calls or sends'); };
        const probe = createJournalWorker(view, { now: wallNow, stopped: () => true, timeZone: timeZoneOf(options), sources: turnSources(root, options, view.view, () => readRuns(runsPath)),
          prepareModel: input => prepareJournalEnvelope(input, required(options, 'model'), view.view.genesis.grant, wallNow(), view.view.limits.maxBytes),
          model: refuse, send: refuse, checkOutbound: refuse }).probe(options.text);
        next = 'reason' in probe ? { held: probe.reason } : recallView(JSON.parse(probe.context));
      }
      process.stdout.write(`${redact(JSON.stringify({ last: last ? { update: last.update, answered: last.answer !== undefined,
        instructions: instructionsOf(last.prompt), ...recallView(contextOf(last.prompt)) } : null,
        reply: reply?.intent ? { update: reply.update, text: reply.intent, telegramMessageId: reply.sent ?? null,
          outcome: reply.sent ? 'api-accepted' : 'send-unknown', grounding: reply.grounding ?? null,
          ...(reply.continuity ? { continuity: reply.continuity } : {}) } : null,
        // Rules 11 and 110: the latest summary frontier and which operator updates the meaning index covers.
        summaryFrontier: view.view.summaries.at(-1)?.through ?? null,
        meaningIndexed: [...new Set(view.view.summaries.flatMap(item => item.concepts ?? [])
          .map(item => view.view.turns.get(item.source)?.update))].filter(update => update !== undefined).slice(-100),
        agentPromises: view.view.commitments.flatMap((note, id) => note.agentPromise ? [{ id, quote: note.quote,
          action: note.agentPromise.action, closed: view.view.closed.has(id) }] : []).slice(-10),
        ...(next ? { next } : {}), withheld: withheldView(view.view),
        undos: view.view.undos.map(item => ({ operatorUpdate: view.view.turns.get(item.trigger)?.update,
          change: item.change, kind: view.view.changeHistory[item.change]?.kind })),
        jevChecks: view.view.jevChecks, replyChecks: view.view.replyCheckCounts, replyCheckPaths: view.view.replyCheckPaths,
        lastReplyCheck: view.view.lastReplyCheck, lastReplyReview: lastReplyReview(view.view),
        ...(view.view.stepCheckStarted ? { stepChecks: stepCheckView(view.view) } : {}) })).text}\n`);

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
  if (command === 'import-store') {
    let storeJournal;
    try {
      if (options['live-mail'] !== undefined && options['live-mail'] !== 'false') throw Error('preview: live mail source is disabled');
      const state = agentState(required(options, 'agent-state-dir'));
      storeJournal = openPreviewJournal(journalPath, key());
      const results = ['telegram', 'slack'].map(source => importSource(storeJournal, state, source, () => existsSync(stopPath)));
      process.stdout.write(`${JSON.stringify({ results, channelItems: storeJournal.view.channelItems.size })}\n`);
    } finally { storeJournal?.close(); storage.close(); }
    return;
  }
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
      const added = importChannelFixture(fixtureJournal, rows, required(options, 'agent-account'), wallNow(), () => existsSync(stopPath));
      process.stdout.write(`${JSON.stringify({ added, total: fixtureJournal.view.channelItems.size })}\n`);
    } finally { fixtureJournal?.close(); storage.close(); }
    return;
  }
  if (command === 'renew-expiry') {
    // Extends a live trial to a new reviewed activation's expiry under the exclusive writer lease.
    let renewJournal;
    try {
      if (existsSync(stopPath)) throw Error('preview: stop latched');
      renewJournal = openPreviewJournal(journalPath, key());
      const now = wallNow();
      if (now >= renewJournal.view.expires) throw Error('preview: expired');
      const bytes = readFileSync(required(options, 'activation-record'), 'utf8');
      const activation = JSON.parse(bytes);
      const profile = Object.freeze(JSON.parse(readFileSync(required(options, 'login-profile'), 'utf8')));
      validateSubscriptionActivation(activation, profile, required(options, 'model'), now, SUBSCRIPTION_CONVERSATION_FRAMING);
      if (!activationMatchesJournal(renewJournal.view, activation, expiry(required(options, 'expires-at'))))
        throw Error('preview: activation differs from journal');
      renewJournalExpiry(renewJournal, { expires: activation.expiresAt, authority: required(options, 'authority'), at: now,
        activation: `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}` });
    } finally { renewJournal?.close(); storage.close(); }
    return;
  }
  if (command === 'raise-caps') {
    let capJournal;
    try {
      if (existsSync(stopPath)) throw Error('preview: stop latched');
      capJournal = openPreviewJournal(journalPath, key());
      if (wallNow() >= capJournal.view.expires) throw Error('preview: expired');
      raiseJournalCaps(capJournal, { maxCalls: number(options['max-calls'] ?? String(capJournal.view.limits.maxCalls), 'max-calls'),
        maxReplies: number(options['max-replies'] ?? String(capJournal.view.limits.maxReplies), 'max-replies'),
        maxTurns: number(options['max-turns'] ?? String(capJournal.view.limits.maxTurns), 'max-turns'),
        maxBytes: number(options['max-context-bytes'] ?? String(capJournal.view.limits.maxBytes), 'max-context-bytes'),
        authority: required(options, 'authority'), at: wallNow() });
    } finally { capJournal?.close(); storage.close(); }
    return;
  }
  let journal, worker, signalled = false, signalName = null, launchedAt = null, endReason = null, runs = null;
  let handoff = null, reservedAtLaunch = new Set();
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
    const modelEnvelope = input => prepareJournalEnvelope(input, required(options, 'model'), g.grant, wallNow(), journal.view.limits.maxBytes);
    const recordedUsage = usage => ({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      charge: null, ...(usage.inputComplete ? { inputComplete: true } : {}) });
    const invokeSubscription = async (prepared, id, reviewTurnId, deadlineAt) => {
      const route = modelRoute(id), policy = subscriptionConversationPolicy(required(options, 'model'));
      const deadline = Math.min(journal.view.expires, deadlineAt ?? wallNow() + 180000);
      if (deadline - wallNow() <= 100) throw Error('preview: reply check budget exceeded');
      const result = await route.invoke(prepared, { operation: id, deadline,
        timeout: policy.timeout, maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens,
        maxCharge: 0, automaticRetries: 0 });
      if (reviewTurnId) journal.append({ kind: 'reply-review-state', id: reviewTurnId, state: result.state,
        diagnostics: replyReviewDiagnostics(result.usage),
        ...(result.usage ? { usage: recordedUsage(result.usage) } : {}), at: wallNow() });

      if (result.state === 'uncertain') return { state: 'uncertain', usage: result.usage };
      if (result.state === 'rejected') return { state: 'rejected', failureClass: 'rejected', usage: result.usage };
      if (result.state !== 'complete') throw Error('preview: model outcome unknown');
      if (!result.bytes) return { state: 'complete', failureClass: 'empty', usage: result.usage };
      const extracted = parseModelJson(result.bytes), decision = extracted.ok ? extracted.value : null;
      if (decision?.type !== 'Decision' || decision.conclusion?.subject !== 'preview-stage2-answer'
        || typeof decision.conclusion.value !== 'string') {
        recordShape(shapesPath, roleOf(id), 'decision', 'malformed', failureShapeOf(extracted));
        return { state: 'complete', failureClass: 'malformed', usage: result.usage };
      }
      if (extracted.shape !== 'bare') recordShape(shapesPath, roleOf(id), 'decision', 'tolerated', extracted.shape);
      if (!decision.conclusion.value.trim()) return { state: 'complete', failureClass: 'empty', usage: result.usage };
      return { state: 'complete', value: decision.conclusion.value, usage: result.usage };
    };
    const invokeJev = async (text, questions) => {
      const start = performance.now();
      const response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST', signal: AbortSignal.timeout(2000),
        headers: { Authorization: `Bearer ${typesafeKey()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: text, model: JEV_MODEL, questions }) });
      if (!response.ok) throw Error('preview: Jev unavailable');
      return { value: parseJevResponse(await response.text()), latencyMs: Math.round(performance.now() - start) };
    };
    worker = createJournalWorker(journal, { now: wallNow, elapsed: clock.elapsed, stopped: () => workerStop.value || existsSync(stopPath), timeZone: timeZoneOf(options),
      sources: turnSources(root, options, journal.view, () => runs, () => launchedAt ?? undefined,
        () => journal.view.order.some(turn => turn.reserved && !reservedAtLaunch.has(turn.id)) ? null : handoff),
      prepareModel: modelEnvelope,
      checkOutbound: text => { if (redact(text).count) throw Error('preview: outbound secret refused'); },
      model: async ({ id, prepared }) => {
        if (typeof prepared !== 'string') throw Error('preview: prepared model input absent');
        const result = await invokeSubscription(prepared, id);
        if (result.state !== 'complete' || result.failureClass) return { ...result,
          ...(result.usage ? { usage: recordedUsage(result.usage) } : {}) };
        return { state: 'complete', text: result.value,
          usage: recordedUsage(result.usage) };
      },
      summaryCheck: async evidence => (await askJev(evidence, SUMMARY_FAITHFULNESS_QUESTION)).value,
      replyCheck: {
        elapsedMs: () => performance.now(),
        jev: (text, questions = jevQuestions, timeoutMs) => askJev(text, questions, timeoutMs),
        escalate: async (text, id, originalPrompt, reviewRules, deadlineAt) => {

          const start = performance.now();
          if (typeof originalPrompt !== 'string') throw Error('preview: full reply-review context absent');
          const selectedRules = replyReviewRules(reviewRules ?? []);
          const question = replyReviewQuestion(reviewRules ?? []);

          const prepared = modelEnvelope({ question,
            context: replyReviewContext(originalPrompt, text, reviewRules), id: `${id}:reply-review` });
          const result = await invokeSubscription(prepared, `${id}:reply-review`, id, deadlineAt);
          if (result.state !== 'complete' || result.failureClass) throw Error('preview: reply review unavailable');
          // The reply verdict is one exact line (PASS | reason / VIOLATION:ids | reason);
          // the whole-line pattern admits no surrounding text, so a written rejection
          // can never be discarded around it.
          let parsed;
          try { parsed = parseReplyReviewVerdict(result.value); }
          catch (error) { recordShape(shapesPath, 'reply-review', 'verdict', 'malformed', 'not-json'); throw error; }
          if (parsed.ruleIds.some(rule => !Object.hasOwn(selectedRules, rule))) {
            recordShape(shapesPath, 'reply-review', 'verdict', 'malformed', 'not-json');
            throw Error('preview: review malformed');
          }
          return { verdict: parsed.verdict, ruleIds: parsed.ruleIds, confidence: null,
            latencyMs: Math.round(performance.now() - start), reason: parsed.reason,
            usage: recordedUsage(result.usage) };
        },
        summaryReview: async (state, through) => {
          const start = performance.now();
          const question = 'Review this rolling summary against its full supplied conversation packet. Check every commitment, person, correction and dated item, and reject invented facts. Return only JSON {"verdict":"pass"|"violation","reason":string}. Pass only when coverage is faithful; uncertainty is a violation. Give a brief evidence-based reason.';
          const id = `summary:${through}:review`;
          let prepared;
          try { prepared = modelEnvelope({ question, context: state, id }); }
          catch { return { verdict: 'unavailable', retryable: true, latencyMs: Math.round(performance.now() - start) }; }
          const result = await invokeSubscription(prepared, id);
          return interpretSummaryReview(result, Math.round(performance.now() - start),
            shape => recordShape(shapesPath, 'summary-review', 'verdict', 'malformed', shape));
        }
      },
      ...(stepCheckEnabled ? { stepCheck: { jev: text => invokeJev(text, stepQuestions) } } : {}),
      send: async ({ text, expectedText, chat, thread }) => {
        if (workerStop.value || existsSync(stopPath) || wallNow() >= journal.view.expires || journal.view.stop) return null;
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
    validateSubscriptionActivation(activation, profile, required(options, 'model'), wallNow(), SUBSCRIPTION_CONVERSATION_FRAMING);
    if (!activationMatchesJournal(journal.view, activation)) throw Error('preview: activation differs from journal');
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
    worker.startStepChecks();
    const cycles = number(options['max-cycles'] ?? '1000', 'max-cycles', 1, 1_000_000);
    // The run log is durable before the first poll; the self-state reads it from memory each turn.
    launchedAt = wallNow();
    appendRun(runsPath, { v: 1, launch: launchedAt, pid: process.pid });
    runs = readRuns(runsPath);
    handoff = restartHandoff(journal.view, runs, launchedAt);
    reservedAtLaunch = new Set(journal.view.order.filter(turn => turn.reserved).map(turn => turn.id));
    let failedPolls = 0, conflictedPolls = 0;
    const pollFailure = async conflict => {
      failedPolls++;
      conflictedPolls = conflict ? conflictedPolls + 1 : 0;
      const reason = exhaustedPollReason(failedPolls, conflictedPolls);
      if (reason) {
        endReason = reason;
        process.exitCode = 1;
        return false;
      }
      const until = clock.elapsed() + Math.min(conflict ? 2000 : 30000, 250 * 2 ** Math.min(failedPolls - 1, 7));
      while (!workerStop.value && !existsSync(stopPath) && clock.elapsed() < until)
        await delay(Math.min(100, until - clock.elapsed()));
      return true;
    };
        let summaryJob = null, stepJob = null;
    const checkStepsLater = () => {
      if (!stepCheckEnabled || stepJob) return;
      stepJob = worker.checkSteps().catch(() => {}).finally(() => { stepJob = null; });
    };

    const sourceState = options['agent-state-dir'] ? agentState(options['agent-state-dir']) : null;
    const summarizeLater = () => {
      // After the reply: the deterministic coherence check records its findings for the next
      // packet. It makes no call and cannot hold the reply already attempted;
      // its synchronous journal write can slightly delay the next poll.
      try { worker.checkCoherence(); } catch { /* the unchecked reply is retried after the next drain */ }
      checkStepsLater();
      if (summaryJob) return;
      summaryJob = worker.summarizeIfNeeded().catch(() => {}).then(checkStepsLater).finally(() => { summaryJob = null; });
    };
    const reportCap = () => reportJournalCap(journal, wallNow(), line => process.stderr.write(line));
    const waitHeldNotices = async () => {
      let due;
      while ((due = worker.nextHeldNoticeAt()) !== null) {
        while (!signalled && !workerStop.value && !existsSync(stopPath) && wallNow() < Math.min(due, journal.view.expires))
          await delay(Math.min(1000, due - wallNow(), journal.view.expires - wallNow()));
        if (signalled || workerStop.value || existsSync(stopPath) || wallNow() >= journal.view.expires) break;
        await worker.drain(); summarizeLater();
      }
    };
    const stopAtCap = async () => {
      const cap = reportCap();
      if (!cap || cap === 'model attempt cap reached') return false;
      endReason = cap;
      await waitHeldNotices();
      return true;
    };
    for (let i = 0; i < cycles && !signalled; i++) {
      if (i > 0) await new Promise(done => setImmediate(done));
      if (signalled || workerStop.value || existsSync(stopPath)) break;
      if (sourceState) for (const source of ['telegram', 'slack']) {
        try {
          importSource(journal, sourceState, source, () => workerStop.value || existsSync(stopPath));
        } catch {
          if (workerStop.value || existsSync(stopPath)) break;
        }
      }
      worker.gate(); await worker.drain(); summarizeLater(); worker.gate();
      if (await stopAtCap()) break;
      if (existsSync(stopPath) || wallNow() >= journal.view.expires) break;
      try { worker.pollGate(); } catch {
        if (!await stopAtCap()) endReason = 'cap reached';
        break;
      }
      if (signalled || workerStop.value || existsSync(stopPath)) break;
      let result;
      try { result = physical.invoke({ token: secretRef('telegram-bot-token'), method: 'getUpdates',
        body: { offset: journal.view.cursor, limit: journalPollLimit(journal.view),
          timeout: number(options['max-poll-seconds'] ?? '5', 'max-poll-seconds', 1, 5),
          allowed_updates: ['message', 'edited_message'] },
        timeoutMs: 12000 }, token()); }
      catch { if (!await pollFailure(false)) break; continue; }
      await new Promise(done => setImmediate(done));
      if (signalled || workerStop.value || existsSync(stopPath)) break;
      if (result.kind !== 'response' || result.status !== 200) {
        if (!await pollFailure(result.kind === 'response' && result.status === 409)) break;
        continue;
      }
      let updates;
      try { updates = JSON.parse(result.bytes); } catch { if (!await pollFailure(false)) break; continue; }
      if (updates.ok !== true || !Array.isArray(updates.result)) { if (!await pollFailure(false)) break; continue; }
      failedPolls = 0; conflictedPolls = 0;
      worker.intake(updates.result); await worker.drain();
      // Reminders go out only after a successful poll returned nothing new: every
      // operator message already waiting (a cancellation included) has been read
      // and settled first. A failed poll, a backlog or a cap leaves them pending.
      if (updates.result.length === 0) await worker.sendReminders();
      summarizeLater();
      if (await stopAtCap()) break;

    }
    await summaryJob;
    await stepJob;
    if (stepCheckEnabled) await worker.checkSteps();
    const finalCap = reportCap();
    endReason ??= finalCap;
    endReason ??= 'cycle limit reached';
    function modelRoute(operation) {
      if (!active() || workerStop.value || existsSync(stopPath)) throw Error('preview: activation stopped');
      const policy = subscriptionConversationPolicy(options.model);
      const contract = { reference: activation.reference, version: activation.profileDigest,
        parserReference: 'claude-code-json-result', parserVersion: '1', endpoint: profile.loginProfileIdentity,
        account: profile.expectedAccount, credentialReference: profile.reference, controller: 'preview-journal',
        sourceEvidence: [activation.reference], terminalEvidence: activation.reference, terminalReasonField: 'subtype',
        successfulFinalReplyReasons: ['success'], strength: 'attestation', maxMetadataBytes: policy.maxMetadataBytes,
        maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes };
      const physicalIO = createSubscriptionProviderIO({ repository: process.cwd(),
        stopped: () => workerStop.value || existsSync(stopPath) || !active() });
      const io = observedSubscriptionIO(physicalIO, policy, operation, row => journal.append(row),
        { elapsed: () => performance.now(), at: wallNow });
      return take(createClaudeCodeSubscriptionRoute({ context, credential: secretRef(profile.reference), profile,
        resolveProfile: () => profile, provider: 'anthropic', model: options.model, route: 'preview-subscription',
        disclosure: 'Subscription preview; charge UNKNOWN', activation, framing: SUBSCRIPTION_CONVERSATION_FRAMING,
        io,
        now: wallNow, active: () => !workerStop.value && !existsSync(stopPath) && active() && !journal.view.stop,
        adapterEvidenceContract: contract,
        ...(journal.view.limits.maxBytes > subscriptionConversationPolicy(options.model).maxPromptBytes
          ? { raisedPromptBytes: journal.view.limits.maxBytes, promptAuthority: journal.view.capAuthority } : {}) }));
    }
  } catch (error) { if (!signalled) throw error; }
  finally {
    try {
      if (journal && !journal.view.stop && !journal.readOnly && wallNow() >= journal.view.expires)
        journal.append({ kind: 'stop', reason: 'trial expired', at: wallNow() });
      if (launchedAt !== null) {
        const reason = signalName ? `paused by signal ${signalName}` : journal?.view.stop === 'trial expired' ? 'trial expired'
          : existsSync(stopPath) || journal?.view.stop ? 'operator stop latched' : endReason ?? 'error (details suppressed)';
        try { appendRun(runsPath, { v: 1, launch: launchedAt, exit: wallNow(), reason }); } catch { /* the next launch reports an unrecorded end */ }
      }
    } finally {
      journal?.close(); storage.close(); process.removeListener('SIGINT', signal); process.removeListener('SIGTERM', signal); process.removeListener('SIGHUP', signal);
    }
  }
}

try { await main(); } catch { process.stderr.write('preview refused to start or continue; details suppressed\n'); process.exitCode = 1; }
