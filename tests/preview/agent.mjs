#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createProductionTelegramIO, productionStorageIO, createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';
import { createPreviewComposition, stage2GuardedProviderPath } from './composition.js';
import { stage2HistoricalStatus } from './stage2-owners.js';
import { HOST_OUTAGE_TEXT, MAX_PREVIEW_ERROR_LIMIT, MAX_PREVIEW_TOTAL_ERROR_LIMIT, openPreviewState } from './state.js';
import { decideUnansweredTurn } from '../../src/sentinels/unanswered-turn.js';

const MAX_PREVIEW_BACKOFF_MS = 300_000;
const DIAGNOSTIC_REASON_CODES = Object.freeze([
  'TRANSPORT', 'TIMEOUT', 'REFUSED', 'STOPPED', 'EXPIRED', 'BOUND', 'UNKNOWN',
]);
const DIAGNOSTIC_PHASES = Object.freeze(['DRAIN', 'POLL']);

function argumentsOf(values) {
  const command = values[0] ?? 'run';
  const options = {};
  for (let index = 1; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (!name?.startsWith('--') || value === undefined) throw new Error('preview: malformed arguments');
    options[name.slice(2)] = value;
  }
  return { command, options };
}

function integer(value, name, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`preview: invalid ${name}`);
  return parsed;
}

function required(options, name) {
  const value = options[name];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`preview: missing --${name}`);
  return value;
}

function expiry(value) {
  const numeric = Number(value);
  const parsed = Number.isSafeInteger(numeric) && numeric > 0 ? numeric : Date.parse(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error('preview: invalid expiry');
  return parsed;
}

function configuration(options) {
  const thread = options['message-thread-id'] === 'none' ? null
    : integer(options['message-thread-id'] ?? '0', 'message-thread-id');
  const forum = options.forum === 'true';
  const chatKind = options['chat-kind'] ?? 'private';
  if (!['private', 'group-topic'].includes(chatKind)) throw new Error('preview: invalid chat-kind');
  if (!forum && thread !== null) throw new Error('preview: non-forum target requires --message-thread-id none');
  if (chatKind === 'private' && (forum || thread !== null)) throw new Error('preview: private target cannot name a forum topic');
  if (chatKind === 'group-topic' && (!forum || thread === null)) throw new Error('preview: group-topic requires forum true and a topic id');
  return Object.freeze({
    root: resolve(required(options, 'root')),
    machine: options.machine ?? 'preview-local-machine',
    botId: required(options, 'bot-id'),
    botUsername: required(options, 'bot-username'),
    operatorSenderId: required(options, 'operator-sender-id'),
    chatId: required(options, 'chat-id'), chatKind,
    forum,
    messageThreadId: thread,
    maxPollSeconds: integer(options['max-poll-seconds'] ?? '5', 'max-poll-seconds', 1),
    maxBatchItems: integer(options['max-batch-items'] ?? '8', 'max-batch-items', 1),
    maxContextTurns: integer(options['max-context-turns'] ?? '8', 'max-context-turns', 1),
    maxContextBytes: integer(options['max-context-bytes'] ?? '65536', 'max-context-bytes', 1),
  });
}

function stateFor(config, options, create) {
  const expiresAt = expiry(required(options, 'expires-at'));
  const totalErrorLimit = integer(options['total-error-limit'] ?? '1000', 'total-error-limit', 1,
    MAX_PREVIEW_TOTAL_ERROR_LIMIT);
  const stateConfiguration = { ...config, expiresAt,
    replyLimit: integer(options['reply-limit'] ?? '6', 'reply-limit', 1),
    replyWindowMs: integer(options['reply-window-ms'] ?? '60000', 'reply-window-ms', 1),
    errorLimit: integer(options['error-limit'] ?? '5', 'error-limit', 1, MAX_PREVIEW_ERROR_LIMIT),
    maxPendingTurns: integer(options['max-pending-turns'] ?? '16', 'max-pending-turns', 1),
    maxTrialTurns: integer(options['max-trial-turns'] ?? '128', 'max-trial-turns', 1) };
  return openPreviewState({ root: config.root, configuration: stateConfiguration, expiresAt,
    replyLimit: stateConfiguration.replyLimit, replyWindowMs: stateConfiguration.replyWindowMs,
    errorLimit: stateConfiguration.errorLimit, totalErrorLimit, maxPendingTurns: stateConfiguration.maxPendingTurns,
    maxTrialTurns: stateConfiguration.maxTrialTurns, create,
    hostNotice: { botId: config.botId, chatId: config.chatId, message: HOST_OUTAGE_TEXT } });
}

function resolveHostSecret(reference) {
  if (reference.vault !== 'preview') throw new Error('preview secret reference refused');
  if (reference.name === 'telegram-bot-token') {
    const value = process.env.INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN;
    if (typeof value === 'string' && value.length > 0) return value;
  }
  if (reference.name === 'storage-key') {
    const value = process.env.INSTAR_SECRET_PREVIEW_STORAGE_KEY;
    if (typeof value === 'string' && value.length > 0) return value;
  }
  throw new Error('preview secret reference unavailable');
}

function storageKey() {
  const encoded = resolveHostSecret({ vault: 'preview', name: 'storage-key' });
  if (/^[a-f0-9]{64}$/iu.test(encoded)) return new Uint8Array(Buffer.from(encoded, 'hex'));
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.byteLength !== 32) throw new Error('preview storage key unavailable');
  return new Uint8Array(bytes);
}

