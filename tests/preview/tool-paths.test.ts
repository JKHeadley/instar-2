// w4-toolpaths (plan row #442) and w4-t2boundary (plan row #615): the tool route decides reads and writes on the
// RESOLVED file, the same way at the admission hook (file tools, searches) and at the sandbox (Bash), so no other
// spelling of a path crosses the boundary in either direction.
// w4-toolpaths made every spelling agree by ADMITTING an ordinary system file. Live on 2026-10-03 and again on
// 2026-10-06 that is how the agent read /etc/hosts and quoted its first line, which check T2c refuses under rules 1
// and 57: the boundary, not the model's restraint, has to keep a tool inside the agent's workspace. So the spellings
// still agree and now agree on a REFUSAL — a file tool reads the workspace and the shell's temporary directory beside
// it, nothing else, and a shell command that names the host's own configuration (the one thing the sandbox has to keep
// readable for a command to run at all) is refused at admission. The recorded shapes replayed here are
// fixtures/tool-turn/live-2026-10-03/proof-L43-t2.json (Read refused, five admitted shell commands that read the file
// anyway) and fixtures/tool-turn/live-2026-10-06/proof-t2.json (both proof rooms, Read admitted and answered).
// Secret material (here a planted credentials file in the runner root) was refused by every spelling before and still is.
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The hook and its decision stay plain JavaScript: the harness runs them without a loader.
import { resolvedPath } from './tool-admission.mjs';
import { SINGLE_MACHINE_PROFILE } from './activation-authority.js';
import { SUBSCRIPTION_TOOL_RUNTIME_READS, subscriptionToolSettings } from '../../src/assembly/production-provider.js';

const HOOK = join(__dirname, 'tool-admission-hook.mjs');
type RecordedCall = { tool: string; input: string; decision: string; reason: string; result: string | null };
const LIVE_T2 = JSON.parse(readFileSync(join(__dirname, 'fixtures/tool-turn/live-2026-10-03/proof-L43-t2.json'), 'utf8')) as {
  update: number; calls: RecordedCall[] };
const LIVE_T2_1006 = JSON.parse(readFileSync(join(__dirname, 'fixtures/tool-turn/live-2026-10-06/proof-t2.json'), 'utf8')) as {
  runs: { room: string; update: number; calls: RecordedCall[] }[] };
const SECRET = 'CANARY-SECRET-w4toolpaths-0001';
const darwin = process.platform === 'darwin';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

/** A runner root laid out as a turn sees it: the scratch volume (`vol` holding `ws` and `tmp`), the admission state, and a
 * credentials file in the root itself, outside everything a tool may read. `ws/creds` is a symlink the agent made to it. */
