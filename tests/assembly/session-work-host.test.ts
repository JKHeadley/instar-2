// Rules 36, 60, 75, 114: the physical side of the delegated-session path. The model-call meter is a
// parser of real harness transcripts, so it is driven here on recorded line shapes
// (tests/preview/session-transcript-shapes.json: one live Codex rollout and one live Claude Code
// transcript, content removed, record types, call identifiers and order kept). The result reader is
// bounded physically, and the resource owner holds and reclaims a session's real process tree.
import { spawn, spawnSync } from 'node:child_process';
import { linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error physical JS host is intentionally outside the pure core
import { createProductionSessionIO } from '../../scripts/production-session-io.mjs';
// @ts-expect-error physical JS host is intentionally outside the pure core
import { createResourceOwner } from '../../scripts/resource-owner.mjs';

const roots: string[] = [];
const started: number[] = [];
afterEach(() => {
  for (const pid of started.splice(0)) try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const shapes = JSON.parse(readFileSync('tests/preview/session-transcript-shapes.json', 'utf8')) as {
  codex: { lines: string[]; modelCalls: number }; claude: { lines: string[]; modelCalls: number } };
function world() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'session-host-'))); roots.push(root);
  const scope = join(root, 'scope'), login = join(root, 'login'), home = join(root, 'home');
  for (const path of [scope, login, home]) mkdirSync(path, { recursive: true, mode: 0o700 });
  const io = createProductionSessionIO({ stateDirectory: join(root, 'state'), tmuxPath: '/usr/bin/true', home, configHome: login, cwd: scope });
  return { root, scope, login, io };
}
const today = (base: string) => { const d = new Date();
  return join(base, 'sessions', String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')); };

it('counts a Claude Code session\'s model calls from its own transcript: one per distinct request', () => {
  const w = world();
  const folder = join(w.login, 'projects', w.scope.replace(/[/.]/g, '-'));
  mkdirSync(folder, { recursive: true });
  const since = Date.now() - 1000;
  expect(w.io.modelCalls('claude-code', w.scope, w.login, since)).toBe(0);
  writeFileSync(join(folder, 'a.jsonl'), `${shapes.claude.lines.join('\n')}\n`);
  expect(shapes.claude.modelCalls).toBeGreaterThan(1);
  expect(w.io.modelCalls('claude-code', w.scope, w.login, since)).toBe(shapes.claude.modelCalls);
  // A transcript last written before the step began belongs to an earlier step and is not counted.
  const old = (Date.now() - 3_600_000) / 1000;
  utimesSync(join(folder, 'a.jsonl'), old, old);
  expect(w.io.modelCalls('claude-code', w.scope, w.login, since)).toBe(0);
});

it('counts a Codex session\'s model calls from its rollout, attributed by its own working directory', () => {
  const w = world();
  const folder = today(w.login); mkdirSync(folder, { recursive: true });
  const since = Date.now() - 1000;
  const lines = (cwd: string) => `${shapes.codex.lines.map(line => line.replace('"<project>"', JSON.stringify(cwd))).join('\n')}\n`;
  writeFileSync(join(folder, 'rollout-mine.jsonl'), lines(w.scope));
  expect(shapes.codex.modelCalls).toBeGreaterThan(1);
  expect(w.io.modelCalls('codex-cli', w.scope, w.login, since)).toBe(shapes.codex.modelCalls);
  // Another Codex run in the same login home (an answer turn, the operator's own work) is not this session's.
  writeFileSync(join(folder, 'rollout-other.jsonl'), lines('/somewhere/else'));
  expect(w.io.modelCalls('codex-cli', w.scope, w.login, since)).toBe(shapes.codex.modelCalls);
});

it('an unreadable or oversized transcript is unknown, never zero', () => {
  const w = world();
  // A rollout folder that cannot be listed.
  const folder = today(w.login); mkdirSync(join(folder, '..'), { recursive: true }); writeFileSync(folder, 'not a directory');
  expect(w.io.modelCalls('codex-cli', w.scope, w.login, Date.now() - 1000)).toBe(null);
  // A transcript past its 64 MiB bound is not read.
  const projects = join(w.login, 'projects', w.scope.replace(/[/.]/g, '-')); mkdirSync(projects, { recursive: true });
  writeFileSync(join(projects, 'big.jsonl'), Buffer.alloc(64 * 1024 * 1024 + 1, 0x20));
  expect(w.io.modelCalls('claude-code', w.scope, w.login, Date.now() - 60_000)).toBe(null);
});

it('reads a result physically bounded to its limit plus one byte, and a failed clear throws', () => {
  const w = world();
  const path = join(w.scope, 'work.json');
  expect(w.io.readResult(path, 8)).toBe(null);
  writeFileSync(path, 'x'.repeat(100_000));
  expect(Buffer.byteLength(w.io.readResult(path, 8)!)).toBe(9);
  writeFileSync(path, '{"ok":1}');
  expect(w.io.readResult(path, 8)).toBe('{"ok":1}');
  w.io.clearResult(path);
  expect(w.io.readResult(path, 8)).toBe(null);
  w.io.clearResult(path);
  // A destination that cannot be removed is an error, never silently left in place.
  mkdirSync(path);
  expect(() => w.io.clearResult(path)).toThrow();
});

it('reads a result only from a regular, singly-linked file inside the delegated scope: links and special files refuse', () => {
  const w = world();
  const path = join(w.scope, 'work.json');
  const secret = join(w.root, 'outside-dummy-secret.json');
  writeFileSync(secret, '{"reply":"DUMMY-SECRET-OUTSIDE-SCOPE"}');
  // A symbolic link at the destination is never followed: the host would read with its own, broader authority.
  symlinkSync(secret, path);
  expect(() => w.io.readResult(path, 1024)).toThrow(/symbolic link/u);
  rmSync(path);
  // A hard link to an out-of-scope file is a second name for that file: refused.
  linkSync(secret, path);
  expect(() => w.io.readResult(path, 1024)).toThrow(/another link/u);
  rmSync(path);
  // A named pipe refuses at once, without blocking the host on a writer that never comes.
  expect(spawnSync('/usr/bin/mkfifo', [path]).status).toBe(0);
  const started = Date.now();
  expect(() => w.io.readResult(path, 1024)).toThrow(/not a regular file/u);
  expect(Date.now() - started).toBeLessThan(1000);
  rmSync(path);
  // A destination whose folder resolves outside the scope (a planted directory link) refuses.
  mkdirSync(join(w.root, 'elsewhere'));
  writeFileSync(join(w.root, 'elsewhere', 'work.json'), '{"reply":"outside"}');
  symlinkSync(join(w.root, 'elsewhere'), join(w.scope, 'linked'));
  expect(() => w.io.readResult(join(w.scope, 'linked', 'work.json'), 1024)).toThrow(/outside the delegated scope/u);
  // The other side: an ordinary result file in the scope is read, physically bounded.
  writeFileSync(path, '{"reply":"ordinary"}');
  expect(w.io.readResult(path, 1024)).toBe('{"reply":"ordinary"}');
  expect(JSON.stringify(w.io.readResult(path, 1024))).not.toContain('DUMMY-SECRET');
});

it('the resource owner admits a session step, holds its real process tree, and reclaims it on release', async () => {
  const w = world();
  const owner = createResourceOwner();
  const held = await owner.hold('maintenance', { timeout: 1000, stopped: () => false });
  expect(held).not.toBe(null);
  // A session root with its own process group in the step's private scope, as tmux starts one.
  const child = spawn('/bin/sleep', ['30'], { cwd: w.scope, detached: true, stdio: 'ignore' });
  started.push(child.pid!);
  await held.attach({ pid: child.pid!, cwd: w.scope });
  expect(owner.snapshot().active.map((row: { pid: number }) => row.pid)).toContain(child.pid);
  const outcome = await held.release();
  expect(outcome).toMatchObject({ verified: true });
  expect(() => process.kill(child.pid!, 0)).toThrow();
  expect(owner.snapshot().active).toHaveLength(0);
  // A stopped launch is refused before admission.
  expect(await owner.hold('maintenance', { timeout: 1000, stopped: () => true })).toBe(null);
}, 30_000);
