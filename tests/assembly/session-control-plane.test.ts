import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error physical host module is JavaScript
import { createProductionSessionIO, createSessionControlPlaneObserver } from '../../scripts/production-session-io.mjs';
import { createSessionConversationAdapter } from '../../src/assembly/conversation-harness-adapter.js';
import type { SessionWorkIO } from '../../src/assembly/production-session-work.js';
import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';

// Deliberately fake control plane, real isolated client processes. No model or
// shared tmux server is used. A sleeping client is not a machine-load test.
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const name = `instar20-${'a'.repeat(24)}`;
function fixture(now?: () => number) {
  const root = mkdtempSync(join(tmpdir(), 'session-control-plane-')); roots.push(root);
  const scope = join(root, 'scope'), home = join(root, 'home'), login = join(root, 'login');
  for (const path of [scope, home, login]) mkdirSync(path);
  const modePath = join(root, 'mode.json'), pidPath = join(root, 'client.pid');
  const executable = join(root, 'fake-tmux');
  writeFileSync(executable, `#!${process.execPath}
import { readFileSync, writeFileSync } from 'node:fs';
const mode = JSON.parse(readFileSync(${JSON.stringify(modePath)}, 'utf8'));
if (mode.delay) await new Promise(resolve => setTimeout(resolve, mode.delay));
if (mode.hang) {
  writeFileSync(${JSON.stringify(pidPath)}, String(process.pid));
  process.on('SIGTERM', () => {});
  setInterval(() => {}, 1000);
} else if (process.argv[2] === 'has-session') process.exit(mode.has);
else if (process.argv[2] === 'list-sessions') {
  process.stdout.write(mode.names.join('\\n'));
  process.exit(mode.list);
} else if (process.argv[2] === 'display-message') process.stdout.write(mode.identity ?? '123:1000');
else if (process.argv[2] === 'capture-pane') process.stdout.write(mode.pane ?? 'fixture work');
else process.exit(2);
`);
  chmodSync(executable, 0o700);
  const mode = (value: object) => writeFileSync(modePath, JSON.stringify({ has: 1, list: 1, names: [], ...value }));
  mode({});
  const io = createProductionSessionIO({ stateDirectory: join(root, 'state'), tmuxPath: executable,
    home, configHome: login, cwd: scope, ...(now ? { now } : {}) });
  const save = (pid: number, identity = `${name}:${pid}:1000`) => {
    const session = { name, identity, operation: 'work', claim: 'claim', incarnation: 'inc', startedAt: 1000,
      resumeId: null, recovery: 0, turnDeadline: 100000, turnStartedAt: 1000, closedAt: null };
    io.save({ sessions: [session], deliveries: [], resumes: {} });
    return session;
  };
  const probe = () => io.tmux(['has-session', '-t', `=${name}:`]);
  return { root, scope, home, login, executable, io, mode, probe, save, pidPath };
}

it('distinguishes a positive probe, affirmative absence, and a target present in the fresh census', () => {
  const f = fixture();
  f.mode({ has: 0 }); expect(f.probe().code).toBe(0);
  f.mode({ list: 0, names: ['unrelated-worker'] }); expect(f.probe().code).toBe(1);
  f.mode({ list: 0, names: ['unrelated-worker', name] }); expect(f.probe().code).toBe(0);
});

it.each(['missing', 'live', 'malformed'] as const)('keeps an unreachable control plane unknown with %s process evidence', kind => {
  const f = fixture();
  if (kind !== 'missing') f.save(process.pid, kind === 'malformed' ? 'untrusted-identity' : undefined);
  expect(f.probe).toThrow('worker state unknown');
});

it('allows closure when the last server is absent and the exact recorded pane PID has exited', () => {
  const f = fixture();
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  expect(child.status).toBe(0);
  f.save(child.pid);
  expect(f.probe().code).toBe(1);
});

