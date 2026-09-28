// @ts-nocheck -- offline child processes exercise the actual preview launcher.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';

it('keeps Telegram polling alive through a source error, then clears it after a durable import', async () => {
  const trial = successiveWorld();
  const root = join(trial.directory, 'source-journal');
  const source = join(trial.directory, 'agents', 'echo', '.instar');
  mkdirSync(source, { recursive: true });
  const logPath = join(source, 'telegram-messages.jsonl');
  const valid = JSON.stringify({ messageId: 77, topicId: 99, text: 'The studio code is JADE-52.',
    fromUser: true, timestamp: '2026-09-21T13:13:00Z', sessionName: 'echo-topic',
    telegramUserId: 101, provenance: 'user' }) + '\n';
  writeFileSync(logPath, valid + '{bad json}\n');
  const activation = join(trial.directory, 'activation.json'), profile = join(trial.directory, 'profile.json');
  const pollLog = join(trial.directory, 'poll.log'), updates = join(trial.directory, 'updates.json');
  writeFileSync(activation, JSON.stringify(trial.activation()));
  writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(updates, '[]');
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), pollLog, updates],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((done, fail) => { endpoint.stdout.once('data', data => done(Number(String(data).trim()))); endpoint.once('error', fail); });
    const grant = trial.state().read().trial;
    const env = { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const args = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
      'run', '--root', root, '--bot-id', trial.configuration.botId, '--chat-id', trial.configuration.chatId,
      '--operator-sender-id', trial.configuration.operatorSenderId, '--grant-reference', grant.id,
      '--configuration-digest', grant.configurationDigest, '--expires-at', String(grant.expiresAt),
      '--activation-record', activation, '--operator-records', join(trial.directory, 'operator-records'), '--login-profile', profile, '--model', trial.model,
      '--bot-username', trial.configuration.botUsername, '--max-cycles', '2', '--max-poll-seconds', '1',
      '--agent-state-dir', source];
    const run = () => spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, env });
    const status = () => JSON.parse(spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
        'status', '--root', root], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000, env }).stdout);
    const failed = run();
    expect(failed.status, failed.stderr).toBe(0);
    expect(readFileSync(pollLog, 'utf8')).toContain('getUpdates');
    expect(status().channelSources.telegram).toMatchObject({ offset: 0, error: 'import refused' });
    expect(status().channelItems).toBe(1); // Item append preceded the malformed line and survived.
    writeFileSync(logPath, valid);
    const recovered = run();
    expect(recovered.status, recovered.stderr).toBe(0);
    expect(status().channelSources.telegram).toMatchObject({ imported: 1, scanned: 1, error: null });
    expect(status().channelItems).toBe(1);
  } finally { endpoint.kill('SIGTERM'); }
}, 30_000);
