// Runner side of a tool turn (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule): the conversation's
// persistent workspace on its own fixed-size volume under the root's `workspaces` directory, the conversation's kept
// harness session (a cache subordinate to the journal, MF5), the per-turn hook state directory, the trace read back after
// the turn, and bounded retention. Workspaces, session records and traces are machine-local by declaration (Rule 113): this
// runner's working state; the journal row is the durable record, and nothing here is shared or resumed on another machine.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBSCRIPTION_SUBAGENT_TYPE, SUBSCRIPTION_TOOL_LIMITS, SUBSCRIPTION_TOOL_NAMES, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { toolTrace } from './tool-admission.mjs';

export const TOOL_TURNS_DIRECTORY = 'tool-turns';
/** Where a root keeps the tools activation the runner derived by default (its live withdrawal handle; machine-local). */
export const TOOLS_DEFAULT_ACTIVATION = 'tools-activation.json';
/** Finished turn directories kept for inspection; older ones are removed (the journal keeps their trace). */
export const TOOL_TURNS_KEPT = 16;
export const TOOL_HOOK_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'tool-admission-hook.mjs');
/** Answer turns and scheduled obligation work run with tools; reviews, summaries and benchmark reruns never do. */
export const toolTurnEligible = id => /^telegram:[0-9]+:update:[0-9]+$/u.test(id) || /^obligation:/u.test(id);

/** The fixed size of one conversation's workspace volume. Every byte a tool can write (the workspace, the shell's
 * temporary files) lands on it, so a conversation can never take more than this from the disk that holds the journal
 * (Rule 60); with at most `TOOL_WORKSPACES_KEPT` conversations kept, a root's tool storage is bounded by their product. */
export const TOOL_SCRATCH_BYTES = 128 * 1024 * 1024;
const HDIUTIL = '/usr/bin/hdiutil';
const SCRATCH_IMAGE = 'scratch.sparseimage', SCRATCH_LINK = 'vol';
/** Where scratch volumes mount. The mount point doubles as the harness's temporary directory (CLAUDE_CODE_TMPDIR), and
 * Claude Code 2.1.280 keeps its per-user directory under it only while that path stays within 44 bytes (else it falls
 * back to the shared /tmp/claude-<uid>, outside the volume), so the mount point is short: `/private/tmp/itw-` (a
 * conversation's workspace, its 12 hex digits fixed) or `itt-` (a one-turn volume, random), 29 bytes. The owning
 * directory links to it as `vol`, so the next attach or prune finds a volume a crash left mounted. */
export const TOOL_SCRATCH_MOUNTS = '/private/tmp';
const mountOf = turn => { try { return readlinkSync(join(turn, SCRATCH_LINK)); } catch { return null; } };
/** Whether a turn directory's scratch volume is still mounted (its mount point sits on another device). */
export function scratchMounted(turn) {
  const mount = mountOf(turn);
  try { return mount !== null && lstatSync(mount).dev !== lstatSync(dirname(mount)).dev; } catch { return false; }
}
/** Mounts a directory's fixed-size scratch volume (a sparse disk image: it takes only the bytes written, and refuses
 * writes past `bytes`), linked from `<dir>/vol`, creating the image on first use and reusing it afterwards, so its files
 * persist between mounts. `name` is the mount point's name under `mounts` (a conversation's is fixed, so its harness
 * session finds the same working directory every turn); a volume a crash left mounted is unmounted first. Returns the
 * mount point's real path. */
export function attachScratch(dir, name = `itt-${randomBytes(6).toString('hex')}`, bytes = TOOL_SCRATCH_BYTES, mounts = TOOL_SCRATCH_MOUNTS) {
  if (!/^it[tw]-[0-9a-f]{12}$/u.test(name)) throw Error('preview: tool scratch mount name');
  if (!unmountScratch(dir)) throw Error('preview: a tool scratch volume left mounted will not unmount');
  const image = join(dir, SCRATCH_IMAGE), mount = join(realpathSync(mounts), name);
  mkdirSync(mount, { recursive: true, mode: 0o700 });
  rmSync(join(dir, SCRATCH_LINK), { force: true });
  symlinkSync(mount, join(dir, SCRATCH_LINK));
  if (!existsSync(image)) execFileSync(HDIUTIL, ['create', '-quiet', '-size', `${String(Math.ceil(bytes / 1048576))}m`, '-type', 'SPARSE',
    '-fs', 'HFS+', '-volname', 'instar-tool-turn', image], { stdio: 'ignore', timeout: 60000 });
  execFileSync(HDIUTIL, ['attach', '-quiet', '-nobrowse', '-noautoopen', '-owners', 'on', '-mountpoint', mount, image],
    { stdio: 'ignore', timeout: 60000 });
  if (!scratchMounted(dir)) throw Error('preview: tool scratch volume did not mount');
  chmodSync(mount, 0o700);
  return realpathSync(mount);
}
/** Unmounts a directory's scratch volume and removes its mount point, keeping its image (and so its files). Returns false
 * when the volume is still mounted afterwards (the next attach or a later prune retries). */
