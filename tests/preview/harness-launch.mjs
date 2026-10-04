#!/usr/local/bin/node
// The harness launcher (desk unit harness-user): the one command the desk's sudoers rule lets the runner's account run as
// the harness's own macOS user. It runs the pinned Claude Code harness as that user, so every file the harness or its
// tools open is checked by the kernel as that user, and the operator account's files stay out of its reach whatever
// path a tool presents (docs/defects/2026-10-03-file-tool-swap-race.md). It owns the teardown of everything it started:
// the runner's account cannot signal another user's processes, so this process ends the harness's whole tree when the
// harness exits, when sudo relays a stop, or when sudo itself is gone (the runner's resource owner SIGKILLs it).
//
//   harness-launch NAME=VALUE ... -- EXECUTABLE ARG ...   run EXECUTABLE (only one installed beside this file) with
//                                                         exactly that environment, stdin and stdout passed through
//   harness-launch --probe r:PATH w:PATH ...              report whether this user can read (r) or write (w) each path;
//                                                         a read opens and reads one byte (never printed), a write is an
//                                                         access(2) check (nothing is created)
//
// It is installed by the runner at HARNESS_BIN/harness-launch (owned by the runner's account, unwritable by the harness
// user) and is plain Node with no imports outside node:, because the harness user can read nothing else of the repo.
import { spawn, execFileSync } from 'node:child_process';
import { accessSync, closeSync, constants, openSync, readdirSync, readSync, realpathSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(realpathSync(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const fail = message => { process.stderr.write(`harness-launch: ${message}\n`); process.exit(125); };

if (argv[0] === '--probe') {
  for (const spec of argv.slice(1)) {
    const mode = spec.slice(0, 2), path = spec.slice(2);
    if (!['r:', 'w:'].includes(mode) || !path.startsWith('/')) fail(`probe spec ${JSON.stringify(spec)}`);
    let ok = false, code = null;
    try {
      if (mode === 'w:') accessSync(path, constants.W_OK);
      else if (statSync(path).isDirectory()) readdirSync(path);
      else { const fd = openSync(path, 'r'); try { readSync(fd, Buffer.alloc(1), 0, 1, 0); } finally { closeSync(fd); } }
      ok = true;
    } catch (error) { code = error?.code ?? 'error'; }
    process.stdout.write(`${JSON.stringify({ path, mode: mode[0], ok, code })}\n`);
  }
  process.exit(0);
}

const split = argv.indexOf('--');
if (split < 0 || split === argv.length - 1) fail('usage: NAME=VALUE ... -- EXECUTABLE ARG ...');
const env = {};
for (const pair of argv.slice(0, split)) {
  const at = pair.indexOf('=');
  if (at < 1 || !/^[A-Z_][A-Z0-9_]*$/u.test(pair.slice(0, at))) fail(`environment entry ${JSON.stringify(pair.slice(0, 64))}`);
  env[pair.slice(0, at)] = pair.slice(at + 1);
}
const [executable, ...args] = argv.slice(split + 1);
// Only an executable installed beside this launcher (the pinned harness copy) runs: the rule names one command.
let real = null;
try { real = realpathSync(executable); } catch { real = null; }
if (real !== executable || dirname(real) !== HERE || real === realpathSync(fileURLToPath(import.meta.url))) fail('executable is not the installed harness');

const uid = process.getuid();
// The harness runs in its own process group (and session), so one group signal reaches every process it did not move.
const child = spawn(executable, args, { env, stdio: 'inherit', detached: true });
const parent = process.ppid;
let tearing = false;

/** Every process of this user that descends from the harness, read before anything is signalled, plus (for a tool turn,
 * whose private volume is CLAUDE_CODE_TMPDIR) every process of this user whose working directory lies on that volume: a
 * descendant that left the group and lost its parent is still found there. Only this user's processes can be signalled. */
function members() {
  const found = new Set();
  let table = '';
  try { table = execFileSync('/bin/ps', ['-U', String(uid), '-o', 'pid=,ppid=,pgid='], { encoding: 'utf8', timeout: 2000 }); } catch { table = ''; }
  const rows = table.split('\n').map(line => line.trim().split(/\s+/u).map(Number)).filter(row => row.length === 3 && row.every(Number.isSafeInteger));
  const children = new Map(), queue = child.pid ? [child.pid] : [];
  for (const [pid, ppid, pgid] of rows) {
    if (child.pid && pgid === child.pid) queue.push(pid);
    children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  }
  while (queue.length) {
    const pid = queue.pop();
    if (found.has(pid)) continue;
    found.add(pid);
    queue.push(...(children.get(pid) ?? []));
  }
  const area = env.CLAUDE_CODE_TMPDIR;
  if (typeof area === 'string' && area.startsWith('/private/tmp/it')) {
    let text = '';
    try { text = execFileSync('/usr/sbin/lsof', ['-a', '-u', String(uid), '-d', 'cwd', '-Fpn', '-w'], { encoding: 'utf8', timeout: 4000 }); } catch (error) { text = String(error?.stdout ?? ''); }
    let pid = null;
    for (const line of text.split('\n')) {
      if (line.startsWith('p')) pid = Number(line.slice(1));
      else if (line.startsWith('n') && pid !== null && (line.slice(1) === area || line.slice(1).startsWith(`${area}/`))) found.add(pid);
    }
  }
  found.delete(process.pid);
  return found;
}
function teardown() {
  if (tearing) return;
  tearing = true;
  const all = members();
  try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); } catch { /* the group is gone */ }
  for (const pid of all) try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
}
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => { teardown(); process.exit(128 + ({ SIGHUP: 1, SIGINT: 2, SIGTERM: 15 })[signal]); });
// sudo gone (the runner's owner SIGKILLed it, or the runner died with it): this process was reparented.
const watch = setInterval(() => { if (process.ppid !== parent) { teardown(); process.exit(137); } }, 50);
child.on('error', () => { clearInterval(watch); teardown(); process.exit(126); });
child.on('exit', (code, signal) => {
  clearInterval(watch);
  teardown();
  if (signal) { for (const name of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.removeAllListeners(name); process.kill(process.pid, signal); }
  process.exit(code ?? 1);
});
