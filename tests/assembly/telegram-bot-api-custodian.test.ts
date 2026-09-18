import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { canonical, consumeResult, decode } from '../../src/index.js';
import type { Result, SecretRef } from '../../src/index.js';
import { createTelegramBotApiCustodian, telegramBotApiCustodianContractMap,
  telegramBridgeReplyFromExecution } from '../../src/assembly/index.js';
import type { TelegramBridgeReply, TelegramConfinedBridgePort, TelegramDurableCapturePort } from '../../src/assembly/index.js';
import type { TelegramBotApiCustodianPort } from '../../src/conversation/index.js';
import { admitTelegramAdapter, assessTelegramReplyResponse, extractTelegramUpdate } from '../../src/conversation/index.js';
import { conversationFixture } from '../conversation/fixture.js';
import { telegramCustodianPreparedOutbound } from './telegram-custodian-outbound-fixture.js';
import { telegramCustodianResponseAssessment } from './telegram-custodian-assessment-fixture.js';

const getMe = '{"ok":true,"result":{"id":8820318295,"is_bot":true,"first_name":"Echo Mentor (e2c)","username":"echo_mmtest_seam_b27x_bot","can_join_groups":true,"can_read_all_group_messages":false,"supports_inline_queries":false,"supports_guest_queries":false,"can_connect_to_business":false,"has_main_web_app":false,"has_topics_enabled":false,"allows_users_to_create_topics":false,"can_manage_bots":false,"supports_join_request_queries":false}}';
const poll = '{"ok":true,"result":[{"update_id":969389541,\n"message":{"message_id":33,"from":{"id":7812716706,"is_bot":false,"first_name":"Justin","last_name":"Headley","language_code":"en"},"chat":{"id":7812716706,"first_name":"Justin","last_name":"Headley","type":"private"},"date":1789506678,"text":"Test"}}]}';
const sent = '{"ok":true,"result":{"message_id":35,"from":{"id":8820318295,"is_bot":true,"first_name":"Echo Mentor (e2c)","username":"echo_mmtest_seam_b27x_bot"},"chat":{"id":7812716706,"first_name":"Justin","last_name":"Headley","type":"private"},"date":1789540042,"text":"Instar 2.0 confined custodian live-path proof","entities":[{"offset":0,"length":45,"type":"bold"}]}}';
const realBot = JSON.parse(getMe).result;
const realUpdate = JSON.parse(poll).result[0];
const update = JSON.stringify(realUpdate);

function unwrap<T>(result: Result<T>): T {
  return consumeResult(result, { Success: item => item, Refused: refusal => { throw new Error(refusal.detail); } });
}
function rejected<T>(result: Result<T>, detail: string) {
  return consumeResult(result, { Success: () => { throw new Error('expected refusal'); }, Refused: refusal => {
    expect(refusal.detail).toContain(detail); return refusal;
  } });
}
function ownerFixture() {
  const base = conversationFixture({ botId: String(realBot.id), skipInitialAdmission: true });
  const token = unwrap(decode('SecretRef', {
    type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'telegram_livetest_bot_token',
  }, base.intake.context.decode)) as SecretRef;
  const declaration = { ...base.declaration, token,
    bot: { ...base.declaration.bot, username: `@${String(realBot.username)}`, identityEpoch: 'live' } };
  const plan = unwrap(base.verification.inspectCurrent()).find(row => row.record.type === 'VerificationPlan'
    && row.record.subject.governed === `telegram:v1:bot:${String(realBot.id)}`)?.record;
  if (!plan || plan.type !== 'VerificationPlan') throw new Error('Telegram identity plan absent');
  return { base, declaration, identityEvidence: { verification: base.verification,
    plan: plan.id, arm: plan.arms.find(arm => arm.required)!.id, generation: 'generation:fixture' } };
}