export function unmountScratch(dir) {
  const mount = mountOf(dir);
  if (scratchMounted(dir)) {
    try { execFileSync(HDIUTIL, ['detach', '-quiet', '-force', mount], { stdio: 'ignore', timeout: 60000 }); } catch { /* checked below */ }
    if (scratchMounted(dir)) return false;
  }
  if (mount !== null) try { rmdirSync(mount); } catch { /* already gone */ }
  return true;
}
/** Unmounts a scratch volume and removes its image: everything on it is gone. Returns false when it stays mounted. */
export function detachScratch(dir) {
  if (!unmountScratch(dir)) return false;
  rmSync(join(dir, SCRATCH_IMAGE), { force: true });
  return true;
}

/** Allocates a turn: a fresh `<root>/tool-turns/<digest>-<attempt>/state` and the hook's config, and mounts the volume
 * holding `ws` and `tmp`, all 0700 (`scratch(dir, name)` mounts it; tests may pass a stand-in). `volume` is the
 * conversation's workspace ({directory, name} from `conversationWorkspace`), whose files persist across turns; absent,
 * the turn gets its own fresh volume in its turn directory. `children` is the number of subagents this turn's
 * reservation covers; `mcp` is the root's MCP configuration ({servers, reads}) or null. The servers' launch configuration
 * is written into the state directory, which no tool can read. */
export function prepareToolTurn({ root, operation, attempt, operations, children = 0, mcp = null, node = process.execPath, scratch = attachScratch,
  volume = null }) {
  const base = join(realpathSync(root), TOOL_TURNS_DIRECTORY);
  mkdirSync(base, { recursive: true, mode: 0o700 });
  const slug = `${createHash('sha256').update(operation, 'utf8').digest('hex').slice(0, 16)}-${String(attempt)}`;
  const turn = join(base, slug);
  mkdirSync(turn, { mode: 0o700 });
  mkdirSync(join(turn, 'state'), { mode: 0o700 });
  const mounted = volume ? scratch(volume.directory, volume.name) : scratch(turn);
  for (const name of ['ws', 'tmp']) { mkdirSync(join(mounted, name), { recursive: true, mode: 0o700 }); chmodSync(join(mounted, name), 0o700); }
  const workspace = realpathSync(join(mounted, 'ws')), tmp = realpathSync(join(mounted, 'tmp'));
  const stateDirectory = realpathSync(join(turn, 'state'));
  const servers = mcp ? Object.keys(mcp.servers) : [];
  writeFileSync(join(stateDirectory, 'config.json'), JSON.stringify({ workspace, tmp, maxCalls: SUBSCRIPTION_TOOL_LIMITS.maxToolCalls,
    maxWriteBytes: SUBSCRIPTION_TOOL_LIMITS.maxWriteBytes, operations: [...operations],
    children: { max: children, type: SUBSCRIPTION_SUBAGENT_TYPE }, mcpReads: mcp ? [...mcp.reads] : [] }), { mode: 0o600 });
  let mcpTurn;
  if (servers.length) {
    writeFileSync(join(stateDirectory, 'mcp.json'), JSON.stringify({ mcpServers: mcp.servers }), { mode: 0o600 });
    mcpTurn = { config: join(stateDirectory, 'mcp.json'), servers };
  }
  return { slug, directory: turn, volumeDirectory: volume ? volume.directory : turn, scratch: mounted, workspace, stateDirectory,
    hook: { node, script: TOOL_HOOK_SCRIPT },
    ...(mcpTurn ? { mcp: mcpTurn } : {}) };
}

/** The root's MCP configuration, read from `<root>/mcp.json` (the operator's file; absent means no MCP servers):
 * `{"mcpServers": {name: {command, args?, env?}}, "reads": ["mcp__name__tool", ...]}`. A tool the file lists in `reads`
 * is ordinary work; every other MCP tool is a consequential effect for the effect doorway. A malformed file refuses
 * (thrown) rather than guessing. Credentials in `env` stay in this file and in the turn's admission state, both
 * outside every path a tool can read. */
export const TOOL_MCP_CONFIG = 'mcp.json';
export function readRootMcp(root, read = path => readFileSync(path, 'utf8')) {
  let text;
  try { text = read(join(root, TOOL_MCP_CONFIG)); } catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
  const data = JSON.parse(text), servers = data?.mcpServers;
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) throw Error('preview: root MCP configuration has no mcpServers object');
  const names = Object.keys(servers);
  if (!names.length) return null;
  if (!names.every(name => /^[A-Za-z0-9_-]{1,64}$/u.test(name) && servers[name] && typeof servers[name].command === 'string'))
    throw Error('preview: root MCP server names must be plain and each must name a command');
  const reads = data.reads ?? [];
  if (!Array.isArray(reads) || !reads.every(tool => typeof tool === 'string' && names.some(name => tool.startsWith(`mcp__${name}__`))))
    throw Error('preview: root MCP reads must name tools of the configured servers');
  return { servers, reads, digest: `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}` };
}

/** The trace of one finished turn, read from the hook's record. An absent record is an empty trace. */
export function readToolTrace(stateDirectory) {
  let text = '';
  try { text = readFileSync(join(stateDirectory, 'admission.jsonl'), 'utf8'); } catch { text = ''; }
  return toolTrace(text.split('\n').filter(line => line.length > 0));
}

