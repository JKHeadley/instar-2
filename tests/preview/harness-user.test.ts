// Desk unit harness-user (plan row #464): the decisions that run the preview's Claude Code harness as its own macOS user,
// each proven on both sides without the root step (fakes for sudo and the probe; the launcher and the resource owner on
// real processes of this user). The live proof against the real `_instarharness` user is
// tests/integration/tool-turn-harness-user-live.test.ts.
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openPreviewJournal } from './journal.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { harnessCommand } from '../../scripts/production-boot-io.mjs';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createResourceOwner, RESOURCE_CEILINGS, hostQuery } from '../../scripts/resource-owner.mjs';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createProcessInventory } from '../../scripts/process-inventory.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { harnessExecutable, harnessReadiness, harnessStatusLine, HARNESS_HOOK_FILES, HARNESS_OFF_LINE, HARNESS_PROFILE, harnessSocketDirectory, removeHarnessState, grantVolume, HARNESS_VOLUME_MARK } from './harness-user.mjs';
// @ts-expect-error The runner side stays plain JavaScript.
import { prepareToolTurn, pruneToolTurns, serveMcpSecrets, TOOL_MCP_LAUNCHER, TOOL_TURN_PRIVATE } from './tool-turn.mjs';

const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'harness-user-')));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const fresh = (name: string) => { const dir = join(scratch, name); mkdirSync(dir, { recursive: true, mode: 0o700 }); return realpathSync(dir); };

describe('the harness command line', () => {
  it('runs the launcher as the harness user through sudo, the command\'s environment as launcher arguments', () => {
    const command = harnessCommand({ executable: '/h/bin/claude-2.1.280', args: ['-p', '--model', 'm'], env: { HOME: '/h/home', CLAUDE_CONFIG_DIR: '/h/config', SKIP: undefined },
      cwd: '/w', stdin: 'x' }, { user: '_instarharness', launcher: '/h/bin/harness-launch' });
    expect(command).toEqual({ executable: '/usr/bin/sudo', args: ['-n', '-u', '_instarharness', '/h/bin/harness-launch', 'HOME=/h/home',
      'CLAUDE_CONFIG_DIR=/h/config', '--', '/h/bin/claude-2.1.280', '-p', '--model', 'm'], env: { PATH: '/usr/bin:/bin' } });
  });
  it('refuses a malformed identity rather than guessing', () => {
    expect(() => harnessCommand({ executable: '/x', args: [], env: {} }, { user: 'a b', launcher: '/l' })).toThrow(/malformed/u);
    expect(() => harnessCommand({ executable: '/x', args: [], env: {} }, { user: 'ok', launcher: 'relative' })).toThrow(/malformed/u);
  });
});