function publicStatus(document, config) {
  const root = config.root;
  const counts = {};
  for (const turn of Object.values(document.turns)) counts[turn.phase] = (counts[turn.phase] ?? 0) + 1;
  let stage2;
  const sidecarPath = resolve(root, 'preview-stage2-state.json');
  if (existsSync(sidecarPath)) {
    const d = stage2HistoricalStatus(root, document, config);
    stage2 = { phase: d.phase, modelAttemptUsed: d.modelAttemptUsed, terminalLatch: d.terminalLatch,
      ownerStart: d.ownerStart, ownerDeadline: d.ownerDeadline, hold: d.hold,
      selectedTurn: d.selectedTurn, references: d.references };
  }
  return { stage2, trial: document.trial.id, createdAt: document.trial.createdAt,
    expiresAt: document.trial.expiresAt, stop: document.stop, consecutiveErrors: document.consecutiveErrors,
    totalErrors: document.totalErrors, errorLimit: document.trial.errorLimit,
    totalErrorLimit: document.trial.totalErrorLimit,
    turns: counts, configuration: document.trial.configurationDigest };
}

const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
const yieldBoundary = () => new Promise(resolveBoundary => setImmediate(resolveBoundary));

function diagnosticReason(document, observed = 'UNKNOWN') {
  if (document.stop?.reason === 'expiry') return 'EXPIRED';
  if (document.stop?.reason === 'capacity') return 'BOUND';
  if (document.stop?.reason === 'operator' || document.stop?.reason === 'signal') return 'STOPPED';
  return DIAGNOSTIC_REASON_CODES.includes(observed) ? observed : 'UNKNOWN';
}

function emitCycleDiagnostic(reason, phase, document, backoffMs) {
  const safeReason = DIAGNOSTIC_REASON_CODES.includes(reason) ? reason : 'UNKNOWN';
  const safePhase = DIAGNOSTIC_PHASES.includes(phase) ? phase : 'DRAIN';
  const record = { type: 'PREVIEW_CYCLE_DIAGNOSTIC', schemaVersion: 1,
    reason: safeReason, phase: safePhase,
    consecutiveErrors: document.consecutiveErrors, totalErrors: document.totalErrors, backoffMs };
  try { process.stderr.write(`${JSON.stringify(record)}\n`); } catch { /* accounting is already durable */ }
}

async function interruptibleBackoff(milliseconds, state, stopped) {
  const deadline = Date.now() + milliseconds;
  while (!stopped()) {
    try { state.gate('poll'); } catch { return; }
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    await delay(Math.min(remaining, 100));
  }
}

