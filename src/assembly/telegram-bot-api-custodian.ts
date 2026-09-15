import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { BoundaryContext, Clock, Hash, ProvenanceInput, Result, SecretRef } from '../index.js';
import type { TelegramBotApiCustodianPort, TelegramIdentityProbe, TelegramPolledBatch } from '../conversation/index.js';
import type { InboundRoute } from '../intake/index.js';
import { boundary, ensure, freeze } from './boundary.js';

type ProviderMethod = 'getMe' | 'getUpdates' | 'sendMessage';
type ProviderBody = Readonly<Record<string, string | number>>;
export type TelegramBridgeReply = Readonly<{
  kind: 'response' | 'uncertain'; status?: number; bytes?: string; limitation?: 'timeout' | 'transport';
}>;
export interface TelegramConfinedBridgePort {
  readonly owner: 'part-ten';
  invoke(input: Readonly<{ token: SecretRef; method: ProviderMethod; body: ProviderBody; timeoutMs: number }>): TelegramBridgeReply;
}
export interface TelegramDurableCapturePort {
  readonly owner: 'part-ten';
  preserve(reference: string, bytes: string): boolean;
  read(reference: string): string | null;
}
export interface TelegramBotApiCustodianOptions {
  readonly context: BoundaryContext;
  readonly agentHome: string;
  readonly machine: string;
  readonly now: () => Clock;
  readonly freshFor: number;
  readonly captures?: TelegramDurableCapturePort;
  readonly bridge?: TelegramConfinedBridgePort;
}

