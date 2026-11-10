// @ts-nocheck -- physical installer/watchdog/runner proof with isolated offline custody.
import { expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { successiveWorld, offlineProfile, OFFLINE_STORAGE_KEY } from './successive-fixture.js';
import { openPreviewJournal } from './journal.js';

const processLimitAvailable = spawnSync('/bin/sh', ['-c', 'ulimit -S -u'], { encoding: 'utf8' }).status === 0;
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
it.skipIf(!processLimitAvailable)('real installer, idle drain, watchdog recreation and admitted replacement retain a usable prior release after a failed candidate', async () => {
  const world = successiveWorld(), root = join(world.directory, 'lifecycle');
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
  writeFileSync(join(root, 'runtime-settings.json'), JSON.stringify({ updates: {
    applyDelayMinutes: 0, preRestartDelaySecs: 0, restartCascadeDampenerWindowMs: 0 },
    monitoring: { templatesDriftVerifier: { enabled: false } } }));
  const source = join(world.directory, 'source'); mkdirSync(source);
  // Real npm installs this local package. Only network discovery/source selection
  // is substituted; admission, resources, migration, processes and HTTP are real.
  for (const dir of ['src', 'scripts', 'tests', 'generated', 'register-source', 'docs', 'dist', 'bin'])
    if (existsSync(dir)) cpSync(dir, join(source, dir), { recursive: true });
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  pkg.version = '0.1.1'; pkg.dependencies = { typescript: `file:${resolve('node_modules/typescript')}` };
  delete pkg.devDependencies; delete pkg.scripts;
  writeFileSync(join(source, 'package.json'), JSON.stringify(pkg));
  const commands = join(world.directory, 'commands'); mkdirSync(commands);
  const selected = join(world.directory, 'selected'); writeFileSync(selected, '0.1.1');
  const git = spawnSync('/usr/bin/which', ['git'], { encoding: 'utf8' }).stdout.trim();
  const npm = spawnSync('/usr/bin/which', ['npm'], { encoding: 'utf8' }).stdout.trim();
  writeFileSync(join(commands, 'git'), `#!/bin/sh\nif [ "$1" = ls-remote ]; then printf 'fixture\\trefs/tags/v'; cat ${quote(selected)}; printf '\\n'; else exec ${quote(git)} "$@"; fi\n`);
  // The shipped installer has a fixed argument vector; refuse drift in this fixture
  // instead of accidentally running its GitHub source over the network.
  // Until the real install ends, the endpoint holds each empty poll its full 5 s instead of 1 s, so the
  // agent's fixed cycle count outlasts a discovery and install slowed by a loaded host without lengthening
  // the rest of the run. Each run sets the marker at launch, not at the npm call: on m5pro (2026-11-08,
  // train-219 e6c555ee) the cycles still ran out at 1 s each before the install began, and no update was
  // ever requested. The shim clears it when its install ends.
  const installing = join(world.directory, 'installing');
  writeFileSync(join(commands, 'npm'), `#!/bin/sh\n[ "$1" = install ] && [ "$2" = --prefix ] && [ "$8" = -- ] || exit 90\n: > ${quote(installing)}\n${quote(npm)} install --prefix "$3" --ignore-scripts --no-audit --no-fund --install-links -- ${quote('file:' + source)}\nstatus=$?\n/bin/rm -f ${quote(installing)}\nexit $status\n`);
  chmodSync(join(commands, 'git'), 0o700); chmodSync(join(commands, 'npm'), 0o700);
  const endpoint = spawn(process.execPath, [resolve('tests/preview/journal-poll-endpoint.mjs'), log, updates, '-', 'long-poll', '', '0', installing], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((resolvePort, reject) => {
      endpoint.stdout.once('data', data => resolvePort(Number(String(data).trim()))); endpoint.once('error', reject);
      endpoint.once('exit', code => reject(Error(`endpoint exited: ${code}`)));
    });
    const env = { ...process.env, PATH: `${commands}:${process.env.PATH}`, npm_config_cache: join(world.directory, 'npm-cache'),
      INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(OFFLINE_STORAGE_KEY).toString('hex'),
      INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: 'offline-placeholder',
      INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      INSTAR_PREVIEW_TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${port}` };
    const config = { mode: 'journal', root, cwd: process.cwd(), maxRestarts: 5, backoffMs: 20, maxBackoffMs: 40,
      agent: [process.execPath, '--no-warnings', '--loader', resolve('scripts/slice-ts-loader.mjs'), resolve('tests/preview/journal-agent.mjs'), 'run', '--root', root,
        '--bot-id', world.configuration.botId, '--chat-id', world.configuration.chatId, '--operator-sender-id', world.configuration.operatorSenderId,
        '--grant-reference', trial.id, '--configuration-digest', trial.configurationDigest, '--expires-at', String(trial.expiresAt),
        '--tools', 'off', '--activation-record', activation, '--operator-records', join(world.directory, 'operator-records'),
        '--login-profile', profile, '--model', world.model, '--bot-username', world.configuration.botUsername,
        '--max-cycles', '35', '--max-poll-seconds', '5'] };
    const configPath = join(world.directory, 'watch.json'); writeFileSync(configPath, JSON.stringify(config));
    const authorityBefore = readFileSync(activation, 'utf8');
    const run = () => (writeFileSync(installing, ''), spawnSync(process.execPath, ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'scripts/host-watch.mjs', configPath],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 200000, maxBuffer: 1024 * 1024, env }));
    const first = run();
    expect(first.status, first.stderr + first.stdout).toBe(0);
    const state = () => JSON.parse(readFileSync(join(root, 'update-state.json'), 'utf8'));
    expect(state().runtime.handshake, first.stderr + first.stdout + JSON.stringify(state())).toMatchObject({ status: 'verified', expectedVersion: '0.1.1', runningVersion: '0.1.1' });
    expect(state().runtime.request.status).toBe('drained');
    expect(state().runtime.healthyRelease).toBe('v0.1.1');
    const runs = () => readFileSync(join(root, 'runs.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const oldExit = runs().find(row => row.reason === 'installed update restart drained');
    expect(oldExit.revival).toBe('queued');
    expect(new Set(runs().filter(row => row.pid).map(row => row.pid)).size).toBeGreaterThanOrEqual(2);
    // A second invocation recreates the actual watchdog. A syntax-valid package
    // whose runner fails before polling must return to the previously healthy code.
    pkg.version = '0.1.2'; writeFileSync(join(source, 'package.json'), JSON.stringify(pkg));
    writeFileSync(join(source, 'tests/preview/journal-agent.mjs'), "throw Error('offline candidate startup failure');\n");
    writeFileSync(selected, '0.1.2');
    const second = run(); expect(second.status, second.stderr + second.stdout).toBe(0);
    expect(state().runtime.handshake).toMatchObject({ status: 'failed', expectedVersion: '0.1.2', runningVersion: '0.1.1' });
    expect(state().runtime.handshake.failures.length).toBeGreaterThan(0);
    expect(state().runtime.healthyRelease).toBe('v0.1.1');
    expect(readFileSync(activation, 'utf8')).toBe(authorityBefore);
    expect(readFileSync(log, 'utf8')).toContain('getUpdates');
    const after = openPreviewJournal(join(root, 'journal.encrypted'), OFFLINE_STORAGE_KEY);
    try { expect(after.view.calls).toBe(0); expect(after.view.replies).toBe(0); } finally { after.close(); }
  } finally { endpoint.kill('SIGTERM'); }
}, 450000);