/** Bytes the turn left in its workspace (regular files, symlinks not followed, bounded walk). */
export function workspaceBytes(workspace, limit = 10000) {
  let bytes = 0, seen = 0;
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      if (++seen > limit) return;
      const path = join(dir, name), stat = lstatSync(path);
      if (stat.isDirectory()) walk(path); else if (stat.isFile()) bytes += stat.size;
    }
  };
  try { walk(workspace); } catch { return null; }
  return seen > limit ? null : bytes;
}

/** Conversation workspaces a root keeps (Rule 60: with the volume size, the root's whole tool storage). A workspace is kept
 * for the root's life and never deleted to make room (Rule 7): past this count a further conversation's turns each run in a
 * fresh one-turn volume, removed after the turn, without a kept session, and the journal records that overflow. */
export const TOOL_WORKSPACES_DIRECTORY = 'workspaces';
export const TOOL_WORKSPACES_KEPT = 4;
/** The conversation's workspace: `<root>/workspaces/<key>` holding its volume image, the `vol` link and the kept-session
 * record, mounted at the fixed `itw-<key>`. The key is derived from the root's real path and the conversation, so two
 * roots or two conversations never share a workspace. Null when the root already keeps its bound of other workspaces. */
export function conversationWorkspace(root, conversation, keep = TOOL_WORKSPACES_KEPT) {
  if (typeof conversation !== 'string' || !conversation.length) throw Error('preview: tool workspace needs its conversation');
  const real = realpathSync(root);
  const key = createHash('sha256').update(`${real}\0${conversation}`, 'utf8').digest('hex').slice(0, 12);
  const base = join(real, TOOL_WORKSPACES_DIRECTORY), directory = join(base, key);
  if (!existsSync(directory)) {
    let kept = [];
    try { kept = readdirSync(base).filter(name => /^[0-9a-f]{12}$/u.test(name)); } catch { kept = []; }
    if (kept.length >= keep) return { key, directory: null, name: null };
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  return { key, directory, name: `itw-${key}` };
}

/** The journal's forgotten and corrected clauses (Rule 33: the journal is the authority on what the agent knows): the
 * quote of every `forget` and `correct` memory change, those under four characters excluded so a stray word is never
 * stripped from unrelated notes. A kept workspace must not hand back what the journal no longer holds. */
export const forgottenQuotes = view => [...new Set((view.memory ?? []).filter(change => change.mode === 'forget' || change.mode === 'correct')
  .map(change => String(change.quote).trim()).filter(quote => quote.length >= 4))].sort();
const VOLUME_MARK = 'kept.json';
/** The note a replacement workspace carries, so the turn that finds it is told plainly what was lost (constraint 2). */
export const WORKSPACE_LOST_NOTE = 'WORKSPACE-LOST.txt';
/** The note a kept workspace carries while its last reconciliation could not finish, naming what still may disagree with
 * the journal; removed once a pass completes. */
export const WORKSPACE_STALE_NOTE = 'WORKSPACE-STALE.txt';
/** How many held files a note names (each name clipped), so the note, which is also delivered in the turn's input, stays
 * within its bound (NOTICE_TEXT_MAX). */
const STALE_NAMED = 16;
const named = paths => `${paths.slice(0, STALE_NAMED).map(path => path.length > 96 ? `${path.slice(0, 93)}...` : path).join(', ')}`
  + `${paths.length > STALE_NAMED ? ` and ${String(paths.length - STALE_NAMED)} more` : ''}`;
/** The room a turn's packet keeps for the workspace notice delivered with it (the stale and lost notes, both bounded): the
 * notice's own text is held to three quarters of it, the rest covers its escaping inside the packet's JSON. */
export const TOOL_NOTICE_MAX_BYTES = 4096;
const NOTICE_TEXT_MAX = 3072;
const strip = (buffer, needle) => {
  const parts = []; let from = 0, at;
  while ((at = buffer.indexOf(needle, from)) >= 0) { parts.push(buffer.subarray(from, at)); from = at + needle.length; }
  if (!parts.length) return null;
  parts.push(buffer.subarray(from));
  return Buffer.concat(parts);
};
const UTF8 = new TextDecoder('utf-8', { fatal: true });
/** The formats whose every byte is prose, so removing a clause leaves a valid file of the same format: a plain note or a
 * Markdown file, by its name, that is valid UTF-8 without a NUL byte. Any other file (JSON, code, an archive, a database)
 * has structure a splice can break, so it is kept intact and named to the agent, which rewrites it with its own tools. */
export const PROSE_EXTENSIONS = Object.freeze(['.txt', '.text', '.md', '.markdown']);
const prose = (path, buffer) => {
  if (!PROSE_EXTENSIONS.some(extension => path.toLowerCase().endsWith(extension)) || buffer.includes(0)) return false;
  try { UTF8.decode(buffer); return true; } catch { return false; }
};
/** Whether `a` comes after `b` in the walk's order (component by component; a directory before what it holds). */
const after = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] > b[i];
  return a.length > b.length;
};
const prefixOf = (a, b) => a.length < b.length && a.every((part, i) => part === b[i]);
/** Writes a file in place, keeping its mode: a read-only file the agent left is made writable for the edit only. */
function rewrite(path, data, mode) {
  try { writeFileSync(path, data); return; } catch (error) { if (error?.code !== 'EACCES' && error?.code !== 'EPERM') throw error; }
  chmodSync(path, mode | 0o200);
  try { writeFileSync(path, data); } finally { chmodSync(path, mode); }
}
/**
 * Removes every forgotten or corrected clause from the prose regular files under `dirs` (symlinks not followed);
 * files without one are left byte-for-byte. The walk visits at most `limit` entries, starting after `from` (a position a
 * bounded earlier pass stopped at), so a large workspace is covered over several passes. Returns the files changed,
 * the files still holding a clause (unreadable, unwritable, or not prose: kept intact, never half-edited), and
 * `cursor`: where the walk stopped at its bound, or null when it reached the end.
 */