it('a refused probe reaches the driver as refusal, without manufacturing exit or mutating custody', () => {
  const f = fixture(), session = f.save(process.pid), before = f.io.load();
  const driver = createProductionSessionDriver({ operatorOwnUse: true, confinement: 'unconfined', framework: 'claude-code',
    executable: f.executable, cwd: f.scope, home: f.home, configHome: f.login, context: assemblyRuntimeFixture().c,
    io: f.io, now: () => 2000, stopped: () => false, resolveIntake: () => 'retained input',
    maxSessions: 1, turnDeadlineMs: 100000, readyTimeoutMs: 1000, protectedSessions: [] });
  expect(driver.observe({ operation: 'work', processIdentity: session.identity }).kind).toBe('Refused');
  expect(driver.launch({ operation: 'work', claim: 'claim', artifact: 'fixture', incarnation: 'inc',
    workingScope: f.scope, handles: [] }).kind).toBe('Refused');
  expect(driver.stop({ claim: 'claim', incarnation: 'inc', processIdentity: session.identity }).kind).toBe('Refused');
  expect(f.io.load()).toEqual(before);
  // The same retained identity has a positive exit neighbor once the server
  // successfully supplies a complete census with no matching session.
  f.mode({ list: 0 });
  const observed = driver.observe({ operation: 'work', processIdentity: session.identity });
  expect(observed.kind).toBe('Success');
  if (observed.kind === 'Success') expect(observed.value.phase).toBe('exit-observed');
});

it('bounds a client that ignores TERM and retains timeout as unknown rather than missing', () => {
  const f = fixture(); f.mode({ hang: true });
  expect(f.probe).toThrow('worker state unknown');
  const pid = Number(readFileSync(f.pidPath, 'utf8'));
  expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
  expect(() => process.kill(pid, 0)).toThrow();
}, 15000);

it('failed executable startup cannot be mistaken for a missing session', () => {
  const f = fixture(); chmodSync(f.executable, 0o600);
  expect(f.probe).toThrow('worker state unknown');
});

it('retains an interrupted launch without a pane identity until a reachable census can reconcile it', () => {
  const f = fixture();
  const reservation = { name, operation: 'work', claim: 'claim', incarnation: 'inc', resumeId: null,
    recovery: 0, startedAt: 1000 };
  f.io.save({ sessions: [], deliveries: [], resumes: {}, reservations: [reservation] });
  const driver = createProductionSessionDriver({ operatorOwnUse: true, confinement: 'unconfined', framework: 'claude-code',
    executable: f.executable, cwd: f.scope, home: f.home, configHome: f.login, context: assemblyRuntimeFixture().c,
    io: f.io, now: () => 2000, stopped: () => false, resolveIntake: () => 'retained input',
    maxSessions: 1, turnDeadlineMs: 100000, readyTimeoutMs: 1000, protectedSessions: [] });
  expect(driver.stop().kind).toBe('Refused');
  expect(f.io.load().reservations).toEqual([reservation]);
  f.mode({ list: 0 });
  expect(driver.stop().kind).toBe('Success');
  expect(f.io.load().reservations).toEqual([]);
});


it('degraded-control-plane signal retains the 64/.3/three-cycle tuning, settle and same-episode escalation', () => {
  let now = 0;
  const observer = createSessionControlPlaneObserver({ now: () => now,
    resourceObservation: () => ({ state: 'available', at: now, freshForMs: 1000 }) });
  observer.observe(9000, 'killed-client'); observer.observe(9000, 'killed-client');
  expect(observer.status()).toMatchObject({ state: 'unknown', consecutiveSlowCycles: 2 });
  observer.observe(9000, 'killed-client');
  expect(observer.status()).toMatchObject({ state: 'degraded', episode: 1, ewmaMs: 9000 });
  now = 1_800_000; observer.observe(9000, 'killed-client');
  expect(observer.status()).toMatchObject({ episode: 1, escalations: 1, ageMs: 1_800_000 });
  observer.refresh(); observer.observe(9000, 'killed-client');
  expect(observer.status().consecutiveSlowCycles).toBe(4);
  now += 60_000; observer.observe(9000, 'killed-client');
  expect(observer.status().consecutiveSlowCycles).toBe(5);
  observer.observe(0, 'success');
  expect(observer.status()).toMatchObject({ state: 'healthy', ewmaMs: 6300, consecutiveSlowCycles: 0 });
  for (let sample = 0; sample < 10_000; sample++) observer.observe(1, 'success');
  expect(observer.status()).toMatchObject({ windowSize: 64, ringCount: 64, killedClientCount: 6 });
});

