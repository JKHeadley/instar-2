// @ts-nocheck -- recorded test host joins production owner ports to explicit fixture authorities.
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { FIXED_LIMITED_RESPONSE, PREVIEW_LABEL, PREVIEW_STAND_IN_LEDGER, createPreviewComposition } from './composition.js';
import { openPreviewState, previewTurnId } from './state.js';

const roots: string[] = [];
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });
function root(prefix = 'preview-stage1-') { const path = realpathSync(mkdtempSync(join(tmpdir(), prefix))); roots.push(path); return path; }

function privateUpdate(updateId: number, sender: number, text: string, chat = 7001) {
  return { update_id: updateId, message: { message_id: updateId + 1000,
    from: { id: sender, is_bot: false, first_name: `sender-${sender}` },
    chat: { id: chat, type: 'private', first_name: 'preview' }, date: 1_700_000_000, text } };
}
function livePrivateStart(updateId: number, sender: number) {
  return { update_id: updateId, message: { message_id: 5300 + updateId,
    from: { id: sender, is_bot: false, first_name: 'Preview', last_name: 'Operator',
      username: 'preview_operator', language_code: 'en', is_premium: true },
    chat: { id: sender, type: 'private', first_name: 'Preview', last_name: 'Operator',
      username: 'preview_operator' },
    date: Math.floor(Date.now() / 1000), text: '/start',
    entities: [{ offset: 0, length: 6, type: 'bot_command' }] } };
}
function topicUpdate(updateId: number, sender: number, text: string, chat = -1000000007001, topic = 42) {
  return { update_id: updateId, message: { message_id: updateId + 1000, message_thread_id: topic, is_topic_message: true,
    from: { id: sender, is_bot: false, first_name: `sender-${sender}` },
    chat: { id: chat, type: 'supergroup', title: 'preview', is_forum: true }, date: 1_700_000_000, text } };
}

function recordedTelegram(updates: readonly object[], options: { mode?: 'positive' | 'uncertain' | 'rejected'; botId?: number } = {}) {
  const calls: { method: string; body: any }[] = []; let sent = 0;
  return { calls, io: { invoke(request) {
    calls.push({ method: request.method, body: request.body });
    if (request.method === 'getMe') return { kind: 'response', status: 200,
      bytes: JSON.stringify({ ok: true, result: { id: options.botId ?? 9001, is_bot: true,
        username: 'fixture_bot', first_name: 'Preview' } }) };
    if (request.method === 'getUpdates') {
      const offset = Number(request.body.offset), limit = Number(request.body.limit);
      const result = updates.filter(row => Number(row.update_id) >= offset).slice(0, limit);
      return { kind: 'response', status: 200, bytes: JSON.stringify({ ok: true, result }) };
    }
    sent += 1;
    if (options.mode === 'uncertain') return { kind: 'uncertain', limitation: 'transport' };
    if (options.mode === 'rejected') return { kind: 'response', status: 403,
      bytes: JSON.stringify({ ok: false, error_code: 403, description: 'recorded refusal' }) };
    const chatId = Number(request.body.chat_id);
    return { kind: 'response', status: 200, bytes: JSON.stringify({ ok: true, result: {
      message_id: 8000 + sent, chat: { id: chatId, type: chatId < 0 ? 'supergroup' : 'private' },
      ...(request.body.message_thread_id === undefined ? {} : { message_thread_id: request.body.message_thread_id }),
      text: request.body.text } }) };
  } } };
}

function setup(path: string, transport, hooks = {}, overrides: any = {}) {
  const expiresAt = overrides.expiresAt ?? 2_000_000_000_000;
  const stateNow = overrides.stateNow ?? (() => 1_800_000_000_000);
  const authorityNow = overrides.authorityNow ?? (() => 100);
  const configuration = { root: path, machine: 'preview-test-machine', botId: '9001', botUsername: '@fixture_bot',
    operatorSenderId: '7', chatId: '7001', chatKind: 'private', forum: false, messageThreadId: null,
    maxPollSeconds: 1, maxBatchItems: 8, maxContextTurns: 8, maxContextBytes: 65_536,
    ...overrides.configuration };
  const limits = { replyLimit: 20, replyWindowMs: 60_000, errorLimit: 3, totalErrorLimit: 100,
    maxPendingTurns: 32, maxTrialTurns: 128, ...overrides.limits };
  const { totalErrorLimit, ...configurationLimits } = limits;
  const stateConfiguration = { ...configuration, expiresAt, ...configurationLimits };
  const state = openPreviewState({ root: path, configuration: stateConfiguration, expiresAt,
    now: stateNow, ...limits, totalErrorLimit });
  const composition = (nextHooks = hooks) => createPreviewComposition({ configuration, state,
    storageKey: new Uint8Array(32).fill(19), storageIO: productionStorageIO, telegramIO: transport.io,
    now: authorityNow,
    resolveSecret: reference => {
      if (reference.vault === 'preview' && reference.name === 'telegram-bot-token') return '9001:synthetic_recorded_test_only_value';
      throw new Error('recorded resolver refused');
    }, hooks: nextHooks });
  return { configuration, limits, state, composition };
}

const sends = telegram => telegram.calls.filter(call => call.method === 'sendMessage');
const polls = telegram => telegram.calls.filter(call => call.method === 'getUpdates');
const resumeYielding = async composition => {
  while (composition.resumeOne()) await new Promise(resolve => setImmediate(resolve));
};

