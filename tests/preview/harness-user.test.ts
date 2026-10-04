// Desk unit harness-user (plan row #464): the decisions that run the preview's Claude Code harness as its own macOS user,
// each proven on both sides without the root step (fakes for sudo and the probe; the launcher and the resource owner on
// real processes of this user). The live proof against the real `_instarharness` user is
// tests/integration/tool-turn-harness-user-live.test.ts.
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openPreviewJournal } from './journal.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { harnessCommand, createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createResourceOwner, RESOURCE_CEILINGS, hostQuery } from '../../scripts/resource-owner.mjs';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createProcessInventory } from '../../scripts/process-inventory.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { harnessExecutable, harnessReadiness, harnessStatusLine, HARNESS_PROFILE, removeHarnessState, grantVolume, HARNESS_VOLUME_MARK, harnessGate, HARNESS_RECHECK_MS, readHarnessLogin, storeHarnessLogin, plaintextLogins, closeOperatorTmp, tmpCanary, HARNESS_TMP } from './harness-user.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { prepareSessionAdmission, sessionAdmissionCommand } from './session-admission.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { harnessSessionCommand } from './harness-session.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { prepareToolTurn, pruneToolTurns, runToolTurn, TOOL_TURN_PRIVATE } from './tool-turn.mjs';

const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'harness-user-')));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const fresh = (name: string) => { const dir = join(scratch, name); mkdirSync(dir, { recursive: true, mode: 0o700 }); return realpathSync(dir); };

describe('the harness command line', () => {
  const runAs = { user: '_instarharness', launcher: '/h/bin/harness-launch', login: () => 'sk-ant-oat01-synthetic-login', plan: 'max' };
  it('runs the launcher as the harness user through sudo: the environment as arguments, the login only in the stdin hand-off', () => {
    const command = harnessCommand({ executable: '/h/bin/claude-2.1.280', args: ['-p', '--model', 'm'], env: { HOME: '/h/home', CLAUDE_CONFIG_DIR: '/h/config', SKIP: undefined },
      cwd: '/w', stdin: 'x' }, runAs);
    expect(command).toEqual({ executable: '/usr/bin/sudo', args: ['-n', '-u', '_instarharness', '/h/bin/harness-launch', '--handoff', 'HOME=/h/home',
      'CLAUDE_CONFIG_DIR=/h/config', 'CLAUDE_CODE_SUBSCRIPTION_TYPE=max', '--', '/h/bin/claude-2.1.280', '-p', '--model', 'm'], env: { PATH: '/usr/bin:/bin' },
    stdin: `${JSON.stringify({ login: 'sk-ant-oat01-synthetic-login' })}\nx` });
    expect(JSON.stringify(command.args)).not.toContain('synthetic-login');
    // A preflight with no stdin still carries the login line, and nothing else.
    expect(harnessCommand({ executable: '/x', args: ['--version'], env: {} }, runAs).stdin).toBe(`${JSON.stringify({ login: 'sk-ant-oat01-synthetic-login' })}\n`);
  });
  it('hands an MCP configuration file over as /dev/fd/4, leaving an inline configuration as it is', () => {
    const read = (path: string) => { expect(path).toBe('/root/tool-turns/x/private/mcp.json'); return '{"mcpServers":{"s":{"command":"c","env":{"K":"secret"}}}}'; };
    const command = harnessCommand({ executable: '/x', args: ['-p', '--mcp-config', '/root/tool-turns/x/private/mcp.json', '--settings', '{}'], env: {} }, runAs, read);
    expect(command.args.slice(-4)).toEqual(['--mcp-config', '/dev/fd/4', '--settings', '{}']);
    expect(JSON.parse(command.stdin.split('\n')[0]).mcp).toContain('"K":"secret"');
    expect(JSON.stringify(command.args)).not.toContain('secret');
    const inline = harnessCommand({ executable: '/x', args: ['--mcp-config', '{"mcpServers":{}}'], env: {} }, runAs);
    expect(inline.args.slice(-2)).toEqual(['--mcp-config', '{"mcpServers":{}}']);
    expect(JSON.parse(inline.stdin.split('\n')[0])).toEqual({ login: 'sk-ant-oat01-synthetic-login' });
  });
  it('refuses a malformed identity or a missing login rather than guessing', () => {
    expect(() => harnessCommand({ executable: '/x', args: [], env: {} }, { ...runAs, user: 'a b' })).toThrow(/malformed/u);
    expect(() => harnessCommand({ executable: '/x', args: [], env: {} }, { ...runAs, launcher: 'relative' })).toThrow(/malformed/u);
    expect(() => harnessCommand({ executable: '/x', args: [], env: {} }, { user: 'ok', launcher: '/l' })).toThrow(/malformed/u);
    expect(() => harnessCommand({ executable: '/x', args: [], env: {} }, { ...runAs, plan: 'free' })).toThrow(/malformed/u);
    expect(() => harnessCommand({ executable: '/x', args: [], env: {} }, { ...runAs, login: () => '' })).toThrow(/login unavailable/u);
  });
  it('declares the descriptor login on an IO that runs as the harness user, and only there', () => {
    expect(createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false, runAs }).descriptorLogin).toBe(true);
    expect(createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false }).descriptorLogin).toBeUndefined();
  });
});

