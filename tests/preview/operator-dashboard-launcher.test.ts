// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
// Wiring (Rules 79, 81): the live runner publishes the operator dashboard's snapshot into its approval outbox, built from
// the same status answer it sends in chat, only while the operator's approval page is installed; and with
// --dashboard-listen and --dashboard-pin-check it serves the same views READ-ONLY behind the operator's existing PIN.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { openPreviewJournal } from './journal.js';
import { DASHBOARD_FILE, readSnapshot } from '../../scripts/operator-dashboard.mjs';

it.each([['with', true], ['without', false]])('the runner %s the approval page installed publishes a dashboard snapshot only then', async (_name, installed) => {
  const world = successiveWorld(), root = join(world.directory, 'dashboard-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json'), preload = join(world.directory, 'jev.mjs');
  const store = join(world.directory, 'store'), outbox = join(world.directory, 'outbox');
  mkdirSync(store, { mode: 0o755 }); chmodSync(store, 0o755);
  mkdirSync(outbox, { mode: 0o750 }); chmodSync(outbox, 0o750); // closed to other accounts: the dashboard carries message excerpts
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(updates, JSON.stringify([{ update_id: 1, message: { chat: { id: Number(world.configuration.chatId), type: 'private' },
    from: { id: Number(world.configuration.operatorSenderId) }, text: 'status' } }]));
  writeFileSync(preload, `globalThis.fetch = async () => new Response(JSON.stringify({ model: 'jev-1.13.0',
    answers: Object.fromEntries(['raw_path','cli_command','config_key','credential','api_endpoint',
      'quits_on_self','claims_blocked','parks_on_user','defers_work','unrecorded_blocker'].map(rule => [rule,{type:'noul',noul:0.01}])) }));\n`);
  const trial = world.state().read().trial;
  let journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, { kind: 'genesis', origin: 'test',
    bot: world.configuration.botId, chat: world.configuration.chatId, operator: world.configuration.operatorSenderId, grant: trial.id,
    configurationDigest: trial.configurationDigest, expires: trial.expiresAt, maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  // At the call cap: the status answer is the fixed reply, so no model is needed to reach the publish step.
  for (let index = 0; index < 16; index++) journal.append({ kind: 'legacy-call', at: 1000 });
  journal.close();
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => {
      endpoint.stdout.once('data', data => resolve(Number(String(data).trim())));
      endpoint.once('error', reject);
      endpoint.once('exit', code => reject(Error(`endpoint exited before listening: ${String(code)}`)));
    });
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder', INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    // The page runs as another OS user in a real installation; this process can only declare that identity.
    const page = installed ? ['--approval-store', store, '--approval-outbox', outbox, '--approval-operator-uid', String(process.getuid() + 1)] : [];
    const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--import', preload,
      'tests/preview/journal-agent.mjs', 'run', '--root', root, '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile, '--model', world.model,
      '--bot-username', world.configuration.botUsername, '--max-cycles', '2', '--max-poll-seconds', '1', ...page],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 20000, env });
    expect(run.status, run.stderr).toBe(0);
    journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    const sent = journal.view.order[0]?.intent ?? '';
    journal.close();
    expect(sent).toContain('Turns today: 1.');
    if (!installed) { expect(existsSync(join(outbox, DASHBOARD_FILE))).toBe(false); return; }
    const state = readSnapshot(outbox, Date.now());
    expect(state.kind).toBe('ok');
    // The snapshot's status is the runner's own chat status answer (same functions, same host lines), read after the reply.
    expect(sent).toContain(state.snapshot.status[0]);
    for (const prefix of ['Turns today:', 'Held replies:', 'Spend allowance:', 'Serving:', 'Past a cap:'])
      expect(state.snapshot.status.some(line => line.startsWith(prefix)), prefix).toBe(true);
    expect(state.snapshot).toMatchObject({ state: 'running', chat: world.configuration.botUsername.slice(1),
      turns: [{ update: 1, from: 'you', message: 'status', state: 'Answered' }] });
    expect(JSON.parse(readFileSync(join(outbox, DASHBOARD_FILE), 'utf8')).type).toBe('PreviewOperatorDashboard');
  } finally { endpoint.kill('SIGTERM'); }
}, 60000);