it.each(['missing', 'pressured', 'stale'] as const)('does not infer socket degradation from %s resource evidence', kind => {
  const observer = createSessionControlPlaneObserver({ now: () => 10000, resourceObservation: () => kind === 'missing' ? null
    : ({ state: kind === 'pressured' ? 'pressured' : 'available', at: 0, freshForMs: kind === 'stale' ? 1 : 20000 }) });
  for (let sample = 0; sample < 5; sample++) observer.observe(9000, 'killed-client');
  expect(observer.status()).toMatchObject({ state: 'unknown', consecutiveSlowCycles: 0, episode: 0, totalSamples: 5 });
});

it('the physical tmux path supplies its real outcome to the pull snapshot', () => {
  const f = fixture(); f.mode({ has: 0 }); f.probe();
  expect(f.io.controlPlaneStatus()).toMatchObject({ state: 'unknown', totalSamples: 1, unavailableCount: 0 });
});

it('reads a bounded exact transcript tail and preserves missing transcript as unknown', () => {
  const f = fixture(), id = '12345678-1234-1234-1234-123456789abc';
  const folder = join(f.login, 'projects', f.scope.replace(/[\/.]/g, '-'));
  mkdirSync(folder, { recursive: true }); writeFileSync(join(folder, `${id}.jsonl`), 'a'.repeat(1024));
  expect(f.io.progressSnapshot('claude-code', id, f.scope, f.login)).toMatchObject({ transcriptSize: 1024,
    descendantCpuSeconds: null, mainProcessActive: null });
  expect(f.io.progressSnapshot('codex-cli', id, f.scope, f.login).transcriptSize).toBeNull();
  expect(f.io.progressSnapshot('claude-code', null, f.scope, f.login).transcriptSize).toBeNull();
});


it('async census and exact capture yield to the host and coalesce concurrent observations', async () => {
  const f = fixture(), identity = `${name}:123:1000`;
  f.mode({ list: 0, names: [name], delay: 40 });
  let ticked = false;
  const timer = setTimeout(() => { ticked = true; }, 10);
  try {
    const [first, second] = await Promise.all([f.io.observeSession(name, identity), f.io.observeSession(name, identity)]);
    expect(ticked).toBe(true);
    expect(first).toMatchObject({ state: 'alive', identity, pane: 'fixture work', reachable: true });
    expect(second).toEqual(first);
    expect(f.io.controlPlaneStatus().totalSamples).toBe(4);
  } finally { clearTimeout(timer); }
});

it('async whole-plane uncertainty opens one episode and never projects an empty population', async () => {
  const f = fixture(), identity = `${name}:${process.pid}:1000`;
  expect(await f.io.observeSession(name, identity)).toMatchObject({ state: 'indeterminate', reachable: false });
  expect(await f.io.observeSession(name, identity)).toMatchObject({ state: 'indeterminate', reachable: false });
  expect(f.io.controlPlaneStatus()).toMatchObject({ unreachable: true, unreachableEpisode: 1 });
  f.mode({ list: 0, names: [] });
  expect(await f.io.observeSession(name, identity)).toMatchObject({ state: 'dead', reachable: true });
  expect(f.io.controlPlaneStatus().unreachable).toBe(false);
});

it('async per-worker identity ambiguity keeps the worker unknown despite a reachable census', async () => {
  const f = fixture(); f.mode({ list: 0, names: [name], identity: '456:2000' });
  expect(await f.io.observeSession(name, `${name}:123:1000`)).toMatchObject({ state: 'indeterminate', reachable: true });
});


it('async outage preserves affirmative absence of an exited exact recorded pane PID', async () => {
  const f = fixture(), child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  expect(child.status).toBe(0);
  expect(await f.io.observeSession(name, `${name}:${child.pid}:1000`)).toMatchObject({ state: 'dead', reachable: false });
});


