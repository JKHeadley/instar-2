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
//   harness-launch --handoff NAME=VALUE ... -- EXECUTABLE ARG ...
//                                                         the same, but stdin starts with one JSON line from the runner's
//                                                         custody, `{"login"?: TOKEN, "mcp"?: CONFIG}`: the login reaches
//                                                         the harness on descriptor 3 (CLAUDE_CODE_OAUTH_TOKEN_FILE_
//                                                         DESCRIPTOR) and the MCP configuration on descriptor 4 (read
//                                                         as /dev/fd/4), each a pipe read once; neither is ever a file
//                                                         this user can open, nor in an argument or the environment.
//                                                         The rest of stdin is the harness's.
//   harness-launch --handoff --tty NAME=VALUE ... -- EXECUTABLE ARG ...
//                                                         the same hand-off for an interactive harness (a delegated
//                                                         session in a tmux pane): stdin carries only the header, and
//                                                         the harness's stdin is this process's terminal (its stdout),
//                                                         in this process's group, so the pane's keys reach it
//
// Absent from the command's environment, TMPDIR and CLAUDE_CODE_TMPDIR are the harness area's own temporary directory
// (`tmp` beside `bin`): in /private/tmp every new entry is denied to this user (harness-user.mjs HARNESS_TMP_DENY).
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

const handoff = argv[0] === '--handoff';
const tty = handoff && argv[1] === '--tty';
const rest = argv.slice((handoff ? 1 : 0) + (tty ? 1 : 0));
const split = rest.indexOf('--');
if (split < 0 || split === rest.length - 1) fail('usage: [--handoff] NAME=VALUE ... -- EXECUTABLE ARG ...');
const env = {};
for (const pair of rest.slice(0, split)) {
  const at = pair.indexOf('=');
  if (at < 1 || !/^[A-Z_][A-Z0-9_]*$/u.test(pair.slice(0, at))) fail(`environment entry ${JSON.stringify(pair.slice(0, 64))}`);
  env[pair.slice(0, at)] = pair.slice(at + 1);
}
for (const name of ['TMPDIR', 'CLAUDE_CODE_TMPDIR']) env[name] ??= `${dirname(HERE)}/tmp`;
if (tty && !process.stdout.isTTY) fail('--tty needs a terminal on stdout');
const [executable, ...args] = rest.slice(split + 1);
// Only an executable installed beside this launcher (the pinned harness copy) runs: the rule names one command.
let real = null;
try { real = realpathSync(executable); } catch { real = null; }
if (real !== executable || dirname(real) !== HERE || real === realpathSync(fileURLToPath(import.meta.url))) fail('executable is not the installed harness');

const uid = process.getuid();
const parent = process.ppid;
/** Descendants seen while the harness ran (pid to start time), refreshed every TRACK_MS (without the slower working-
 * directory read): one that lived through a refresh and later left the group and lost its parent is still this launch's,
 * and is ended only while its start time still matches (never a reused pid). */
const TRACK_MS = 250;
const seen = new Map();
let tearing = false, child = null;

/** The hand-off header: the first stdin line (bounded), and whatever followed it in the same read. */
const HEADER_LIMIT = 1048576;
function readHeader() {
  return new Promise(resolve => {
    let held = Buffer.alloc(0);
    const take = chunk => {
      held = Buffer.concat([held, chunk]);
      const end = held.indexOf(10);
      if (end < 0) { if (held.length > HEADER_LIMIT) fail('hand-off header too large'); return; }
      process.stdin.off('data', take); process.stdin.off('end', ended); process.stdin.pause();
      let header;
      try { header = JSON.parse(held.subarray(0, end).toString('utf8')); } catch { fail('hand-off header unreadable'); }
      if (!header || typeof header !== 'object' || Array.isArray(header) || Object.keys(header).some(key => !['login', 'mcp'].includes(key))
        || (header.login !== undefined && (typeof header.login !== 'string' || !/^[\x21-\x7e]{1,4096}$/u.test(header.login)))
        || (header.mcp !== undefined && typeof header.mcp !== 'string')) fail('hand-off header malformed');
      resolve({ header, remainder: held.subarray(end + 1) });
    };
    const ended = () => fail('hand-off header missing');
    process.stdin.on('data', take); process.stdin.on('end', ended);
  });
}

