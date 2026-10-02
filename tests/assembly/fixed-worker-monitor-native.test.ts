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
    for (const fault of ['supervisor-kill', 'supervisor-stop', 'guard-kill', 'deadline', 'guard-stop'])
      expect(guard.lines[`guard-${fault}`], fault).toMatch(/^PASS worker ended=yes/);
    // Both sides of every supervisor backstop bound (stopped guard, deadline, owner lapse).
    expect(guard.lines['guard-backstop']).toMatch(/^PASS .*250ms past the deadline, or 600ms after the last owner/);
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
    // On every host: the -O2 probe really consumes what it touches (the kernel's
    // footprint, not the request), and the one verdict expression rejects every
    // SIGKILL neighbor: a real outside kill (exit detail 0), real deadline (30) and
    // lapse (31) kills, a memory setup failure (34), a refusal and a finished run.
    expect(run.lines['memory-consumes']).toMatch(/^PASS .*outcome=10 /);
    expect(run.lines['memory-attribution']).toMatch(/^PASS outside-kill\(guard=0 signal=9 detail=0\) deadline\(guard=30\) lapse\(guard=31\) .*all rejected=yes; a memorystatus kill is accepted=yes/);
    if (process.getuid!() === 0) {
      expect(run.lines.memory).toMatch(/^PASS .*guard=0 signal=9 exit-detail=0x2/);
      expect(run.lines['memory-control']).toMatch(/^PASS .*outcome=10/);
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
  const restarts = join(dir, 'supervisor-restarts');
  const enforcer = build(dir, [`-DINSTAR_CONTROL_SOCKET="${socket}"`, `-DINSTAR_CONTROL_PEER_UID=${process.getuid!()}`,
    `-DINSTAR_INSTALL_CONF="${conf}"`, `-DINSTAR_SERVICE_CONF="${service}"`, '-DINSTAR_TEST_UNPRIVILEGED=1',
    `-DINSTAR_RESTART_STATE="${restarts}"`, '-DINSTAR_STABLE_MS=400']);
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
  return { enforcer, socket, conf, service, keys, journal: join(dir, 'journal'), restarts };
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
    // Each refusal below is one start; clearing the restart record keeps it from settling.
    const supervise = () => { rmSync(x.restarts, { force: true }); return spawnSync(x.enforcer, ['supervise'], { encoding: 'utf8' }); };
    rmSync(x.conf);
    let run = supervise();
    expect(run.status).toBe(78);
    expect(run.stderr).toContain('owner bindings unavailable; refusing');
    for (const bad of [{ nofile: '0' }, { cpu_seconds: '-1' }, { release_dir: '/tmp/../etc' }, { max_lifetime_ms: 'x' }]) {
      writeConf(dir, bad);
      run = supervise();
      expect(run.status, JSON.stringify(bad)).toBe(78);
      expect(run.stderr).toContain('installed configuration invalid; refusing');
    }
    writeConf(dir);
    writeFileSync(x.conf, readFileSync(x.conf, 'utf8') + 'extra_key=1\n');
    expect(supervise().status).toBe(78);
    writeConf(dir);
    expect(readFileSync(x.conf, 'utf8')).toContain('memory_mib=0');
    chmodSync(x.conf, 0o666);                                   // writable by others: not the administrator's
    run = supervise();
    expect(run.stderr).toContain('installed configuration invalid; refusing');
    expect(existsSync(x.socket)).toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 60_000);

// launchd's policy for this job (KeepAlive SuccessfulExit=false): start again only
// after an unsuccessful exit. Emulated here with a hard cap far above the breaker's.
function launchdRestarts(enforcer: string, cap = 30) {
  const exits: number[] = [];
  for (let i = 0; i < cap; i++) {
    const run = spawnSync(enforcer, ['supervise'], { encoding: 'utf8', timeout: 30_000 });
    exits.push(run.status!);
    if (run.status === 0) return { exits, last: run };
  }
  return { exits, last: null };
}

