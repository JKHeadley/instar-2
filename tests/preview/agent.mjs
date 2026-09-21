#!/usr/bin/env node
import { resolve } from 'node:path';
import { createProductionTelegramIO, productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { createPreviewComposition } from './composition.js';
import { openPreviewState } from './state.js';

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

function integer(value, name, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`preview: invalid ${name}`);
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
  if (!forum && thread !== null) throw new Error('preview: non-forum target requires --message-thread-id none');
  return Object.freeze({
    root: resolve(required(options, 'root')),
    machine: options.machine ?? 'preview-local-machine',
    botId: required(options, 'bot-id'),
    botUsername: required(options, 'bot-username'),
    operatorSenderId: required(options, 'operator-sender-id'),
    chatId: required(options, 'chat-id'),
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
  const stateConfiguration = { ...config, expiresAt,
    replyLimit: integer(options['reply-limit'] ?? '6', 'reply-limit', 1),
    replyWindowMs: integer(options['reply-window-ms'] ?? '60000', 'reply-window-ms', 1),
    errorLimit: integer(options['error-limit'] ?? '5', 'error-limit', 1) };
  return openPreviewState({ root: config.root, configuration: stateConfiguration, expiresAt,
    replyLimit: stateConfiguration.replyLimit, replyWindowMs: stateConfiguration.replyWindowMs,
    errorLimit: stateConfiguration.errorLimit, create });
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

function publicStatus(document) {
  const counts = {};
  for (const turn of Object.values(document.turns)) counts[turn.phase] = (counts[turn.phase] ?? 0) + 1;
  return { trial: document.trial.id, createdAt: document.trial.createdAt,
    expiresAt: document.trial.expiresAt, stop: document.stop, consecutiveErrors: document.consecutiveErrors,
    turns: counts, configuration: document.trial.configurationDigest };
}

const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));

async function main() {
  const { command, options } = argumentsOf(process.argv.slice(2));
  const config = configuration(options);
  const state = stateFor(config, options, command === 'run');
  if (command === 'status') {
    process.stdout.write(`${JSON.stringify(publicStatus(state.read()))}\n`);
    return 0;
  }
  if (command === 'stop') {
    process.stdout.write(`${JSON.stringify(publicStatus(state.latchStop('operator')))}\n`);
    return 0;
  }
  if (command !== 'run') throw new Error('preview: command must be run, status, or stop');

  // A stopped/expired trial never resolves a credential and never admits a transport.
  state.gate('poll');
  let signalled = false;
  const signal = () => {
    signalled = true;
    try { state.latchStop('signal'); } catch { /* diagnostics are deliberately suppressed */ }
  };
  process.once('SIGINT', signal);
  process.once('SIGTERM', signal);
  let composition;
  try {
    composition = createPreviewComposition({ configuration: config, state, storageKey: storageKey(),
      storageIO: productionStorageIO, resolveSecret: resolveHostSecret,
      telegramIOFactory: storage => createProductionTelegramIO(config.root, storage.captures) });
    composition.resume();
    const maximumCycles = integer(options['max-cycles'] ?? '1000', 'max-cycles', 1);
    const baseBackoff = integer(options['backoff-ms'] ?? '250', 'backoff-ms', 1);
    const maximumBackoff = integer(options['max-backoff-ms'] ?? '5000', 'max-backoff-ms', 1);
    for (let cycle = 0; cycle < maximumCycles && !signalled; cycle += 1) {
      try {
        composition.pollOnce();
      } catch {
        const current = state.noteError();
        process.stderr.write('preview cycle failed; diagnostic details suppressed\n');
        if (current.stop !== null) break;
        const wait = Math.min(maximumBackoff, baseBackoff * (2 ** Math.min(current.consecutiveErrors - 1, 8)));
        await delay(wait);
      }
    }
    return 0;
  } finally {
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