describe('readiness: the switch is decided from live state, a refusal names its reason', () => {
  const profile = { version: '2.1.280', artifact: 'sha256:good', executable: harnessExecutable('2.1.280'),
    home: `${HARNESS_PROFILE}/home`, configDirectory: `${HARNESS_PROFILE}/config`, workingDirectory: `${HARNESS_PROFILE}/work` };
  const exec = (uid: string) => (file: string) => { if (file === '/usr/bin/id') { if (uid === 'none') throw Error('no such user'); return `${uid}\n`; } throw Error(file); };
  const install = { launcher: () => 'sha256:l', hook: () => '/h/hook/x/tool-admission-hook.mjs', tmp: () => HARNESS_TMP };
  const refusedPaths = ['/root', '/Users/operator', '/h/custody', '/h/custody/login.json', '/private/tmp/closed'];
  // The canary made after the sweep: the kernel's inherited entry refuses it (EACCES), unless `canaryOpen` says otherwise.
  const CANARY = '/private/tmp/instar-harness-canary-000000000000';
  let removed = 0;
  const canary = () => ({ path: CANARY, remove: () => { removed++; } });
  const probe = (exposed: string | null, unreadable: string | null, canaryRow: { ok: boolean; code: string | null } = { ok: false, code: 'EACCES' }) => (specs: string[]) => specs.map(spec => {
    const path = spec.slice(2), denied = refusedPaths.includes(path);
    if (path === CANARY) return { path, mode: spec[0], ...canaryRow };
    return { path, mode: spec[0], ok: path === unreadable ? false : path === exposed ? true : !denied, code: null };
  });
  const ready = (overrides: Record<string, unknown> = {}) => harnessReadiness({ profile, denied: ['/root', '/Users/operator'], exec: exec('498'),
    install, probe: probe(null, null), digestOf: () => 'sha256:good', login: () => 'token', custody: ['/h/custody', '/h/custody/login.json'],
    plaintext: () => [], tmp: () => ({ entries: ['/private/tmp/closed'], failed: 0 }), canary, ...overrides });
  it('is ready when the user, launcher, hook, pinned copy, custody login, closed /private/tmp and the kernel\'s answers all hold', () => {
    expect(ready()).toEqual({ ready: true, user: '_instarharness', uid: 498, hookScript: '/h/hook/x/tool-admission-hook.mjs' });
  });
  it('refuses each missing condition by name', () => {
    expect(ready({ exec: exec('none') })).toEqual({ ready: false, reason: 'no user _instarharness' });
    expect(ready({ exec: exec(String(process.getuid!())) }).reason).toMatch(/not a separate identity/u);
    expect(ready({ profile: { ...profile, executable: '/elsewhere/claude' } })).toMatchObject({ uid: 498, reason: expect.stringMatching(/installed harness copy/u) });
    expect(ready({ profile: { ...profile, home: '/Users/Shared/instar-preview-s2/home' } }).reason).toMatch(/harness area/u);
    expect(ready({ digestOf: () => 'sha256:other' }).reason).toMatch(/differs from the pinned artifact/u);
    expect(ready({ install: { ...install, launcher: () => { throw Error('EACCES'); } } }).reason).toMatch(/cannot be installed/u);
    expect(ready({ install: { ...install, tmp: () => { throw Error('EACCES'); } } }).reason).toMatch(/cannot be installed/u);
    expect(ready({ probe: probe(null, HARNESS_TMP) }).reason).toBe(`the harness user cannot read ${HARNESS_TMP}`);
    expect(ready({ probe: () => null }).reason).toMatch(/not permitted/u);
    expect(ready({ probe: probe(null, `${HARNESS_PROFILE}/config`) }).reason).toBe(`the harness user cannot read ${HARNESS_PROFILE}/config`);
    expect(ready({ probe: probe('/Users/operator', null) }).reason).toBe('the harness user can read /Users/operator');
  });
  it('refuses a login the harness user could open, a custody it could open, an unusable custody login and an open /private/tmp entry', () => {
    expect(ready({ plaintext: () => [`${HARNESS_PROFILE}/config/.credentials.json`] }).reason)
      .toBe(`a plain-text login the harness user can open sits at ${HARNESS_PROFILE}/config/.credentials.json`);
    expect(ready({ probe: probe('/h/custody/login.json', null) }).reason).toBe('the harness user can read /h/custody/login.json');
    expect(ready({ login: () => { throw Error('the custody login is bound to another account, organization or plan'); } }).reason)
      .toBe('the harness login is unusable: the custody login is bound to another account, organization or plan');
    expect(ready({ probe: probe('/private/tmp/closed', null) }).reason).toBe('the harness user can read /private/tmp/closed');
    expect(ready({ tmp: () => ({ entries: [], failed: 2 }) }).reason).toMatch(/2 of the runner's \/private\/tmp entries cannot be closed/u);
    expect(ready({ tmp: () => { throw Error('EACCES'); } }).reason).toMatch(/cannot be listed/u);
  });
  it('is ready only while the kernel refuses a /private/tmp file created after the sweep, and always removes that canary', () => {
    removed = 0;
    expect(ready().ready).toBe(true);
    // No inherited deny entry: the fresh world-readable canary is readable as the harness user, so nothing launches.
    expect(ready({ probe: probe(null, null, { ok: true, code: null }) }).reason).toMatch(/does not refuse the harness user new \/private\/tmp files/u);
    // A refusal that is not the kernel's permission answer (the canary vanished) proves nothing either.
    expect(ready({ probe: probe(null, null, { ok: false, code: 'ENOENT' }) }).reason).toMatch(/does not refuse/u);
    expect(ready({ canary: () => { throw Error('EEXIST'); } }).reason).toMatch(/canary cannot be created/u);
    expect(ready({ probe: () => null }).reason).toMatch(/not permitted/u);
    expect(removed).toBe(4);
  });
  it('makes the canary world-readable, in the given directory, under a fresh name', () => {
    const base = fresh('canary-base');
    const one = tmpCanary(base), two = tmpCanary(base);
    expect(one.path).not.toBe(two.path);
    expect(lstatSync(one.path).mode & 0o777).toBe(0o644);
    one.remove(); two.remove();
    expect([existsSync(one.path), existsSync(two.path)]).toEqual([false, false]);
  });
  it('says which identity the harness runs as, and an unavailable one as held, never as a fallback', () => {
    expect(harnessStatusLine({ ready: true, user: '_instarharness' })).toMatch(/own macOS user \(_instarharness\).*new \/private\/tmp entries are denied to it from creation/u);
    expect(harnessStatusLine({ ready: false, reason: 'no user x' })).toMatch(/^Harness identity: UNAVAILABLE, so every Claude Code launch is held \(nothing runs as the operator's account\).*no user x/u);
    expect(harnessStatusLine({ ready: false, reason: 'no user x' })).not.toMatch(/FALLBACK/u);
    expect(harnessStatusLine(null)).toBeNull();
  });
});

describe('the gate: an unavailable harness user holds every launch, a ready one runs it', () => {
  const profile = { expectedAccount: 'a@example.invalid', organization: 'org', plan: 'max' };
  const gateWith = (results: Array<Record<string, unknown>>, clock: { t: number }, adopt: ((uid: number) => void) | null = () => {}) => {
    const lines: string[] = [];
    const gate = harnessGate({ profile, denied: [], clock: () => clock.t, runner: () => 'operator', log: (line: string) => lines.push(line),
      check: () => results.shift() ?? { ready: false, reason: 'exhausted' }, login: () => 'sk-ant-oat01-synthetic-login', adopt });
    return { gate, lines };
  };
  it('throws instead of returning an identity while not ready, decides again only after the recheck interval, then runs as the harness user', () => {
    const clock = { t: 0 };
    const { gate, lines } = gateWith([{ ready: false, reason: 'no user _instarharness' }, { ready: false, reason: 'still no user' },
      { ready: true, user: '_instarharness', uid: 498, hookScript: '/h/hook' }], clock);
    expect(() => gate.current()).toThrow(/harness identity is unavailable \(no user _instarharness\); this launch is held/u);
    clock.t = HARNESS_RECHECK_MS - 1;
    expect(() => gate.current()).toThrow(/no user _instarharness/u);
    clock.t = HARNESS_RECHECK_MS;
    expect(() => gate.current()).toThrow(/still no user/u);
    clock.t = 2 * HARNESS_RECHECK_MS;
    const identity = gate.current();
    expect(identity).toMatchObject({ ready: true, user: '_instarharness', uid: 498, runner: 'operator', plan: 'max' });
    expect(identity.login()).toBe('sk-ant-oat01-synthetic-login');
    // The command it runs is the launcher as the harness user: never the harness executable as this account.
    const command = harnessCommand({ executable: '/h/bin/claude', args: [], env: {} }, identity);
    expect(command.args.slice(0, 5)).toEqual(['-n', '-u', '_instarharness', identity.launcher, '--handoff']);
    expect(lines.map(line => line.split(' ')[2])).toEqual(['UNAVAILABLE,', 'UNAVAILABLE,', 'Claude']);
  });
  it('holds a ready identity whose uid changed since launch (the census was attached for the first)', () => {
    const clock = { t: 0 };
    const { gate } = gateWith([{ ready: false, reason: 'login missing', uid: 498 }, { ready: true, user: '_instarharness', uid: 499, hookScript: '/h' }], clock);
    expect(gate.uid).toBe(498);
    clock.t = HARNESS_RECHECK_MS;
    expect(() => gate.current()).toThrow(/id changed since launch \(498 to 499\)/u);
  });
  it('a user that did not exist at launch is handed to the census before its first launch, and once only', () => {
    const clock = { t: 0 }, adopted: number[] = [];
    const { gate } = gateWith([{ ready: false, reason: 'no user _instarharness' }, { ready: true, user: '_instarharness', uid: 498, hookScript: '/h' },
      { ready: true, user: '_instarharness', uid: 498, hookScript: '/h' }], clock, uid => { adopted.push(uid); });
    expect(gate.uid).toBeNull();
    expect(() => gate.current()).toThrow(/no user _instarharness/u);
    expect(adopted).toEqual([]);
    clock.t = HARNESS_RECHECK_MS;
    expect(gate.current()).toMatchObject({ ready: true, uid: 498 });
    expect(adopted).toEqual([498]);
    expect(gate.current()).toMatchObject({ ready: true, uid: 498 });
    expect(adopted).toEqual([498]);
  });
  it('holds that late user while the census cannot take it, and when no census was given', () => {
    const clock = { t: 0 };
    const { gate } = gateWith([{ ready: false, reason: 'no user _instarharness' }, { ready: true, user: '_instarharness', uid: 498, hookScript: '/h' }],
      clock, () => { throw Error('a different harness user is already in the census'); });
    clock.t = HARNESS_RECHECK_MS;
    expect(() => gate.current()).toThrow(/appeared after launch and the resource census cannot take its processes \(a different harness user/u);
    const later = { t: 0 };
    const none = gateWith([{ ready: false, reason: 'no user _instarharness' }, { ready: true, user: '_instarharness', uid: 498, hookScript: '/h' }],
      later, null);
    later.t = HARNESS_RECHECK_MS;
    expect(() => none.gate.current()).toThrow(/no census to take it/u);
  });
  it('a user present (ready) at launch is the census\'s from attach, never adopted again', () => {
    const adopted: number[] = [];
    const { gate } = gateWith([{ ready: true, user: '_instarharness', uid: 498, hookScript: '/h' }], { t: 0 }, uid => { adopted.push(uid); });
    expect(gate.uid).toBe(498);
    expect(gate.current()).toMatchObject({ ready: true });
    expect(adopted).toEqual([]);
  });
  it('a tool turn given an unavailable identity throws before preparing or launching anything', async () => {
    const root = fresh('held-turn');
    let invoked = 0, fellBack = 0;
    await expect(runToolTurn({ journal: { view: { toolTurns: undefined, genesis: {} }, append: () => { throw Error('nothing is journaled'); } },
      root, id: 'telegram:1:update:9', prepared: 'p', promptLimit: 1000, deniedRoots: [], operations: [], now: () => 1, redactText: (t: string) => t,
      harness: { ready: false, reason: 'no user _instarharness' }, fallback: async () => { fellBack++; return { result: 'x' }; },
      invoke: async () => { invoked++; return { state: 'complete' }; } })).rejects.toThrow(/harness identity is unavailable \(no user _instarharness\)/u);
    expect([invoked, fellBack]).toEqual([0, 0]);
    expect(existsSync(join(root, 'tool-turns'))).toBe(false);
  });
});

describe('the login custody and the runner\'s /private/tmp entries', () => {
  const profile = { expectedAccount: 'a@example.invalid', organization: 'org', plan: 'max', configDirectory: '/h/config', home: '/h/home' };
  it('stores and reads back a login bound to the profile, the runner\'s alone, and refuses anything else by name', () => {
    const path = join(fresh('custody-root'), 'custody', 'login.json');
    storeHarnessLogin(profile, 'sk-ant-oat01-synthetic-login-token', path);
    expect((lstatSync(path).mode & 0o777)).toBe(0o600);
    expect((lstatSync(join(path, '..')).mode & 0o777)).toBe(0o700);
    expect(readHarnessLogin(profile, path)).toBe('sk-ant-oat01-synthetic-login-token');
    expect(() => readHarnessLogin({ ...profile, expectedAccount: 'b@example.invalid' }, path)).toThrow(/another account/u);
    chmodSync(path, 0o644);
    expect(() => readHarnessLogin(profile, path)).toThrow(/not the runner's alone/u);
    chmodSync(path, 0o600); chmodSync(join(path, '..'), 0o755);
    expect(() => readHarnessLogin(profile, path)).toThrow(/directory is not the runner's alone/u);
    expect(() => storeHarnessLogin(profile, 'short', path)).toThrow(/not a login token/u);
    expect(plaintextLogins(profile, (p: string) => p === '/h/config/.credentials.json')).toEqual(['/h/config/.credentials.json']);
    expect(plaintextLogins(profile, () => false)).toEqual([]);
  });
  it('closes the runner\'s own top-level entries to every other user, leaving links alone', () => {
    const base = fresh('tmp-base');
    writeFileSync(join(base, 'open.log'), 'x', { mode: 0o644 }); chmodSync(join(base, 'open.log'), 0o644);
    mkdirSync(join(base, 'open-dir'), { mode: 0o755 }); chmodSync(join(base, 'open-dir'), 0o755);
    writeFileSync(join(base, 'open-dir', 'inner.txt'), 'x', { mode: 0o644 });
    writeFileSync(join(base, 'private.log'), 'x', { mode: 0o600 });
    symlinkSync('/etc/hosts', join(base, 'link'));
    const closed = closeOperatorTmp(base);
    expect(closed.failed).toBe(0);
    expect(closed.entries.sort()).toEqual(['open-dir', 'open.log', 'private.log'].map(name => join(base, name)));
    expect(lstatSync(join(base, 'open.log')).mode & 0o777).toBe(0o600);
    expect(lstatSync(join(base, 'open-dir')).mode & 0o777).toBe(0o700);
    expect(lstatSync(join(base, 'link')).isSymbolicLink()).toBe(true);
  });
});

describe('the launcher', () => {
  const dir = fresh('launcher');
  copyFileSync(join(__dirname, 'harness-launch.mjs'), join(dir, 'harness-launch.mjs'));
  const fake = join(dir, 'fake');
  // The stand-in harness: reports its environment, leaves a grandchild in its group and one that moved to its own group
  // (on `exit`, after living through one tracking refresh: a group-leaver orphaned within the same instant is the resource
  // owner's census to find, not the launcher's).
  writeFileSync(fake, `#!/bin/sh\nenv | sort > "$OUT/env"\nsleep 30 &\necho $! > "$OUT/same-group"\n`
    + `/usr/bin/perl -e 'setpgrp(0,0); sleep 30' &\necho $! > "$OUT/own-group"\n[ "$1" = exit ] && sleep 0.6 && exit 7\nwait\n`, { mode: 0o755 });
  chmodSync(fake, 0o755);
  const launcher = join(dir, 'harness-launch.mjs');
  const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const pidOf = (out: string, name: string) => Number(readFileSync(join(out, name), 'utf8').trim());
  const waitFor = async (check: () => boolean, ms = 3000) => { const end = Date.now() + ms; while (!check() && Date.now() < end) await new Promise(r => setTimeout(r, 20)); return check(); };

  it('passes exactly the given environment and the exit code, and ends what the harness left behind', async () => {
    const out = fresh('launcher-exit');
    const result = spawnSync(process.execPath, [launcher, `OUT=${out}`, 'MARK=a b', '--', fake, 'exit'], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin', LEAK: 'no' } });
    expect(result.status).toBe(7);
    const env = readFileSync(join(out, 'env'), 'utf8');
    expect(env).toContain('MARK=a b'); expect(env).not.toContain('LEAK');
    // Absent from the command's environment, the temporary directory is the harness area's own (`tmp` beside `bin`).
    expect(env).toContain(`TMPDIR=${join(dir, '..', 'tmp').replace(/\/launcher\/\.\./u, '')}`);
    expect(env).toContain('CLAUDE_CODE_TMPDIR=');
    expect(await waitFor(() => !alive(pidOf(out, 'same-group')) && !alive(pidOf(out, 'own-group')))).toBe(true);
  });
  it('keeps a temporary directory the command names, and refuses the terminal mode with no terminal', async () => {
    const out = fresh('launcher-tmpdir');
    const given = spawnSync(process.execPath, [launcher, `OUT=${out}`, 'CLAUDE_CODE_TMPDIR=/private/tmp/itt-000000000000', '--', fake, 'exit'],
      { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
    expect(given.status).toBe(7);
    expect(readFileSync(join(out, 'env'), 'utf8')).toContain('CLAUDE_CODE_TMPDIR=/private/tmp/itt-000000000000\n');
    const tty = spawnSync(process.execPath, [launcher, '--handoff', '--tty', `OUT=${out}`, '--', fake], { encoding: 'utf8', input: '{}\n', env: { PATH: '/usr/bin:/bin' } });
    expect(tty.status).toBe(125);
    expect(tty.stderr).toMatch(/--tty needs a terminal on stdout/u);
  });
  it('ends the whole tree, a group-leaver included, within the bound once its parent (sudo) is gone', async () => {
    const out = fresh('launcher-parent');
    const parent = spawn('/bin/sh', ['-c', `"${process.execPath}" "${launcher}" OUT=${out} -- "${fake}" & wait`], { stdio: 'ignore', detached: true });
    expect(await waitFor(() => existsSync(join(out, 'own-group')) && readFileSync(join(out, 'own-group'), 'utf8').trim().length > 0)).toBe(true);
    const same = pidOf(out, 'same-group'), own = pidOf(out, 'own-group');
    expect(alive(same) && alive(own)).toBe(true);
    const killedAt = Date.now();
    process.kill(parent.pid!, 'SIGKILL');
    expect(await waitFor(() => !alive(same) && !alive(own))).toBe(true);
    expect(Date.now() - killedAt).toBeLessThan(2000);
  });
  it('ends the tree on a relayed stop (TERM)', async () => {
    const out = fresh('launcher-term');
    const child = spawn(process.execPath, [launcher, `OUT=${out}`, '--', fake], { stdio: 'ignore' });
    expect(await waitFor(() => existsSync(join(out, 'own-group')) && readFileSync(join(out, 'own-group'), 'utf8').trim().length > 0)).toBe(true);
    const same = pidOf(out, 'same-group'), own = pidOf(out, 'own-group');
    child.kill('SIGTERM');
    expect(await waitFor(() => !alive(same) && !alive(own))).toBe(true);
  });
  it('hands the login over on descriptor 3 and the MCP configuration on descriptor 4, each once, and passes the rest of stdin on', () => {
    const out = fresh('launcher-handoff'), reader = join(dir, 'fake-handoff');
    writeFileSync(reader, `#!/bin/sh\nenv | sort > "$OUT/env"\necho "$@" > "$OUT/args"\ncat <&3 > "$OUT/fd3"\ncat /dev/fd/4 > "$OUT/fd4"\n`
      + `cat <&3 > "$OUT/fd3-again"\ncat > "$OUT/stdin"\n`, { mode: 0o755 });
    chmodSync(reader, 0o755);
    const header = JSON.stringify({ login: 'sk-ant-oat01-synthetic-login', mcp: '{"mcpServers":{}}' });
    const result = spawnSync(process.execPath, [launcher, '--handoff', `OUT=${out}`, '--', reader, '--mcp-config', '/dev/fd/4'],
      { input: `${header}\nthe prompt\nline two`, encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
    expect(result.status).toBe(0);
    expect(readFileSync(join(out, 'fd3'), 'utf8')).toBe('sk-ant-oat01-synthetic-login\n');
    expect(readFileSync(join(out, 'fd3-again'), 'utf8')).toBe('');
    expect(readFileSync(join(out, 'fd4'), 'utf8')).toBe('{"mcpServers":{}}');
    expect(readFileSync(join(out, 'stdin'), 'utf8')).toBe('the prompt\nline two');
    const env = readFileSync(join(out, 'env'), 'utf8');
    expect(env).toContain('CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR=3');
    expect(env + readFileSync(join(out, 'args'), 'utf8')).not.toContain('synthetic-login');
    // A malformed or missing hand-off line runs nothing.
    for (const input of ['not json\n', '{"login":"has space"}\n', '{"other":"x"}\n', ''])
      expect(spawnSync(process.execPath, [launcher, '--handoff', `OUT=${out}`, '--', reader], { input, encoding: 'utf8' }).status).toBe(125);
  });
  it('runs only an executable installed beside it, and probes access without changing anything', () => {
    expect(spawnSync(process.execPath, [launcher, '--', '/bin/echo', 'x'], { encoding: 'utf8' }).status).toBe(125);
    expect(spawnSync(process.execPath, [launcher, 'lower=x', '--', fake], { encoding: 'utf8' }).status).toBe(125);
    const rows = spawnSync(process.execPath, [launcher, '--probe', `r:${fake}`, `w:${dir}`, 'r:/nonexistent/x'], { encoding: 'utf8' }).stdout
      .trim().split('\n').map(line => JSON.parse(line));
    expect(rows.map(row => row.ok)).toEqual([true, true, false]);
    expect(rows[2].code).toBe('ENOENT');
  });
});

describe('the census and cleanup of a harness-user tree', () => {
  it('lists the harness user beside the current user', async () => {
    let args: string[] = [];
    const inventory = createProcessInventory({ query: async (_file: string, a: string[]) => { args = a; return ''; }, now: () => 1, monotonic: () => 1,
      identity: { machine: 'm', hardwareProfile: 'h' }, limit: 10, freshForMs: 1, uid: 501, uids: () => [501, 498] });
    await inventory.census();
    expect(args.slice(0, 2)).toEqual(['-U', '501,498']);
  });
  // A member the runner's account cannot signal: a real process of this user that the fakes present as the harness
  // user's (its uid rewritten in the census, its signal refused), which "its launcher" ends 300 ms later.
  const launchWithUnkillableMember = async (harnessUid: number | null, late = false) => {
    const area = fresh(`owner-${String(harnessUid)}`), pidFile = join(area, 'member');
    const memberPid = () => { try { return Number(readFileSync(pidFile, 'utf8').trim()) || null; } catch { return null; } };
    const fakeUid = 498;
    const query = async (file: string, args: string[]) => {
      const text = await hostQuery(file, file === '/bin/ps' && args[0] === '-U' ? ['-U', String(process.getuid!()), ...args.slice(2)] : args);
      const pid = memberPid();
      if (text === null || file !== '/bin/ps' || pid === null) return text;
      return text.split('\n').map((line: string) => { const parts = line.trim().split(/\s+/u);
        return Number(parts[0]) === pid ? line.replace(new RegExp(`^(\\s*${parts[0]}\\s+${parts[1]}\\s+${parts[2]}\\s+)${parts[3]}`, 'u'), `$1${String(fakeUid)}`) : line; }).join('\n');
    };
    let ended = false;
    const signal = (target: number, name: string) => {
      const pid = memberPid();
      if (pid !== null && (target === pid || target < 0)) {
        if (!ended) { ended = true; setTimeout(() => { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }, 300); }
        if (target === pid) { const error = Object.assign(Error('EPERM'), { code: 'EPERM' }); throw error; }
        return;
      }
      process.kill(target, name);
    };
    const owner = createResourceOwner(RESOURCE_CEILINGS);
    await owner.attach({ query, signal, ...(harnessUid === null || late ? {} : { harnessUid }) });
    // A harness user that appeared after attach (harness-user.mjs harnessGate's adopt), before this launch.
    if (late && harnessUid !== null) owner.adoptHarnessUid(harnessUid);
    const result = await owner.execute({ executable: '/bin/sh', args: ['-c', `sleep 30 & echo $! > "${pidFile}"; sleep 0.5; exit 0`], cwd: area,
      env: { PATH: '/usr/bin:/bin' }, stdin: '', timeout: 20000, maxBytes: 4096 });
    const pid = memberPid();
    if (pid) try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ }
    return result.resources;
  };
  it('waits for a harness-user member its launcher ends, and verifies the cleanup', async () => {
    const resources = await launchWithUnkillableMember(498);
    expect(resources.cleanup).toBe('verified');
  }, 30000);
  it('without the harness user declared, a member it cannot signal stays unresolved (loud)', async () => {
    const resources = await launchWithUnkillableMember(null);
    expect(resources.cleanup).toBe('unresolved');
  }, 30000);
  it('a harness user adopted after attach is in the census from then on, as one given at attach is', async () => {
    const resources = await launchWithUnkillableMember(498, true);
    expect(resources.cleanup).toBe('verified');
  }, 30000);
  it('adopts one harness user only: the same uid again is a no-op, a different one or this account refuses', async () => {
    const owner = createResourceOwner(RESOURCE_CEILINGS);
    expect(() => owner.adoptHarnessUid(process.getuid!())).toThrow(/separate identity/u);
    owner.adoptHarnessUid(498);
    owner.adoptHarnessUid(498);
    expect(() => owner.adoptHarnessUid(499)).toThrow(/different harness user is already in the census/u);
  });
  it('refuses the runner\'s own uid as the harness user', async () => {
    await expect(createResourceOwner(RESOURCE_CEILINGS).attach({ harnessUid: process.getuid!() })).rejects.toThrow(/separate identity/u);
  });
});

describe('a tool turn in harness mode', () => {
  it('puts its admission state in the harness area (add-only, opened after the runner\'s files), its egress state under the root, and its hook copy in the settings', () => {
    const root = fresh('turn-root'), stateBase = fresh('turn-state'), granted: string[][] = [];
    let opened: string[] | null = null, volume: string | null = null;
    const grant = { volume: (mounted: string) => { volume = mounted; },
      state: (directory: string) => { mkdirSync(directory, { mode: 0o700 }); granted.push([directory]);
        return { open: (readable: string[]) => { opened = readable.map(path => readFileSync(path, 'utf8').length > 0 ? path : ''); } }; } };
    const turn = prepareToolTurn({ root, operation: 'telegram:1:update:2', attempt: 0, operations: [], scratch: (dir: string) => {
      mkdirSync(join(dir, 'vol'), { recursive: true, mode: 0o700 }); return realpathSync(join(dir, 'vol')); },
    harness: { user: '_instarharness', runner: 'me', hookScript: '/h/hook/x/tool-admission-hook.mjs', rootState: stateBase }, grant });
    expect(lstatSync(join(turn.directory, 'state')).isSymbolicLink()).toBe(true);
    expect(turn.stateDirectory).toBe(join(stateBase, turn.slug));
    expect(readlinkSync(join(turn.directory, 'state'))).toBe(join(stateBase, turn.slug));
    expect(turn.privateDirectory).toBe(join(turn.directory, TOOL_TURN_PRIVATE));
    expect(turn.hook.script).toBe('/h/hook/x/tool-admission-hook.mjs');
    expect(volume).toBe(turn.scratch);
    expect(opened).toEqual([join(turn.stateDirectory, 'config.json')]);
    // The MCP servers' configuration (their credentials) stays runner-private: never in the harness's state.
    const withMcp = prepareToolTurn({ root, operation: 'telegram:1:update:4', attempt: 0, operations: [], scratch: (dir: string) => {
      mkdirSync(join(dir, 'vol'), { recursive: true, mode: 0o700 }); return realpathSync(join(dir, 'vol')); },
    mcp: { servers: { s: { command: 'c', env: { K: 'secret' } } }, reads: [] },
    harness: { user: '_instarharness', runner: 'me', hookScript: '/h/hook/x/tool-admission-hook.mjs', rootState: stateBase }, grant });
    expect(withMcp.mcp.config).toBe(join(withMcp.privateDirectory, 'mcp.json'));
    expect(existsSync(join(withMcp.stateDirectory, 'mcp.json'))).toBe(false);
    expect(opened).toEqual([join(withMcp.stateDirectory, 'config.json')]);
    // Without the harness the turn is laid out exactly as before.
    const plain = prepareToolTurn({ root, operation: 'telegram:1:update:3', attempt: 0, operations: [], scratch: (dir: string) => {
      mkdirSync(join(dir, 'vol'), { recursive: true, mode: 0o700 }); return realpathSync(join(dir, 'vol')); } });
    expect(lstatSync(join(plain.directory, 'state')).isDirectory()).toBe(true);
    expect(plain.privateDirectory).toBe(plain.stateDirectory);
    // Prune removes a harness turn's linked state with it, and never a directory outside the harness area.
    expect(pruneToolTurns(root, 0, () => true, new Set(), stateBase)).toMatchObject({ removed: 3, failed: 0 });
    expect(existsSync(turn.stateDirectory)).toBe(false);
    const outside = fresh('outside-state'), link = join(fresh('link-holder'), 'state');
    spawnSync('/bin/ln', ['-s', outside, link]);
    expect(removeHarnessState(link, stateBase)).toBe(false);
    expect(existsSync(outside)).toBe(true);
  });
  it('grants a volume once, never through a link', () => {
    const mounted = fresh('volume'), calls: string[][] = [];
    mkdirSync(join(mounted, 'ws')); writeFileSync(join(mounted, 'ws', 'a.txt'), 'a');
    spawnSync('/bin/ln', ['-s', '/etc/hosts', join(mounted, 'ws', 'link')]);
    expect(grantVolume(mounted, 'h', 'r', 100, (paths: string[]) => { calls.push(paths); })).toEqual({ walked: 2 });
    expect(calls.flat()).not.toContain(join(mounted, 'ws', 'link'));
    expect(JSON.parse(readFileSync(join(mounted, HARNESS_VOLUME_MARK), 'utf8'))).toEqual({ v: 1, user: 'h' });
    expect(grantVolume(mounted, 'h', 'r', 100, () => {})).toEqual({ walked: 0 });
  });
});

describe('the journal records which identity the harness ran as', () => {
  const journalWith = (harness: unknown) => {
    const root = fresh(`journal-${Math.random().toString(16).slice(2)}`);
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(5), { kind: 'genesis', bot: '1', chat: '2', operator: '2',
      grant: 'grant:x', configurationDigest: 'sha256:x', expires: 9_999_999_999_999, maxCalls: 20, maxReplies: 5, maxTurns: 5, maxBytes: 32768, cursor: 0 });
    journal.append({ kind: 'tool-turn', phase: 'reserved', id: 'telegram:1:update:1', attempt: 0, calls: 1, at: 1 } as never);
    return () => journal.append({ kind: 'tool-turn', phase: 'trace', id: 'telegram:1:update:1', attempt: 0, calls: [], consistent: true,
      workspaceBytes: null, ...(harness === undefined ? {} : { harness }), at: 2 } as never);
  };
  it('accepts its own user (and reads back a fallback row of the unit\'s first build)', () => {
    expect(journalWith({ user: '_instarharness' })).not.toThrow();
    expect(journalWith({ fallback: 'no user _instarharness' })).not.toThrow();
    expect(journalWith(undefined)).not.toThrow();
  });
  it('refuses an empty or ambiguous identity', () => {
    expect(journalWith({})).toThrow(/harness identity/u);
    expect(journalWith({ user: '' })).toThrow(/harness identity/u);
    expect(journalWith({ user: 'a', fallback: 'b' })).toThrow(/harness identity/u);
  });
});

describe('a delegated session as the harness user', () => {
  const gate = 'http://127.0.0.1:4000/0123456789abcdef0123456789abcdef/session-work-a';
  it('lays its step state out as a tool turn\'s: created by the harness-state preparer, its config and shell profile opened once written', () => {
    const base = fresh('session-admission-harness'), workspace = fresh('session-workspace-harness');
    let prepared: string[] = [], opened: string[] = [];
    const state = prepareSessionAdmission({ base, claim: 'session-work-a', workspace, maxCalls: 4, gate, harness: { user: '_instarharness', runner: 'me' },
      prepare: (directory: string, user: string, runner: string) => { prepared = [directory, user, runner]; mkdirSync(directory, { mode: 0o700 });
        return { open: (readable: string[]) => { opened = readable.filter(path => existsSync(path)); } }; } });
    expect(prepared).toEqual([join(base, 'session-work-a'), '_instarharness', 'me']);
    expect(opened).toEqual([join(state, 'config.json'), join(realpathSync(state), 'shell.sb')]);
    // The hook it runs is the read-only copy the command names.
    expect(sessionAdmissionCommand({ base, node: '/n', script: '/h/hook/x/tool-admission-hook.mjs' })('session-work-a', 'pre'))
      .toBe(`/n /h/hook/x/tool-admission-hook.mjs pre ${join(base, 'session-work-a')}`);
  });
  it('without a harness user, the step state is the runner\'s own plain directory, as before', () => {
    const base = fresh('session-admission-plain'), workspace = fresh('session-workspace-plain');
    let called = false;
    const state = prepareSessionAdmission({ base, claim: 'session-work-a', workspace, maxCalls: 4, gate,
      prepare: () => { called = true; throw Error('not used'); } });
    expect(called).toBe(false);
    expect(lstatSync(state).mode & 0o777).toBe(0o700);
    expect(existsSync(join(state, 'config.json'))).toBe(true);
  });
  it('runs the pane\'s harness as the harness user in the launcher\'s terminal mode, the login only in the stdin hand-off', () => {
    const profile = { expectedAccount: 'a@example.invalid', organization: 'org', plan: 'max' };
    const command = harnessSessionCommand({ user: '_instarharness', profile, executable: '/h/bin/claude-2.1.280', args: ['--session-id', 'x'],
      env: { PATH: '/usr/bin:/bin', HOME: '/h/home', ANTHROPIC_BASE_URL: 'http://127.0.0.1:4000/g' }, login: () => 'sk-ant-oat01-synthetic-login' });
    expect(command.executable).toBe('/usr/bin/sudo');
    expect(command.args.slice(0, 6)).toEqual(['-n', '-u', '_instarharness', '/Users/Shared/instar-harness/bin/harness-launch', '--handoff', '--tty']);
    expect(command.args).toContain('ANTHROPIC_BASE_URL=http://127.0.0.1:4000/g');
    expect(command.args.slice(-3)).toEqual(['/h/bin/claude-2.1.280', '--session-id', 'x']);
    expect(JSON.stringify(command.args)).not.toContain('synthetic-login');
    expect(command.stdin).toBe(`${JSON.stringify({ login: 'sk-ant-oat01-synthetic-login' })}\n`);
    expect(() => harnessSessionCommand({ user: '_instarharness', profile, executable: '/x', args: [], env: {},
      login: () => { throw Error('the login custody file is not the runner\'s alone'); } })).toThrow(/not the runner's alone/u);
  });
});
