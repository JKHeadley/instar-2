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
  const expiresAt = 2_000_000_000_000;
  const configuration = { root: path, machine: 'preview-test-machine', botId: '9001', botUsername: '@fixture_bot',
    operatorSenderId: '7', chatId: '7001', chatKind: 'private', forum: false, messageThreadId: null,
    maxPollSeconds: 1, maxBatchItems: 8, maxContextTurns: 8, maxContextBytes: 65_536,
    ...overrides.configuration };
  const limits = { replyLimit: 20, replyWindowMs: 60_000, errorLimit: 3,
    maxPendingTurns: 32, maxTrialTurns: 128, ...overrides.limits };
  const stateConfiguration = { ...configuration, expiresAt, ...limits };
  const state = openPreviewState({ root: path, configuration: stateConfiguration, expiresAt,
    now: () => 1_800_000_000_000, ...limits });
  const composition = (nextHooks = hooks) => createPreviewComposition({ configuration, state,
    storageKey: new Uint8Array(32).fill(19), storageIO: productionStorageIO, telegramIO: transport.io,
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

describe('Stage 1 preview driver (recorded transport only)', () => {
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
    expect(document.turns[previewTurnId('9001', 101)]).toMatchObject({ phase: 'ignored-out-of-scope', disposition: 'admitted-unbound' });
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
    const restarted = setup(path, telegram).composition();
    try { restarted.resume(); } finally { restarted.close(); }
    expect(sends(telegram)).toHaveLength(1);
    expect(built.state.read().turns[previewTurnId('9001', 100)].phase).toBe('dispatch-outcome-unknown');
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

    const expiredPath = root(); const limits = { replyLimit: 1, replyWindowMs: 10, errorLimit: 1, maxPendingTurns: 1, maxTrialTurns: 1 };
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
    expect(Object.values(built.state.read().turns).filter(turn => turn.phase === 'ignored-out-of-scope')).toHaveLength(3);

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

  it('enumerates every simulated, dormant, safeguard-substitution, and real-effect ledger tier', () => {
    expect(PREVIEW_STAND_IN_LEDGER.map(row => row.name)).toEqual([
      'fixture-governance-and-register', 'fixture-signing-and-standing-grants',
      'fixture-clock-and-verification-host', 'fixture-five-six-run-admission-capacity',
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
  });
});
