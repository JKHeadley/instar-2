// @ts-nocheck -- offline process and HTTP fixtures exercise the real launcher.
/** Row 01's send slice in the real launcher process: its own admitted tick, the worker, the physical Telegram bridge to an
 * offline endpoint, and the effect policy file. It needs the launcher's limit shim, which refuses under a shell with no
 * `ulimit -u` (dash), the same as every sibling launcher test on such a host. */
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from '../preview/successive-fixture.js';
import { createJournalWorker, openPreviewJournal } from '../preview/journal-test-worker.js';
import { createCommitmentHost } from '../preview/commitment-host.js';

const TOPIC = 77;
const policy = (grants: unknown[]) => JSON.stringify({ type: 'PreviewEffectPolicy', resourceLevelUsd: 0, policySensitive: [],
  registered: [{ effect: 'telegram:ordinary-reply', consequence: 'attention', reversibility: 'irreversible', reach: 'operator', costUsd: 0, source: 'P-08' }], grants });
const grant = { id: 'commitment-send-grant', effect: 'telegram:ordinary-reply', target: `commitment-send:${String(TOPIC)}`, approves: ['scope'],
  source: 'operator message', custodian: 'operator', recovery: 'unknown-never-retry' };

it.each([['with its exact grant', [grant], 1], ['with no grant', [], 0]])('the launcher tick drives a due check-in %s', async (_name, grants, expected) => {
  const world = successiveWorld(), root = join(world.directory, 'commitment-journal');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), effectPolicy = join(world.directory, 'effect-policy.json');
  writeFileSync(activation, JSON.stringify(world.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(effectPolicy, policy(grants));
  const trial = world.state().read().trial, start = Date.now() - 3_600_000;
  const chat = '-1001234', operator = Number(world.configuration.operatorSenderId);
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, { kind: 'genesis', origin: 'test', forum: true,
    bot: world.configuration.botId, chat, operator: world.configuration.operatorSenderId, grant: trial.id, configurationDigest: trial.configurationDigest,
    expires: trial.expiresAt, maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  const worker = createJournalWorker(journal, { now: () => start, stopped: () => false, timeZone: 'America/Los_Angeles', origin: 'test', checkOutbound: () => {}, send: async () => 100,
    model: async () => JSON.stringify({ reply: 'Okay.', memory: [] }) });
  worker.intake([{ update_id: 1, message: { message_id: 1, chat: { id: Number(chat), type: 'supergroup', is_forum: true }, from: { id: operator }, text: 'hello', date: Math.floor(start / 1000), message_thread_id: TOPIC } }]);
  await worker.drain();
  const seed = createCommitmentHost(journal, { now: () => start, minutesOfDay: () => 720, formatWhen: ms => new Date(ms).toISOString(), fileExists: () => false,
    config: { get: (_k, fallback) => fallback, set() {} }, log() {} });
  seed.tick();
  const row = seed.tracker().record({ type: 'one-time-action', userRequest: 'the benchmark', agentResponse: 'ok', topicId: TOPIC, checkInAt: new Date(start).toISOString() });
  seed.stop(); journal.close();
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => {
      endpoint.stdout.once('data', data => resolve(Number(String(data).trim())));
      endpoint.once('error', reject);
    });
    const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', '--loader', './tests/preview/model-failure-loader.mjs',
      'tests/preview/journal-agent.mjs', 'run', '--root', root, '--forum', 'true', '--effect-policy', effectPolicy,
      '--bot-id', world.configuration.botId, '--chat-id', chat, '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt), '--tools', 'off', '--activation-record', activation,
      '--operator-records', join(world.directory, 'operator-records'), '--login-profile', profile, '--model', world.model,
      '--bot-username', world.configuration.botUsername, '--max-cycles', '3', '--max-poll-seconds', '1'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 25000, env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder', INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${String(port)}` } });
    expect(run.status, run.stderr).toBe(0);
    const sends = existsSync(`${log}.sends`) ? readFileSync(`${log}.sends`, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    const carried = sends.filter(body => String(body.text).includes('the benchmark'));
    expect(carried).toHaveLength(expected);
    const after = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    try {
      const store = after.view.commitmentStore!;
      expect(store.sends).toHaveLength(expected);
      if (expected) {
        expect(carried[0].message_thread_id).toBe(TOPIC);
        expect(store.sends[0]).toMatchObject({ logicalSendId: `${row.id}:check-in`, effectGrant: grant.id, thread: TOPIC, sent: expect.any(Number) });
        expect(store.rows[row.id].checkInReminderSentAt).toBeDefined();
      } else expect(store.rows[row.id].checkInReminderAttempts ?? 0).toBe(0);
      expect(store.rows[row.id].status).toBe('pending');
    } finally { after.close(); }
  } finally { endpoint.kill(); }
}, 40000);
