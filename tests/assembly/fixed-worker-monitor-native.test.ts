// @ts-nocheck -- native fixed-worker monitor (M2) wiring: builder-local OS observations.
// These run the real enforcer, guard, supervisor and owner service unprivileged on the
// running macOS build. They are NOT installed-host evidence: the installed monitor runs
// as root under launchd, where the memory limit is enforced and verified instead.
import { expect, it } from 'vitest';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync,
  symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { frame, unframe, createMonitorClient, createAttachedWorkerChannel, initializeJournal, OfflineJournal }
  from '../../scripts/fixed-native-worker-monitor.mjs';
import { createInstalledChannelNativeContextIO } from '../../src/assembly/production-native-context.js';

const darwin = process.platform === 'darwin';
const repo = process.cwd();
const ok = v => ({ type: 'Result', schemaVersion: 1, kind: 'Success', value: v });
const sha = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };   // observation only

function build(dir: string, defines: string[] = []) {
  const out = join(dir, 'rel', 'bin', 'instar-worker-enforcer');
  mkdirSync(join(dir, 'rel', 'bin'), { recursive: true });
  const cc = spawnSync('/usr/bin/clang', ['-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', ...defines,
    '-o', out, join(repo, 'scripts/fixed-native-worker-enforcer.c')], { encoding: 'utf8' });
  expect(cc.stderr).toBe('');
  expect(cc.status).toBe(0);
  return out;
}

function releaseRuntime(dir: string) {
  mkdirSync(join(dir, 'rel', 'runtime'), { recursive: true });
  const target = join(dir, 'rel', 'runtime', 'node');
  try { linkSync(realpathSync(process.execPath), target); } catch { symlinkSync(realpathSync(process.execPath), target); }
  return target;
}

/** The shipped deny-default profile, materialized exactly as the installer does. */
function shippedProfile(dir: string) {
  const rel = join(dir, 'rel'), slot = join(dir, 'slot');
  mkdirSync(slot, { recursive: true });
  const ancestors: string[] = [];
  for (let p = rel; p !== '/'; ) { p = dirname(p); ancestors.push(`(literal "${p}")`); }
  // test-only: when the temporary release lives on another volume than the runtime,
  // the runtime is a symlink and the sandbox judges its resolved path.
  const runtime = realpathSync(process.execPath);
  const profile = readFileSync(join(repo, 'deploy/macos/fixed-worker/worker.sb'), 'utf8')
    .replaceAll('@RELEASE_DIR@', rel).replaceAll('@SLOT_DIR@', slot)
    + `\n; test-only: ancestors of the temporary release path\n(allow file-read-metadata ${ancestors.join(' ')})\n`
    + `(allow process-exec (literal "${runtime}"))\n(allow file-read* file-map-executable (literal "${runtime}"))\n`;
  writeFileSync(join(rel, 'worker.sb'), profile);
  return join(rel, 'worker.sb');
}

const tempRoot = () => realpathSync(mkdtempSync(join(tmpdir(), 'instar-fwm-')));

function feasibility(enforcer: string, which: string, profile: string, dir: string, runtime = '') {
  mkdirSync(join(dir, 'scratch'), { recursive: true });
  const run = spawnSync(enforcer, ['feasibility', which, profile, join(dir, 'scratch'), runtime],
    { encoding: 'utf8', cwd: join(dir, 'slot'), timeout: 60_000 });
  const lines: Record<string, string> = {};
  for (const line of run.stdout.split('\n')) {
    const m = /^feasibility\.([a-z-]+)=(PASS|FAIL|UNVERIFIED) (.*)$/.exec(line);
    if (m) lines[m[1]] = `${m[2]} ${m[3]}`;
  }
  return { lines, status: run.status };
}

