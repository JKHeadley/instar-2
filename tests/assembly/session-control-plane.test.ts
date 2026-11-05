import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error physical host module is JavaScript
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';
import { createProductionSessionDriver } from '../../src/assembly/production-session-driver.js';
import { assemblyRuntimeFixture } from './runtime-fixture.js';

// Deliberately fake control plane, real isolated client processes. No model or
// shared tmux server is used. A sleeping client is not a machine-load test.
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const name = `instar20-${'a'.repeat(24)}`;
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'session-control-plane-')); roots.push(root);
  const scope = join(root, 'scope'), home = join(root, 'home'), login = join(root, 'login');
  for (const path of [scope, home, login]) mkdirSync(path);
  const modePath = join(root, 'mode.json'), pidPath = join(root, 'client.pid');
  const executable = join(root, 'fake-tmux');
  writeFileSync(executable, `#!${process.execPath}
import { readFileSync, writeFileSync } from 'node:fs';
const mode = JSON.parse(readFileSync(${JSON.stringify(modePath)}, 'utf8'));
if (mode.hang) {
  writeFileSync(${JSON.stringify(pidPath)}, String(process.pid));
  process.on('SIGTERM', () => {});
  setInterval(() => {}, 1000);
} else if (process.argv[2] === 'has-session') process.exit(mode.has);
else if (process.argv[2] === 'list-sessions') {
  process.stdout.write(mode.names.join('\\n'));
  process.exit(mode.list);
} else process.exit(2);
`);
  chmodSync(executable, 0o700);
  const mode = (value: object) => writeFileSync(modePath, JSON.stringify({ has: 1, list: 1, names: [], ...value }));
  mode({});
  const io = createProductionSessionIO({ stateDirectory: join(root, 'state'), tmuxPath: executable,
    home, configHome: login, cwd: scope });
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