export function removeForgotten(dirs, quotes, limit = 10000, from = null) {
  const needles = quotes.map(quote => Buffer.from(quote, 'utf8'));
  let changed = 0, seen = 0, stopped = false, cursor = null, last = null;
  const held = [];
  const visit = (path, stat) => {
    let original;
    try { original = readFileSync(path); } catch { held.push(path); return; }
    let next = original;
    for (const needle of needles) next = strip(next, needle) ?? next;
    if (next === original) return;
    if (!prose(path, original)) { held.push(path); return; }
    try { rewrite(path, next, stat.mode & 0o7777); changed++; } catch { held.push(path); }
  };
  const walk = (dir, position) => {
    let names;
    try { names = readdirSync(dir).sort(); } catch { held.push(dir); return; }
    for (const name of names) {
      if (stopped) return;
      const child = [...position, name];
      if (from !== null && !prefixOf(child, from) && !after(child, from)) continue;
      if (++seen > limit) { stopped = true; cursor = last ?? from ?? []; return; }
      last = child;
      const path = join(dir, name);
      let stat;
      try { stat = lstatSync(path); } catch { held.push(path); continue; }
      if (stat.isDirectory()) walk(path, child);
      else if (stat.isFile()) visit(path, stat);
    }
  };
  dirs.forEach((dir, index) => { if (!stopped) walk(dir, [index]); });
  return { changed, held, cursor };
}
/** Reconciles a mounted kept workspace with the journal before any tool of the turn can read it. `used` says whether the
 * journal records an earlier turn in this workspace: then a volume without its mark and with an empty workspace is a lost
 * volume (its image gone), not a first allocation, and the replacement carries a note saying so. Whenever the journal's
 * forgotten clauses changed since the volume last completed a pass over them, a pass removes them from its files. The
 * mark records them as reconciled only when a whole walk (possibly over several bounded passes) left no file holding
 * one; until then every turn repeats the check, and the workspace carries a note naming what may still disagree. */
export function reconcileWorkspace({ mounted, workspace, tmp, used, quotes, limit = 10000 }) {
  const mark = join(mounted, VOLUME_MARK);
  let recorded = null;
  try { recorded = JSON.parse(readFileSync(mark, 'utf8')); } catch { recorded = null; }
  const lost = used && recorded === null && readdirSync(workspace).length === 0;
  const forgotten = digestOf(JSON.stringify(quotes));
  let reconciled = 0, held = [], unchecked = false, pending = null, done = recorded?.forgotten ?? null;
  if (recorded?.forgotten === forgotten || !quotes.length) done = forgotten;
  else {
    const prior = recorded?.pending?.digest === forgotten && Array.isArray(recorded.pending.cursor) ? recorded.pending : null;
    const pass = removeForgotten([workspace, tmp], quotes, limit, prior?.cursor ?? null);
    reconciled = pass.changed; unchecked = pass.cursor !== null;
    // The files an earlier bounded pass of this same walk held stay named until the walk completes clean.
    const earlier = Array.isArray(prior?.held) ? prior.held.filter(path => typeof path === 'string') : [];
    held = [...new Set([...earlier, ...pass.held.map(path => relative(mounted, path))])];
    const clean = (prior ? prior.clean === true : true) && !held.length;
    // A walk that reached the end clean completes the forget; one that held a file starts over next turn.
    if (unchecked) pending = { digest: forgotten, cursor: pass.cursor, clean, held: held.slice(0, STALE_NAMED) };
    else if (clean) done = forgotten;
  }
  const note = join(workspace, WORKSPACE_STALE_NOTE);
  if (held.length || unchecked) writeFileSync(note, 'Some of this workspace may still disagree with this conversation\'s memory: it has '
    + 'since forgotten or corrected statements these files may still hold. The memory is the authority; do not rely on them '
    + 'for anything it no longer holds, and rewrite them without it if you use them. The check repeats every turn until it '
    + `completes.\n${held.length ? `Files that still hold such a statement and were not changed automatically (kept intact): ${named(held)}\n` : ''}`
    + `${unchecked ? 'Part of the workspace has not been checked yet (past this turn\'s bound); the next turn continues.\n' : ''}`, { mode: 0o600 });
  else rmSync(note, { force: true });
  if (lost) writeFileSync(join(workspace, WORKSPACE_LOST_NOTE), 'This conversation\'s earlier workspace was lost: its volume was '
    + `missing when this turn started. Files written on earlier turns are gone; this workspace started empty. `
    + 'The conversation\'s journal still holds every answer and tool trace.\n', { mode: 0o600 });
  writeFileSync(mark, JSON.stringify({ v: 1, forgotten: done, ...(pending ? { pending } : {}) }), { mode: 0o600 });
  return { lost, reconciled, ...(held.length ? { held: held.length } : {}), ...(unchecked ? { unchecked } : {}) };
}
/** What the turn's input carries about its workspace (Rules 33, 84): the stale note while reconciliation is unfinished and
 * the lost note on the turn that found the loss, so the agent is told, not left to discover a file. Empty when neither. */