it('real async control-plane uncertainty reaches the adapter without retiring work and later delivers its original result', async () => {
  const f = fixture(() => 2000), session = f.save(process.pid);
  let result: string | null = null;
  const driver = createProductionSessionDriver({ operatorOwnUse: true, confinement: 'unconfined', framework: 'claude-code',
    executable: f.executable, cwd: f.scope, home: f.home, configHome: f.login, context: assemblyRuntimeFixture().c,
    io: f.io, now: () => 2000, stopped: () => false, resolveIntake: () => 'original task', requireTurnHook: true,
    maxSessions: 1, turnDeadlineMs: 100000, readyTimeoutMs: 1000, protectedSessions: [] });
  const workIO = { readResult: () => result } as unknown as SessionWorkIO;
  const adapter = createSessionConversationAdapter({ createDriver: () => driver, io: workIO, resolveDelivery: () => undefined });
  const input = { claim: 'claim', incarnation: 'inc', launch: session.identity, cursor: 0, limit: 16,
    delivery: { claim: 'claim', incarnation: 'inc', launch: session.identity, operation: 'work', digest: 'unused',
      text: 'original task', resultPath: '/fixture-result', maxBytes: 1024 } };
  const unavailable = await adapter.observe(input);
  expect(unavailable).toEqual({ observations: [], cursor: 0, complete: true });
  expect(f.io.load().sessions[0]).toMatchObject({ identity: session.identity, closedAt: null, turnDeadline: 100000,
    staleObservation: { state: 'unknown', indeterminateStreak: 0 } });
  f.mode({ list: 0, names: [name], identity: `${process.pid}:1000` });
  writeFileSync(join(f.io.inboxDirectory, `${name}.closed.json`), JSON.stringify({ kind: 'turn-closed',
    sessionId: '12345678-1234-1234-1234-123456789abc', at: 1500, receiptId: 'original-turn' }));
  result = 'the original requested result';
  const complete = await adapter.observe(input);
  expect(complete.observations).toMatchObject([{ kind: 'reply', delivery: 'work', text: result },
    { kind: 'turn-end', delivery: 'work', state: 'completed' }]);
  expect(f.io.load().sessions).toHaveLength(1);
  expect(f.io.load().sessions[0].identity).toBe(session.identity);
});

it('shares one socket episode and an eight-client coalescing ceiling across observer consumers', async () => {
  const observer = createSessionControlPlaneObserver({ now: () => 1000 });
  const completions: Array<() => void> = [];
  let invoked = 0;
  const invoke = () => { invoked++; return new Promise<void>(resolve => completions.push(resolve)); };
  const first = observer.coalesce('same-socket-command', invoke);
  expect(observer.coalesce('same-socket-command', invoke)).toBe(first);
  const others = Array.from({ length: 7 }, (_, index) => observer.coalesce(`command-${index}`, invoke));
  expect(await observer.coalesce('ninth-command', invoke)).toBeNull();
  expect(invoked).toBe(8);
  observer.reachability(false); observer.reachability(false);
  expect(observer.status()).toMatchObject({ unreachable: true, unreachableEpisode: 1 });
  observer.reachability(true); observer.reachability(false);
  expect(observer.status()).toMatchObject({ unreachable: true, unreachableEpisode: 2 });
  completions.forEach(complete => complete()); await Promise.all([first, ...others]);
  expect(await observer.coalesce('ninth-command', () => 'recovered')).toBe('recovered');
});

// Carryover 02 r4: 1.x DegradedTmuxGuard's raise lifecycle as deduplicated pull notices: one per episode,
// re-raised with its age at the thirty-minute cadence, closed by a clean cycle, never a kill.
it('a degraded episode yields one deduplicated notice, re-raised at the inherited cadence, and none once healthy', () => {
  let now = 0;
  const observer = createSessionControlPlaneObserver({ now: () => now,
    resourceObservation: () => ({ state: 'available', at: now, freshForMs: 1000 }) });
  expect(observer.notices()).toEqual([]);
  observer.observe(9000, 'killed-client'); observer.observe(9000, 'killed-client');
  expect(observer.notices()).toEqual([]);
  observer.observe(9000, 'killed-client');
  const [first] = observer.notices();
  expect(first).toMatchObject({ key: 'degraded-tmux:1:0' });
  expect(first.line).toContain('episode 1'); expect(first.line).toContain('refresh is your explicit action'); expect(first.line).not.toContain('raised again');
  now = 60_000; observer.observe(9000, 'killed-client');
  expect(observer.notices()[0].key).toBe('degraded-tmux:1:0');
  now = 1_800_000; observer.observe(9000, 'killed-client');
  const [raised] = observer.notices();
  expect(raised.key).toBe('degraded-tmux:1:1'); expect(raised.line).toContain('raised again after 30 min');
  observer.observe(0, 'success');
  expect(observer.status().state).toBe('healthy'); expect(observer.notices()).toEqual([]);
});