describe('readiness: the switch is decided from live state, a refusal names its reason', () => {
  const profile = { version: '2.1.280', artifact: 'sha256:good', executable: harnessExecutable('2.1.280'),
    home: `${HARNESS_PROFILE}/home`, configDirectory: `${HARNESS_PROFILE}/config`, workingDirectory: `${HARNESS_PROFILE}/work` };
  const exec = (uid: string) => (file: string) => { if (file === '/usr/bin/id') { if (uid === 'none') throw Error('no such user'); return `${uid}\n`; } throw Error(file); };
  const install = { launcher: () => 'sha256:l', hook: () => '/h/hook/x/tool-admission-hook.mjs' };
  const probe = (exposed: string | null, unreadable: string | null) => (specs: string[]) => specs.map(spec => {
    const path = spec.slice(2), denied = ['/root', '/Users/operator'].includes(path);
    return { path, mode: spec[0], ok: path === unreadable ? false : path === exposed ? true : !denied, code: null };
  });
  const ready = (overrides: Record<string, unknown> = {}) => harnessReadiness({ profile, denied: ['/root', '/Users/operator'], exec: exec('498'),
    install, probe: probe(null, null), digestOf: () => 'sha256:good', ...overrides });
  it('is ready when the user, launcher, hook, pinned copy and the kernel\'s answers all hold', () => {
    expect(ready()).toEqual({ ready: true, user: '_instarharness', uid: 498, hookScript: '/h/hook/x/tool-admission-hook.mjs' });
  });
  it('refuses each missing condition by name', () => {
    expect(ready({ exec: exec('none') })).toEqual({ ready: false, reason: 'no user _instarharness' });
    expect(ready({ exec: exec(String(process.getuid!())) }).reason).toMatch(/not a separate identity/u);
    expect(ready({ profile: { ...profile, executable: '/elsewhere/claude' } }).reason).toMatch(/installed harness copy/u);
    expect(ready({ profile: { ...profile, home: '/Users/Shared/instar-preview-s2/home' } }).reason).toMatch(/harness area/u);
    expect(ready({ digestOf: () => 'sha256:other' }).reason).toMatch(/differs from the pinned artifact/u);
    expect(ready({ install: { launcher: () => { throw Error('EACCES'); }, hook: install.hook } }).reason).toMatch(/cannot be installed/u);
    expect(ready({ probe: () => null }).reason).toMatch(/not permitted/u);
    expect(ready({ probe: probe(null, `${HARNESS_PROFILE}/config`) }).reason).toBe(`the harness user cannot read ${HARNESS_PROFILE}/config`);
    expect(ready({ probe: probe('/Users/operator', null) }).reason).toBe('the harness user can read /Users/operator');
  });
  it('says which identity the harness runs as, and a fallback loudly with its reason', () => {
    expect(harnessStatusLine({ ready: true, user: '_instarharness' })).toMatch(/own macOS user \(_instarharness\)/u);
    expect(harnessStatusLine({ ready: false, reason: 'no user x' })).toMatch(/^Harness identity: FALLBACK.*no user x/u);
    expect(harnessStatusLine(null)).toBeNull();
    // With no switch at all the launch is not silent: the race is named open.
    expect(HARNESS_OFF_LINE).toMatch(/^Harness identity: OFF, Claude Code runs as the operator's account \(no --harness-user\).*race is open\.$/u);
  });
});

describe('the launcher', () => {
  const dir = fresh('launcher');
  copyFileSync(join(__dirname, 'harness-launch.mjs'), join(dir, 'harness-launch.mjs'));
  const fake = join(dir, 'fake');
  // The stand-in harness: reports its environment, leaves a grandchild in its group and one that moved to its own group.
  writeFileSync(fake, `#!/bin/sh\nenv | sort > "$OUT/env"\nsleep 30 &\necho $! > "$OUT/same-group"\n`
    + `/usr/bin/perl -e 'setpgrp(0,0); sleep 30' &\necho $! > "$OUT/own-group"\n[ "$1" = exit ] && exit 7\nwait\n`, { mode: 0o755 });
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
    expect(await waitFor(() => !alive(pidOf(out, 'same-group')) && !alive(pidOf(out, 'own-group')))).toBe(true);
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
  const launchWithUnkillableMember = async (harnessUid: number | null) => {
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
    await owner.attach({ query, signal, ...(harnessUid === null ? {} : { harnessUid }) });
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
    // Without the harness the turn is laid out exactly as before.
    const plain = prepareToolTurn({ root, operation: 'telegram:1:update:3', attempt: 0, operations: [], scratch: (dir: string) => {
      mkdirSync(join(dir, 'vol'), { recursive: true, mode: 0o700 }); return realpathSync(join(dir, 'vol')); } });
    expect(lstatSync(join(plain.directory, 'state')).isDirectory()).toBe(true);
    expect(plain.privateDirectory).toBe(plain.stateDirectory);
    // Prune removes a harness turn's linked state with it, and never a directory outside the harness area.
    expect(pruneToolTurns(root, 0, () => true, new Set(), stateBase)).toMatchObject({ removed: 2, failed: 0 });
    expect(existsSync(turn.stateDirectory)).toBe(false);
    const outside = fresh('outside-state'), link = join(fresh('link-holder'), 'state');
    spawnSync('/bin/ln', ['-s', outside, link]);
    expect(removeHarnessState(link, stateBase)).toBe(false);
    expect(existsSync(outside)).toBe(true);
  });
  it('launches a SecretRef MCP server through the harness\'s read-only launcher copy, over a socket in the harness area', async () => {
    // The launcher is plain Node with no imports outside node:, so its copy beside the hook runs for a user who cannot read the repo.
    expect(HARNESS_HOOK_FILES).toContain('mcp-launch.mjs');
    expect(readFileSync(TOOL_MCP_LAUNCHER, 'utf8').match(/from '([^']+)'/gu)?.every(spec => /from 'node:/u.test(spec))).toBe(true);
    const sockets = fresh('sockets'), acl: [string[], string[]][] = [];
    const made = harnessSocketDirectory('_instarharness', sockets, (paths: string[], entries: string[]) => { acl.push([paths, entries]); });
    expect(made.startsWith(`${sockets}/m-`)).toBe(true);
    expect(lstatSync(made).mode & 0o777).toBe(0o700);
    expect(acl).toEqual([[[sockets], ['user:_instarharness allow search']], [[made], ['user:_instarharness allow search']]]);
    const root = fresh('mcp-root'), stateBase = fresh('mcp-state');
    const grant = { volume: () => {}, socket: () => made,
      state: (directory: string) => { mkdirSync(directory, { mode: 0o700 }); return { open: () => {} }; } };
    const mcp = { servers: { keyed: { command: '/usr/bin/srv', args: ['--x'], env: { TOKEN: { secretRef: 'k1' }, LOG: 'debug' } } }, reads: [],
      secrets: { keyed: { TOKEN: 'k1' } } };
    const turn = prepareToolTurn({ root, operation: 'telegram:1:update:9', attempt: 0, operations: [], mcp, scratch: (dir: string) => {
      mkdirSync(join(dir, 'vol'), { recursive: true, mode: 0o700 }); return realpathSync(join(dir, 'vol')); },
    harness: { user: '_instarharness', runner: 'me', hookScript: '/h/hook/x/tool-admission-hook.mjs', rootState: stateBase }, grant });
    expect(turn.mcp.socket).toBe(join(made, 's'));
    expect(turn.mcp.shared).toBe(true);
    expect(JSON.parse(readFileSync(turn.mcp.config, 'utf8')).mcpServers.keyed).toEqual({ command: process.execPath,
      args: ['/h/hook/x/mcp-launch.mjs', join(made, 's'), 'keyed', turn.mcp.nonces.keyed, '/usr/bin/srv', '--x'], env: { LOG: 'debug' } });
    // The socket is writable by whoever can reach it (the harness user connects); without `shared` it keeps the default mode.
    const close = await serveMcpSecrets(turn.mcp.socket, turn.mcp.nonces, { keyed: { TOKEN: 'v' } }, true);
    expect(lstatSync(turn.mcp.socket).mode & 0o777).toBe(0o666);
    await close();
    expect(existsSync(made)).toBe(false);
    const own = join(fresh('own-socket'), 's');
    const closeOwn = await serveMcpSecrets(own, {}, {});
    expect(lstatSync(own).mode & 0o066).not.toBe(0o066);
    await closeOwn();
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
  it('accepts its own user or a named fallback', () => {
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
