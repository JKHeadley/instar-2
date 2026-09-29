import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
import { HOST_OUTAGE_TEXT, openPreviewState } from '../preview/state.js';
// @ts-expect-error Physical launchd watcher is JavaScript.
import { watchOnce, supervise, superviseJournal } from '../../scripts/host-watch.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function fixture(errorLimit = 5) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'host-watch-'))); roots.push(root);
  const configuration = { trial: 'host', botId: '8820318295', chatId: '7812716706' };
  const options = { root, configuration, expiresAt: Date.now() + 60000,
    replyLimit: 6, replyWindowMs: 60000, errorLimit, totalErrorLimit: 100,
    maxPendingTurns: 16, maxTrialTurns: 128,
    hostNotice: { botId: configuration.botId, chatId: configuration.chatId, message: HOST_OUTAGE_TEXT } };
  const state = openPreviewState(options);
  return { root, state, options };
}

it('waits for a failed restart, binds the prepared notice, and closes only on recovery', () => {
  const { root, state } = fixture(); let sends = 0;
  const send = () => { sends += 1; };
  const now = Date.now();
  expect(watchOnce({ root, now, failedAttempt: 1, failedOutcome: { code: 23, signal: null }, forceOutage: true, send })).toBe('recovering');
  expect(sends).toBe(0);
  expect(watchOnce({ root, now: now + 1, failedAttempt: 2, failedOutcome: { code: 23, signal: null }, forceOutage: true, send })).toBe('notified');
  const episode = JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8'));
  expect(episode).toMatchObject({ open: true, phase: 'prepared', trial: state.read().trial.id,
    configurationDigest: state.read().trial.configurationDigest, botId: '8820318295', chatId: '7812716706',
    message: HOST_OUTAGE_TEXT, failedAttempt: 2, recoveryFailure: { code: 23, signal: null } });
  expect(watchOnce({ root, now: now + 2, failedAttempt: 3, failedOutcome: { code: 23, signal: null }, forceOutage: true, send })).toBe('already-notified');
  expect(sends).toBe(1);
  state.heartbeat(process.pid);
  expect(watchOnce({ root, now: Date.now(), alive: () => true, send })).toBe('healthy');
  expect(JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8')).open).toBe(false);
});

it('a fresh heartbeat after the bounded restart suppresses escalation', () => {
  const { root, state } = fixture(); let sends = 0;
  expect(watchOnce({ root, failedAttempt: 1, failedOutcome: { code: 23, signal: null }, forceOutage: true, send: () => { sends++; } })).toBe('recovering');
  state.heartbeat(process.pid);
  expect(watchOnce({ root, alive: () => true, send: () => { sends++; } })).toBe('healthy');
  expect(sends).toBe(0);
  expect(JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8')).open).toBe(false);
});

it('a prepared but interrupted notice is non-retryable and a mismatched authority refuses', () => {
  const { root, state } = fixture(); let attempts = 0;
  expect(watchOnce({ root, failedAttempt: 1, failedOutcome: { code: 23, signal: null }, forceOutage: true, send: () => { attempts++; } })).toBe('recovering');
  expect(() => watchOnce({ root, failedAttempt: 2, failedOutcome: { code: 23, signal: null }, forceOutage: true,
    send: () => { attempts++; throw Error('interrupted'); } })).toThrow('interrupted');
  expect(watchOnce({ root, failedAttempt: 3, failedOutcome: { code: 23, signal: null }, forceOutage: true, send: () => { attempts++; } })).toBe('already-notified');
  expect(attempts).toBe(1);
  const path = join(root, 'host-watch.json'), episode = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...episode, chatId: '999' }));
  expect(() => watchOnce({ root, failedAttempt: 3, failedOutcome: { code: 23, signal: null }, forceOutage: true })).toThrow('episode authority changed');
  state.latchStop('operator');
  expect(watchOnce({ root, failedAttempt: 3, failedOutcome: { code: 23, signal: null }, forceOutage: true })).toBe('inactive');
});