export function workspaceNotice(workspace, volume) {
  const read = name => { try { return readFileSync(join(workspace, name), 'utf8'); } catch { return ''; } };
  const parts = [...(volume.held || volume.unchecked ? [read(WORKSPACE_STALE_NOTE)] : []), ...(volume.lost ? [read(WORKSPACE_LOST_NOTE)] : [])]
    .filter(text => text.length);
  if (!parts.length) return '';
  const text = `Workspace notice (from this conversation's kept workspace, before this turn):\n${parts.join('')}`;
  return Buffer.byteLength(text) > NOTICE_TEXT_MAX ? `${Buffer.from(text).subarray(0, NOTICE_TEXT_MAX - 4).toString('utf8').replace(/\uFFFD$/u, '')}...\n` : text;
}

/** The kept harness session (MF5): a disposable cache of one conversation's harness context, subordinate to the journal.
 * It is resumed only while it is bound to the same tools authority, harness and model, and the journal's facts it may
 * hold are unchanged; any correction, forgetting, undo, closure, grant change or stop rotates it, as do its bounds, a
 * compaction, a lost transcript, and any turn that did not end cleanly. Every turn is still grounded by the full current
 * journal packet; the session is never the only copy of accepted work (the journal holds every answer and tool trace). */
export const TOOL_SESSION_LIMITS = Object.freeze({ maxTurns: 6, maxTranscriptBytes: 512 * 1024 });
const SESSION_FILE = 'session.json';
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const digestOf = text => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
const plain = (_key, value) => value instanceof Map ? [...value.entries()] : value instanceof Set ? [...value] : value;
/** The journal facts a kept session may hold: memory changes and their undos, dated items, people, commitments and
 * their closures, directives and blockers, conflicts, grants and authorities (reminders, summaries, caps, expiry,
 * operator requests and their verdicts) and the stop. A change to any of them rotates the session. */
export function sessionFactsDigest(view) {
  return digestOf(JSON.stringify({ memory: view.memory, dated: view.dated, changes: view.changeHistory, undos: view.undos,
    people: view.people, attributes: view.personAttributes, merges: view.personMerges, commitments: view.commitments, closed: view.closed,
    directives: view.directives, blockers: view.blockers, conflicts: view.conflicts, reminderGrant: view.reminderGrant,
    reminderCancels: view.reminderCancels, summaryGrants: view.summaryGrants, requests: view.operatorRequests,
    caps: [view.limits, view.capAuthority], expiry: [view.expires, view.expiryAuthority], stop: view.stop, sourceStop: view.sourceStop }, plain));
}
/** Where the harness keeps a session's transcript: `<config>/projects/<cwd with every non-alphanumeric as ->/<id>.jsonl`
 * (Claude Code 2.1.280, observed). Its subagents' transcripts sit in `<id>/` beside it. */
export const sessionTranscript = (store, workspace, id) => join(store, workspace.replace(/[^A-Za-z0-9]/gu, '-'), `${id}.jsonl`);
/** Removes one kept session's harness files, and only those: the transcript and its subagent directory, by exact id. */
export function removeSessionFiles(store, workspace, id) {
  if (typeof store !== 'string' || typeof workspace !== 'string' || !SESSION_ID.test(String(id))) return false;
  const transcript = sessionTranscript(store, workspace, id);
  rmSync(transcript, { force: true });
  rmSync(transcript.slice(0, -'.jsonl'.length), { recursive: true, force: true });
  return true;
}
/** Removes every harness session file of one workspace's projects directory (UUID-named transcripts and their subagent
 * directories, nothing else). The workspace path is the conversation's own (`itw-<key>`), so these are exactly its kept
 * sessions; used when a new session starts, so a session whose record was lost is never stranded outside retention. */
export function removeWorkspaceSessions(store, workspace) {
  if (typeof store !== 'string' || typeof workspace !== 'string') return 0;
  const directory = dirname(sessionTranscript(store, workspace, 'x'));
  let names;
  try { names = readdirSync(directory); } catch { return 0; }
  let removed = 0;
  for (const name of names) {
    const id = name.endsWith('.jsonl') ? name.slice(0, -'.jsonl'.length) : name;
    if (SESSION_ID.test(id)) { rmSync(join(directory, name), { recursive: true, force: true }); removed++; }
  }
  return removed;
}
/** The kept-session record of a workspace: `present` (with its value), `absent`, or `unreadable` (treated as lost). */
export function readSession(dir) {
  let text;
  try { text = readFileSync(join(dir, SESSION_FILE), 'utf8'); } catch (error) { return error?.code === 'ENOENT' ? { state: 'absent' } : { state: 'unreadable' }; }
  try {
    const value = JSON.parse(text);
    return value?.v === 1 && SESSION_ID.test(value.id) && typeof value.binding === 'string' && typeof value.facts === 'string'
      && typeof value.workspace === 'string' && Number.isSafeInteger(value.turns) ? { state: 'present', value } : { state: 'unreadable' };
  } catch { return { state: 'unreadable' }; }
}
function writeSession(dir, value) {
  const path = join(dir, SESSION_FILE), temporary = `${path}.${randomBytes(4).toString('hex')}.pending`;
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  renameSync(temporary, path);
}
/** What this turn does with the conversation's kept session: resume it, or start a new one with the reason the old one
 * (if any) was not resumed. Pure apart from the transcript reads, which are bounded by the size limit. */