it.runIf(darwin)('CPU, identity-safe termination through the shipped exec chain, escape and every guard fault PASS under the shipped profile', () => {
  const dir = tempRoot();
  try {
    const enforcer = build(dir), profile = shippedProfile(dir), runtime = releaseRuntime(dir);
    const cpu = feasibility(enforcer, 'cpu', profile, dir);
    // The kernel's CPU-time limit: SIGXCPU stops the traced worker even though it
    // ignores the signal, and the guard (its parent) ends it.
    expect(cpu.lines.cpu).toMatch(/^PASS .*guard=33 .*signal=9/);
    const task = feasibility(enforcer, 'task', profile, dir, runtime);
    expect(task.lines.task).toMatch(/^PASS after bootstrap->sandbox-exec->.*guard=30 signal=9/);
    expect(task.lines['task-runtime']).toMatch(/^PASS after bootstrap->sandbox-exec->.*runtime\/node.*guard=30 signal=9/);
    expect(task.lines.escape).toMatch(/^PASS .*outcome=3/);
    const guard = feasibility(enforcer, 'guard', profile, dir);
    for (const fault of ['supervisor-kill', 'supervisor-stop', 'guard-kill', 'deadline'])
      expect(guard.lines[`guard-${fault}`], fault).toMatch(/^PASS worker ended=yes/);
    const gate = feasibility(enforcer, 'gate', profile, dir);
    expect(gate.lines.gate).toMatch(/^PASS .*guard=31/);
    expect(gate.lines['gate-refused']).toMatch(/^PASS .*guard=35/);
    expect(guard.status).toBe(0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 120_000);

it.runIf(darwin)('memory: an unprivileged guard refuses before release instead of running without its ceiling', () => {
  const dir = tempRoot();
  try {
    const enforcer = build(dir), profile = shippedProfile(dir);
    const run = feasibility(enforcer, 'memory', profile, dir);
    if (process.getuid!() === 0) {
      expect(run.lines.memory).toMatch(/^PASS .*signal=9/);
    } else {
      // Honest: the builder cannot install a fatal footprint limit; the verdict is
      // UNVERIFIED (never PASS) and the worker never started (35 = refused before release).
      expect(run.lines.memory).toMatch(/^UNVERIFIED requires-root: .*guard=35 started=0/);
      expect(run.status).toBe(1);
    }
    expect(run.lines['limit-raise']).toMatch(/^PASS /);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 60_000);

/** The installed per-slot configuration (administrator-owned in a real install). */
function writeConf(dir: string, overrides: Record<string, string> = {}) {
  const conf = join(dir, 'installation.conf');
  const values = { agent_uid: String(process.getuid!()), worker_uid: String(process.getuid!()),
    worker_gid: String(process.getgid!()), release_dir: join(dir, 'rel'), cpu_seconds: '30', memory_mib: '0',
    nofile: '256', max_lifetime_ms: '20000', ...overrides };
  writeFileSync(conf, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o644 });
  chmodSync(conf, 0o644);
  return conf;
}

/** A supervise build bound to a temporary installation (test build flags only). */
function installation(dir: string) {
  const socket = join(dir, 'run', 'control.sock');
  const conf = join(dir, 'installation.conf'), service = join(dir, 'service.json');
  const enforcer = build(dir, [`-DINSTAR_CONTROL_SOCKET="${socket}"`, `-DINSTAR_CONTROL_PEER_UID=${process.getuid!()}`,
    `-DINSTAR_INSTALL_CONF="${conf}"`, `-DINSTAR_SERVICE_CONF="${service}"`, '-DINSTAR_TEST_UNPRIVILEGED=1']);
  releaseRuntime(dir);
  shippedProfile(dir);
  mkdirSync(join(dir, 'rel', 'scripts'), { recursive: true });
  writeConf(dir);
  const keys = generateKeyPairSync('ed25519');
  writeFileSync(join(dir, 'key.pem'), keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const genesis = { installation: 'installation:test', machine: 'machine:test', journal: 'journal:test' };
  initializeJournal(join(dir, 'journal'), genesis);
  const digest = sha('release');
  writeFileSync(service, JSON.stringify({ installation: 'installation:test', machine: 'machine:test',
    keyId: 'key:test', privateKeyPath: join(dir, 'key.pem'), journal: join(dir, 'journal'), journalGenesis: genesis,
    digests: { releaseDigest: digest, artifactDigest: digest, profileDigest: digest, handlePolicyDigest: digest,
      limitsDigest: digest }, clockReference: 'clock:test', lifetimeMs: 3000 }), { mode: 0o644 });
  return { enforcer, socket, conf, service, keys, journal: join(dir, 'journal') };
}

async function startSupervisor(enforcer: string, socket: string) {
  const child = spawn(enforcer, ['supervise'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => { stderr += d; });
  for (let i = 0; i < 300 && !existsSync(socket) && child.exitCode === null; i++) await sleep(50);
  return { child, stderr: () => stderr };
}

const launchRequest = (tag: string) => ({ v: 1, method: 'launch', challenge: createHash('sha256').update(`c:${tag}`).digest('hex'),
  installation: 'installation:test', machine: 'machine:test',
  body: { request: `request:${tag}`, specification: `specification:${tag}`, claim: `claim:${tag}`,
    consumed: `consumed:${tag}`, operation: `operation:${tag}`, digest: sha(tag) } });
const observeRequest = (tag: string, launchIdentity: string) => ({ v: 1, method: 'observe',
  challenge: createHash('sha256').update(`o:${tag}:${Math.random()}`).digest('hex'),
  installation: 'installation:test', machine: 'machine:test',
  body: { request: `request:${tag}`, operation: `operation:${tag}`, digest: sha(tag), launchIdentity,
    observationAuthority: 'fact:query' } });

it.runIf(darwin)('supervise refuses without installed bindings and on an invalid or writable configuration', () => {
  const dir = tempRoot();
  try {
    const x = installation(dir);
    rmSync(x.conf);
    let run = spawnSync(x.enforcer, ['supervise'], { encoding: 'utf8' });
    expect(run.status).toBe(78);
    expect(run.stderr).toContain('owner bindings unavailable; refusing');
    for (const bad of [{ nofile: '0' }, { cpu_seconds: '-1' }, { release_dir: '/tmp/../etc' }, { max_lifetime_ms: 'x' }]) {
      writeConf(dir, bad);
      run = spawnSync(x.enforcer, ['supervise'], { encoding: 'utf8' });
      expect(run.status, JSON.stringify(bad)).toBe(78);
      expect(run.stderr).toContain('installed configuration invalid; refusing');
    }
    writeConf(dir);
    writeFileSync(x.conf, readFileSync(x.conf, 'utf8') + 'extra_key=1\n');
    expect(spawnSync(x.enforcer, ['supervise'], { encoding: 'utf8' }).status).toBe(78);
    writeConf(dir);
    expect(readFileSync(x.conf, 'utf8')).toContain('memory_mib=0');
    chmodSync(x.conf, 0o666);                                   // writable by others: not the administrator's
    run = spawnSync(x.enforcer, ['supervise'], { encoding: 'utf8' });
    expect(run.stderr).toContain('installed configuration invalid; refusing');
    expect(existsSync(x.socket)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 60_000);

it.runIf(darwin)('the installed owner service answers through supervise and refuses a launch for authority before any decision', async () => {
  const dir = tempRoot();
  const x = installation(dir);
  symlinkSync(join(repo, 'scripts', 'fixed-native-worker-monitor.mjs'), join(dir, 'rel', 'scripts', 'fixed-native-worker-monitor.mjs'));
  const sup = await startSupervisor(x.enforcer, x.socket);
  try {
    expect(existsSync(x.socket), sup.stderr()).toBe(true);
    const client = createMonitorClient(x.enforcer);
    const reply = unframe(Buffer.from(client.roundTrip(frame(launchRequest('a')))));
    // The genuine service with its installed bindings; its owner context is not
    // installed on this base, so the launch refuses before any dispatch decision.
    expect(reply.receipt).toMatchObject({ state: 'refused-before-release', reason: 'authority', pid: null });
    expect(new OfflineJournal(x.journal, undefined, { established: true }).entries.map(e => e.kind)).toEqual(['initialized']);
  } finally { sup.child.kill('SIGKILL'); rmSync(dir, { recursive: true, force: true }); }
}, 60_000);

it.runIf(darwin)('the owner service refuses to start with a group-writable binding, and supervise refuses with it', async () => {
  const dir = tempRoot();
  const x = installation(dir);
  symlinkSync(join(repo, 'scripts', 'fixed-native-worker-monitor.mjs'), join(dir, 'rel', 'scripts', 'fixed-native-worker-monitor.mjs'));
  chmodSync(x.service, 0o666);
  try {
    const run = spawnSync(x.enforcer, ['supervise'], { encoding: 'utf8', timeout: 30_000 });
    expect(run.status).toBe(78);
    expect(run.stderr).toContain('owner service refused its installed bindings');
    expect(existsSync(x.socket)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 60_000);

// SYNTHETIC owner context: a stand-in for the installed reader (lane A / R4 / R6 are not
// installed on this base). Everything else is genuine: the M1 service and journal, the
// native release leaf, supervise, the guard, the traced worker and the channel adapter.
// The slot uses a permissive profile so the worker can load the repository's modules;
// the shipped deny-default profile is proven by the feasibility cases above.
function stubService(dir: string) {
  const module = join(repo, 'scripts', 'fixed-native-worker-monitor.mjs');
  writeFileSync(join(dir, 'rel', 'scripts', 'fixed-native-worker-monitor.mjs'), `
import { createSupervisorLink, createNativeRelease, serveMonitor, createMonitorService, OfflineJournal,
  runLoadingWorker } from ${JSON.stringify(module)};
import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [,, mode, a, b] = process.argv;
if (mode === 'loading-worker') { try { process.exitCode = runLoadingWorker({ handle: a, delivery: b }); } catch { process.exitCode = 3; } }
if (mode === 'service') {
  const conf = JSON.parse(readFileSync(a, 'utf8'));
  const ok = v => ({ type: 'Result', schemaVersion: 1, kind: 'Success', value: v });
  const link = createSupervisorLink(3);
  const now = () => Date.now();
  const service = createMonitorService({ installation: conf.installation, machine: conf.machine, bootId: b,
    digests: conf.digests, clockReference: conf.clockReference, now, keyId: conf.keyId,
    privateKey: createPrivateKey(readFileSync(conf.privateKeyPath)),
    journal: new OfflineJournal(conf.journal, 1 << 24, { established: true }), journalGenesis: conf.journalGenesis,
    context: { resolveLaunch: l => ok({ bundle: 'bundle:' + l.request, operation: l.operation }),
      recheck: c => ok(c), resolveObservation: () => ok({}) },
    release: createNativeRelease({ link, bootId: b, lifetimeMs: conf.lifetimeMs, clockReference: conf.clockReference, now }) });
  link.writeLine('READY');
  serveMonitor({ link, service });
}
`);
  writeFileSync(join(dir, 'rel', 'worker.sb'), '(version 1)\n(allow default)\n');
}

it.runIf(darwin)('one accounted slot: launch, slot bound, one owner attach with progress heartbeat, delivery, deadline, lapse and supervisor death', async () => {
  const dir = tempRoot();
  const x = installation(dir);
  stubService(dir);
  let sup = await startSupervisor(x.enforcer, x.socket);
  try {
    expect(existsSync(x.socket), sup.stderr()).toBe(true);
    const client = createMonitorClient(x.enforcer);
    const ask = (request: any) => unframe(Buffer.from(client.roundTrip(frame(request)))).receipt;
    const settle = async (tag: string, identity: string) => {
      for (let i = 0; i < 100; i++) { const r = ask(observeRequest(tag, identity)); if (r.state !== 'running') return r; await sleep(100); }
      return null;
    };

    // Positive: one worker under the installed limits, attributable to its guard.
    const first = ask(launchRequest('one'));
    expect(first).toMatchObject({ state: 'running', reason: 'ok', uid: process.getuid!() });
    expect(first.pid).toBeGreaterThan(0);
    expect(first.processStartIdentity.uniqueId).toMatch(/^[0-9]+$/);
    expect(first.evidenceReferences).toEqual([`native-guard:${first.launchIdentity}`]);
    // Per-slot bound: a second launch while the slot is occupied is never started.
    const second = ask(launchRequest('two'));
    expect(second).toMatchObject({ state: 'unknown', reason: 'guard-lost', pid: null });

    // The owner attaches once and serves the one admitted delivery through the
    // genuine channel adapter; its progress is the guard heartbeat.
    const channel = createAttachedWorkerChannel(x.enforcer, first.launchIdentity);
    const io = createInstalledChannelNativeContextIO({ io: channel.io, identity: first.launchIdentity,
      artifact: sha('artifact'), handle: first.launchIdentity, currency: () => ok(true),
      deadline: channel.io.now() + 2500, progress: channel.progress });
    const payload = JSON.stringify({ text: 'x'.repeat(70_000) });
    const readback = io.consume('native-context:operation:one', payload);
    expect(readback.digest).toBe(sha(payload));
    const done = await settle('one', first.launchIdentity);
    expect(done).toMatchObject({ state: 'exited', reason: 'worker-exit' });
    channel.close();

    // Deadline: nobody attaches; the guard ends the worker at its immutable deadline.
    const idle = ask(launchRequest('idle'));
    expect(idle.state).toBe('running');
    expect(await settle('idle', idle.launchIdentity)).toMatchObject({ state: 'expired', reason: 'deadline' });

    // Lapse: the owner attaches and then stops making progress; the heartbeat stops
    // and the guard ends the worker within the lapse, well before the deadline.
    const stalled = ask(launchRequest('stalled'));
    const quiet = createAttachedWorkerChannel(x.enforcer, stalled.launchIdentity);
    // While the owner keeps making progress, a second attach (a reconnect) is refused.
    const beat = setInterval(() => quiet.progress(), 40);
    await sleep(100);
    const dup = createAttachedWorkerChannel(x.enforcer, stalled.launchIdentity);
    await sleep(400);
    expect(dup.exited()).toBe(true);
    expect(quiet.exited()).toBe(false);
    clearInterval(beat);
    const t0 = Date.now();
    const lapsed = await settle('stalled', stalled.launchIdentity);
    expect(lapsed).toMatchObject({ state: 'stopped', reason: 'guard-lost' });
    expect(Date.now() - t0).toBeLessThan(2500);
    quiet.close();

    // Supervisor death: the guard sees its link close and ends the worker.
    const last = ask(launchRequest('last'));
    expect(alive(last.pid)).toBe(true);
    sup.child.kill('SIGKILL');
    let gone = false;
    for (let i = 0; i < 40 && !gone; i++) { await sleep(50); gone = !alive(last.pid); }
    expect(gone).toBe(true);
  } finally { sup.child.kill('SIGKILL'); rmSync(dir, { recursive: true, force: true }); }
}, 120_000);

// ---- the reviewed installation package: stage, install dry run, uninstall, verify ----
// Dry runs only (synthetic inventory); `--apply` is the operator's administrator path.
const provisionScript = join(repo, 'scripts', 'provision-fixed-native-worker.sh');
function provisionRun(args: string[], inventory?: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'instar-provision-'));
  try {
    const extra: string[] = [];
    if (inventory) { writeFileSync(join(dir, 'inventory'), inventory.join('\n') + '\n'); extra.push('--inventory', join(dir, 'inventory')); }
    const run = spawnSync('/bin/bash', [provisionScript, ...args, ...extra, '--agent-user', 'agent'], { encoding: 'utf8', env: {} });
    return { status: run.status, out: run.stdout, err: run.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const workerAttrs = 'uid=499;gid=499;shell=/usr/bin/false;home=/private/var/instar-worker/home;hidden=1;auth=none;password=*;groups=_instar_worker+everyone+localaccounts';
const accountsHost = ['os_name=Darwin', 'os_version=26.5', 'os_build=25F84', 'arch=arm64',
  'users=root:0,agent:501,_instar_worker:499,', 'groups=wheel:0,staff:20,_instar_worker:499,', 'agent_groups=staff',
  `worker_attrs=${workerAttrs}`, ...['/private/var/instar-worker|Directory|root|wheel|755',
    '/private/var/instar-worker/home|Directory|root|wheel|755', '/private/var/instar-worker/slot-0|Directory|root|wheel|755',
    '/Library/Instar2|Directory|root|wheel|755', '/Library/Instar2/m4-launch|Directory|root|wheel|755',
    '/Library/Instar2/m4-launch/releases|Directory|root|wheel|755', '/Library/Instar2/m4-launch/keys|Directory|root|wheel|700',
    '/private/var/db/instar2-worker|Directory|root|wheel|700', '/Library/Instar2/.accounts-ledger|Regular File|root|wheel|600']
    .map(row => `path=${row}`)];
const limits = ['--cpu-seconds', '60', '--memory-mib', '2048', '--nofile', '256', '--lifetime-ms', '600000', '--max-lifetime-ms', '900000'];
const field = (out: string, key: string) => out.split('\n').find(line => line.startsWith(`${key}=`))?.slice(key.length + 1);
const stepBytes = (out: string, path: string) => {
  const step = out.split('\n').find(line => line.startsWith(`plan.step=write-file ${path} `));
  return step ? Buffer.from(step.split(' ')[3], 'hex').toString('utf8') : undefined;
};

it.runIf(darwin)('stage builds one reproducible content-addressed release; install is a digest-bound dry run of exact bytes', () => {
  const dir = tempRoot();
  try {
    writeFileSync(join(dir, 'runtime'), '#!/bin/sh\nexit 0\n');
    const stage = () => provisionRun(['stage', '--out', dir, '--runtime', join(dir, 'runtime'), ...limits]);
    const first = stage();
    expect(first.status, first.err).toBe(0);
    const release = field(first.out, 'stage.release')!;
    expect(release).toMatch(/^[0-9a-f]{64}$/);
    const staged = join(dir, release);
    expect(createHash('sha256').update(readFileSync(join(staged, 'MANIFEST'))).digest('hex')).toBe(release);
    expect(readFileSync(join(staged, 'MANIFEST'), 'utf8')).toMatch(/ bin\/instar-worker-enforcer\n/);
    // Reproducible: the same reviewed checkout and inputs name the same release.
    expect(field(stage().out, 'stage.release')).toBe(release);
    expect(provisionRun(['stage', '--out', dir, '--runtime', join(dir, 'runtime'), ...limits.slice(0, 8), '--max-lifetime-ms', '1000']).err)
      .toContain('--lifetime-ms must be in');
    expect(provisionRun(['stage', '--out', dir, '--apply', ...limits]).err).toContain('never installs anything');

    const args = ['install', '--release', staged, '--installation', 'installation:studio', '--machine', 'machine:studio'];
    const plan = provisionRun(args, accountsHost);
    expect(plan.status, plan.err).toBe(0);
    expect(plan.out).toContain('result=dry-run (nothing changed)');
    const rel = `/Library/Instar2/m4-launch/releases/${release}`;
    expect(stepBytes(plan.out, '/Library/Instar2/m4-launch/installation.conf')).toBe(['agent_uid=501', 'worker_uid=499',
      'worker_gid=499', `release_dir=${rel}`, 'cpu_seconds=60', 'memory_mib=2048', 'nofile=256', 'max_lifetime_ms=900000', ''].join('\n'));
    const profile = stepBytes(plan.out, `${rel}/worker.sb`)!;
    expect(profile).toContain(`(literal "${rel}/runtime/node")`);
    expect(profile).not.toMatch(/@[A-Z_]+@/);
    expect(stepBytes(plan.out, '/Library/LaunchDaemons/ai.instar.worker-monitor.plist')).toContain(`<string>${rel}/bin/instar-worker-enforcer</string>`);
    const service = JSON.parse(stepBytes(plan.out, '/Library/Instar2/m4-launch/service.json')!);
    expect(service).toMatchObject({ installation: 'installation:studio', machine: 'machine:studio', lifetimeMs: 600000,
      privateKeyPath: '/Library/Instar2/m4-launch/keys/receipt.key', journal: '/private/var/db/instar2-worker/journal',
      journalGenesis: { installation: 'installation:studio', machine: 'machine:studio', journal: 'journal:installation:studio' } });
    expect(service.digests.releaseDigest).toBe(`sha256:${release}`);
    expect(service.digests.profileDigest).toBe(sha(profile));
    const steps = plan.out.split('\n').filter(line => line.startsWith('plan.step=')).map(line => line.split(' ')[0]);
    expect(steps).toEqual(['plan.step=copy-release', 'plan.step=write-file', 'plan.step=write-file', 'plan.step=keygen',
      'plan.step=write-file', 'plan.step=journal-init', 'plan.step=write-file', 'plan.step=launchctl-bootstrap']);
    expect(field(provisionRun(args, accountsHost).out, 'plan.digest')).toBe(field(plan.out, 'plan.digest'));
    // Refusals: synthetic --apply, missing inputs, unprovisioned accounts, tampered release, existing key kept.
    expect(provisionRun([...args, '--apply'], accountsHost).err).toContain('never accepts a synthetic inventory');
    expect(provisionRun(args.slice(0, 5), accountsHost).err).toContain('--machine must be a plain identifier');
    expect(provisionRun(args, accountsHost.filter(row => !row.includes('accounts-ledger'))).err).toContain('accounts stage is not provisioned');
    const kept = provisionRun(args, [...accountsHost, 'path=/Library/Instar2/m4-launch/keys/receipt.key|Regular File|root|wheel|600']);
    expect(kept.out).not.toContain('plan.step=keygen');
    writeFileSync(join(staged, 'scripts', 'fixed-native-worker-monitor.mjs'), '// replaced\n');
    expect(provisionRun(args, accountsHost).err).toContain('release content does not match its MANIFEST');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 120_000);

it('uninstall removes only the installed release and its files, never keys or journal; verify checks the installed monitor', () => {
  const rel = `/Library/Instar2/m4-launch/releases/${'ab'.repeat(32)}`;
  const installed = [...accountsHost, `installed_release=${rel}`, ...[
    '/Library/LaunchDaemons/ai.instar.worker-monitor.plist|Regular File|root|wheel|644',
    '/Library/Instar2/m4-launch/installation.conf|Regular File|root|wheel|644',
    '/Library/Instar2/m4-launch/service.json|Regular File|root|wheel|644',
    '/Library/Instar2/m4-launch/keys/receipt.key|Regular File|root|wheel|600',
    '/private/var/db/instar2-worker/journal|Regular File|root|wheel|600'].map(row => `path=${row}`)];
  const plan = provisionRun(['uninstall'], installed);
  expect(plan.status, plan.err).toBe(0);
  const steps = plan.out.split('\n').filter(line => line.startsWith('plan.step='));
  expect(steps).toEqual(['plan.step=launchctl-bootout', 'plan.step=rm-file /Library/LaunchDaemons/ai.instar.worker-monitor.plist',
    'plan.step=rm-file /Library/Instar2/m4-launch/service.json', 'plan.step=rm-file /Library/Instar2/m4-launch/installation.conf',
    `plan.step=rm-release ${rel}`]);
  expect(provisionRun(['uninstall'], installed.map(row => row.startsWith('installed_release=') ? 'installed_release=/etc' : row)).err)
    .toContain('installed release unreadable');
  const verified = provisionRun(['verify'], installed);
  expect(verified.status).toBe(0);
  expect(verified.out).toContain('verify.monitor=ok');
  expect(verified.out).toContain('verify.monitor.production-launch=refusing');
  const loose = provisionRun(['verify'], installed.map(row => row.replace('installation.conf|Regular File|root|wheel|644',
    'installation.conf|Regular File|root|wheel|666')));
  expect(loose.status).toBe(1);
  expect(loose.out).toContain('verify.monitor.conf=FAIL');
  expect(provisionRun(['accounts-rollback', '--uid', '499', '--gid', '499'], installed).err).toContain('uninstall it first');
});

it('the installation steps create an owner-only receipt key and the established journal once, and never over existing ones', () => {
  const dir = tempRoot();
  try {
    const enforcer = build(dir);
    const node = (...args: string[]) => spawnSync(process.execPath, [join(repo, 'scripts', 'fixed-native-worker-monitor.mjs'), ...args],
      { encoding: 'utf8' });
    expect(node('keygen', join(dir, 'receipt.key'), join(dir, 'receipt.pub')).status).toBe(0);
    expect(spawnSync('/usr/bin/stat', ['-f', '%Lp', join(dir, 'receipt.key')], { encoding: 'utf8' }).stdout.trim()).toBe('600');
    expect(spawnSync('/usr/bin/stat', ['-f', '%Lp', join(dir, 'receipt.pub')], { encoding: 'utf8' }).stdout.trim()).toBe('644');
    const before = readFileSync(join(dir, 'receipt.key'));
    expect(node('keygen', join(dir, 'receipt.key'), join(dir, 'other.pub')).status).toBe(2);
    expect(readFileSync(join(dir, 'receipt.key'))).toEqual(before);
    expect(node('journal-init', join(dir, 'journal'), 'installation:t', 'machine:t', 'journal:t', enforcer).status).toBe(0);
    const journal = new OfflineJournal(join(dir, 'journal'), undefined, { established: true });
    expect(journal.entries).toEqual([{ sequence: 1, kind: 'initialized', identity: 'journal:t',
      value: { installation: 'installation:t', machine: 'machine:t', journal: 'journal:t' } }]);
    expect(node('journal-init', join(dir, 'journal'), 'installation:t', 'machine:t', 'journal:t', enforcer).status).toBe(2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 60_000);
