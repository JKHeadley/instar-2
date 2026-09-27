// Reusable process harness for a real journal-agent child with file-backed physical ports.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs',
  '--loader', './tests/preview/journal-cutover-loader.mjs', 'tests/preview/journal-agent.mjs'];
const key = Buffer.alloc(32, 19).toString('hex');
const token = '12345678:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const pause = ms => new Promise(done => setTimeout(done, ms));

export function cutoverHarness(world, profile, childEnv = {}) {
  const directory = world.directory, marker = join(directory, 'long-poll-overlap');
  const activation = world.activation();
  const activationPath = join(directory, 'cutover-activation.json');
  const profilePath = join(directory, 'cutover-profile.json');
  writeFileSync(activationPath, JSON.stringify(activation));
  writeFileSync(profilePath, JSON.stringify(profile));
  const launchArgs = (root, role, cycles) => [...args, 'run', '--root', root,
    '--bot-id', world.configuration.botId, '--bot-username', world.configuration.botUsername,
    '--chat-id', world.configuration.chatId, '--operator-sender-id', world.configuration.operatorSenderId,
    '--grant-reference', activation.trial, '--configuration-digest', activation.baseConfigurationDigest,
    '--expires-at', String(activation.expiresAt), '--activation-record', activationPath,
    '--login-profile', profilePath, '--model', world.model, '--max-cycles', String(cycles),
    '--max-poll-seconds', '1'];
  const env = role => ({ ...process.env, ...childEnv, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key,
    INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: token,
    INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: '',
    INSTAR_PREVIEW_CUTOVER_WORLD: directory, INSTAR_PREVIEW_CUTOVER_ROLE: role });
  const canaryRoot = join(directory, 'cutover-canary');
  const liveRoot = join(directory, 'cutover-live');
  const startCanary = () => spawn(process.execPath, launchArgs(canaryRoot, 'canary', 1000),
    { cwd: process.cwd(), env: env('canary'), stdio: 'ignore' });
  const launchLive = cycles => spawnSync(process.execPath, launchArgs(liveRoot, 'live', cycles),
    { cwd: process.cwd(), env: env('live'), encoding: 'utf8', timeout: 30000 });
  const status = () => spawnSync(process.execPath, [...args,
    'status', '--root', liveRoot], { cwd: process.cwd(), env: env('live'), encoding: 'utf8', timeout: 10000 });
  const waitForOverlap = async () => {
    for (let i = 0; i < 100; i++) { if (existsSync(marker)) return; await pause(50); }
    throw Error('canary never entered a long poll');
  };
  const stopCanary = async child => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    const exited = new Promise(done => child.once('exit', done));
    await Promise.race([exited, pause(5000)]);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
  };
  const releaseOverlap = () => rmSync(marker, { force: true });
  const setUpdates = updates => writeFileSync(join(directory, 'updates.json'), JSON.stringify(updates));
  const setConflicts = count => writeFileSync(join(directory, 'conflicts-remaining'), String(count));
  const calls = () => readFileSync(join(directory, 'telegram.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  return { directory, canaryRoot, liveRoot, startCanary, launchLive, status, waitForOverlap,
    stopCanary, releaseOverlap, setUpdates, setConflicts, calls };
}
