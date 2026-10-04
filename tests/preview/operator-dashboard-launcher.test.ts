// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
// Wiring (Rules 79, 81): the live runner publishes the operator dashboard's snapshot into its approval outbox, built from
// the same status answer it sends in chat, only while the operator's approval page is installed.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
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
      '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile, '--model', world.model,
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
