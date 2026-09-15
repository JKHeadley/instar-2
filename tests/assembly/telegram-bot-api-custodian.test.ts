import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { consumeResult, decode } from '../../src/index.js';
import type { Result, SecretRef } from '../../src/index.js';
import { createTelegramBotApiCustodian, telegramBotApiCustodianContractMap } from '../../src/assembly/index.js';
import type { TelegramBridgeReply, TelegramConfinedBridgePort, TelegramDurableCapturePort } from '../../src/assembly/index.js';
import type { TelegramBotApiCustodianPort } from '../../src/conversation/index.js';
import { factsFixture, value } from '../facts/fixtures.js';

const getMe = '{"ok":true,"result":{"id":818181,"is_bot":true,"first_name":"Echo","username":"echo_mmtest_seam_b27x_bot"}}';
const update = '{"update_id":2727,"message":{"message_id":81,"from":{"id":9191,"is_bot":false,"first_name":"Live"},"chat":{"id":9191,"first_name":"Live","type":"private"},"date":1789460000,"text":"custodian live path"}}';
const poll = `{"ok":true,"result":[${update}]}`;
const sent = '{"ok":true,"result":{"message_id":7373,"from":{"id":818181,"is_bot":true,"first_name":"Echo","username":"echo_mmtest_seam_b27x_bot"},"chat":{"id":9191,"type":"private"},"date":1789460001,"text":"accepted"}}';

function unwrap<T>(result: Result<T>): T {
  return consumeResult(result, { Success: item => item, Refused: refusal => { throw new Error(refusal.detail); } });
}
function rejected<T>(result: Result<T>, detail: string) {
  return consumeResult(result, { Success: () => { throw new Error('expected refusal'); }, Refused: refusal => {
    expect(refusal.detail).toContain(detail); return refusal;
  } });
}
function setup(replies: TelegramBridgeReply[], captureFailureAt = Number.POSITIVE_INFINITY) {
  const f = factsFixture();
  const token = unwrap(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'telegram_livetest_bot_token' }, f.ctx.decode)) as SecretRef;
  const bytes = new Map<string, string>(); let writes = 0;
  const captures: TelegramDurableCapturePort = { owner: 'part-ten', preserve(reference, raw) {
    writes += 1; if (writes === captureFailureAt) return false; bytes.set(reference, raw); return true;
  }, read: reference => bytes.get(reference) ?? null };
  const calls: Array<{ method: string; body: Readonly<Record<string, string | number>> }> = [];
  const bridge: TelegramConfinedBridgePort = { owner: 'part-ten', invoke(input) {
    calls.push({ method: input.method, body: input.body }); return replies.shift() ?? { kind: 'uncertain', limitation: 'transport' };
  } };
  const custodian = unwrap(createTelegramBotApiCustodian({ context: f.c, machine: 'machine-live',
    now: () => f.clock(500), freshFor: 60_000, captures, bridge }));
  return { f, token, bytes, calls, custodian };
}