/** This user's processes: pid, parent, group and start time (`lstart`, fixed width), or none if `ps` cannot answer. */
function table() {
  let text = '';
  try { text = execFileSync('/bin/ps', ['-U', String(uid), '-o', 'pid=,ppid=,pgid=,lstart='], { encoding: 'utf8', timeout: 2000 }); } catch { text = ''; }
  return text.split('\n').map(line => /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/u.exec(line)).filter(Boolean)
    .map(([, pid, ppid, pgid, start]) => ({ pid: Number(pid), ppid: Number(ppid), pgid: Number(pgid), start }));
}
/** Every process of this user that descends from the harness, read before anything is signalled: by the tree and the
 * group now, by what the tracking saw while it ran (a descendant that left the group and lost its parent since), and (for
 * a tool turn, whose private volume is CLAUDE_CODE_TMPDIR) by a working directory on that volume. Only this user's
 * processes can be signalled. Returns pid to start time. */
function members(rows = table(), cwds = true) {
  const found = new Map(), byPid = new Map(rows.map(row => [row.pid, row]));
  const children = new Map(), queue = child?.pid ? [child.pid] : [];
  for (const { pid, ppid, pgid } of rows) {
    if (child?.pid && pgid === child.pid) queue.push(pid);
    children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  }
  while (queue.length) {
    const pid = queue.pop();
    if (found.has(pid) || !byPid.has(pid)) continue;
    found.set(pid, byPid.get(pid).start);
    queue.push(...(children.get(pid) ?? []));
  }
  for (const [pid, start] of seen) if (byPid.get(pid)?.start === start) found.set(pid, start);
  const area = env.CLAUDE_CODE_TMPDIR;
  if (cwds && typeof area === 'string' && area.startsWith('/private/tmp/it')) {
    let text = '';
    try { text = execFileSync('/usr/sbin/lsof', ['-a', '-u', String(uid), '-d', 'cwd', '-Fpn', '-w'], { encoding: 'utf8', timeout: 4000 }); } catch (error) { text = String(error?.stdout ?? ''); }
    let pid = null;
    for (const line of text.split('\n')) {
      if (line.startsWith('p')) pid = Number(line.slice(1));
      else if (line.startsWith('n') && pid !== null && byPid.has(pid) && (line.slice(1) === area || line.slice(1).startsWith(`${area}/`))) found.set(pid, byPid.get(pid).start);
    }
  }
  found.delete(process.pid);
  return found;
}
function teardown() {
  if (tearing) return;
  tearing = true;
  const all = members();
  try { if (child?.pid) process.kill(-child.pid, 'SIGKILL'); } catch { /* the group is gone */ }
  for (const pid of all.keys()) try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
}
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => { teardown(); process.exit(128 + ({ SIGHUP: 1, SIGINT: 2, SIGTERM: 15 })[signal]); });
// sudo gone (the runner's owner SIGKILLed it, or the runner died with it): this process was reparented.
let tracked = 0;
const watch = setInterval(() => {
  if (process.ppid !== parent) { teardown(); process.exit(137); }
  if (child?.pid && !tearing && (tracked += 50) >= TRACK_MS) {
    tracked = 0;
    const rows = table(), live = new Set(rows.map(row => `${String(row.pid)} ${row.start}`));
    for (const [pid, start] of seen) if (!live.has(`${String(pid)} ${start}`)) seen.delete(pid);
    for (const [pid, start] of members(rows, false)) seen.set(pid, start);
  }
}, 50);

const { header, remainder } = handoff ? await readHeader() : { header: null, remainder: null };
if (tty && remainder.length) fail('--tty takes only the hand-off header on stdin');
if (header?.login !== undefined) env.CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR = '3';
// The harness runs in its own process group (and session), so one group signal reaches every process it did not move. An
// interactive one stays in this group instead, the terminal's foreground, or it could not read the terminal; the tree walk
// and the tracking still find every descendant.
const descriptors = handoff ? [header.login === undefined ? 'ignore' : 'pipe', header.mcp === undefined ? 'ignore' : 'pipe'] : [];
child = spawn(executable, args, { env, detached: !tty, stdio: tty ? [1, 'inherit', 'inherit', ...descriptors]
  : handoff ? ['pipe', 'inherit', 'inherit', ...descriptors] : 'inherit' });
if (handoff) {
  // Each hand-off is written once and closed; a harness that never reads one only loses a pipe (EPIPE is ignored).
  for (const [fd, text] of [[3, header.login === undefined ? undefined : `${header.login}\n`], [4, header.mcp]])
    if (text !== undefined) { child.stdio[fd].on('error', () => {}); child.stdio[fd].end(text, 'utf8'); }
  if (!tty) {
    child.stdin.on('error', () => {});
    if (remainder.length) child.stdin.write(remainder);
    process.stdin.pipe(child.stdin);
    process.stdin.resume();
  }
}
child.on('error', () => { clearInterval(watch); teardown(); process.exit(126); });
child.on('exit', (code, signal) => {
  clearInterval(watch);
  teardown();
  if (signal) { for (const name of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.removeAllListeners(name); process.kill(process.pid, signal); }
  process.exit(code ?? 1);
});