it('ships a temporary-label launchd job with crash-only KeepAlive and no credential in argv', () => {
  const { root } = fixture();
  const template = readFileSync('scripts/host-watch.launchd.plist.template', 'utf8');
  const rendered = template.replace('__TEMP_OR_DEPLOYMENT_LABEL__', `test.instar.host-watch.${process.pid}`)
    .replace('__ABSOLUTE_NODE__', process.execPath)
    .replace('__ABSOLUTE_HOST_WATCH_SCRIPT__', join(process.cwd(), 'scripts/host-watch.mjs'))
    .replace('__ABSOLUTE_NON_SECRET_CONFIG__', join(root, 'config.json'))
    .replace('__ABSOLUTE_SAFE_STDOUT_LOG__', join(root, 'out.log'))
    .replace('__ABSOLUTE_SAFE_STDERR_LOG__', join(root, 'err.log'));
  const path = join(root, 'test.plist'); writeFileSync(path, rendered);
  expect(spawnSync('plutil', ['-lint', path], { encoding: 'utf8' }).status).toBe(0);
  expect(rendered).toContain('<key>SuccessfulExit</key><false/>');
  expect(rendered).not.toContain('INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN');
});

it('a recovered first crash produces no escalation, then respects a durable stop latch', async () => {
  const { root, state } = fixture();
  state.noteError(); // Existing loop errors must not count as a failed host recovery attempt.
  const script = join(root, 'child.mjs');
  writeFileSync(script, `import { existsSync, writeFileSync } from 'node:fs';
const marker = process.argv[2];
if (!existsSync(marker)) { writeFileSync(marker, 'first'); process.exit(23); }
writeFileSync(process.argv[3], JSON.stringify({ reason: 'breaker', latchedAt: Date.now() }));
process.exit(0);
`);
  const marker = join(root, 'launched'), stop = join(root, 'preview-stop.json');
  expect(await supervise({ root, cwd: root, agent: [process.execPath, script, marker, stop] })).toBe(0);
  expect(existsSync(marker)).toBe(true);
  expect(JSON.parse(readFileSync(stop, 'utf8')).reason).toBe('breaker');
  expect(JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8')).phase).toBe('recovering');
});

it('sustained crashes reach the existing durable breaker and a reopening cannot restart', async () => {
  const { root, options } = fixture(3);
  const script = join(root, 'crash.mjs'), marker = join(root, 'launches');
  writeFileSync(script, `import { appendFileSync } from 'node:fs'; appendFileSync(process.argv[2], 'one\\n'); process.exit(23);`);
  const config = { root, cwd: root, agent: [process.execPath, script, marker, '--backoff-ms', '1', '--max-backoff-ms', '2'] };
  expect(await supervise(config)).toBe(0);
  expect(readFileSync(marker, 'utf8')).toBe('one\none\none\n');
  expect(openPreviewState({ ...options, create: false }).read()).toMatchObject({
    consecutiveErrors: 3, totalErrors: 3, stop: { reason: 'breaker' } });
  expect(await supervise(config)).toBe(0);
  expect(readFileSync(marker, 'utf8')).toBe('one\none\none\n');
  expect(JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8')).failedAttempt).toBe(2);
});

it('does not restart a successful agent exit or a deliberate configuration refusal', async () => {
  const { root } = fixture();
  const script = join(root, 'success.mjs'), marker = join(root, 'launches');
  writeFileSync(script, `import { appendFileSync } from 'node:fs'; appendFileSync(process.argv[2], 'one\\n'); process.exit(0);`);
  expect(await supervise({ root, cwd: root, agent: [process.execPath, script, marker] })).toBe(0);
  expect(readFileSync(marker, 'utf8')).toBe('one\n');
  expect(existsSync(join(root, 'host-watch.json'))).toBe(false);
  const refused = join(root, 'refused.mjs');
  writeFileSync(refused, `import { appendFileSync } from 'node:fs'; appendFileSync(process.argv[2], 'one\\n'); process.exit(1);`);
  expect(await supervise({ root, cwd: root, agent: [process.execPath, refused, marker] })).toBe(0);
  expect(readFileSync(marker, 'utf8')).toBe('one\none\n');
  expect(JSON.parse(readFileSync(join(root, 'preview-stop.json'), 'utf8')).reason).toBe('breaker');
});

it('a missing executable latches the existing breaker without a launchd retry', async () => {
  const { root } = fixture();
  const missing = join(root, 'missing-provider-executable');
  expect(await supervise({ root, cwd: root, agent: [missing] })).toBe(0);
  expect(JSON.parse(readFileSync(join(root, 'preview-stop.json'), 'utf8')).reason).toBe('breaker');
  expect(JSON.parse(readFileSync(join(root, 'preview-state.json'), 'utf8')).totalErrors).toBe(1);
});

// Rule 15 gap (a), the desk's live test run offline: the REAL journal runner under host-watch is stopped with
// SIGSTOP (alive, not exiting); host-watch sees its progress beat stop, relaunches it, and a message sent
// afterwards is answered.
it('relaunches a SIGSTOPped real journal runner, and a message sent afterwards is answered', async () => {
  const { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } = await import('../preview/successive-fixture.js');
  const world = successiveWorld(), root = join(world.directory, 'watched-journal'), dir = world.directory;
  const activation = join(dir, 'activation.json'), profile = join(dir, 'profile.json');
  const log = join(dir, 'poll.log'), updates = join(dir, 'updates.json'), preload = join(dir, 'jev.mjs');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(updates, '[]');
  writeFileSync(preload, `globalThis.fetch = async () => new Response(JSON.stringify({ model: 'jev-1.13.0',
    answers: Object.fromEntries(['raw_path','cli_command','config_key','credential','api_endpoint',
      'quits_on_self','claims_blocked','parks_on_user','defers_work','unrecorded_blocker'].map(rule => [rule,{type:'noul',noul:0.01}])) }));\n`);
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates], { stdio: ['ignore', 'pipe', 'ignore'] });
  const saved = { ...process.env };
  try {
    const port = await new Promise<number>((done, fail) => { endpoint.stdout!.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', fail); });
    Object.assign(process.env, { INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` });
    const trial = world.state().read().trial;
    const agent = [process.execPath, '--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--import', preload,
      join(process.cwd(), 'tests/preview/journal-agent.mjs'), 'run', '--root', root,
      '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--activation-record', activation, '--operator-records', join(dir, 'operator-records'), '--login-profile', profile, '--model', world.model,
      '--bot-username', world.configuration.botUsername, '--max-cycles', '100000', '--max-poll-seconds', '1'];
    const supervised = superviseJournal({ mode: 'journal', root, cwd: process.cwd(), agent, hangAfterMs: 20000, backoffMs: 50, maxBackoffMs: 100 });
    const polls = () => existsSync(log) ? readFileSync(log, 'utf8').split('getUpdates').length - 1 : 0;
    const until = async (test: () => boolean, ms: number) => {
      const end = Date.now() + ms; while (!test() && Date.now() < end) await new Promise(done => setTimeout(done, 25)); return test(); };
    expect(await until(() => polls() >= 2 && existsSync(join(root, 'runner-beat.json')), 30000)).toBe(true);
    const first = JSON.parse(readFileSync(join(root, 'runner-beat.json'), 'utf8')).pid;
    process.kill(first, 'SIGSTOP');
    const stoppedAt = polls();
    // host-watch kills the stopped runner and a fresh one resumes polling.
    expect(await until(() => { try { return JSON.parse(readFileSync(join(root, 'runner-beat.json'), 'utf8')).pid !== first && polls() > stoppedAt; }
      catch { return false; } }, 40000)).toBe(true);
    expect(() => process.kill(first, 0)).toThrow();
    expect(JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8'))).toMatchObject({ phase: 'recovering',
      failures: [{ signal: 'SIGKILL', hung: true }] });
    // The operator's next message reaches the relaunched runner and is answered.
    writeFileSync(updates, JSON.stringify([{ update_id: 1, message: { chat: { id: Number(world.configuration.chatId), type: 'private' },
      from: { id: Number(world.configuration.operatorSenderId) }, text: 'status' } }]));
    const answered = () => existsSync(`${log}.sends`) && readFileSync(`${log}.sends`, 'utf8').split('\n').filter(Boolean)
      .some(line => String(JSON.parse(line).chat_id) === world.configuration.chatId);
    expect(await until(answered, 40000)).toBe(true);
    writeFileSync(join(root, 'preview-stop.json'), JSON.stringify({ reason: 'operator' }));
    expect(await supervised).toBe(0);
    expect(JSON.parse(readFileSync(join(root, 'host-watch.json'), 'utf8')).open).toBe(false);
  } finally {
    endpoint.kill('SIGKILL');
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}, 150000);
