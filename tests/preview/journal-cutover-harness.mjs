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
    '--expires-at', String(activation.expiresAt), '--tools', 'off', '--activation-record', activationPath, '--operator-records', join(directory, 'operator-records'),
    '--login-profile', profilePath, '--model', world.model, '--max-cycles', String(cycles),
    '--max-poll-seconds', '1'];
  const env = (role, fenced = false) => ({ ...process.env, ...childEnv, INSTAR_SECRET_PREVIEW_STORAGE_KEY: key,
    INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN: token,
    INSTAR_SECRET_PREVIEW_TYPESAFE_KEY: '',
    INSTAR_PREVIEW_CUTOVER_WORLD: directory, INSTAR_PREVIEW_CUTOVER_ROLE: role,
    // The canary is an outside poller (another host's fence), so only Telegram's own conflict separates it.
    // A fenced canary shares this host's owner directory: a second runner for the same conversation.
    ...(role === 'canary' && !fenced ? { INSTAR_CONVERSATION_OWNERS: join(directory, 'owners-canary') } : {}) });
  const canaryRoot = join(directory, 'cutover-canary');
  const liveRoot = join(directory, 'cutover-live');
  const startCanary = (fenced = false) => spawn(process.execPath, launchArgs(canaryRoot, 'canary', 1000),
    { cwd: process.cwd(), env: env('canary', fenced), stdio: 'ignore' });
  const launchLive = cycles => spawnSync(process.execPath, launchArgs(liveRoot, 'live', cycles),
    { cwd: process.cwd(), env: env('live'), encoding: 'utf8', timeout: 30000 });
  /** The live runner as a child the test can kill at a chosen moment (a crash with no exit record). */
  const startLive = cycles => spawn(process.execPath, launchArgs(liveRoot, 'live', cycles),
    { cwd: process.cwd(), env: env('live'), stdio: 'ignore' });
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
  // Asynchronous twins of launchLive/status: the Vitest worker keeps its event loop (and its RPC to the main
  // process) alive while the child runs, so a slow machine never turns into an unhandled onTaskUpdate timeout.
  const collect = (child, timeout) => new Promise(done => {
    let stdout = '', stderr = '', finished = false;
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    const timer = setTimeout(() => { if (!finished) child.kill('SIGKILL'); }, timeout);
    child.once('close', (status, signal) => { finished = true; clearTimeout(timer); done({ status, signal, stdout, stderr }); });
  });
  const runLive = (cycles, extraArgs = [], extraEnv = {}) => collect(spawn(process.execPath, [...launchArgs(liveRoot, 'live', cycles), ...extraArgs],
    { cwd: process.cwd(), env: { ...env('live'), ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] }), 60000);
  const statusOf = () => collect(spawn(process.execPath, [...args, 'status', '--root', liveRoot],
    { cwd: process.cwd(), env: env('live'), stdio: ['ignore', 'pipe', 'pipe'] }), 30000);
  /** Any non-run command against an arbitrary root (e.g. a copy), with the live role's key and no poller. */
  const commandOn = (root, command, extraArgs = []) => collect(spawn(process.execPath, [...args, command, '--root', root, ...extraArgs],
    { cwd: process.cwd(), env: env('live'), stdio: ['ignore', 'pipe', 'pipe'] }), 30000);
  /** Any runner on any root, under a named role, as a child the test drives (two machines on one host). */
  const startRunner = (root, role, cycles, extraArgs = [], extraEnv = {}) => {
    const child = spawn(process.execPath, [...launchArgs(root, role, cycles), ...extraArgs],
      { cwd: process.cwd(), env: { ...env(role), ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
    const output = { stdout: '', stderr: '' };
    child.stdout.setEncoding('utf8').on('data', chunk => { output.stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { output.stderr += chunk; });
    return { child, output, exited: new Promise(done => child.once('close', (status, signal) => done({ status, signal }))) };
  };
  /** The status command against any root, under any role's environment. */
  const statusOn = (root, extraEnv = {}) => collect(spawn(process.execPath, [...args, 'status', '--root', root],
    { cwd: process.cwd(), env: { ...env('live'), ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] }), 30000);
  const setUpdates = updates => writeFileSync(join(directory, 'updates.json'), JSON.stringify(updates));
  const setConflicts = count => writeFileSync(join(directory, 'conflicts-remaining'), String(count));
  const calls = () => readFileSync(join(directory, 'telegram.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  return { directory, canaryRoot, liveRoot, startCanary, launchLive, startLive, status, waitForOverlap,
    stopCanary, releaseOverlap, setUpdates, setConflicts, calls, runLive, statusOf, commandOn, startRunner, statusOn };
}