export function planSession({ record, binding, facts, store, workspace, stat = path => statSync(path).size,
  read = path => readFileSync(path, 'utf8'), newId = randomUUID, volumeLost = false }) {
  const fresh = (reason, previous = null) => ({ id: newId(), resume: false, reason, turn: 1, previous });
  // A session is never resumed against a replacement of the workspace it worked in.
  if (volumeLost) return fresh('lost: the workspace volume is missing', record.state === 'present' ? record.value : null);
  if (record.state === 'absent') return fresh('new');
  if (record.state === 'unreadable') return fresh('lost: the session record is unreadable');
  const r = record.value, previous = r;
  if (r.ended) return fresh(r.ended, previous);
  if (r.open) return fresh('interrupted: the last turn did not settle', previous);
  if (r.binding !== binding || r.workspace !== workspace) return fresh('authority, harness or model changed', previous);
  if (r.facts !== facts) return fresh('the journal changed a fact', previous);
  if (r.turns >= TOOL_SESSION_LIMITS.maxTurns) return fresh('turn bound', previous);
  let size;
  try { size = stat(sessionTranscript(store, workspace, r.id)); } catch { return fresh('lost: the transcript is missing', previous); }
  if (size >= TOOL_SESSION_LIMITS.maxTranscriptBytes) return fresh('size bound', previous);
  let text;
  try { text = read(sessionTranscript(store, workspace, r.id)); } catch { return fresh('lost: the transcript is unreadable', previous); }
  if (text.includes('"compact_boundary"')) return fresh('compacted', previous);
  return { id: r.id, resume: true, reason: 'resumed', turn: r.turns + 1, previous: null };
}

/** Keeps the newest `keep` turn directories (by modification time); a failed removal is reported, not thrown.
 * A volume left mounted (a turn interrupted by a crash) is unmounted first; one that will not unmount is kept. */
export function pruneToolTurns(root, keep = TOOL_TURNS_KEPT, detach = detachScratch) {
  const base = join(root, TOOL_TURNS_DIRECTORY);
  let names;
  try { names = readdirSync(base); } catch { return { removed: 0, failed: 0 }; }
  const dirs = names.map(name => ({ name, at: lstatSync(join(base, name)).mtimeMs })).sort((a, b) => b.at - a.at);
  let removed = 0, failed = 0;
  for (const { name } of dirs.slice(keep)) {
    try {
      if (!detach(join(base, name))) { failed++; continue; }
      rmSync(join(base, name), { recursive: true, force: true }); removed++;
    } catch { failed++; }
  }
  return { removed, failed };
}

/**
 * One tool turn, as the runner runs it (Part Thirteen §9, docs/17-harness-adapters). Its whole liability, every model turn the policy
 * allows beyond the answer's own reserved attempt, is reserved against the operator's call cap before
 * dispatch and retained (MF4). A short allowance, or a packet the longer tool system prompt would overflow,
 * answers this turn without tools (`fallback`), recorded. The reservation is durable before anything is
 * allocated or launched, so a crash leaves it open and visible. The hook's trace is journaled after the
 * turn whatever its outcome; a tool result with no admitted call before it (a tool that ran past the hook)
 * refuses the answer instead of trusting it. `invoke(toolTurn, notice)` runs the admitted route with the workspace notice; `redactText` scrubs
 * recorded excerpts.
 */
/** Whether the call allowance holds a tool turn's whole liability. The packet that names the tools and the turn's own
 * reservation use this one predicate, so an answer is told it has tools only when its turn will run with them. The packet
 * is prepared before its base call is reserved, so it passes that call as `unreserved`; dispatch runs after it. */
export const toolTurnFits = (view, unreserved = 0) => view.calls + unreserved + SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1 <= view.limits.maxCalls;
/** The packet's side of `toolTurnFits`: its own base call is not reserved yet when it is prepared. */
export const toolPacketFits = view => toolTurnFits(view, 1);
/** How many subagents the allowance holds (Rule 114 budget share): each reserves its whole `childMaxTurns` before dispatch,
 * taken only from allowance beyond this turn's own liability AND one further plain tool turn (its base call and its
 * liability), so a subagent budget never costs the next answer (a format re-ask, a replacement, the next message) its
 * tools. Zero means the turn runs with tools but the hook refuses Agent for budget. */
export const toolChildrenFit = (view, unreserved = 0) => Math.max(0, Math.min(SUBSCRIPTION_TOOL_LIMITS.maxChildren,
  Math.floor((view.limits.maxCalls - view.calls - unreserved - 2 * (SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1) - 1)
    / SUBSCRIPTION_TOOL_LIMITS.childMaxTurns)));