function setup(replies: TelegramBridgeReply[], captureFailureAt = Number.POSITIVE_INFINITY) {
  const owners = ownerFixture();
  const f = owners.base.intake.f;
  const token = unwrap(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'telegram_livetest_bot_token' }, f.ctx.decode)) as SecretRef;
  const bytes = new Map<string, string>(); let writes = 0;
  const captures: TelegramDurableCapturePort = { owner: 'part-ten', preserve(reference, raw) {
    if (!reference.includes(':poll-witness:') && !reference.includes(':cursor:')) {
      writes += 1; if (writes === captureFailureAt) return false;
    }
    bytes.set(reference, raw); return true;
  }, read: reference => bytes.get(reference) ?? null };
  const calls: Array<{ method: string; body: Readonly<Record<string, string | number>> }> = [];
  const bridge: TelegramConfinedBridgePort = { owner: 'part-ten', invoke(input) {
    calls.push({ method: input.method, body: input.body }); return replies.shift() ?? { kind: 'uncertain', limitation: 'transport' };
  } };
  const custodian = unwrap(createTelegramBotApiCustodian({ context: f.c, machine: 'machine-a',
    declaration: owners.declaration, identityEvidence: owners.identityEvidence,
    now: () => f.clock(100), freshFor: 50, captures, bridge }));
  return { f, token, bytes, calls, captures, custodian, owners };
}