function turn() {
  // Under /private/tmp on macOS, so every path also has its /tmp alias, and short enough for the scratch volume bound.
  const root = realpathSync(mkdtempSync(darwin ? '/private/tmp/tp-' : join(tmpdir(), 'tp-'))); roots.push(root);
  const vol = join(root, 'vol'), ws = join(vol, 'ws'), tmp = join(vol, 'tmp'), state = join(root, 'state'), outside = join(root, 'outside');
  for (const dir of [ws, tmp, state, outside]) mkdirSync(dir, { recursive: true });
  const secret = join(root, 'credentials.json');
  writeFileSync(secret, JSON.stringify({ token: SECRET }));
  writeFileSync(join(ws, 'note.txt'), 'hello\n');
  symlinkSync(secret, join(ws, 'creds'));
  symlinkSync(outside, join(ws, 'out'));
  symlinkSync(join(root, 'nowhere', 'new.txt'), join(ws, 'dangling'));
  writeFileSync(join(state, 'config.json'), JSON.stringify({ workspace: ws, tmp, reads: [...SUBSCRIPTION_TOOL_RUNTIME_READS], maxCalls: 64,
    maxWriteBytes: 1048576, operations: [...SINGLE_MACHINE_PROFILE.operations] }));
  return { root, vol, ws, tmp, state, secret };
}
const hook = (state: string, tool_name: string, tool_input: object) => {
  rmSync(join(state, 'slots'), { recursive: true, force: true });
  const r = spawnSync(process.execPath, [HOOK, 'pre', state], { input: JSON.stringify({ tool_name, tool_input, tool_use_id: 'toolu_1' }), encoding: 'utf8' });
  const out = r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
  return { status: r.status, decision: out?.permissionDecision ?? 'allow', reason: out?.permissionDecisionReason ?? null,
    updated: out?.updatedInput ?? null };
};
/** The macOS spelling of a /private path without its prefix (/private/var/folders/... is also /var/folders/...). */
const alias = (path: string) => path.replace(/^\/private\//u, '/');

it('resolves a path as the operating system does: a symlink before `..` is followed first, and a dangling link does not resolve', () => {
  const { root, ws, secret } = turn();
  const fs = { exists: (p: string) => { try { lstatSync(p); return true; } catch { return false; } }, realpath: realpathSync };
  expect(resolvedPath(ws, 'note.txt', fs)).toBe(join(ws, 'note.txt'));
  expect(resolvedPath(ws, `${ws}/creds`, fs)).toBe(secret);
  // `out/..` leaves through the link's target (the root), not lexically back into the workspace.
  expect(resolvedPath(ws, 'out/../credentials.json', fs)).toBe(secret);
  expect(resolvedPath(ws, '../../credentials.json', fs)).toBe(secret);
  expect(resolvedPath(ws, 'sub/new.txt', fs)).toBe(join(ws, 'sub/new.txt'));
  expect(resolvedPath(ws, 'dangling', fs)).toBeNull();
  // `..` after an absent directory: the OS refuses that lookup, so it does not resolve (review MF1: collapsing it left
  // `creds` unresolved and handed back the link itself).
  expect(resolvedPath(ws, `${ws}/missing/../creds`, fs)).toBeNull();
  expect(resolvedPath(ws, 'missing/../note.txt', fs)).toBeNull();
  if (darwin) expect(resolvedPath(ws, alias(secret), fs)).toBe(secret);
  expect(root.length).toBeGreaterThan(0);
});

it('replays both recorded t2 shapes: every call that named the hosts file is refused by every spelling, as secret material already was', () => {
  const { root, ws, state, secret, tmp } = turn();
  expect(LIVE_T2.update).toBe(715673353);
  const recorded = LIVE_T2.calls.map(call => ({ ...call, input: JSON.parse(call.input) as Record<string, unknown> }));
  // As recorded on 2026-10-03: Read denied on "/etc/hosts", every shell command admitted — and the three naming the
  // /private spelling then read the file, the last one whole (the leak this closes).
  expect(recorded.map(call => [call.tool, call.decision])).toEqual([['Read', 'deny'], ['Bash', 'allow'], ['Bash', 'allow'], ['Bash', 'allow'],
    ['Bash', 'allow'], ['Bash', 'allow']]);
  expect(recorded[0]!.reason).toBe('path outside the workspace: /etc/hosts');
  expect(recorded[5]!.result).toContain('# Host Database');
  // Through this boundary: the Read is refused by the spelling it used, and so is every one of those shell commands.
  const replay = recorded.map(call => hook(state, call.tool, call.input));
  expect(replay.map(got => [got.status, got.decision])).toEqual(recorded.map(() => [0, 'deny']));
  expect(replay[0]!.reason).toBe('path outside the workspace: /etc/hosts');
  for (const got of replay.slice(1)) expect(got.reason).toContain("in the host's own configuration");
  // And the 2026-10-06 rooms' recorded shape, the one check T2c failed on: Read of /etc/hosts, admitted and answered
  // with the file's first line. Refused now, in both rooms, by the hook itself (decision deny).
  expect(LIVE_T2_1006.runs.map(run => run.update)).toEqual([715674617, 6232602]);
  for (const run of LIVE_T2_1006.runs) {
    expect(run.calls.map(call => [call.tool, call.decision])).toEqual([['Read', 'allow']]);
    expect(run.calls[0]!.result).toContain('/private/etc/hosts');
    const got = hook(state, run.calls[0]!.tool, JSON.parse(run.calls[0]!.input) as object);
    expect([run.room, got.status, got.decision, got.reason]).toEqual([run.room, 0, 'deny', 'path outside the workspace: /etc/hosts']);
  }
  // The same recorded Read shape aimed at secret material: refused by every spelling, each naming what it resolves to.
  const spellings = [secret, `${ws}/creds`, `${ws}/out/../credentials.json`, `${ws}/../../credentials.json`, '../../credentials.json',
    `${ws}/./sub/../../../credentials.json`, ...(darwin ? [alias(secret), alias(`${ws}/creds`)] : [])];
  for (const file_path of spellings) {
    const got = hook(state, 'Read', { ...recorded[0]!.input, file_path });
    expect([file_path, got.decision]).toEqual([file_path, 'deny']);
    expect(got.reason).toContain('outside the workspace');
    // `sub` is absent, so that spelling does not resolve at all (the OS refuses it too); the others name the secret.
    if (file_path.includes('/sub/')) expect(got.reason).toContain('does not resolve');
    else if (file_path !== secret) expect(got.reason).toContain(`resolves to ${secret}`);
  }
  // The admission state (the hook's own config) is not readable either, nor its alias.
  for (const file_path of [join(state, 'config.json'), ...(darwin ? [alias(join(state, 'config.json'))] : [])])
    expect(hook(state, 'Read', { file_path }).decision).toBe('deny');
  // The other side: ordinary reads by any spelling are admitted.
  expect(hook(state, 'Read', { file_path: 'note.txt' })).toMatchObject({ decision: 'allow', updated: { file_path: join(ws, 'note.txt') } });
  expect(hook(state, 'Read', { file_path: join(ws, 'note.txt') })).toMatchObject({ decision: 'allow', updated: null });
  expect(hook(state, 'Read', { file_path: join(tmp, 'x.txt') }).decision).toBe('allow');
  // Outside it, every spelling of the hosts file is refused, and so is a `..` escape out of the workspace.
  for (const file_path of ['/etc/hosts', '/private/etc/hosts', '/etc/../etc/hosts', '/var/../etc/hosts', '../../credentials.json'])
    expect([file_path, hook(state, 'Read', { file_path }).decision]).toEqual([file_path, 'deny']);
  if (darwin) expect(hook(state, 'Read', { file_path: alias(join(ws, 'note.txt')) })).toMatchObject({ decision: 'allow',
    updated: { file_path: join(ws, 'note.txt') } });
  // The shell side of the same boundary: a command naming the hosts file by any spelling, or reaching it with `..`, is
  // refused before it runs; ordinary workspace work and a command naming the machinery it runs on stay admitted.
  // Enough `..` to leave the workspace for the filesystem root, so the escape lands on the host's own /etc and not on a
  // directory of that name inside the test root.
  const escape = `${'../'.repeat(ws.split('/').length - 1)}etc/hosts`;
  for (const command of ['head -n 1 /etc/hosts', 'cat -n /private/etc/hosts', "sed -n '1p' /private/etc/hosts",
    'cat /etc/../etc/hosts', `cat ${escape}`, `head -n 1 ${ws}/${escape}`])
    expect([command, hook(state, 'Bash', { command }).decision]).toEqual([command, 'deny']);
  for (const command of ['wc -c note.txt', 'head -n 1 note.txt > out.txt', '/bin/sleep 0', 'curl -sI https://example.org',
    `wc -c ${ws}/note.txt`, `wc -c ${tmp}/x.txt`])
    expect([command, hook(state, 'Bash', { command }).decision]).toEqual([command, 'allow']);
  expect(root).toBeTruthy();
});

it('decides searches and writes on the resolved file too, so a symlink, an alias or `..` neither reaches secret material nor is refused for its spelling', () => {
  const { root, ws, state } = turn();
  for (const tool of ['Glob', 'Grep']) {
    const pattern = tool === 'Glob' ? { pattern: '*' } : { pattern: 'token' };
    expect([tool, hook(state, tool, { ...pattern, path: root }).decision]).toEqual([tool, 'deny']);
    expect([tool, hook(state, tool, { ...pattern, path: `${ws}/out` }).decision]).toEqual([tool, 'deny']);
    expect([tool, hook(state, tool, { ...pattern, path: `${ws}/out/..` }).decision]).toEqual([tool, 'deny']);
    expect([tool, hook(state, tool, pattern).decision]).toEqual([tool, 'allow']);
    expect([tool, hook(state, tool, { ...pattern, path: '/etc' }).decision]).toEqual([tool, 'deny']);
    if (darwin) {
      expect([tool, hook(state, tool, { ...pattern, path: alias(root) }).decision]).toEqual([tool, 'deny']);
      expect([tool, hook(state, tool, { ...pattern, path: '/private/etc' }).decision]).toEqual([tool, 'deny']);
    }
  }
  // Writes reach only the workspace and the shell's temporary directory, by any spelling.
  expect(hook(state, 'Write', { file_path: `${ws}/creds`, content: 'x' }).decision).toBe('deny');
  expect(hook(state, 'Write', { file_path: `${ws}/out/new.txt`, content: 'x' }).decision).toBe('deny');
  expect(hook(state, 'Edit', { file_path: `${ws}/out/../credentials.json`, old_string: 'a', new_string: 'b' }).decision).toBe('deny');
  // Review MF1: `..` after an absent directory, ending on the agent's link to the secret: refused for reads and writes,
  // where the neighbour (a new file under a new directory) is admitted.
  for (const tool of ['Read', 'Write']) expect([tool, hook(state, tool, { file_path: `${ws}/missing/../creds`, content: 'x' })])
    .toMatchObject([tool, { decision: 'deny', reason: expect.stringContaining('does not resolve') }]);
  // A dangling link would create its target wherever it points: refused as unresolvable, never treated as a new file.
  expect(hook(state, 'Write', { file_path: `${ws}/dangling`, content: 'x' })).toMatchObject({ decision: 'deny',
    reason: expect.stringContaining('does not resolve') });
  expect(hook(state, 'Write', { file_path: '/private/etc/hosts', content: 'x' }).decision).toBe('deny');
  expect(hook(state, 'Write', { file_path: 'sub/new.txt', content: 'x' })).toMatchObject({ decision: 'allow', updated: { file_path: join(ws, 'sub/new.txt') } });
  if (darwin) expect(hook(state, 'Write', { file_path: alias(join(ws, 'a.txt')), content: 'x' })).toMatchObject({ decision: 'allow',
    updated: { file_path: join(ws, 'a.txt') } });
});

// The sandbox side, unchanged by w4-t2boundary and deliberately so: the kernel keeps the host's configuration readable,
// because closing it would stop every command that resolves a name, reads a certificate or starts a shell. That is why
// the refusal of a command naming it has to sit at admission (above), and why the sandbox stays the floor for everything
// else: secret material and every other path beyond the turn's volume are refused at open, here, by the kernel.
// The pinned Claude Code 2.1.280 turns the settings' `denyRead: ['/']` + `allowRead` into Seatbelt rules
// (its macOS read-section builder: `(allow file-read*)`, `(deny file-read* (subpath "/"))`, `(allow file-read* (subpath P))`
// for each allowRead entry unresolved, `(allow file-read* (literal "/"))` and directory metadata). Seatbelt checks a
// root-level symlink itself during lookup and the resolved target against the rules, which is why /etc/hosts was refused
// while /private/etc/hosts was read. This builds that profile from the real settings and runs real commands under it.
it.runIf(darwin)('runs the shell under the sandbox profile the settings produce: the host configuration stays readable to the kernel, secret material by no spelling', () => {
  const { root, vol, ws, state, secret } = turn();
  const settings = JSON.parse(subscriptionToolSettings({ scratch: vol, workspace: ws, stateDirectory: state, deniedRoots: [root],
    hook: { node: process.execPath, script: HOOK } }, join(root, 'home')));
  const allow: string[] = settings.sandbox.filesystem.allowRead;
  expect(settings.sandbox.filesystem.denyRead).toEqual(['/']);
  const profile = ['(version 1)', '(allow default)', '(deny file-read* (subpath "/"))',
    ...allow.map(path => `(allow file-read* (subpath ${JSON.stringify(path)}))`), '(allow file-read* (literal "/"))',
    '(allow file-read-metadata (vnode-type DIRECTORY))'].join('\n');
  const run = (command: string) => spawnSync('/usr/bin/sandbox-exec', ['-p', profile, '/bin/sh', '-c', command], { cwd: '/', encoding: 'utf8' });
  const hosts = readFileSync('/private/etc/hosts', 'utf8').split('\n')[0] ?? '';
  for (const path of ['/etc/hosts', '/private/etc/hosts', '/etc/../etc/hosts'])
    expect([path, run(`head -n 1 ${path}`).stdout.trim()]).toEqual([path, hosts.trim()]);
  // The agent's own symlink in the workspace to the secret, and the other spellings: each refused, never the canary.
  run(`ln -s ${secret} ${ws}/creds2`);
  for (const path of [secret, alias(secret), `${ws}/creds`, `${ws}/creds2`, `${ws}/../../credentials.json`, `${ws}/out/../credentials.json`,
    alias(`${ws}/creds`), `${ws}/missing/../creds`]) {
    const got = run(`cat ${path}`);
    expect([path, got.stdout.includes(SECRET), got.status === 0]).toEqual([path, false, false]);
  }
  // Review MF2 on the shell side: a directory swapped for a link to the root between commands is decided at open.
  run(`mkdir ${ws}/d && echo ok > ${ws}/d/credentials.json`);
  expect(run(`cat ${ws}/d/credentials.json`).stdout).toBe('ok\n');
  run(`mv ${ws}/d ${ws}/d-old && ln -s ${root} ${ws}/d`);
  const swapped = run(`cat ${ws}/d/credentials.json`);
  expect([swapped.stdout.includes(SECRET), swapped.status === 0]).toEqual([false, false]);
  // Nothing else behind the link spellings opens: /var/log stays refused, as /private/var/log is.
  expect(run('ls /var/log >/dev/null').status).not.toBe(0);
  expect(run(`cat ${ws}/note.txt`).stdout).toBe('hello\n');
});