/**
 * One tool turn. `authority` names the activation the tools run under (its reference and tools policy digest); each
 * subagent edge carries it. `mcp` is `readRootMcp(root)`. `stopped()` reports whether the operator's stop or a withdrawal
 * ended the turn, so an edge without a result is recorded `cancelled` (else `unknown`).
 */
export async function runToolTurn({ journal, root, id, prepared, promptLimit, deniedRoots, operations, invoke, fallback, now, redactText,
  authority = 'unrecorded', mcp = null, stopped = () => false, scratch = attachScratch, detach = detachScratch, unmount = unmountScratch,
  conversation = `${String(journal.view.genesis?.bot)}:${String(journal.view.genesis?.chat)}`, session = null,
  completed = result => result?.state === 'complete' }) {
  const extra = SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1;
  const refuse = reason => { journal.append({ kind: 'tool-turn', phase: 'refused', id, reason, at: now() }); return fallback(); };
  if (!toolTurnFits(journal.view)) return refuse('call cap');
  if (Buffer.byteLength(prepared) + Buffer.byteLength(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT) + TOOL_NOTICE_MAX_BYTES > promptLimit) return refuse('prompt size');
  const attempt = journal.view.toolTurns?.invocations ?? 0;
  const children = toolChildrenFit(journal.view);
  // Rule 60: the conversation's kept workspace, or (past the root's bound) a fresh one-turn volume and no kept session.
  const space = conversationWorkspace(root, conversation);
  const kept = space.directory !== null;
  // The facts the kept session may be grounded with are read now, before the turn's own answer changes any of them.
  const facts = session && kept ? sessionFactsDigest(journal.view) : null;
  // Whether the journal records an earlier turn in this workspace (read before this turn's own reservation adds it), and
  // the clauses it has forgotten or corrected, which the workspace must not keep handing back.
  const used = kept && (journal.view.toolTurns?.workspaces ?? []).includes(space.key);
  const quotes = kept ? forgottenQuotes(journal.view) : [];
  // Rule 114: the edge's authority and budget share are durable before dispatch, with the turn's whole liability.
  journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt, calls: extra + children * SUBSCRIPTION_TOOL_LIMITS.childMaxTurns,
    delegation: { children, turnsEach: SUBSCRIPTION_TOOL_LIMITS.childMaxTurns, type: SUBSCRIPTION_SUBAGENT_TYPE, authority },
    ...(mcp ? { mcp: { servers: Object.keys(mcp.servers), reads: mcp.reads.length, digest: mcp.digest } } : {}),
    workspace: { key: space.key, kept }, at: now() });
  let turn = null, result, failure = null, plan = null, volume = null, notice = '';
  try {
    turn = prepareToolTurn({ root, operation: id, attempt, operations, children, mcp, scratch, volume: kept ? space : null });
    if (kept) {
      volume = reconcileWorkspace({ mounted: turn.scratch, workspace: turn.workspace, tmp: join(turn.scratch, 'tmp'), used, quotes });
      notice = workspaceNotice(turn.workspace, volume);
    }
    if (session && kept) {
      // MF5: the session is resumed only when nothing it may hold has changed; otherwise the old one's files go before a
      // new one starts, and the record naming it is written (open) before dispatch, so a crash leaves it `interrupted`.
      const record = readSession(space.directory);
      plan = planSession({ record, binding: `${authority} ${session.harness}`, facts, store: session.store, workspace: turn.workspace,
        volumeLost: volume.lost });
      // Rule 60: a new session removes every earlier one of this workspace, including any whose record was lost.
      if (plan.previous) removeSessionFiles(session.store, plan.previous.workspace, plan.previous.id);
      if (!plan.resume) removeWorkspaceSessions(session.store, turn.workspace);
      writeSession(space.directory, { v: 1, id: plan.id, binding: `${authority} ${session.harness}`, facts, workspace: turn.workspace,
        turns: plan.turn, open: true, at: now() });
    }
    result = await invoke({ scratch: turn.scratch, workspace: turn.workspace, stateDirectory: turn.stateDirectory, hook: turn.hook, deniedRoots,
      ...(turn.mcp ? { mcp: turn.mcp } : {}), ...(plan ? { session: { id: plan.id, resume: plan.resume } } : {}) }, notice);
  } catch (error) { failure = error; }
  const trace = turn ? readToolTrace(turn.stateDirectory) : { calls: [], children: [], consistent: true };
  const ended = stopped() ? 'cancelled' : 'unknown';
  // A kept session continues only from a turn that ended cleanly; a stop, a withdrawal, a failure or an unproven tool
  // run ends it now (its transcript removed), so nothing it saw outlives the turn that saw it.
  let ending = null;
  if (plan) {
    const why = stopped() ? 'stopped or withdrawn' : failure ? 'the turn failed' : !trace.consistent ? 'a tool ran without its admission record'
      : !completed(result) ? 'the answer did not complete' : null;
    let transcriptBytes = null;
    try { transcriptBytes = statSync(sessionTranscript(session.store, turn.workspace, plan.id)).size; } catch { transcriptBytes = null; }
    ending = why === null && transcriptBytes === null ? 'lost: the harness wrote no transcript' : why;
    try {
      if (ending !== null) removeSessionFiles(session.store, turn.workspace, plan.id);
      writeSession(space.directory, { v: 1, id: plan.id, binding: `${authority} ${session.harness}`, facts, workspace: turn.workspace,
        turns: plan.turn, open: false, ...(ending === null ? {} : { ended: ending }), at: now() });
    } catch { /* an unwritten record leaves the open one: the next turn rotates it as interrupted */ }
    ending = { ended: ending, transcriptBytes };
  }
  journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt, consistent: trace.consistent,
    calls: trace.calls.slice(0, 64).map(call => ({ ...call, input: redactText(call.input),
      result: call.result === null ? null : redactText(call.result) })),
    edges: trace.children.slice(0, SUBSCRIPTION_TOOL_LIMITS.maxChildren).map(edge => ({ child: edge.toolUse, agent: edge.agent,
      parent: `${id}#${String(attempt)}`, authority, budget: { modelTurns: SUBSCRIPTION_TOOL_LIMITS.childMaxTurns,
        toolCalls: `shared ${String(SUBSCRIPTION_TOOL_LIMITS.maxToolCalls)} per turn` },
      exitTest: 'returns its final message as the subagent tool result', placement: 'in the turn\'s harness process on this machine',
      transport: 'claude-code Agent tool', resultDestination: 'the parent turn\'s tool result', cancellation: 'ends with the turn\'s process group',
      state: edge.state === 'returned' ? 'returned' : ended, result: edge.result === null ? null : redactText(edge.result) })),
    workspaceBytes: turn ? workspaceBytes(turn.workspace) : null,
    ...(volume ? { volume } : {}),
    ...(plan ? { session: { id: plan.id, mode: plan.resume ? 'resume' : 'new', reason: plan.reason, turn: plan.turn,
      kept: ending.ended === null, ...(ending.ended === null ? {} : { ended: ending.ended }), transcriptBytes: ending.transcriptBytes } } : {}),
    at: now() });
  // A kept volume is unmounted between turns, its image (and so its files) staying for the next turn; a one-turn volume
  // goes with its image (a failed unmount is retried by prune).
  if (turn) { if (kept) unmount(space.directory); else detach(turn.directory); }
  pruneToolTurns(root, TOOL_TURNS_KEPT, detach);
  if (failure) throw failure;
  if (!trace.consistent) throw Error('preview: a tool ran without its admission record');
  return { result, turn, trace, session: plan };
}