async function main() {
  const { command, options } = argumentsOf(process.argv.slice(2));
  const config = configuration(options);
  const stage = integer(options.stage ?? '1', 'stage', 1, 2);
  const state = stateFor(config, options, command === 'run');
  if (command === 'status') {
    process.stdout.write(`${JSON.stringify(publicStatus(state.read(), config))}\n`);
    return 0;
  }
  if (command === 'stop') {
    process.stdout.write(`${JSON.stringify(publicStatus(state.latchStop('operator'), config))}\n`);
    return 0;
  }
  if (command === 'host-notice') {
    const notice = createPreviewComposition({ configuration: config, state, noticeOnly: true,
      storageKey: storageKey(), storageIO: productionStorageIO,
      resolveSecret: resolveHostSecret,
      telegramIOFactory: storage => createProductionTelegramIO(config.root, storage.captures) });
    try { notice.dispatchHostNotice(resolve(config.root, 'host-watch.json')); } finally { notice.close(); }
    return 0;
  }
  if (command !== 'run') throw new Error('preview: command must be run, status, stop, or host-notice');

  // Historical terminal inspection stays credential-free on stopped and
  // answered roots. Only a live held turn with a pending fixed notice proceeds.
  if (stage === 2 && existsSync(resolve(config.root, 'preview-stage2-state.json'))) {
    const historical = stage2HistoricalStatus(config.root, state.read(), config);
    if (historical.phase === 'reply-dispatch-unknown') {
      const recorded = await stage2GuardedProviderPath({ configuration: config, state });
      try { await recorded.resume(); } finally { recorded.close(); }
      return 0;
    }
    const selected = historical.selectedTurn && state.read().turns[historical.selectedTurn];
    if (historical.terminalLatch && (state.read().stop || historical.phase !== 'held'
      || !selected?.failureClass || !['intake-preserved', 'grounded'].includes(selected.phase))) return 0;
  }

  // A stopped/expired trial never resolves a credential and never admits a transport.
  state.gate('poll');
  let signalled = false;
  const signal = () => {
    signalled = true;
    try { state.latchStop('signal'); } catch { /* diagnostics are deliberately suppressed */ }
  };
  process.once('SIGINT', signal);
  process.once('SIGTERM', signal);
  let observedPollReason = 'UNKNOWN';
  const observedTelegramIO = storage => {
    const physical = createProductionTelegramIO(config.root, storage.captures);
    return Object.freeze({ invoke(request, credential) {
      if (request.method === 'getUpdates') observedPollReason = 'UNKNOWN';
      let outcome;
      try { outcome = physical.invoke(request, credential); }
      catch {
        // An untyped exception is deliberately replaced, never inspected.
        if (request.method === 'getUpdates') observedPollReason = 'UNKNOWN';
        throw new Error('preview: Telegram invocation failed');
      }
      if (request.method === 'getUpdates') {
        if (outcome?.kind === 'uncertain' && outcome.limitation === 'timeout') observedPollReason = 'TIMEOUT';
        else if (outcome?.kind === 'uncertain' && outcome.limitation === 'transport') observedPollReason = 'TRANSPORT';
        else if (outcome?.kind === 'response' && Number.isSafeInteger(outcome.status)
          && (outcome.status < 200 || outcome.status >= 300)) observedPollReason = 'REFUSED';
      }
      return outcome;
    } });
  };
  const noticeCycle = () => {
    if (stage !== 2 || !existsSync(resolve(config.root, 'preview-stage2-state.json'))) return false;
    const document = state.read();
    const historical = stage2HistoricalStatus(config.root, document, config);
    const selected = historical.selectedTurn && document.turns[historical.selectedTurn];
    if (historical.phase !== 'held' || !selected?.failureClass) return false;
    const decision = decideUnansweredTurn({ turns: [{ ...selected, held: true }],
      stopped: document.stop !== null, expiresAt: document.trial.expiresAt }, Date.now());
    if (!decision) return false;
    const notice = createPreviewComposition({ configuration: config, state, noticeOnly: true,
      storageKey: storageKey(), storageIO: productionStorageIO,
      resolveSecret: resolveHostSecret, telegramIOFactory: observedTelegramIO });
    try { notice.dispatchNotice(decision.turnId, decision.text); } finally { notice.close(); }
    return true;
  };
  const waitForHeldNotice = async historical => {
    while (!signalled && state.read().stop === null) {
      state.heartbeat(process.pid);
      if (noticeCycle()) break;
      const current = state.read().turns[historical.selectedTurn];
      if (historical.phase !== 'held' || !current?.failureClass
        || !['intake-preserved', 'grounded'].includes(current.phase)
        || Date.now() >= state.read().trial.expiresAt) break;
      await interruptibleBackoff(1000, state, () => signalled);
    }
  };
  // Historical recovery never invokes a second model call or reply. A held
  // selected turn remains alive only long enough for its fixed notice.
  if (stage === 2 && existsSync(resolve(config.root, 'preview-stage2-state.json'))) {
    const historical = stage2HistoricalStatus(config.root, state.read(), config);
    if (historical.terminalLatch) {
      await waitForHeldNotice(historical);
      return 0;
    }
  }
  let composition;
  try {
    let stage2;
    if (stage === 2) {
      const activationPath = required(options, 'activation-record');
      const activationBytes = readFileSync(activationPath, 'utf8');
      const activation = JSON.parse(activationBytes);
      const profile = Object.freeze(JSON.parse(readFileSync(required(options, 'login-profile'), 'utf8')));
      stage2 = { activation, profile, model: required(options, 'model'),
        cutoff: integer(required(options, 'activation-cutoff'), 'activation-cutoff', 1), arm: options.arm === 'true',
        now: Date.now, active: () => { try { return !signalled && readFileSync(activationPath, 'utf8') === activationBytes; } catch { return false; } },
        io: createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => {
          try { const deadline = composition?.sidecar?.read().ownerDeadline;
            return signalled || state.read().stop !== null || Date.now() >= state.read().trial.expiresAt
              || (typeof deadline === 'number' && deadline <= Date.now())
              || readFileSync(activationPath, 'utf8') !== activationBytes;
          } catch { return true; }
        } }) };
    }
    const input = { configuration: config, state, storageKey: storageKey(), storageIO: productionStorageIO,
      resolveSecret: resolveHostSecret, telegramIOFactory: observedTelegramIO, stage2 };
    composition = stage === 2 ? await stage2GuardedProviderPath(input) : createPreviewComposition(input);
    // Successful physical bridges are synchronous. Yield after each such boundary so
    // Node can service SIGINT/SIGTERM before any subsequent admission or dispatch.
    await yieldBoundary();
    const maximumCycles = integer(options['max-cycles'] ?? '1000', 'max-cycles', 1, 1_000_000);
    const baseBackoff = integer(options['backoff-ms'] ?? '250', 'backoff-ms', 1, MAX_PREVIEW_BACKOFF_MS);
    const maximumBackoff = integer(options['max-backoff-ms'] ?? '5000', 'max-backoff-ms', 1, MAX_PREVIEW_BACKOFF_MS);
    if (baseBackoff > maximumBackoff) throw new Error('preview: base backoff exceeds maximum');
    for (let cycle = 0; cycle < maximumCycles && !signalled; cycle += 1) {
      let phase = 'DRAIN';
      try {
        state.heartbeat(process.pid);
        while (!signalled) {
          await yieldBoundary();
          if (signalled || !(await composition.resumeOne())) break;
          await yieldBoundary();
          if (state.read().stop !== null) break;
        }
        if (signalled || state.read().stop !== null || composition.terminal?.()) {
          const held = stage === 2 && stage2HistoricalStatus(config.root, state.read(), config);
          const selected = held?.selectedTurn && state.read().turns[held.selectedTurn];
          if (held?.phase === 'held' && !signalled && state.read().stop === null
            && selected?.failureClass && ['intake-preserved', 'grounded'].includes(selected.phase)) {
            composition.close(); composition = null;
            try { await waitForHeldNotice(held); } catch { state.noteError(); }
          }
          break;
        }
        phase = 'POLL';
        composition.pollOnce();
        await yieldBoundary();
      } catch {
        // Persist both breaker counters before constructing or emitting diagnostics.
        const current = state.noteError();
        const wait = current.stop === null
          ? Math.min(maximumBackoff, baseBackoff * (2 ** Math.min(current.consecutiveErrors - 1, 8))) : 0;
        emitCycleDiagnostic(diagnosticReason(current, phase === 'POLL' ? observedPollReason : 'UNKNOWN'), phase, current, wait);
        if (current.stop !== null) break;
        await interruptibleBackoff(wait, state, () => signalled);
        if (signalled || state.read().stop !== null) break;
      }
    }
    return 0;
  } finally {
    if (stage === 2 && composition?.sidecar && state.read().stop)
      composition.sidecar.hold(state.read().stop.reason === 'expiry' ? 'EXPIRED' : 'STOPPED');
    composition?.close();
    process.removeListener('SIGINT', signal);
    process.removeListener('SIGTERM', signal);
  }
}

try {
  process.exitCode = await main();
} catch {
  // No resolver/provider/child diagnostic is ever reflected to the terminal.
  process.stderr.write('preview refused to start or continue; details suppressed\n');
  process.exitCode = 1;
}