it.runIf(darwin)('the supervisor settles: sustained failure stops restarting after five starts; a stable start resets the count', async () => {
  const dir = tempRoot();
  try {
    const x = installation(dir);
    symlinkSync(join(repo, 'scripts', 'fixed-native-worker-monitor.mjs'), join(dir, 'rel', 'scripts', 'fixed-native-worker-monitor.mjs'));
    // The shipped job restarts only after an unsuccessful exit, never unconditionally.
    const plist = JSON.parse(spawnSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-',
      join(repo, 'deploy/macos/fixed-worker/ai.instar.worker-monitor.plist')], { encoding: 'utf8' }).stdout);
    expect(plist.KeepAlive).toEqual({ SuccessfulExit: false });

    // Permanent invalid bindings: five refusing starts, then a successful exit that
    // launchd does not restart, and every later start stays settled.
    rmSync(x.conf);
    let settled = launchdRestarts(x.enforcer);
    expect(settled.exits).toEqual([78, 78, 78, 78, 78, 0]);
    expect(settled.last!.stderr).toContain('restart breaker open');
    expect(readFileSync(x.restarts, 'utf8')).toBe('terminal\n');
    writeConf(dir);                                            // even a repaired config stays settled
    expect(launchdRestarts(x.enforcer).exits).toEqual([0]);
    expect(existsSync(x.socket)).toBe(false);

    // Permanent owner-service failure: the same five starts, then settled.
    rmSync(x.restarts);
    chmodSync(x.service, 0o666);
    settled = launchdRestarts(x.enforcer);
    expect(settled.exits).toEqual([78, 78, 78, 78, 78, 0]);
    chmodSync(x.service, 0o644);

    // An unusable record (foreign link, group-writable) is terminal, never a reset.
    rmSync(x.restarts);
    symlinkSync(join(dir, 'elsewhere'), x.restarts);
    expect(launchdRestarts(x.enforcer).exits).toEqual([0]);
    rmSync(x.restarts);
    writeFileSync(x.restarts, '2\n', { mode: 0o664 });
    chmodSync(x.restarts, 0o664);
    expect(launchdRestarts(x.enforcer).exits).toEqual([0]);

    // Working-start neighbor: after four failures a good start runs, serves, and once
    // stable (400 ms in this build) resets the count to zero.
    rmSync(x.restarts);
    writeFileSync(x.restarts, '4\n', { mode: 0o600 });
    const sup = await startSupervisor(x.enforcer, x.socket);
    try {
      expect(existsSync(x.socket), sup.stderr()).toBe(true);
      expect(readFileSync(x.restarts, 'utf8')).toBe('5\n');      // counted before it ran
      for (let i = 0; i < 40 && readFileSync(x.restarts, 'utf8') !== '0\n'; i++) await sleep(50);
      expect(readFileSync(x.restarts, 'utf8')).toBe('0\n');
    } finally { sup.child.kill('SIGKILL'); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 120_000);

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
    // The stated owner bound is 600 ms from the last authority check (two serial
    // 250 ms timers plus beat slack, backstopped by the supervisor); observe the
    // worker's end directly, with scheduling margin.
    let ended = 0;
    for (let i = 0; i < 300 && !ended; i++) { await sleep(5); if (!alive(stalled.pid)) ended = Date.now() - t0; }
    expect(ended).toBeGreaterThan(0);
    expect(ended).toBeLessThan(1000);
    const lapsed = await settle('stalled', stalled.launchIdentity);
    expect(lapsed).toMatchObject({ state: 'stopped', reason: 'guard-lost' });
    quiet.close();

    // A stopped guard: the supervisor's slot loop kills its own unreaped guard child,
    // and the kernel ends the traced worker, long before its deadline. Neighbor: the
    // running guards above were never killed by the backstop (their reasons are the
    // guard's own: worker-exit, deadline, lapse).
    const held = ask(launchRequest('held'));
    expect(held.state).toBe('running');
    const guardPid = Number(spawnSync('/bin/ps', ['-o', 'ppid=', '-p', String(held.pid)], { encoding: 'utf8' }).stdout.trim());
    expect(guardPid).toBeGreaterThan(1);
    const s0 = Date.now();
    process.kill(guardPid, 'SIGSTOP');                          // test fault on our own test process tree
    let stoppedEnd = 0;
    for (let i = 0; i < 200 && !stoppedEnd; i++) { await sleep(5); if (!alive(held.pid)) stoppedEnd = Date.now() - s0; }
    expect(stoppedEnd).toBeGreaterThan(0);
    expect(stoppedEnd).toBeLessThan(1000);
    expect(await settle('held', held.launchIdentity)).toMatchObject({ state: 'unknown', reason: 'guard-lost' });

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
    // The release digest also binds the installer that installs it.
    expect(readFileSync(join(staged, 'MANIFEST'), 'utf8')).toMatch(/ scripts\/provision-fixed-native-worker\.sh\n/);
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
    expect(steps).toEqual(['plan.step=place-release', 'plan.step=write-file', 'plan.step=write-file', 'plan.step=keygen',
      'plan.step=write-file', 'plan.step=journal-init', 'plan.step=write-file', 'plan.step=launchctl-bootstrap']);
    expect(plan.out).toContain(`plan.step=place-release ${release}\n`);       // source path is not part of the plan
    // The receipt public key is the agent-side owner's trust reference (S8), so it lands
    // beside service.json in the world-traversable package folder, never inside the
    // root-only (0700) keys folder the agent account cannot enter.
    expect(plan.out).toContain(`plan.step=keygen ${rel} /Library/Instar2/m4-launch/keys/receipt.key /Library/Instar2/m4-launch/receipt.pub\n`);
    expect(field(provisionRun(args, accountsHost).out, 'plan.digest')).toBe(field(plan.out, 'plan.digest'));
    // Refusals: synthetic --apply, missing inputs, unprovisioned accounts, tampered release, existing key kept.
    expect(provisionRun([...args, '--apply'], accountsHost).err).toContain('never accepts a synthetic inventory');
    expect(provisionRun(args.slice(0, 5), accountsHost).err).toContain('--machine must be a plain identifier');
    expect(provisionRun(args, accountsHost.filter(row => !row.includes('accounts-ledger'))).err).toContain('accounts stage is not provisioned');
    // Keys and the journal are kept at run time when present, so the reviewed digest does
    // not depend on what an unprivileged dry run cannot see inside root-only folders.
    const kept = provisionRun(args, [...accountsHost, 'path=/Library/Instar2/m4-launch/keys/receipt.key|Regular File|root|wheel|600']);
    expect(field(kept.out, 'plan.digest')).toBe(field(plan.out, 'plan.digest'));
    // A loaded service, an unreadable service state or a leftover restart record refuse.
    expect(provisionRun(args, [...accountsHost, 'service_state=loaded']).err).toContain('service is already loaded');
    expect(provisionRun(args, [...accountsHost, 'service_state=query-failed:5']).err).toContain('could not be read');
    expect(provisionRun(args, [...accountsHost, 'path=/private/var/db/instar2-worker/supervisor-restarts|Regular File|root|wheel|600']).err)
      .toContain('already present: /private/var/db/instar2-worker/supervisor-restarts');
    expect(plan.out).toMatch(/plan\.recovery=if a step fails: nothing was activated; reverse what was written with uninstall/);
    expect(plan.out).not.toContain('accounts-rollback');
    writeFileSync(join(staged, 'scripts', 'fixed-native-worker-monitor.mjs'), '// replaced\n');
    expect(provisionRun(args, accountsHost).err).toContain('release content does not match its MANIFEST');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 120_000);