describe('Part Ten confined Telegram Bot API custodian', () => {
  test('recorded real response bytes replay identity, capture-before-offset, authentication, and HTML send with zero retries', () => {
    const s = setup([{ kind: 'response', status: 200, bytes: getMe }, { kind: 'response', status: 200, bytes: poll },
      { kind: 'response', status: 200, bytes: sent }]);
    const identity = unwrap(s.custodian.identity({ token: s.token, apiVersion: '9.2' }));
    expect(identity).toMatchObject({ botId: String(realBot.id), username: '@echo_mmtest_seam_b27x_bot', authenticated: true });
    expect(s.bytes.get(identity.capture.reference)).toBe(getMe);
    rejected(s.custodian.readCapture(identity.capture.reference), 'not publicly readable');
    const batch = unwrap(s.custodian.poll({ token: s.token, apiVersion: '9.2', offset: 0, limit: 100, timeout: 1 }));
    expect(batch.updates).toEqual([update]);
    const route = { channel: `telegram:v1:bot:${String(realBot.id)}:chat:${String(realUpdate.message.chat.id)}:direct`,
      sender: `telegram:v1:user:${String(realUpdate.message.from.id)}`,
      identityEpoch: `telegram:v1:bot:${String(realBot.id)}:epoch:live`, eventId: String(realUpdate.update_id) };
    const provenance = unwrap(s.custodian.authenticate({ token: s.token, apiVersion: '9.2', raw: batch.updates[0]!, route, at: s.f.clock(501) }));
    expect(provenance).toMatchObject({ adapter: 'telegram-intake-v1', method: 'telegram-bot-api-long-poll', evidence: { kind: 'channel', authenticated: true } });
    expect(unwrap(s.custodian.sendMessage({ token: s.token, apiVersion: '9.2', chatId: String(realUpdate.message.chat.id), messageThreadId: null,
      text: '<b>Instar 2.0 confined custodian live-path proof</b>', parseMode: 'HTML', timeout: 1, hiddenRetries: 0 }))).toBe(sent);
    expect(s.calls).toEqual([
      { method: 'getMe', body: {} },
      { method: 'getUpdates', body: { offset: 0, limit: 100, timeout: 1 } },
      { method: 'sendMessage', body: { chat_id: String(realUpdate.message.chat.id), text: '<b>Instar 2.0 confined custodian live-path proof</b>', parse_mode: 'HTML' } },
    ]);
  });

  test('refuses an offset beyond the consecutively durable captured prefix before another network call', () => {
    const two = '{"ok":true,"result":[{"update_id":5,"message":{"message_id":1}},{"update_id":6,"message":{"message_id":2}}]}';
    const s = setup([{ kind: 'response', status: 200, bytes: two }], 3);
    expect(unwrap(s.custodian.poll({ token: s.token, apiVersion: '9.2', offset: 0, limit: 2, timeout: 1 })).updates).toHaveLength(1);
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
    const s = setup([reply]); rejected(s.custodian.sendMessage({ token: s.token, apiVersion: '9.2', chatId: String(realUpdate.message.chat.id),
      messageThreadId: null, text: 'one', parseMode: 'HTML', timeout: 1, hiddenRetries: 0 }), detail);
    expect(s.calls).toHaveLength(1);
    if (reply.kind === 'response') expect([...s.bytes.values()]).toContain(reply.bytes);
  });

  test('recorded real bytes pass A1 admission, durable cursor replay, one send, and the real Part Nine assessment', () => {
    const s = setup([
      { kind: 'response', status: 200, bytes: getMe },
      { kind: 'response', status: 200, bytes: poll },
      { kind: 'response', status: 200, bytes: sent },
    ]);
    const admitted = unwrap(admitTelegramAdapter(s.owners.declaration,
      { ...s.owners.base.admissionDependencies, api: s.custodian }));
    const batch = unwrap(s.custodian.poll({ token: s.token, apiVersion: '9.2', offset: 0, limit: 100, timeout: 0 }));
    const raw = batch.updates[0]!;
    const extracted = extractTelegramUpdate(raw, s.owners.declaration);
    const provenance = unwrap(s.custodian.authenticate({ token: s.token, apiVersion: '9.2', raw,
      route: extracted.route, at: s.f.clock(100) }));
    s.f.captures[provenance.record.reference] = unwrap(s.custodian.readCapture(provenance.record.reference));
    s.owners.base.intake.syncCaptures();
    const checked = unwrap(decode('Provenance', provenance, s.owners.base.intake.context.decode));
    expect(checked.authenticated.principal.id).toBe(extracted.principal.id);
    const cursorEntry = [...s.bytes.entries()].find(([reference]) => reference.includes(':cursor:'));
    expect(cursorEntry).toBeDefined();
    const cursor = JSON.parse(cursorEntry![1]);
    expect(cursor.next).toBe(realUpdate.update_id + 1);
    expect(s.bytes.get(cursor.update)).toBe(raw);
    expect(s.bytes.get(cursor.response)).toBe(poll);

    const outbound = telegramCustodianPreparedOutbound({ api: s.custodian, admitted,
      declaration: s.owners.declaration }, extracted.target,
    '<b>Instar 2.0 confined custodian live-path proof</b>');
    const fixture = telegramCustodianResponseAssessment(outbound);
    const accepted = unwrap(assessTelegramReplyResponse({ effect: fixture.effect,
      claim: 'provider-accepted', existing: null }, fixture.dependencies));
    expect(accepted.stage).toBe('provider-accepted');
    expect(unwrap(fixture.verification.runtime.inspectCurrent()).some(row =>
      row.fact.id === accepted.assessment.id && row.record.type === 'VerificationAssessment')).toBe(true);
    expect(s.calls.map(call => call.method)).toEqual(['getMe', 'getUpdates', 'sendMessage']);
    expect(accepted.unsupported).toEqual(['human-delivered', 'human-read']);
  });

  test('contract map exposes only the executable slice and names every held arm', () => {
    expect(telegramBotApiCustodianContractMap.executable).toHaveLength(5);
    expect(telegramBotApiCustodianContractMap.held.join(' ')).toMatch(
      /webhook.*media.*edit.*react.*topic.*slack.*whatsapp.*imessage.*web.*other-platform.*rate-limit/,
    );
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
  const owners = ownerFixture();
  const f = owners.base.intake.f;
  const token = unwrap(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'vault', name: 'telegram_livetest_bot_token' }, f.ctx.decode)) as SecretRef;
  const captureDirectory = process.env.INSTAR_TELEGRAM_CAPTURE_DIRECTORY
    ?? join(agentHome, '.instar', 'custody', 'telegram-bot-api-live-test');
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
    const sealed = /^capture:telegram:sealed-getMe:([a-f0-9]{64})$/.exec(reference);
    const destination = sealed === null
      ? join(captureDirectory, `${reference.replace(/[^A-Za-z0-9_.-]/g, '_')}.capture`)
      : join(captureDirectory, `${sealed[1]}.capture`);
    return existsSync(destination) ? readFileSync(destination, 'utf8') : null;
  } };
  const bridge: TelegramConfinedBridgePort = { owner: 'part-ten', invoke(input) {
    const request = Buffer.from(JSON.stringify({ method: input.method, body: input.body, timeoutMs: input.timeoutMs,
      captureDirectory, identityBinding: input.identityBinding }), 'utf8').toString('base64url');
    const run = spawnSync(process.execPath, [`${agentHome}/.instar/scripts/secret-get.mjs`, input.token.name, '--run', '--',
      process.execPath, join(process.cwd(), 'src/assembly/telegram-bot-api-bridge.mjs'), request], {
      cwd: agentHome, encoding: 'utf8', timeout: input.timeoutMs + 2_000, maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return telegramBridgeReplyFromExecution({ resolver: 'ok', status: run.status, stdout: run.stdout });
  } };
  const api: TelegramBotApiCustodianPort = unwrap(createTelegramBotApiCustodian({ context: f.c, machine: 'machine-a',
    declaration: owners.declaration, identityEvidence: owners.identityEvidence,
    now: () => f.clock(100), freshFor: 50, captures, bridge }));
  const admitted = unwrap(admitTelegramAdapter(owners.declaration, { ...owners.base.admissionDependencies, api }));
  const identity = admitted.probe;
  expect(identity.username).toBe('@echo_mmtest_seam_b27x_bot');
  const batch = unwrap(api.poll({ token, apiVersion: '9.2', offset: 0, limit: 100, timeout: 3 }));
  if (batch.updates.length === 0) throw new Error('live bot returned no update; a real inbound update is required');
  const raw = batch.updates[0]!; const parsed = JSON.parse(raw) as { update_id: number; message?: { chat?: { id?: number }; from?: { id?: number } } };
  const chatId = parsed.message?.chat?.id; const senderId = parsed.message?.from?.id;
  if (!Number.isSafeInteger(chatId) || !Number.isSafeInteger(senderId)) throw new Error('live update is not an authenticatable ordinary message');
  const extracted = extractTelegramUpdate(raw, owners.declaration);
  expect(extracted.route.sender).toBe(`telegram:v1:user:${String(senderId)}`);
  const provenance = unwrap(api.authenticate({ token, apiVersion: '9.2', raw,
    route: extracted.route, at: f.clock(100) }));
  f.captures[provenance.record.reference] = unwrap(api.readCapture(provenance.record.reference));
  owners.base.intake.syncCaptures();
  expect(unwrap(decode('Provenance', provenance, owners.base.intake.context.decode))
    .authenticated.principal.id).toBe(extracted.principal.id);
  const scope = unwrap(canonical({ token: owners.declaration.token, apiVersion: owners.declaration.apiVersion,
    bot: owners.declaration.bot })).hash;
  const cursorBytes = captures.read(`capture:telegram:cursor:${scope}:0`);
  expect(cursorBytes).not.toBeNull();
  const cursor = JSON.parse(cursorBytes!);
  const nextOffset = cursor.next;
  expect(nextOffset).toBe(parsed.update_id + 1);
  expect(captures.read(cursor.update)).toBe(raw);

  const outbound = telegramCustodianPreparedOutbound({ api, admitted, declaration: owners.declaration },
    extracted.target, '<b>Instar 2.0 confined custodian live-path proof</b>');
  const fixture = telegramCustodianResponseAssessment(outbound);
  const acceptance = unwrap(assessTelegramReplyResponse({ effect: fixture.effect,
    claim: 'provider-accepted', existing: null }, fixture.dependencies));
  expect(acceptance.stage).toBe('provider-accepted');
  expect(unwrap(fixture.verification.runtime.inspectCurrent()).some(row =>
    row.fact.id === acceptance.assessment.id && row.record.type === 'VerificationAssessment')).toBe(true);
  const capturedResponse = outbound.effects.ctx.captures[fixture.observation.capture.reference];
  expect(capturedResponse?.status).toBe('available');
  const messageId = JSON.parse(capturedResponse!.bytes!).result.message_id;
  expect(Number.isSafeInteger(messageId)).toBe(true);
  process.stderr.write(`LIVE_EVIDENCE update_id=${String(parsed.update_id)} message_id=${String(messageId)} token=confined\n`);
});