describe('Part Ten confined Telegram Bot API custodian', () => {
  test('recorded real response bytes replay identity, capture-before-offset, authentication, and HTML send with zero retries', () => {
    const s = setup([{ kind: 'response', status: 200, bytes: getMe }, { kind: 'response', status: 200, bytes: poll },
      { kind: 'response', status: 200, bytes: sent }]);
    const identity = unwrap(s.custodian.identity({ token: s.token, apiVersion: '9.2' }));
    expect(identity).toMatchObject({ botId: '818181', username: '@echo_mmtest_seam_b27x_bot', authenticated: true });
    expect(unwrap(s.custodian.readCapture(identity.capture.reference))).toBe(getMe);
    const batch = unwrap(s.custodian.poll({ token: s.token, apiVersion: '9.2', offset: 2727, limit: 100, timeout: 1 }));
    expect(batch.updates).toEqual([update]);
    const route = { channel: 'telegram:v1:bot:818181:chat:9191:direct', sender: 'telegram:v1:user:9191',
      identityEpoch: 'telegram:v1:bot:818181:epoch:live', eventId: '2727' };
    const provenance = unwrap(s.custodian.authenticate({ token: s.token, apiVersion: '9.2', raw: batch.updates[0]!, route, at: s.f.clock(501) }));
    expect(provenance).toMatchObject({ adapter: 'telegram-intake-v1', method: 'telegram-bot-api-long-poll', evidence: { kind: 'channel', authenticated: true } });
    expect(unwrap(s.custodian.sendMessage({ token: s.token, apiVersion: '9.2', chatId: '9191', messageThreadId: null,
      text: '<b>accepted</b>', parseMode: 'HTML', timeout: 1, hiddenRetries: 0 }))).toBe(sent);
    expect(s.calls).toEqual([
      { method: 'getMe', body: {} },
      { method: 'getUpdates', body: { offset: 2727, limit: 100, timeout: 1 } },
      { method: 'sendMessage', body: { chat_id: '9191', text: '<b>accepted</b>', parse_mode: 'HTML' } },
    ]);
  });

  test('refuses an offset beyond the consecutively durable captured prefix before another network call', () => {
    const two = '{"ok":true,"result":[{"update_id":5,"message":{"message_id":1}},{"update_id":6,"message":{"message_id":2}}]}';
    const s = setup([{ kind: 'response', status: 200, bytes: two }], 3);
    expect(unwrap(s.custodian.poll({ token: s.token, apiVersion: '9.2', offset: 5, limit: 2, timeout: 1 })).updates).toHaveLength(1);
    rejected(s.custodian.poll({ token: s.token, apiVersion: '9.2', offset: 7, limit: 2, timeout: 1 }), 'past consecutively durable capture');
    expect(s.calls).toHaveLength(1);
  });

  test('missing or invalid SecretRef refuses without transport, and raw token value is not a reachable property', () => {
    const s = setup([]); const invalid = { ...s.token, name: '' } as SecretRef;
    rejected(s.custodian.identity({ token: invalid, apiVersion: '9.2' }), 'confined SecretRef');
    expect(s.calls).toHaveLength(0);
    expect(Object.keys(s.custodian)).toEqual(['owner', 'id', 'identity', 'readCapture', 'authenticate', 'poll', 'sendMessage']);
    expect(JSON.stringify(s.custodian)).not.toContain('telegram_livetest_bot_token');
  });

  test.each([
    [{ kind: 'uncertain', limitation: 'timeout' } as const, 'transport uncertainty: timeout'],
    [{ kind: 'response', status: 429, bytes: '{"ok":false,"description":"Too Many Requests"}' } as const, 'HTTP 429'],
    [{ kind: 'response', status: 200, bytes: 'not-json' } as const, 'response JSON malformed'],
  ])('returns typed refusal with no hidden retry for %s', (reply, detail) => {
    const s = setup([reply]); rejected(s.custodian.sendMessage({ token: s.token, apiVersion: '9.2', chatId: '9191',
      messageThreadId: null, text: 'one', parseMode: 'HTML', timeout: 1, hiddenRetries: 0 }), detail);
    expect(s.calls).toHaveLength(1);
    if (reply.kind === 'response') expect([...s.bytes.values()]).toContain(reply.bytes);
  });

  test('contract map exposes only the executable slice and names every held arm', () => {
    expect(telegramBotApiCustodianContractMap.executable).toHaveLength(5);
    expect(telegramBotApiCustodianContractMap.held.join(' ')).toMatch(/webhook.*media.*edit.*react.*topic.*other-platform.*rate-limit/);
  });
});