// Plan #502: the runner itself serves the dashboard read-only. A stand-in for the operator's existing sign-in answers like an
// Instar 1.x unlock: 200 (with a token the runner must never pass on) for the PIN, 403 otherwise.
it('the runner with --dashboard-listen serves the read-only dashboard behind the existing PIN, from its own chat status answer', async () => {
  const world = successiveWorld(), root = join(world.directory, 'readonly-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json'), preload = join(world.directory, 'jev.mjs');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(updates, JSON.stringify([{ update_id: 1, message: { chat: { id: Number(world.configuration.chatId), type: 'private' },
    from: { id: Number(world.configuration.operatorSenderId) }, text: 'status' } }]));
  writeFileSync(preload, `const real = globalThis.fetch;
globalThis.fetch = async (url, init) => String(url).startsWith('http://127.0.0.1:') && String(url).endsWith('/dashboard/unlock') ? real(url, init)
  : new Response(JSON.stringify({ model: 'jev-1.13.0', answers: Object.fromEntries(['raw_path','cli_command','config_key','credential','api_endpoint',
    'quits_on_self','claims_blocked','parks_on_user','defers_work','unrecorded_blocker'].map(rule => [rule,{type:'noul',noul:0.01}])) }));\n`);
  const trial = world.state().read().trial;
  let journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, { kind: 'genesis', origin: 'test',
    bot: world.configuration.botId, chat: world.configuration.chatId, operator: world.configuration.operatorSenderId, grant: trial.id,
    configurationDigest: trial.configurationDigest, expires: trial.expiresAt, maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  for (let index = 0; index < 16; index++) journal.append({ kind: 'legacy-call', at: 1000 });
  journal.close();
  const unlocks = [];
  const signIn = createServer((request, response) => { let body = ''; request.on('data', chunk => { body += chunk; });
    request.on('end', () => { const pin = JSON.parse(body).pin; unlocks.push(pin);
      response.writeHead(pin === '246810' ? 200 : 403, { 'content-type': 'application/json' });
      response.end(JSON.stringify(pin === '246810' ? { token: 'api-token-never-shown' } : { error: 'Incorrect PIN' })); }); });
  await new Promise(done => signIn.listen(0, '127.0.0.1', done));
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates, 'keep-thread', 'long-poll'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  let runner;
  try {
    const port = await new Promise((resolve, reject) => {
      endpoint.stdout.once('data', data => resolve(Number(String(data).trim())));
      endpoint.once('error', reject);
      endpoint.once('exit', code => reject(Error(`endpoint exited before listening: ${String(code)}`)));
    });
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder', INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    runner = spawn(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--import', preload,
      'tests/preview/journal-agent.mjs', 'run', '--root', root, '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile, '--model', world.model,
      '--bot-username', world.configuration.botUsername, '--max-cycles', '25', '--max-poll-seconds', '1',
      '--dashboard-listen', '127.0.0.1:0', '--dashboard-pin-check', `http://127.0.0.1:${String(signIn.address().port)}/dashboard/unlock`],
    { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    const base = await new Promise((resolve, reject) => {
      runner.stderr.on('data', data => { stderr += String(data);
        const found = stderr.match(/read-only operator dashboard at (http:\/\/127\.0\.0\.1:\d+)\/dashboard/u); if (found) resolve(found[1]); });
      runner.once('exit', code => reject(Error(`runner exited before serving the dashboard: ${String(code)}\n${stderr}`)));
    });
    const form = pin => ({ method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `pin=${pin}` });
    const signedOut = await fetch(`${base}/dashboard/status`), signedOutText = await signedOut.text();
    expect(signedOut.status).toBe(401);
    expect(signedOutText).toContain('Your dashboard PIN');
    expect(signedOutText).not.toContain('Turns today');
    const wrong = await fetch(`${base}/dashboard/sign-in`, form('111111'));
    expect([wrong.status, wrong.headers.get('set-cookie')]).toEqual([401, null]);
    const right = await fetch(`${base}/dashboard/sign-in`, form('246810')), cookie = right.headers.get('set-cookie')?.split(';')[0];
    expect(right.status).toBe(303);
    expect(right.headers.get('location')).toBe('/dashboard');
    expect(await right.text()).not.toContain('api-token-never-shown');
    expect(unlocks).toEqual(['111111', '246810']);
    // The snapshot is rebuilt at most every 15 seconds on the runner's cycle; wait for the one taken after the chat answer.
    let status = '';
    for (let attempt = 0; attempt < 120 && !status.includes('Turns today: 1.'); attempt++) {
      const page = await fetch(`${base}/dashboard/status`, { headers: { cookie } });
      expect(page.status).toBe(200);
      status = await page.text();
      if (!status.includes('Turns today: 1.')) await new Promise(done => setTimeout(done, 250));
    }
    expect(status, `${stderr}\n${existsSync(log) ? readFileSync(log, 'utf8') : 'no poll log'}`).toContain('Turns today: 1.');
    expect(status).not.toContain('api-token-never-shown');
    // No approval port: nothing to approve, decline or stop here.
    for (const path of ['/dashboard/begin', '/dashboard/act', '/begin', '/act'])
      expect((await fetch(`${base}${path}`, { method: 'POST', headers: { cookie }, body: '{}' })).status).toBe(404);
    const stop = await (await fetch(`${base}/dashboard/stop`, { headers: { cookie } })).text();
    expect(stop).toContain('send /stop in your chat');
    const exit = await new Promise(done => runner.once('exit', done));
    expect(exit, stderr).toBe(0);
    journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    const sent = journal.view.order[0]?.intent ?? '';
    journal.close();
    // One source: the page's status lines are the chat status answer the runner sent.
    const first = status.match(/<li>(Status \([^<]*\))<\/li>/u)?.[1];
    expect(first).toBeTruthy();
    expect(sent).toContain(first);
    expect(sent).toContain('Turns today: 1.');
  } finally { runner?.kill('SIGTERM'); endpoint.kill('SIGTERM'); signIn.close(); }
}, 90000);

// The refusal comes before anything else in the launch: the root a launch would create is never created. Both sides: the
// same launch with a valid pair gets past this check and creates the root (it then stops on the options this test omits).
const PIN_CHECK = ['--dashboard-pin-check', 'http://127.0.0.1:4042/dashboard/unlock'];
it.each([
  ['the listen address alone', ['--dashboard-listen', '127.0.0.1:4071'], false],
  ['the PIN check alone', PIN_CHECK, false],
  ['a wildcard listen address', ['--dashboard-listen', '0.0.0.0:4071', ...PIN_CHECK], false],
  ['a public listen address', ['--dashboard-listen', '203.0.113.5:4071', ...PIN_CHECK], false],
  ['a PIN check off this machine', ['--dashboard-listen', '127.0.0.1:4071', '--dashboard-pin-check', 'https://example.org/dashboard/unlock'], false],
  ['a valid loopback pair', ['--dashboard-listen', '127.0.0.1:4071', ...PIN_CHECK], true],
  ['a valid Tailscale pair', ['--dashboard-listen', '100.124.55.70:4071', ...PIN_CHECK], true],
])('the runner launch with %s', (_name, flags, passes) => {
  const root = join(successiveWorld().directory, 'refused-root');
  const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'run',
    '--root', root, ...flags], { cwd: process.cwd(), encoding: 'utf8', timeout: 20000 });
  expect(run.status).not.toBe(0);
  expect(existsSync(root)).toBe(passes);
});
