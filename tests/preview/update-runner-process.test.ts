// @ts-nocheck -- real admitted runner and HTTP fixture; no model or real service calls.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { openPreviewJournal } from './journal.js';

// The shipped transport shim requires this kernel-limit shell operation. WSL dash refuses it.
const processLimitAvailable = spawnSync('/bin/sh', ['-c', 'ulimit -S -u'], { encoding: 'utf8' }).status === 0;
it.skipIf(!processLimitAvailable)('the shipped runner polls, completes its handshake and runs the real auto-update tick with refreshed settings', async () => {
  const world = successiveWorld(), root = join(world.directory, 'update-runner');
  const activation = join(world.directory, 'activation.json'), profile = join(world.directory, 'profile.json');
  const log = join(world.directory, 'poll.log'), updates = join(world.directory, 'updates.json');
  writeFileSync(activation, JSON.stringify(world.activation())); writeFileSync(profile, JSON.stringify(offlineProfile));
  writeFileSync(updates, '[]');
  const trial = world.state().read().trial;
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY, {
    kind: 'genesis', origin: 'test', bot: world.configuration.botId, chat: world.configuration.chatId,
    operator: world.configuration.operatorSenderId, grant: trial.id, configurationDigest: trial.configurationDigest,
    expires: trial.expiresAt, maxCalls: 16, maxReplies: 16, maxTurns: 20, maxBytes: 32768, cursor: 0 });
  journal.close();
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  writeFileSync(join(root, 'update-state.json'), JSON.stringify({ phase: 'observing', runtime: {
    handshake: { expectedVersion: version, previousVersion: '0.0.9', retryCount: 0, status: 'pending', failures: [] } } }));
  writeFileSync(join(root, 'runtime-settings.json'), JSON.stringify({ updates: { autoApply: false },
    monitoring: { templatesDriftVerifier: { enabled: false } } }));
  const commands = join(world.directory, 'commands'); mkdirSync(commands);
  // Bounded deterministic release discovery only. Every other launch/port remains the shipped path.
  writeFileSync(join(commands, 'git'), `#!/bin/sh\nprintf 'fixture\\trefs/tags/v${version}\\n'\n`); chmodSync(join(commands, 'git'), 0o700);
  const endpoint = spawn(process.execPath, [join(process.cwd(), 'tests/preview/journal-poll-endpoint.mjs'), log, updates, '-', 'long-poll'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolve, reject) => {
      endpoint.stdout.once('data', data => resolve(Number(String(data).trim()))); endpoint.once('error', reject);
      endpoint.once('exit', code => reject(Error(`endpoint exited: ${code}`)));
    });
    const env = { ...process.env, PATH: `${commands}:${process.env.PATH}`,
      INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const run = spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
      'tests/preview/journal-agent.mjs', 'run', '--root', root,
      '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId,
      '--operator-sender-id', world.configuration.operatorSenderId, '--grant-reference', trial.id,
      '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
      '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'),
      '--login-profile', profile, '--model', world.model, '--bot-username', world.configuration.botUsername,
      '--max-cycles', '13', '--max-poll-seconds', '1'], { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, env });
    expect(run.status, run.stderr + readFileSync(join(root, 'runs.jsonl'), 'utf8')).toBe(0);
    const runtime = JSON.parse(readFileSync(join(root, 'update-state.json'), 'utf8')).runtime;
    expect(runtime.handshake).toMatchObject({ status: 'verified', runningVersion: version, retryCount: 0 });
    expect(runtime.updater.lastCheck).toEqual(expect.any(String));
    expect(runtime.templateScan).toBeUndefined();
    expect(readFileSync(log, 'utf8')).toContain('getUpdates');
    const after = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    try { expect(after.view.calls).toBe(0); expect(after.view.replies).toBe(0); } finally { after.close(); }
  } finally { endpoint.kill('SIGTERM'); }
}, 45000);