function recordedLauncherArguments(stateRoot: string, overrides: Record<string, string | number> = {}) {
  const options = { root: stateRoot, 'bot-id': '9001', 'bot-username': '@fixture_bot',
    'operator-sender-id': '7', 'chat-id': '7001', 'chat-kind': 'private', forum: 'false',
    'message-thread-id': 'none', 'expires-at': String(Date.now() + 60_000), 'max-cycles': 4,
    'max-poll-seconds': 1, 'max-batch-items': 1, 'max-context-turns': 2, 'max-context-bytes': 4096,
    'max-pending-turns': 2, 'max-trial-turns': 4, 'reply-limit': 2, 'reply-window-ms': 60_000,
    'error-limit': 3, 'total-error-limit': 20, 'backoff-ms': 1, 'max-backoff-ms': 2,
    ...overrides };
  return ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/agent.mjs', 'run',
    ...Object.entries(options).flatMap(([name, value]) => [`--${name}`, String(value)])];
}

function runRecordedLauncher(stateRoot: string, preloadSource: string,
  overrides: Record<string, string | number> = {}) {
  const preloadRoot = root('preview-error-preload-'), preload = join(preloadRoot, 'preload.mjs');
  writeFileSync(preload, preloadSource);
  return spawnSync(process.execPath, recordedLauncherArguments(stateRoot, overrides), {
    cwd: process.cwd(), env: { ...process.env, NODE_OPTIONS: `--import=${preload}`,
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '9001:synthetic_recorded_test_only_value',
      INSTAR_SECRET_PREVIEW_STORAGE_KEY: '13'.repeat(32) }, encoding: 'utf8', timeout: 30_000,
  });
}