test('LIVE Telegram custodian: real getMe, update capture, authentication, and sendMessage evidence', async context => {
  if (process.env.INSTAR_TELEGRAM_LIVE_TEST !== '1') {
    context.skip('live Telegram mutation gate is closed; set INSTAR_TELEGRAM_LIVE_TEST=1 for the confined live canary'); return;
  }
  const agentHome = '/Users/dabombstudio/.instar/agents/echo';
  const names = spawnSync(process.execPath, [`${agentHome}/.instar/scripts/secret-get.mjs`, '--names'], { cwd: agentHome, encoding: 'utf8' });
  if (names.status !== 0 || !names.stderr.includes('telegram_livetest_bot_token (')) {
    context.skip('SecretRef telegram_livetest_bot_token is absent; live Telegram test is intentionally not faked green'); return;
  }
  const f = factsFixture();
  const token = unwrap(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'telegram_livetest_bot_token' }, f.ctx.decode)) as SecretRef;
  const captureDirectory = join(agentHome, '.instar', 'custody', 'telegram-bot-api-live-test');
  const captures: TelegramDurableCapturePort = { owner: 'part-ten', preserve(reference, bytes) {
    mkdirSync(captureDirectory, { recursive: true, mode: 0o700 });
    const destination = join(captureDirectory, `${reference.replace(/[^A-Za-z0-9_.-]/g, '_')}.capture`);
    if (existsSync(destination)) return readFileSync(destination, 'utf8') === bytes;
    const temporary = `${destination}.pending`;
    try {
      writeFileSync(temporary, bytes, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      const fd = openSync(temporary, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temporary, destination);
      const directoryFd = openSync(captureDirectory, 'r'); try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
      return readFileSync(destination, 'utf8') === bytes;
    } catch { return false; }
  }, read(reference) {
    const destination = join(captureDirectory, `${reference.replace(/[^A-Za-z0-9_.-]/g, '_')}.capture`);
    return existsSync(destination) ? readFileSync(destination, 'utf8') : null;
  } };
  const bridge: TelegramConfinedBridgePort = { owner: 'part-ten', invoke(input) {
    const request = Buffer.from(JSON.stringify({ method: input.method, body: input.body, timeoutMs: input.timeoutMs }), 'utf8').toString('base64url');
    const run = spawnSync(process.execPath, [`${agentHome}/.instar/scripts/secret-get.mjs`, input.token.name, '--run', '--',
      process.execPath, join(process.cwd(), 'src/assembly/telegram-bot-api-bridge.mjs'), request], {
      cwd: agentHome, encoding: 'utf8', timeout: input.timeoutMs + 2_000, maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (run.status !== 0 || !run.stdout) return { kind: 'uncertain', limitation: run.error ? 'timeout' : 'transport' };
    try { return JSON.parse(run.stdout) as TelegramBridgeReply; }
    catch { return { kind: 'uncertain', limitation: 'transport' }; }
  } };
  const api: TelegramBotApiCustodianPort = unwrap(createTelegramBotApiCustodian({ context: f.c, machine: 'echo',
    now: () => f.clock(Date.now()), freshFor: 60_000, captures, bridge }));
  const identity = unwrap(api.identity({ token, apiVersion: '9.2' }));
  expect(identity.username).toBe('@echo_mmtest_seam_b27x_bot');
  const batch = unwrap(api.poll({ token, apiVersion: '9.2', offset: 0, limit: 100, timeout: 3 }));
  if (batch.updates.length === 0) throw new Error('live bot returned no update; a real inbound update is required');
  const raw = batch.updates[0]!; const parsed = JSON.parse(raw) as { update_id: number; message?: { chat?: { id?: number }; from?: { id?: number } } };
  const chatId = parsed.message?.chat?.id; const senderId = parsed.message?.from?.id;
  if (!Number.isSafeInteger(chatId) || !Number.isSafeInteger(senderId)) throw new Error('live update is not an authenticatable ordinary message');
  const route = { channel: `telegram:v1:bot:${identity.botId}:chat:${String(chatId)}:direct`, sender: `telegram:v1:user:${String(senderId)}`,
    identityEpoch: `telegram:v1:bot:${identity.botId}:epoch:live-test`, eventId: String(parsed.update_id) };
  unwrap(api.authenticate({ token, apiVersion: '9.2', raw, route, at: f.clock(Date.now()) }));
  const response = unwrap(api.sendMessage({ token, apiVersion: '9.2', chatId: String(chatId), messageThreadId: null,
    text: '<b>Instar 2.0 confined custodian live-path proof</b>', parseMode: 'HTML', timeout: 10, hiddenRetries: 0 }));
  const messageId = (JSON.parse(response) as { result: { message_id: number } }).result.message_id;
  expect(Number.isSafeInteger(messageId)).toBe(true);
  process.stderr.write(`LIVE_EVIDENCE update_id=${String(parsed.update_id)} message_id=${String(messageId)} token=confined\n`);
});