const digest = (bytes: string): Hash => `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;
const captureReference = (kind: string, bytes: string) => `capture:telegram:${kind}:${digest(bytes).slice(7)}`;

export const telegramBotApiCustodianContractMap = Object.freeze({
  executable: Object.freeze(['identity:getMe', 'poll:long-poll-capture-before-offset',
    'authenticate:captured-update-bytes', 'readCapture', 'sendMessage:HTML:hiddenRetries=0']),
  held: Object.freeze([
    'NON-EXECUTABLE-UNTIL-webhook-mode-grant',
    'NON-EXECUTABLE-UNTIL-typed-media-payload-grant',
    'NON-EXECUTABLE-UNTIL-typed-edit-payload-grant',
    'NON-EXECUTABLE-UNTIL-typed-react-payload-grant',
    'NON-EXECUTABLE-UNTIL-typed-topic-creation-payload-grant',
    'NON-EXECUTABLE-UNTIL-other-platform-adapter-grants',
    'NON-EXECUTABLE-UNTIL-rate-limit-backoff-grant',
  ]),
});

export function createTelegramFileCaptureStore(directory: string): TelegramDurableCapturePort {
  const root = resolve(directory);
  const pathFor = (reference: string) => join(root, `${reference.replace(/[^A-Za-z0-9_.-]/g, '_')}.capture`);
  return Object.freeze({ owner: 'part-ten' as const,
    preserve(reference: string, bytes: string) {
      mkdirSync(root, { recursive: true, mode: 0o700 });
      const destination = pathFor(reference);
      if (existsSync(destination)) return readFileSync(destination, 'utf8') === bytes;
      const temporary = `${destination}.${process.pid}.tmp`;
      try {
        writeFileSync(temporary, bytes, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        const fd = openSync(temporary, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
        renameSync(temporary, destination);
        const directoryFd = openSync(root, 'r'); try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
        return readFileSync(destination, 'utf8') === bytes;
      } catch { try { unlinkSync(temporary); } catch { /* absent temporary is inert */ } return false; }
    },
    read(reference: string) { const path = pathFor(reference); return existsSync(path) ? readFileSync(path, 'utf8') : null; },
  });
}

function defaultBridge(agentHome: string): TelegramConfinedBridgePort {
  return Object.freeze({ owner: 'part-ten' as const, invoke(input: Parameters<TelegramConfinedBridgePort['invoke']>[0]): TelegramBridgeReply {
    const adjacentBridge = fileURLToPath(new URL('./telegram-bot-api-bridge.js', import.meta.url));
    const bridge = existsSync(adjacentBridge) ? adjacentBridge : resolve('dist/assembly/telegram-bot-api-bridge.js');
    const request = Buffer.from(JSON.stringify({ method: input.method, body: input.body, timeoutMs: input.timeoutMs }), 'utf8').toString('base64url');
    const secretGet = join(agentHome, '.instar', 'scripts', 'secret-get.mjs');
    const run = spawnSync(process.execPath, [secretGet, input.token.name, '--run', '--', process.execPath, bridge, request], {
      cwd: agentHome, encoding: 'utf8', timeout: input.timeoutMs + 2_000, maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (run.status !== 0 || !run.stdout) return { kind: 'uncertain' as const, limitation: run.error ? 'timeout' as const : 'transport' as const };
    try { return JSON.parse(run.stdout) as TelegramBridgeReply; }
    catch { return { kind: 'uncertain' as const, limitation: 'transport' as const }; }
  } });
}

function record(value: unknown, label: string): Record<string, unknown> {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value as Record<string, unknown>;
}
function response(reply: TelegramBridgeReply, captures: TelegramDurableCapturePort, kind: string): { bytes: string; reference: string; hash: Hash } {
  ensure(reply.kind === 'response', `Telegram transport uncertainty: ${reply.limitation ?? 'transport'}`);
  ensure(typeof reply.bytes === 'string', 'Telegram response bytes absent');
  const reference = captureReference(kind, reply.bytes);
  ensure(captures.preserve(reference, reply.bytes), 'Telegram response capture was not durable');
  ensure(Number.isSafeInteger(reply.status) && reply.status! >= 200 && reply.status! < 300,
    `Telegram provider refused with HTTP ${String(reply.status)}`);
  let parsed: Record<string, unknown>;
  try { parsed = record(JSON.parse(reply.bytes) as unknown, 'Telegram response'); }
  catch { throw new Error('Telegram response JSON malformed'); }
  ensure(parsed.ok === true, 'Telegram provider returned ok:false');
  return { bytes: reply.bytes, reference, hash: digest(reply.bytes) };
}

export function createTelegramBotApiCustodian(options: TelegramBotApiCustodianOptions): Result<TelegramBotApiCustodianPort> {
  return boundary('TelegramBotApiCustodianConstruction', { machine: options.machine, freshFor: options.freshFor }, options.context, () => {
    ensure(options.agentHome.length > 0 && options.machine.length > 0, 'Telegram custodian identity is required');
    ensure(Number.isSafeInteger(options.freshFor) && options.freshFor > 0, 'Telegram identity freshness must be positive');
    const captures = options.captures ?? createTelegramFileCaptureStore(join(options.agentHome, '.instar', 'custody', 'telegram-bot-api'));
    const bridge = options.bridge ?? defaultBridge(options.agentHome);
    ensure(captures.owner === 'part-ten' && bridge.owner === 'part-ten', 'Telegram credential and capture custody must remain with Part Ten');
    let maximumPermittedOffset: number | null = null;
    const call = (token: SecretRef, method: ProviderMethod, body: ProviderBody, timeout: number, kind: string) => {
      ensure(token.type === 'SecretRef' && token.schemaVersion === 1 && token.vault.length > 0 && token.name.length > 0,
        'Telegram token must be a confined SecretRef');
      ensure(!/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(token.name), 'Telegram token bytes are forbidden at the custodian port');
      ensure(Number.isSafeInteger(timeout) && timeout > 0, 'Telegram timeout must be positive');
      return response(bridge.invoke({ token, method, body, timeoutMs: timeout * 1_000 }), captures, kind);
    };
    const port: TelegramBotApiCustodianPort = Object.freeze({ owner: 'part-ten' as const, id: 'telegram-bot-api-custodian:live:v1',
      identity(input: Parameters<TelegramBotApiCustodianPort['identity']>[0]): Result<TelegramIdentityProbe> { return boundary('TelegramBotApiIdentity', { apiVersion: input.apiVersion }, options.context, () => {
        const captured = call(input.token, 'getMe', {}, 30, 'getMe');
        const parsed = record(JSON.parse(captured.bytes) as unknown, 'Telegram getMe response');
        const bot = record(parsed.result, 'Telegram getMe bot');
        ensure(Number.isSafeInteger(bot.id) && Number(bot.id) > 0 && typeof bot.username === 'string' && bot.username.length > 0 && bot.is_bot === true,
          'Telegram getMe identity malformed');
        const observedAt = options.now();
        return freeze({ botId: String(bot.id), username: `@${bot.username}`, apiVersion: input.apiVersion, authenticated: true as const,
          observedAt: observedAt.value, freshFor: options.freshFor,
          reference: `probe:telegram:get-me:${String(bot.id)}:${input.apiVersion}:${captured.hash}`,
          capture: { reference: captured.reference, hash: captured.hash } });
      }); },
      readCapture(reference: string): Result<string> { return boundary('TelegramBotApiReadCapture', { reference }, options.context, () => {
        const bytes = captures.read(reference); ensure(bytes !== null, 'Telegram capture absent'); return bytes;
      }); },
      authenticate(input: Parameters<TelegramBotApiCustodianPort['authenticate']>[0]): Result<ProvenanceInput> { return boundary('TelegramBotApiAuthenticate', { apiVersion: input.apiVersion, route: input.route }, options.context, () => {
        let update: Record<string, unknown>; try { update = record(JSON.parse(input.raw) as unknown, 'Telegram update'); }
        catch { throw new Error('Telegram captured update JSON malformed'); }
        ensure(Number.isSafeInteger(update.update_id) && Number(update.update_id) >= 0, 'Telegram captured update id malformed');
        const hash = digest(input.raw); const reference = captureReference(`update-${String(update.update_id)}`, input.raw);
        ensure(captures.read(reference) === input.raw, 'Telegram authentication requires exact captured update bytes');
        ensure(String(update.update_id) === input.route.eventId, 'Telegram route event differs from captured update');
        return freeze({ type: 'Provenance' as const, schemaVersion: 1 as const, adapter: 'telegram-intake-v1',
          method: 'telegram-bot-api-long-poll', record: { reference, hash }, verifiedAt: input.at,
          machine: options.machine, evidence: { kind: 'channel' as const, authenticated: true } });
      }); },
      poll(input: Parameters<TelegramBotApiCustodianPort['poll']>[0]): Result<TelegramPolledBatch> { return boundary('TelegramBotApiPoll', { apiVersion: input.apiVersion, offset: input.offset, limit: input.limit, timeout: input.timeout }, options.context, () => {
        ensure(Number.isSafeInteger(input.offset) && input.offset >= 0, 'Telegram offset must be nonnegative');
        ensure(maximumPermittedOffset === null || input.offset <= maximumPermittedOffset,
          'Telegram offset advance attempted past consecutively durable capture');
        ensure(Number.isSafeInteger(input.limit) && input.limit > 0 && input.limit <= 100, 'Telegram poll limit out of range');
        const captured = call(input.token, 'getUpdates', { offset: input.offset, limit: input.limit, timeout: input.timeout }, input.timeout + 5, `poll-${input.offset}`);
        const parsed = record(JSON.parse(captured.bytes) as unknown, 'Telegram poll response');
        ensure(Array.isArray(parsed.result), 'Telegram poll result malformed');
        const updates: string[] = [];
        let next = input.offset;
        for (const candidate of parsed.result) {
          const update = record(candidate, 'Telegram update'); ensure(Number.isSafeInteger(update.update_id) && Number(update.update_id) >= next, 'Telegram update ids are not ordered');
          const raw = JSON.stringify(candidate); const reference = captureReference(`update-${String(update.update_id)}`, raw);
          if (!captures.preserve(reference, raw)) break;
          updates.push(raw); next = Number(update.update_id) + 1;
        }
        maximumPermittedOffset = next;
        return freeze({ updates, response: { reference: captured.reference, hash: captured.hash } });
      }); },
      sendMessage(input: Parameters<TelegramBotApiCustodianPort['sendMessage']>[0]): Result<string> { return boundary('TelegramBotApiSendMessage', { apiVersion: input.apiVersion, chatId: input.chatId,
        messageThreadId: input.messageThreadId, text: input.text, parseMode: input.parseMode, timeout: input.timeout, hiddenRetries: input.hiddenRetries }, options.context, () => {
        ensure(input.parseMode === 'HTML' && input.hiddenRetries === 0, 'Telegram send requires HTML and zero hidden retries');
        const body: Record<string, string | number> = { chat_id: input.chatId, text: input.text, parse_mode: 'HTML' };
        if (input.messageThreadId !== null) body.message_thread_id = input.messageThreadId;
        return call(input.token, 'sendMessage', body, input.timeout, 'sendMessage').bytes;
      }); },
    });
    return port;
  });
}