describe('Stage 1 preview driver (recorded transport only)', () => {
  it('binds a live-shaped private /start at wall time to the configured principal and replies once', () => {
    const path = root(); const wallNow = Date.now(); const expiresAt = wallNow + 60_000;
    const sender = 7812716706; const botId = 8820318295;
    const telegram = recordedTelegram([livePrivateStart(746001, sender)], { botId });
    const built = setup(path, telegram, {}, { expiresAt, stateNow: () => wallNow,
      configuration: { botId: String(botId), operatorSenderId: String(sender),
        chatId: String(sender), maxBatchItems: 1 } });
    const composition = built.composition(); let facts: any[] = [];
    try { composition.pollOnce(); composition.resume(); facts = composition.storage.segment.read(); }
    finally { composition.close(); }
    const turn = built.state.read().turns[previewTurnId(String(botId), 746001)];
    expect(turn).toMatchObject({ disposition: 'admitted-bound', phase: 'api-accepted' });
    expect(sends(telegram)).toHaveLength(1);
    expect(sends(telegram)[0].body.text).toBe(FIXED_LIMITED_RESPONSE);
    const binding = facts.find(fact => fact.kind === 'conversation-binding'
      && fact.body.sender === `telegram:v1:user:${sender}`);
    expect(binding.body).toMatchObject({ principalId: `telegram:v1:user:${sender}`,
      channel: `telegram:v1:bot:${botId}:chat:${sender}:direct` });
    const grant = facts.find(fact => fact.kind === 'genesis-grant'
      && fact.body.grant.id === binding.body.grantId);
    expect(grant.body.grant).toMatchObject({ grantee: { id: `telegram:v1:user:${sender}` },
      issuedAt: { value: 100 }, expiresAt });
  }, 60_000);

  it('does not bind outside the trial window or retroactively re-admit a stored unbound turn', () => {
    const path = root(); const wallNow = Date.now(); const expiresAt = wallNow + 30_000;
    const sender = 7812716706; const botId = 8820318295;
    const telegram = recordedTelegram([livePrivateStart(746010, sender)], { botId });
    const common = { expiresAt, stateNow: () => wallNow,
      configuration: { botId: String(botId), operatorSenderId: String(sender), chatId: String(sender), maxBatchItems: 1 } };
    const outside = setup(path, telegram, {}, { ...common, authorityNow: () => expiresAt + 1 });
    let composition = outside.composition();
    try { composition.pollOnce(); composition.resume(); } finally { composition.close(); }
    let document = outside.state.read();
    expect(document.turns[previewTurnId(String(botId), 746010)]).toMatchObject({
      disposition: 'admitted-unbound', phase: 'ignored-out-of-scope' });
    expect(sends(telegram)).toHaveLength(0);

    const reopened = setup(path, telegram, {}, { ...common, authorityNow: () => wallNow + 1 });
    composition = reopened.composition();
    try { composition.resume(); expect(sends(telegram)).toHaveLength(0); composition.pollOnce(); composition.resume(); }
    finally { composition.close(); }
    document = reopened.state.read();
    expect(document.turns[previewTurnId(String(botId), 746010)]).toMatchObject({
      disposition: 'admitted-unbound', phase: 'ignored-out-of-scope' });
    expect(Object.keys(document.turns)).toEqual([previewTurnId(String(botId), 746010)]);
    expect(sends(telegram)).toHaveLength(0);
  }, 90_000);

  it('supports the narrow private-chat target, durable owner reconstruction, two turns, and an excluded outsider', () => {
    expect(process.env.INSTAR_TELEGRAM_LIVE_TEST).toBeUndefined();
    const path = root();
    const first = privateUpdate(100, 7, 'first');
    const telegram = recordedTelegram([first, privateUpdate(101, 8, 'outsider'), privateUpdate(102, 7, 'second')]);
    const built = setup(path, telegram); const composition = built.composition(); let durableKinds: string[] = [];
    try { const cycle = composition.pollOnce(); expect(cycle.nextOffset).toBe(103);
      expect(composition.intake.receive(JSON.stringify(first), cycle.captured[0].route).kind).toBe('Success');
      composition.reconcileDurableIntake(); composition.resume();
      durableKinds = composition.storage.segment.read().map(row => row.kind); }
    finally { composition.close(); }
    const document = built.state.read();
    expect(document.turns[previewTurnId('9001', 100)].phase).toBe('api-accepted');
    expect(document.turns[previewTurnId('9001', 101)]).toMatchObject({ phase: 'held-or-refused', disposition: 'held' });
    expect(document.turns[previewTurnId('9001', 102)]).toMatchObject({ phase: 'api-accepted', contextReferences: expect.any(Array) });
    expect(document.turns[previewTurnId('9001', 102)].contextReferences).toHaveLength(2);
    expect(sends(telegram)).toHaveLength(2);
    expect(durableKinds).toContain('intake-collapse');
    expect(sends(telegram).every(call => call.body.text === FIXED_LIMITED_RESPONSE && call.body.text.startsWith(PREVIEW_LABEL))).toBe(true);
    for (const id of [100, 102]) {
      const proof = JSON.parse(readFileSync(document.turns[previewTurnId('9001', id)].runEvidence, 'utf8'));
      expect(proof.facts.some(row => row.kind === 'run-opening')).toBe(true);
      expect(proof.facts.some(row => row.kind === 'session-grounding')).toBe(true);
      expect(proof.admissions.length).toBeGreaterThan(0);
      expect(proof.captureReferences.length).toBeGreaterThan(0);
      expect(proof.allowedIntakeIds).toHaveLength(id === 100 ? 1 : 2);
      expect(proof.stockGroundingValidation).toBe('passed');
    }
    const reopened = setup(path, telegram).composition();
    try { expect(() => reopened.resume()).not.toThrow(); } finally { reopened.close(); }
    expect(sends(telegram)).toHaveLength(2);
  }, 60_000);

  it('advances the custodian-backed cursor across offset-respecting batches and reopen', () => {
    const path = root(); const telegram = recordedTelegram([privateUpdate(100, 7, 'one'), privateUpdate(101, 7, 'two')]);
    const built = setup(path, telegram, {}, { configuration: { maxBatchItems: 1 } });
    let composition = built.composition();
    expect(composition.pollOnce()).toMatchObject({ requestedOffset: 0, nextOffset: 101 });
    const receipt = composition.storage.segment.read().find(row => row.kind === 'intake-receipt');
    expect(receipt.body.capture.reference).toMatch(/^capture:telegram:update-100:[a-f0-9]{64}$/u);
    expect(composition.api.readCapture(receipt.body.capture.reference).kind).toBe('Success');
    composition.resume(); composition.close();
    composition = setup(path, telegram, {}, { configuration: { maxBatchItems: 1 } }).composition();
    try { expect(composition.pollOnce()).toMatchObject({ requestedOffset: 101, nextOffset: 102 }); composition.resume(); }
    finally { composition.close(); }
    expect(polls(telegram).map(call => call.body.offset)).toEqual([0, 101]);
    expect(built.state.read().cursor.nextOffset).toBe(102);
    expect(sends(telegram)).toHaveLength(2);
  }, 60_000);

  for (const cutAfter of [0, 1, 2]) it(`reconciles a durable three-item batch after an index cut at boundary ${cutAfter}`, async () => {
    const path = root();
    const telegram = recordedTelegram([privateUpdate(100, 7, 'one'), privateUpdate(101, 7, 'two'), privateUpdate(102, 7, 'three')]);
    let indexes = 0, cut = true;
    const hooks = cutAfter === 0 ? { beforeIntakeIndex: () => { if (cut) { cut = false; throw new Error('index cut'); } } }
      : { afterIntake: () => { indexes += 1; if (cut && indexes === cutAfter) { cut = false; throw new Error('index cut'); } } };
    const built = setup(path, telegram, hooks); const first = built.composition();
    expect(() => first.pollOnce()).toThrow('index cut'); first.close();
    expect(built.state.read().cursor.nextOffset).toBe(103);
    const restarted = setup(path, telegram).composition();
    try { await resumeYielding(restarted); } finally { restarted.close(); }
    expect(Object.values(built.state.read().turns).map(turn => turn.phase)).toEqual(['api-accepted', 'api-accepted', 'api-accepted']);
    expect(sends(telegram)).toHaveLength(3);
    expect(polls(telegram)).toHaveLength(1);
  }, 90_000);

  for (const mode of ['uncertain', 'rejected'] as const) it(`keeps ${mode} dispatch unknown, never resends, and counts the breaker`, () => {
    const path = root(); const telegram = recordedTelegram([privateUpdate(100, 7, mode)], { mode });
    const built = setup(path, telegram); const first = built.composition();
    try { first.pollOnce(); first.resume(); } finally { first.close(); }
    expect(built.state.read().turns[previewTurnId('9001', 100)].phase).toBe('dispatch-outcome-unknown');
    expect(built.state.read().consecutiveErrors).toBe(1);
    expect(built.state.read().totalErrors).toBe(1);
    const restarted = setup(path, telegram).composition();
    try { restarted.resume(); } finally { restarted.close(); }
    expect(sends(telegram)).toHaveLength(1);
    expect(built.state.read().turns[previewTurnId('9001', 100)].phase).toBe('dispatch-outcome-unknown');
  }, 60_000);

  it('persists separate consecutive and total error ceilings across restart', () => {
    const options = (path, errorLimit = 3, totalErrorLimit = 10) => ({ root: path,
      configuration: { marker: 'error-counters', errorLimit }, expiresAt: 2_000_000_000_000,
      now: () => 1_800_000_000_000, replyLimit: 2, replyWindowMs: 60_000,
      errorLimit, totalErrorLimit, maxPendingTurns: 2, maxTrialTurns: 4 });

    const interleavedPath = root(); let interleaved = openPreviewState(options(interleavedPath, 2, 10));
    interleaved.noteError(); interleaved.noteSuccess(); interleaved.noteError(); interleaved.noteSuccess();
    expect(interleaved.read()).toMatchObject({ consecutiveErrors: 0, totalErrors: 2, stop: null });
    interleaved = openPreviewState(options(interleavedPath, 2, 10));
    expect(interleaved.read()).toMatchObject({ consecutiveErrors: 0, totalErrors: 2, stop: null });
    interleaved.noteError();
    expect(openPreviewState(options(interleavedPath, 2, 10)).read())
      .toMatchObject({ consecutiveErrors: 1, totalErrors: 3, stop: null });

    const consecutivePath = root(); const consecutive = openPreviewState(options(consecutivePath, 3, 10));
    consecutive.noteError(); consecutive.noteError();
    expect(consecutive.read().stop).toBeNull(); consecutive.noteError();
    expect(consecutive.read()).toMatchObject({ consecutiveErrors: 3, totalErrors: 3,
      stop: { reason: 'breaker' } });

    const totalPath = root(); const total = openPreviewState(options(totalPath, 3, 4));
    for (let index = 0; index < 3; index += 1) { total.noteError(); total.noteSuccess(); }
    expect(total.read()).toMatchObject({ consecutiveErrors: 0, totalErrors: 3, stop: null });
    total.noteError();
    expect(openPreviewState(options(totalPath, 3, 4)).read()).toMatchObject({
      consecutiveErrors: 1, totalErrors: 4, stop: { reason: 'breaker' },
    });

    const legacyPath = root(); const legacyOptions = options(legacyPath, 3, 10);
    const legacySeed = openPreviewState(legacyOptions).read();
    const { errorLimit: _errorLimit, totalErrorLimit: _totalErrorLimit, ...legacyTrial } = legacySeed.trial;
    const { totalErrors: _totalErrors, ...legacyBody } = legacySeed;
    writeFileSync(join(legacyPath, 'preview-state.json'), JSON.stringify({ ...legacyBody,
      version: 2, trial: legacyTrial, consecutiveErrors: 2 }));
    expect(openPreviewState(legacyOptions).read()).toMatchObject({
      version: 3, consecutiveErrors: 0, totalErrors: 2, stop: null,
    });
  });

  it('resets consecutive failures after successful empty polls and emits only closed hostile-safe diagnostics', () => {
    const stateRoot = root('preview-errors-state-');
    const token = '9001:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';
    const storageKey = 'ab'.repeat(32);
    const encoded = 'OTAwMTpBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaQ==';
    const control = '\u001b[31mSECRET\nINJECTED\rLINE';
    const preload = `import childProcess from 'node:child_process';\nimport {syncBuiltinESMExports} from 'node:module';\nlet polls=0;const values=${JSON.stringify({ token, storageKey, encoded, control })};\nconst hostile=()=>({name:values.token+values.control,message:values.storageKey+values.control,stack:values.encoded+values.control,cause:{secret:values.token},stderr:values.storageKey,url:'https://'+values.token+'@invalid.example/',path:'/tmp/'+values.encoded,payload:values.control+values.token});\nchildProcess.spawnSync=(exe,args)=>{const q=JSON.parse(Buffer.from(args[1],'base64url').toString('utf8'));if(q.method==='getMe')return {status:0,stdout:JSON.stringify({kind:'response',status:200,bytes:JSON.stringify({ok:true,result:{id:9001,is_bot:true,username:'fixture_bot',first_name:'Preview'}})})};if(q.method==='getUpdates'){polls++;if(polls===1||polls===3)throw hostile();return {status:0,stdout:JSON.stringify({kind:'response',status:200,bytes:JSON.stringify({ok:true,result:[]})})};}throw hostile();};syncBuiltinESMExports();\n`;
    const result = runRecordedLauncher(stateRoot, preload, { 'error-limit': 2, 'total-error-limit': 3,
      'max-cycles': 4 });
    expect(result.status, result.stderr).toBe(0);
    const state = JSON.parse(readFileSync(join(stateRoot, 'preview-state.json'), 'utf8'));
    expect(state).toMatchObject({ consecutiveErrors: 0, totalErrors: 2, stop: null });
    for (const forbidden of [token, storageKey, encoded, 'SECRET', 'INJECTED', '\u001b']) {
      expect(result.stderr).not.toContain(forbidden);
    }
    const diagnostics = result.stderr.trim().split('\n').filter(line => line.length > 0).map(line => JSON.parse(line));
    expect(diagnostics).toEqual([
      { type: 'PREVIEW_CYCLE_DIAGNOSTIC', schemaVersion: 1, reason: 'UNKNOWN', phase: 'POLL',
        consecutiveErrors: 1, totalErrors: 1, backoffMs: 1 },
      { type: 'PREVIEW_CYCLE_DIAGNOSTIC', schemaVersion: 1, reason: 'UNKNOWN', phase: 'POLL',
        consecutiveErrors: 1, totalErrors: 2, backoffMs: 1 },
    ]);
  }, 60_000);

  it('latches after the configured number of truly consecutive launcher cycle failures', () => {
    const stateRoot = root('preview-consecutive-state-');
    const preload = `import childProcess from 'node:child_process';\nimport {syncBuiltinESMExports} from 'node:module';\nchildProcess.spawnSync=(exe,args)=>{const q=JSON.parse(Buffer.from(args[1],'base64url').toString('utf8'));if(q.method==='getMe')return {status:0,stdout:JSON.stringify({kind:'response',status:200,bytes:JSON.stringify({ok:true,result:{id:9001,is_bot:true,username:'fixture_bot',first_name:'Preview'}})})};throw {name:'hostile',message:'9001:NEVER_LOG_THIS',stack:'${'ef'.repeat(32)}'};};syncBuiltinESMExports();\n`;
    const result = runRecordedLauncher(stateRoot, preload, { 'error-limit': 3,
      'total-error-limit': 20, 'max-cycles': 5 });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(stateRoot, 'preview-state.json'), 'utf8'))).toMatchObject({
      consecutiveErrors: 3, totalErrors: 3,
    });
    expect(JSON.parse(readFileSync(join(stateRoot, 'preview-stop.json'), 'utf8')).reason).toBe('breaker');
    expect(result.stderr).not.toContain('NEVER_LOG_THIS');
    expect(result.stderr.trim().split('\n')).toHaveLength(3);
  }, 60_000);

  for (const [typedOutcome, reason] of [
    [{ kind: 'uncertain', limitation: 'timeout', stage: 'fetch-timeout' }, 'TIMEOUT'],
    [{ kind: 'uncertain', limitation: 'transport', stage: 'child-exit' }, 'TRANSPORT'],
    [{ kind: 'response', status: 503, bytes: 'not emitted' }, 'REFUSED'],
  ] as const) it(`uses the trusted typed poll outcome for diagnostic code ${reason}`, () => {
    const stateRoot = root(`preview-${reason.toLowerCase()}-state-`);
    const preload = `import childProcess from 'node:child_process';\nimport {syncBuiltinESMExports} from 'node:module';\nchildProcess.spawnSync=(exe,args)=>{const q=JSON.parse(Buffer.from(args[1],'base64url').toString('utf8'));if(q.method==='getMe')return {status:0,stdout:JSON.stringify({kind:'response',status:200,bytes:JSON.stringify({ok:true,result:{id:9001,is_bot:true,username:'fixture_bot',first_name:'Preview'}})})};return {status:0,stdout:JSON.stringify(${JSON.stringify(typedOutcome)})};};syncBuiltinESMExports();\n`;
    const result = runRecordedLauncher(stateRoot, preload, { 'max-cycles': 1 });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stderr.trim())).toMatchObject({
      type: 'PREVIEW_CYCLE_DIAGNOSTIC', reason, phase: 'POLL',
      consecutiveErrors: 1, totalErrors: 1,
    });
    expect(result.stderr).not.toContain('not emitted');
  }, 60_000);

  it('records error accounting before a diagnostic write failure', () => {
    const stateRoot = root('preview-diagnostic-failure-state-');
    const preload = `import childProcess from 'node:child_process';\nimport {syncBuiltinESMExports} from 'node:module';\nchildProcess.spawnSync=(exe,args)=>{const q=JSON.parse(Buffer.from(args[1],'base64url').toString('utf8'));if(q.method==='getMe')return {status:0,stdout:JSON.stringify({kind:'response',status:200,bytes:JSON.stringify({ok:true,result:{id:9001,is_bot:true,username:'fixture_bot',first_name:'Preview'}})})};throw {name:'9001:HOSTILE',message:'${'cd'.repeat(32)}',stack:'\\u001b[2J'};};process.stderr.write=()=>{throw new Error('diagnostic sink unavailable');};syncBuiltinESMExports();\n`;
    const result = runRecordedLauncher(stateRoot, preload, { 'max-cycles': 1 });
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(join(stateRoot, 'preview-state.json'), 'utf8')))
      .toMatchObject({ consecutiveErrors: 1, totalErrors: 1, stop: null });
  }, 60_000);

  for (const interruption of ['signal', 'expiry'] as const) it(`honours ${interruption} during a long error backoff`, () => {
    const stateRoot = root(`preview-backoff-${interruption}-state-`);
    const trigger = interruption === 'signal'
      ? "setTimeout(()=>process.kill(process.pid,'SIGTERM'),25);"
      : 'setTimeout(()=>{clock=2000;},25);';
    const clock = interruption === 'expiry' ? 'let clock=1000;Date.now=()=>clock;' : '';
    const preload = `import childProcess from 'node:child_process';\nimport {syncBuiltinESMExports} from 'node:module';\n${clock}\nlet polls=0;childProcess.spawnSync=(exe,args)=>{const q=JSON.parse(Buffer.from(args[1],'base64url').toString('utf8'));if(q.method==='getMe')return {status:0,stdout:JSON.stringify({kind:'response',status:200,bytes:JSON.stringify({ok:true,result:{id:9001,is_bot:true,username:'fixture_bot',first_name:'Preview'}})})};if(q.method==='getUpdates'){polls++;${trigger}throw {message:'HOSTILE\\nSECRET',stack:'\\u001b[31m'};}throw new Error('unexpected method');};syncBuiltinESMExports();\n`;
    const started = Date.now();
    const result = runRecordedLauncher(stateRoot, preload, { 'expires-at': interruption === 'expiry' ? 2000 : Date.now() + 60_000,
      'max-cycles': 2, 'backoff-ms': 10_000, 'max-backoff-ms': 10_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(Date.now() - started).toBeLessThan(5_000);
    const state = JSON.parse(readFileSync(join(stateRoot, 'preview-state.json'), 'utf8'));
    expect(state).toMatchObject({ consecutiveErrors: 1, totalErrors: 1,
      stop: { reason: interruption } });
  }, 60_000);

  it('reconstructs the durable Five/Six run after a grounded cut before the first send', () => {
    const path = root(); const telegram = recordedTelegram([privateUpdate(100, 7, 'grounded cut')]); let cut = true;
    const built = setup(path, telegram, { beforeDispatch: () => { if (cut) { cut = false; throw new Error('grounded cut'); } } });
    const first = built.composition(); first.pollOnce(); expect(() => first.resume()).toThrow('grounded cut'); first.close();
    const grounded = built.state.read().turns[previewTurnId('9001', 100)];
    expect(grounded.phase).toBe('grounded');
    expect(JSON.parse(readFileSync(grounded.runEvidence, 'utf8')).facts.some(row => row.kind === 'session-grounding')).toBe(true);
    const restarted = setup(path, telegram).composition(); try { restarted.resume(); } finally { restarted.close(); }
    expect(sends(telegram)).toHaveLength(1);
    expect(built.state.read().turns[previewTurnId('9001', 100)].phase).toBe('api-accepted');
  }, 60_000);

  it('leaves a cut after positive dispatch unknown and never repeats it', () => {
    const path = root(); const telegram = recordedTelegram([privateUpdate(100, 7, 'cut')]); let cut = true;
    const built = setup(path, telegram, { afterDispatch: () => { if (cut) { cut = false; throw new Error('dispatch cut'); } } });
    const first = built.composition(); first.pollOnce(); expect(() => first.resume()).toThrow('dispatch cut'); first.close();
    const restarted = setup(path, telegram).composition(); try { restarted.resume(); } finally { restarted.close(); }
    expect(sends(telegram)).toHaveLength(1);
    expect(built.state.read().turns[previewTurnId('9001', 100)].phase).toBe('dispatch-outcome-unknown');
  }, 60_000);

  it('honours stop, expiry, bounded context, and a durable trial-capacity latch', () => {
    const stoppedPath = root(); const stoppedTelegram = recordedTelegram([privateUpdate(100, 7, 'no poll')]);
    const stopped = setup(stoppedPath, stoppedTelegram); stopped.state.latchStop('operator');
    expect(() => stopped.composition()).toThrow('preview stopped before admit'); expect(stoppedTelegram.calls).toHaveLength(0);

    const contextPath = root(); const contextTelegram = recordedTelegram([privateUpdate(100, 7, 'one'), privateUpdate(101, 7, 'two')]);
    const bounded = setup(contextPath, contextTelegram, {}, { configuration: { maxContextTurns: 1 } });
    const boundedComposition = bounded.composition(); boundedComposition.pollOnce();
    expect(() => boundedComposition.resume()).toThrow('context turn bound'); boundedComposition.close();
    expect(sends(contextTelegram)).toHaveLength(1);
    expect(bounded.state.read().turns[previewTurnId('9001', 101)].phase).toBe('intake-preserved');

    const capacityPath = root(); const capacityTelegram = recordedTelegram([privateUpdate(100, 8, 'outside')]);
    const capacity = setup(capacityPath, capacityTelegram, {}, { configuration: { maxBatchItems: 1 },
      limits: { maxPendingTurns: 1, maxTrialTurns: 1 } });
    let capacityComposition = capacity.composition(); capacityComposition.pollOnce(); capacityComposition.close();
    capacityComposition = setup(capacityPath, capacityTelegram, {}, { configuration: { maxBatchItems: 1 },
      limits: { maxPendingTurns: 1, maxTrialTurns: 1 } }).composition();
    expect(() => capacityComposition.pollOnce()).toThrow('durable trial capacity'); capacityComposition.close();
    expect(capacity.state.read().stop?.reason).toBe('capacity');

    const expiredPath = root(); const limits = { replyLimit: 1, replyWindowMs: 10, errorLimit: 1,
      totalErrorLimit: 1, maxPendingTurns: 1, maxTrialTurns: 1 };
    openPreviewState({ root: expiredPath, configuration: { marker: 'expiry' }, expiresAt: 20, now: () => 10, ...limits });
    const expired = openPreviewState({ root: expiredPath, configuration: { marker: 'expiry' }, expiresAt: 20, now: () => 20, ...limits });
    expect(() => expired.gate('poll')).toThrow('preview stopped before poll'); expect(expired.read().stop?.reason).toBe('expiry');
  }, 90_000);

  it('supports a bound group topic and excludes wrong sender/chat/topic neighbours; wrong bot identity refuses', () => {
    const path = root();
    const telegram = recordedTelegram([topicUpdate(100, 7, 'bound'), topicUpdate(101, 8, 'wrong sender'),
      topicUpdate(102, 7, 'wrong chat', -1000000007002, 42), topicUpdate(103, 7, 'wrong topic', -1000000007001, 43)]);
    const configuration = { chatId: '-1000000007001', chatKind: 'group-topic', forum: true, messageThreadId: 42 };
    const built = setup(path, telegram, {}, { configuration }); const composition = built.composition();
    try { composition.pollOnce(); composition.resume(); } finally { composition.close(); }
    expect(sends(telegram)).toHaveLength(1); expect(sends(telegram)[0].body).toMatchObject({ chat_id: '-1000000007001', message_thread_id: 42 });
    expect(Object.values(built.state.read().turns).filter(turn => turn.phase === 'held-or-refused')).toHaveLength(3);
    expect(Object.values(built.state.read().turns).slice(1).every(turn => turn.disposition === 'held')).toBe(true);

    const wrongBotPath = root(); const wrongBotTelegram = recordedTelegram([], { botId: 9002 });
    expect(() => setup(wrongBotPath, wrongBotTelegram, {}, { configuration }).composition()).toThrow();
    expect(sends(wrongBotTelegram)).toHaveLength(0);
  }, 60_000);

  for (const signal of ['SIGTERM', 'SIGINT'] as const) it(`the actual launcher latches ${signal} during a successful poll before dispatch`, () => {
    const stateRoot = root('preview-signal-state-'), preloadRoot = root('preview-signal-preload-');
    const preload = join(preloadRoot, 'preload.mjs'), report = join(preloadRoot, 'report.json');
    writeFileSync(preload, `import childProcess from 'node:child_process';\nimport {syncBuiltinESMExports} from 'node:module';\nimport {writeFileSync,existsSync} from 'node:fs';\nconst calls=[];let polls=0;const stateRoot=${JSON.stringify(stateRoot)},report=${JSON.stringify(report)};\nchildProcess.spawnSync=(exe,args)=>{const q=JSON.parse(Buffer.from(args[1],'base64url').toString('utf8'));calls.push(q.method);let result;if(q.method==='getMe')result={id:9001,is_bot:true,username:'fixture_bot',first_name:'Preview'};else if(q.method==='getUpdates'){polls++;if(polls===1)process.kill(process.pid,${JSON.stringify(signal)});result=polls===1?[{update_id:100,message:{message_id:1100,from:{id:7,is_bot:false,first_name:'synthetic'},chat:{id:7001,type:'private'},date:1700000000,text:'signal'}}]:[];}else result={message_id:8001,chat:{id:7001,type:'private'},text:q.body.text};return {status:0,stdout:JSON.stringify({kind:'response',status:200,bytes:JSON.stringify({ok:true,result})})};};syncBuiltinESMExports();process.on('exit',()=>writeFileSync(report,JSON.stringify({calls,stop:existsSync(stateRoot+'/preview-stop.json')})));\n`);
    const expires = String(Date.now() + 60_000);
    const result = spawnSync(process.execPath, ['--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/agent.mjs', 'run',
      '--root', stateRoot, '--bot-id', '9001', '--bot-username', '@fixture_bot', '--operator-sender-id', '7',
      '--chat-id', '7001', '--chat-kind', 'private', '--forum', 'false', '--message-thread-id', 'none',
      '--expires-at', expires, '--max-cycles', '3', '--max-poll-seconds', '1', '--max-batch-items', '1',
      '--max-context-turns', '2', '--max-context-bytes', '4096', '--max-pending-turns', '2', '--max-trial-turns', '4',
      '--reply-limit', '2', '--reply-window-ms', '60000', '--error-limit', '2', '--backoff-ms', '1', '--max-backoff-ms', '2'],
    { cwd: process.cwd(), env: { ...process.env, NODE_OPTIONS: `--import=${preload}`,
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '9001:synthetic_recorded_test_only_value',
      INSTAR_SECRET_PREVIEW_STORAGE_KEY: '13'.repeat(32) }, encoding: 'utf8', timeout: 30_000 });
    expect(result.status, result.stderr).toBe(0);
    const observed = JSON.parse(readFileSync(report, 'utf8'));
    expect(observed).toEqual({ calls: ['getMe', 'getUpdates'], stop: true });
    const state = JSON.parse(readFileSync(join(stateRoot, 'preview-state.json'), 'utf8'));
    expect(Object.values(state.turns)).toHaveLength(1);
    expect(Object.values(state.turns)[0].phase).toBe('intake-preserved');
  }, 60_000);

  for (const signal of ['SIGTERM', 'SIGINT'] as const) it(`the actual launcher services ${signal} after durable grounding and before a separate dispatch`, () => {
    const stateRoot = root('preview-ground-signal-state-'), preloadRoot = root('preview-ground-signal-preload-');
    const preload = join(preloadRoot, 'preload.mjs'), report = join(preloadRoot, 'report.json');
    writeFileSync(preload, `import fs from 'node:fs';\nimport childProcess from 'node:child_process';\nimport {syncBuiltinESMExports} from 'node:module';\nimport {writeFileSync,existsSync,readFileSync} from 'node:fs';\nconst calls=[];let polls=0,signalObserved=false;const stateRoot=${JSON.stringify(stateRoot)},report=${JSON.stringify(report)},signal=${JSON.stringify(signal)};\nprocess.on(signal,()=>{signalObserved=true;});\nchildProcess.spawnSync=(exe,args)=>{const q=JSON.parse(Buffer.from(args[1],'base64url').toString('utf8'));calls.push(q.method);let result;if(q.method==='getMe')result={id:9001,is_bot:true,username:'fixture_bot',first_name:'Preview'};else if(q.method==='getUpdates'){polls++;result=polls===1?[{update_id:100,message:{message_id:1100,from:{id:7,is_bot:false,first_name:'synthetic'},chat:{id:7001,type:'private'},date:1700000000,text:'ground signal'}}]:[];}else result={message_id:8001,chat:{id:7001,type:'private'},text:q.body.text};return {status:0,stdout:JSON.stringify({kind:'response',status:200,bytes:JSON.stringify({ok:true,result})})};};\nconst rename=fs.renameSync;let injected=false;fs.renameSync=(from,to)=>{const result=rename(from,to);if(!injected&&String(to).endsWith('/run-proof.json')){injected=true;process.kill(process.pid,signal);}return result;};syncBuiltinESMExports();process.on('exit',()=>{const state=JSON.parse(readFileSync(stateRoot+'/preview-state.json','utf8'));writeFileSync(report,JSON.stringify({calls,signalObserved,stop:existsSync(stateRoot+'/preview-stop.json'),phases:Object.values(state.turns).map(turn=>turn.phase)}));});\n`);
    const expires = String(Date.now() + 60_000);
    const result = spawnSync(process.execPath, ['--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/agent.mjs', 'run',
      '--root', stateRoot, '--bot-id', '9001', '--bot-username', '@fixture_bot', '--operator-sender-id', '7',
      '--chat-id', '7001', '--chat-kind', 'private', '--forum', 'false', '--message-thread-id', 'none',
      '--expires-at', expires, '--max-cycles', '3', '--max-poll-seconds', '1', '--max-batch-items', '1',
      '--max-context-turns', '2', '--max-context-bytes', '4096', '--max-pending-turns', '2', '--max-trial-turns', '4',
      '--reply-limit', '2', '--reply-window-ms', '60000', '--error-limit', '2', '--backoff-ms', '1', '--max-backoff-ms', '2'],
    { cwd: process.cwd(), env: { ...process.env, NODE_OPTIONS: `--import=${preload}`,
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '9001:synthetic_recorded_test_only_value',
      INSTAR_SECRET_PREVIEW_STORAGE_KEY: '13'.repeat(32) }, encoding: 'utf8', timeout: 30_000 });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(report, 'utf8'))).toEqual({
      calls: ['getMe', 'getUpdates'], signalObserved: true, stop: true, phases: ['grounded'],
    });
  }, 60_000);

  it('enumerates every simulated, dormant, safeguard-substitution, and real-effect ledger tier', () => {
    expect(PREVIEW_STAND_IN_LEDGER.map(row => row.name)).toEqual([
      'fixture-governance-and-register', 'fixture-signing-and-standing-grants',
      'fixture-clock-and-verification-host', 'preview-route-hold-gate', 'fixture-five-six-run-admission-capacity',
      'fixture-context-assembler', 'fixture-run-file-storage-and-capture-custody',
      'fixture-in-memory-authority-and-capture-indexes', 'fixture-five-grounding-consumption',
      'fixture-native-launch-and-process-descriptor', 'fixture-context-delivery-nine-evidence',
      'fixture-independent-protection-posture', 'fixture-model-and-persistence-descriptors',
      'fixture-effect-peer-directory', 'fixture-five-source-result', 'fixture-reply-nine-assessor',
      'real-telegram-effect',
    ]);
    expect(new Set(PREVIEW_STAND_IN_LEDGER.map(row => row.tier))).toEqual(new Set([
      'simulated-authority', 'simulated-internal-operation', 'simulated-custody',
      'dormant-descriptor', 'live-safeguard-substitution', 'real-external-effect' ]));
    expect(PREVIEW_STAND_IN_LEDGER.find(row => row.name === 'fixture-context-delivery-nine-evidence')?.claims)
      .toContain('finalCharge 0');
    expect(PREVIEW_STAND_IN_LEDGER.find(row => row.name === 'fixture-effect-peer-directory')?.liveEffect)
      .toContain('real Telegram send');
    expect(PREVIEW_STAND_IN_LEDGER.every(row => /^M[345]/u.test(row.replacementUnit))).toBe(true);
  });
});