/** Truthful status lines for the operator's status reply (Rule 84): which tools exist, and what they did.
 * Without a tool activation the briefing already says there are no tools; `off` names why the default did not turn them on. */
export function toolStatusLines(view, enabled, off = null) {
  if (!enabled) return off ? [`Tools: off (${off}); answers are text only.`] : [];
  const stats = view.toolTurns ?? { invocations: 0, reservedCalls: 0, refusedCap: 0, toolCalls: 0, toolRefusals: 0, inconsistent: 0, open: [] };
  const sessions = stats.sessions;
  return [`Tools: ${SUBSCRIPTION_TOOL_NAMES.join(', ')} and the root's MCP servers, in this conversation's private workspace (kept between `
      + `turns, ${String(TOOL_SCRATCH_BYTES / 1048576)} MB); shell sandboxed without network; web reads only; consequential effects go through the effect doorway.`,
    `Tool turns: ${stats.invocations} run (${stats.reservedCalls} model attempts reserved for them), ${stats.toolCalls} tool calls admitted, `
      + `${stats.toolRefusals} refused, ${stats.refusedCap} turns answered without tools because the call allowance was short`
      + `${stats.children ? `, ${stats.children.started} subagents started (${stats.children.returned} returned, ${stats.children.cancelled} cancelled, ${stats.children.unknown} unknown)` : ''}`
      + `${stats.refusedPrompt ? `, ${stats.refusedPrompt} because the packet left no room for the tool instructions` : ''}`
      + `${stats.inconsistent ? `, ${stats.inconsistent} turns refused because a tool ran without its admission record` : ''}`
      + `${stats.open?.length ? `, ${stats.open.length} without a recorded trace yet (running now, or interrupted with an unknown outcome)` : ''}.`,
    ...(sessions ? [`Kept session: ${sessions.resumed} turns resumed it, ${sessions.fresh} started a new one (${sessions.changed} after the journal `
      + `changed a fact or the authority changed, ${sessions.lost} after a loss or an interrupted turn, ${sessions.bounded} at its size or turn bound); `
      + `${sessions.ended} ended at a stop, withdrawal or failed turn.`] : []),
    ...(stats.overflow ? [`Workspaces: this root keeps ${String(TOOL_WORKSPACES_KEPT)}; ${stats.overflow} turns of further conversations ran in a fresh `
      + 'one-turn workspace without a kept session.'] : []),
    ...(stats.workspacesLost ? [`Workspace lost: ${stats.workspacesLost} turns found this conversation's kept workspace missing; its earlier files are `
      + 'gone and it started again empty (the journal still holds every answer and tool trace).'] : []),
    ...(stats.reconciledFiles ? [`Workspace kept in step with memory: ${stats.reconciledFiles} files had a forgotten or corrected statement removed.`] : []),
    ...(stats.reconcileIncomplete ? [`Workspace check against memory unfinished on ${stats.reconcileIncomplete} turns (files that could not be changed `
      + 'automatically, kept intact, or a part not yet checked); the agent was told which, and the check repeats each turn until it completes.'] : [])];
}