it('uninstall removes only the installed release and its files, never keys or journal; verify checks the installed monitor', () => {
  const rel = `/Library/Instar2/m4-launch/releases/${'ab'.repeat(32)}`;
  const installed = [...accountsHost, `installed_release=${rel}`, 'service_state=loaded', ...[
    '/Library/LaunchDaemons/ai.instar.worker-monitor.plist|Regular File|root|wheel|644',
    '/Library/Instar2/m4-launch/installation.conf|Regular File|root|wheel|644',
    '/Library/Instar2/m4-launch/service.json|Regular File|root|wheel|644',
    '/Library/Instar2/m4-launch/keys/receipt.key|Regular File|root|wheel|600',
    '/Library/Instar2/m4-launch/receipt.pub|Regular File|root|wheel|644',
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
  expect(verified.out).toContain('verify.monitor.receipt-pub=ok');
  // The agent-side trust reference must exist and be readable by the agent account.
  for (const broken of [installed.filter(row => !row.includes('receipt.pub')),
    installed.map(row => row.replace('receipt.pub|Regular File|root|wheel|644', 'receipt.pub|Regular File|root|wheel|600'))]) {
    const out = provisionRun(['verify'], broken);
    expect(out.status).toBe(1);
    expect(out.out).toContain('verify.monitor.receipt-pub=FAIL');
  }
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

// ---- partial installation is reversible by uninstall (MF5) ----
// Synthetic inventories of the exact cuts install can stop at. Keys and journal are
// history and are never planned for removal; the service is booted out only when
// launchd reports it loaded, and an unreadable service state plans nothing.
it('uninstall reverses every partial install cut and refuses an unreadable service state', () => {
  const rel = `/Library/Instar2/m4-launch/releases/${'cd'.repeat(32)}`;
  const row = (path: string, mode = 644) => `path=${path}|Regular File|root|wheel|${mode}`;
  const conf = row('/Library/Instar2/m4-launch/installation.conf'), service = row('/Library/Instar2/m4-launch/service.json');
  const plistRow = row('/Library/LaunchDaemons/ai.instar.worker-monitor.plist');
  const history = [row('/Library/Instar2/m4-launch/keys/receipt.key', 600), row('/private/var/db/instar2-worker/journal', 600)];
  const stepsOf = (out: string) => out.split('\n').filter(line => line.startsWith('plan.step=')).map(line => line.slice(10));

  // Release copied only (the custody copy, or a stop before installation.conf): named by --release.
  let plan = provisionRun(['uninstall', '--release', rel], accountsHost);
  expect(plan.status, plan.err).toBe(0);
  expect(stepsOf(plan.out)).toEqual([`rm-release ${rel}`]);
  expect(plan.out).toContain('plan.recovery=if a step fails: the steps before it completed');
  expect(plan.out).not.toContain('accounts-rollback');
  expect(provisionRun(['uninstall', '--release', '/tmp/x'], accountsHost).err).toContain('--release must be');

  // Pre-plist cut: release, configuration, key, service.json and journal, no plist, nothing loaded.
  plan = provisionRun(['uninstall'], [...accountsHost, `installed_release=${rel}`, conf, service, ...history]);
  expect(plan.status, plan.err).toBe(0);
  expect(stepsOf(plan.out)).toEqual(['rm-file /Library/Instar2/m4-launch/service.json',
    'rm-file /Library/Instar2/m4-launch/installation.conf', `rm-release ${rel}`]);
  expect(provisionRun(['uninstall', '--release', `/Library/Instar2/m4-launch/releases/${'ef'.repeat(32)}`],
    [...accountsHost, `installed_release=${rel}`, conf]).err).toContain('--release differs from the release named');

  // Failed-bootstrap cut: every file written, the service never loaded: no bootout step.
  plan = provisionRun(['uninstall'], [...accountsHost, `installed_release=${rel}`, conf, service, plistRow, ...history,
    'service_state=absent']);
  expect(stepsOf(plan.out)).toEqual(['rm-file /Library/LaunchDaemons/ai.instar.worker-monitor.plist',
    'rm-file /Library/Instar2/m4-launch/service.json', 'rm-file /Library/Instar2/m4-launch/installation.conf', `rm-release ${rel}`]);

  // Loaded service with a settled restart breaker: bootout first, the record removed, history kept.
  plan = provisionRun(['uninstall'], [...accountsHost, `installed_release=${rel}`, conf, service, plistRow, ...history,
    'service_state=loaded', row('/private/var/db/instar2-worker/supervisor-restarts', 600)]);
  expect(stepsOf(plan.out)).toEqual(['launchctl-bootout', 'rm-file /Library/LaunchDaemons/ai.instar.worker-monitor.plist',
    'rm-file /Library/Instar2/m4-launch/service.json', 'rm-file /Library/Instar2/m4-launch/installation.conf',
    'rm-file /private/var/db/instar2-worker/supervisor-restarts', `rm-release ${rel}`]);
  expect(plan.out).not.toMatch(/plan\.step=.*(receipt\.key|journal)/);

  // A failed service query is not absence: nothing is planned.
  const failed = provisionRun(['uninstall'], [...accountsHost, `installed_release=${rel}`, conf, plistRow, 'service_state=query-failed:5']);
  expect(failed.status).toBe(2);
  expect(failed.err).toContain('service state could not be read');
  expect(failed.out).not.toContain('plan.step=');
});

// ---- the operator's one administrative command (MF4) ----
const custodyRoot = '/Library/Instar2/m4-launch/releases';
/** Run the printed command unprivileged: the custody root becomes a temporary folder and
 * the root-only ownership step is the one thing removed (test-only substitution). */
function runCustody(command: string, custody: string) {
  expect(command.startsWith('sudo /usr/bin/env -i /bin/bash -c ')).toBe(true);
  const unprivileged = command.slice('sudo '.length).replaceAll(custodyRoot, custody)
    .replace('/usr/sbin/chown -R root:wheel "$R"; ', '');
  return spawnSync('/bin/sh', ['-c', unprivileged], { encoding: 'utf8', env: {}, timeout: 120_000 });
}

it.runIf(darwin)('the one command copies into custody, verifies against the reviewed digest before running anything, then runs the verified installer', () => {
  const dir = tempRoot();
  try {
    writeFileSync(join(dir, 'runtime'), '#!/bin/sh\nexit 0\n');
    mkdirSync(join(dir, 'out'));
    const stage = provisionRun(['stage', '--out', join(dir, 'out'), '--runtime', join(dir, 'runtime'), ...limits]);
    expect(stage.status, stage.err).toBe(0);
    const release = field(stage.out, 'stage.release')!, staged = join(dir, 'out', release);
    const digest = `sha256:${'1'.repeat(64)}`;
    const args = ['admin-command', '--release', staged, '--installation', 'installation:studio', '--machine', 'machine:studio',
      '--plan-digest', digest];
    // Refusals: no independently recorded digest, a different one, no plan digest, --apply.
    expect(provisionRun(args).err).toContain('--reviewed-release must be the independently recorded reviewed digest');
    expect(provisionRun([...args, '--reviewed-release', `sha256:${'0'.repeat(64)}`]).err).toContain('must name this staged release');
    expect(provisionRun([...args.slice(0, 7), '--reviewed-release', `sha256:${release}`]).err).toContain('needs the reviewed install --plan-digest');
    expect(provisionRun([...args, '--reviewed-release', `sha256:${release}`, '--apply']).err).toContain('only prints');
    const printed = provisionRun([...args, '--reviewed-release', `sha256:${release}`]);
    expect(printed.status, printed.err).toBe(0);
    const command = field(printed.out, 'admin.command')!;
    // Before the verified installer, only fixed system tools run.
    const prelude = command.slice(0, command.indexOf('exec /bin/bash'));
    const tools = new Set([...prelude.matchAll(/\/(?:usr\/)?s?bin\/[a-z]+/g)].map(m => m[0]));
    expect([...tools].sort()).toEqual(['/bin/bash', '/bin/chmod', '/bin/mkdir', '/bin/rm', '/usr/bin/cut', '/usr/bin/ditto',
      '/usr/bin/env', '/usr/bin/find', '/usr/bin/shasum', '/usr/sbin/chown']);
    expect(prelude.split(staged).length).toBe(2);                // the checkout is only ever the copy's source
    expect(command).toContain(`D=${release};`);
    expect(command).toContain(`--plan-digest ${digest} --apply'`);
    expect(field(printed.out, 'admin.recovery')).toContain('uninstall --release');

    // Genuine: the copy verifies, and the installer that runs is the custody copy.
    const custody = join(dir, 'custody');
    mkdirSync(custody);
    let run = runCustody(command, custody);
    expect(run.stdout).toContain(`admin.installer=${custody}/${release}/scripts/provision-fixed-native-worker.sh`);
    expect(run.stderr).toContain('REFUSED');                    // unprivileged: never installs
    expect(readFileSync(join(custody, release, 'MANIFEST'))).toEqual(readFileSync(join(staged, 'MANIFEST')));

    // Tampered installer in the staged source: refused before anything from the copy runs.
    const marker = join(dir, 'ran');
    const installer = join(staged, 'scripts', 'provision-fixed-native-worker.sh');
    const genuine = readFileSync(installer, 'utf8');
    writeFileSync(installer, genuine.replace('set -euo pipefail\n', `set -euo pipefail\n: > ${marker}\n`));
    rmSync(join(custody, release), { recursive: true });
    run = runCustody(command, custody);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain(`does not match the reviewed release sha256:${release}; nothing was run`);
    expect(existsSync(marker)).toBe(false);
    expect(run.stdout).not.toContain('admin.installer=');

    // A link whose target hashes identically is refused too (its target could change after the check).
    writeFileSync(join(dir, 'same.sh'), genuine);
    rmSync(installer);
    symlinkSync(join(dir, 'same.sh'), installer);
    rmSync(join(custody, release), { recursive: true });
    run = runCustody(command, custody);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('holds a link or special file; nothing was run');
    expect(run.stdout).not.toContain('admin.installer=');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 180_000);

it.runIf(darwin)('admin-install runs feasibility before it installs, refuses without root, and reports custody separation honestly', () => {
  const dir = tempRoot();
  try {
    writeFileSync(join(dir, 'runtime'), '#!/bin/sh\nexit 0\n');
    const stage = provisionRun(['stage', '--out', dir, '--runtime', join(dir, 'runtime'), ...limits]);
    const staged = join(dir, field(stage.out, 'stage.release')!);
    const args = ['admin-install', '--release', staged, '--installation', 'installation:studio', '--machine', 'machine:studio'];
    const preview = provisionRun(args, accountsHost);
    expect(preview.status, preview.err).toBe(0);
    const steps = preview.out.split('\n').filter(line => line.startsWith('admin.step=')).map(line => line.split(' ')[1]);
    expect(steps).toEqual(['custody:', 'plan:', 'feasibility:', 'install:', 'verify:']);
    expect(preview.out).toContain('admin.step=3 feasibility: every native case as uid 499 gid 499 at the installed 2048MiB bound; any non-PASS stops');
    // The digest it checks is the same plan digest the reviewed install dry run printed.
    const install = provisionRun(['install', ...args.slice(1)], accountsHost);
    expect(preview.out).toContain(`plan.digest=${field(install.out, 'plan.digest')} must equal`);
    expect(field(preview.out, 'admin.recovery')).toContain(`uninstall --release /Library/Instar2/m4-launch/releases/${field(stage.out, 'stage.release')}`);
    expect(preview.out).not.toContain('admin.custody-separation=HOLD');
    const admin = provisionRun(args, accountsHost.map(r => r === 'agent_groups=staff' ? 'agent_groups=staff,admin' : r));
    expect(admin.out).toContain('admin.custody-separation=HOLD');
    expect(provisionRun([...args, '--apply'], accountsHost).err).toContain('never accepts a synthetic inventory');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 120_000);
