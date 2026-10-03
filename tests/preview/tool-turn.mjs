// Runner side of a tool turn (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule): the per-turn workspace on its own
// fixed-size scratch volume under the root's allocated `tool-turns` directory, the hook's state directory beside it,
// the trace read back after the turn, and bounded retention. Workspaces and traces are machine-local by declaration (Rule 113): they
// are this runner's scratch; the journal row is the durable record, and nothing here is shared or resumed.
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBSCRIPTION_SUBAGENT_TYPE, SUBSCRIPTION_TOOL_LIMITS, SUBSCRIPTION_TOOL_NAMES, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { toolTrace } from './tool-admission.mjs';

export const TOOL_TURNS_DIRECTORY = 'tool-turns';
/** Where a root keeps the tools activation the runner derived by default (its live withdrawal handle; machine-local). */
export const TOOLS_DEFAULT_ACTIVATION = 'tools-activation.json';
/** Finished turn directories kept for inspection; older ones are removed (the journal keeps their trace). */
export const TOOL_TURNS_KEPT = 16;
export const TOOL_HOOK_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'tool-admission-hook.mjs');
/** The turn's shell egress checkpoint (egress-checkpoint.mjs): one process per turn, started before the harness and
 * stopped with the turn; its authority certificate is written to the scratch volume as EGRESS_CA_FILE. */
export const EGRESS_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'egress-checkpoint.mjs');
export const EGRESS_CA_FILE = 'egress-ca.pem';
const SAFE_DIRECTORY = /^\/[A-Za-z0-9_./@-]+$/u;
/** The toolchain a sandboxed command reads to use the network: the runner's own node installation (node and npm; its
 * `bin` leads the command's PATH) and the developer tools that hold git. Installed programs only; a path that is not
 * plain, or the filesystem root, is left out rather than widened around. Returns {reads, bin, developer}. */
export function toolchainReads({ execPath = process.execPath, real = realpathSync, exists = existsSync } = {}) {
  const reads = [], bin = [];
  let developer = null;
  const add = path => { if (SAFE_DIRECTORY.test(path) && path !== '/' && !reads.includes(path)) { reads.push(path); return true; } return false; };
  try { const node = dirname(dirname(real(execPath))); if (add(node) && exists(join(node, 'bin'))) bin.push(join(node, 'bin')); } catch { /* no node prefix */ }
  // macOS's /usr/bin/git is a shim (xcrun) that needs the per-user cache directory and a read through the /var link, both
  // outside the sandbox; the developer tools' own git needs neither, so their `usr/bin` leads PATH (the command line tools when
  // installed, else the selected developer directory) and DEVELOPER_DIR names them for any other shim.
  const candidates = ['/Library/Developer/CommandLineTools'];
  for (const link of ['/private/var/select/developer_dir', '/private/var/db/xcode_select_link']) try { candidates.push(real(link)); } catch { /* absent */ }
  for (const dir of candidates) {
    if (exists(join(dir, 'usr', 'bin', 'git')) && add(dir)) { developer = dir; bin.push(join(dir, 'usr', 'bin')); break; }
  }
  return { reads, bin, developer };
}
/** Adds the running checkpoint's port to the turn's admission config (write then rename), so every later shell command is
 * pointed at it by address: inside the sandbox the name `localhost` does not resolve for every client (node's resolver
 * cannot reach the system's), while 127.0.0.1 needs no resolver. */
export function recordEgressPort(stateDirectory, port) {
  const path = join(stateDirectory, 'config.json'), config = JSON.parse(readFileSync(path, 'utf8'));
  if (!config.egress || !Number.isSafeInteger(port)) throw Error('preview: no egress configuration for the checkpoint port');
  writeFileSync(`${path}.next`, JSON.stringify({ ...config, egress: { ...config.egress, port } }), { mode: 0o600 });
  renameSync(`${path}.next`, path);
}
/** Starts the turn's egress checkpoint for `stateDirectory` (whose config names its authority certificate's path) and
 * waits for its port. Returns {port, pid, stop}; `stop` signals exactly that process id, then kills it if it has not
 * exited within the grace period, and resolves once it has gone. */
export function startEgressCheckpoint(stateDirectory, { node = process.execPath, readyMs = 15000, graceMs = 2000 } = {}) {
  return new Promise((resolveStart, rejectStart) => {
    const child = spawn(node, ['--max-old-space-size=128', EGRESS_SCRIPT, stateDirectory],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin' } });
    let out = '', err = '', ready = false;
    const exited = new Promise(done => child.once('exit', done));
    const stop = async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try { process.kill(child.pid, 'SIGTERM'); } catch { return; }
      const timer = setTimeout(() => { try { process.kill(child.pid, 'SIGKILL'); } catch { /* gone */ } }, graceMs);
      await exited; clearTimeout(timer);
    };
    const timer = setTimeout(() => { if (!ready) { stop(); rejectStart(Error('egress checkpoint did not start in time')); } }, readyMs);
    child.stderr.on('data', chunk => { err = (err + chunk).slice(-2048); });
    child.stdout.on('data', chunk => {
      out += chunk;
      if (ready || !out.includes('\n')) return;
      ready = true; clearTimeout(timer);
      try { const { port } = JSON.parse(out.slice(0, out.indexOf('\n'))); resolveStart({ port, pid: child.pid, stop }); }
      catch (error) { stop(); rejectStart(error); }
    });
    child.once('exit', code => { if (!ready) { clearTimeout(timer); rejectStart(Error(`egress checkpoint exited (${String(code)}): ${err.trim()}`)); } });
  });
}
/** Answer turns and scheduled obligation work run with tools; reviews, summaries and benchmark reruns never do. */
export const toolTurnEligible = id => /^telegram:[0-9]+:update:[0-9]+$/u.test(id) || /^obligation:/u.test(id);

/** The fixed size of one turn's scratch volume. Every byte a tool can write (the workspace, the shell's
 * temporary files) lands on it, so a turn can never take more than this from the disk that holds the journal. */
export const TOOL_SCRATCH_BYTES = 128 * 1024 * 1024;
const HDIUTIL = '/usr/bin/hdiutil';
const SCRATCH_IMAGE = 'scratch.sparseimage', SCRATCH_LINK = 'vol';
/** Where scratch volumes mount. The mount point doubles as the harness's temporary directory (CLAUDE_CODE_TMPDIR), and
 * Claude Code 2.1.280 keeps its per-user directory under it only while that path stays within 44 bytes (else it falls
 * back to the shared /tmp/claude-<uid>, outside the volume), so the mount point is short: `/private/tmp/itt-` and 12
 * hex digits (29 bytes). The turn directory links to it as `vol`, so prune finds a volume a crash left mounted. */
export const TOOL_SCRATCH_MOUNTS = '/private/tmp';
const mountOf = turn => { try { return readlinkSync(join(turn, SCRATCH_LINK)); } catch { return null; } };
/** Whether a turn directory's scratch volume is still mounted (its mount point sits on another device). */
export function scratchMounted(turn) {
  const mount = mountOf(turn);
  try { return mount !== null && lstatSync(mount).dev !== lstatSync(dirname(mount)).dev; } catch { return false; }
}
/** Creates and mounts a turn's fixed-size scratch volume (a sparse disk image: it takes only the bytes written, and
 * refuses writes past `bytes`), linked from `<turn>/vol`. Returns the mount point's real path. */
export function attachScratch(turn, bytes = TOOL_SCRATCH_BYTES, mounts = TOOL_SCRATCH_MOUNTS) {
  const image = join(turn, SCRATCH_IMAGE), mount = join(realpathSync(mounts), `itt-${randomBytes(6).toString('hex')}`);
  mkdirSync(mount, { mode: 0o700 });
  symlinkSync(mount, join(turn, SCRATCH_LINK));
  execFileSync(HDIUTIL, ['create', '-quiet', '-size', `${String(Math.ceil(bytes / 1048576))}m`, '-type', 'SPARSE', '-fs', 'HFS+',
    '-volname', 'instar-tool-turn', image], { stdio: 'ignore', timeout: 60000 });
  execFileSync(HDIUTIL, ['attach', '-quiet', '-nobrowse', '-noautoopen', '-owners', 'on', '-mountpoint', mount, image],
    { stdio: 'ignore', timeout: 60000 });
  if (!scratchMounted(turn)) throw Error('preview: tool scratch volume did not mount');
  chmodSync(mount, 0o700);
  return realpathSync(mount);
}
/** Unmounts a turn's scratch volume and removes its image and mount point; the turn directory keeps only the admission
 * state. Returns false when the volume is still mounted afterwards (a later prune retries). */
export function detachScratch(turn) {
  const mount = mountOf(turn);
  if (scratchMounted(turn)) {
    try { execFileSync(HDIUTIL, ['detach', '-quiet', '-force', mount], { stdio: 'ignore', timeout: 60000 }); } catch { /* checked below */ }
    if (scratchMounted(turn)) return false;
  }
  if (mount !== null) try { rmdirSync(mount); } catch { /* already gone */ }
  rmSync(join(turn, SCRATCH_IMAGE), { force: true });
  return true;
}

/** Allocates a fresh turn: `<root>/tool-turns/<digest>-<attempt>/state` and the turn's scratch volume holding `ws` and
 * `tmp`, all 0700 (`scratch` mounts it; tests may pass a stand-in), and the hook's config. `children` is the number of
 * subagents this turn's reservation covers; `mcp` is the root's MCP configuration ({servers, reads}) or null. The
 * servers' launch configuration is written into the state directory, which no tool can read. */
/** A turn directory's name: its operation's digest and its attempt (the journal's `id#attempt` key, filesystem-safe). */
export const toolTurnSlug = (operation, attempt) => `${createHash('sha256').update(operation, 'utf8').digest('hex').slice(0, 16)}-${String(attempt)}`;
export function prepareToolTurn({ root, operation, attempt, operations, children = 0, mcp = null, node = process.execPath, scratch = attachScratch,
  authority = 'unrecorded', egress = null }) {
  const base = join(realpathSync(root), TOOL_TURNS_DIRECTORY);
  mkdirSync(base, { recursive: true, mode: 0o700 });
  const slug = toolTurnSlug(operation, attempt);
  const turn = join(base, slug);
  mkdirSync(turn, { mode: 0o700 });
  mkdirSync(join(turn, 'state'), { mode: 0o700 });
  const volume = scratch(turn);
  mkdirSync(join(volume, 'ws'), { mode: 0o700 }); mkdirSync(join(volume, 'tmp'), { mode: 0o700 });
  const workspace = realpathSync(join(volume, 'ws')), tmp = realpathSync(join(volume, 'tmp'));
  const stateDirectory = realpathSync(join(turn, 'state'));
  const servers = mcp ? Object.keys(mcp.servers) : [];
  writeFileSync(join(stateDirectory, 'config.json'), JSON.stringify({ workspace, tmp, maxCalls: SUBSCRIPTION_TOOL_LIMITS.maxToolCalls,
    maxWriteBytes: SUBSCRIPTION_TOOL_LIMITS.maxWriteBytes, operations: [...operations],
    children: { max: children, type: SUBSCRIPTION_SUBAGENT_TYPE }, mcpReads: mcp ? [...mcp.reads] : [], authority,
    ...(egress ? { egress: { ca: join(volume, EGRESS_CA_FILE), bin: [...egress.bin], ...(egress.developer ? { developer: egress.developer } : {}) } } : {}) }), { mode: 0o600 });
  let mcpTurn;
  if (servers.length) {
    writeFileSync(join(stateDirectory, 'mcp.json'), JSON.stringify({ mcpServers: mcp.servers }), { mode: 0o600 });
    mcpTurn = { config: join(stateDirectory, 'mcp.json'), servers };
  }
  return { slug, directory: turn, scratch: volume, workspace, stateDirectory, hook: { node, script: TOOL_HOOK_SCRIPT },
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

/** The directory names of the turns the journal still holds open (reserved, no trace yet): running now, or interrupted. */
export const openToolTurnSlugs = view => new Set((view.toolTurns?.open ?? []).map(key => {
  const at = key.lastIndexOf('#'); return toolTurnSlug(key.slice(0, at), Number(key.slice(at + 1)));
}));
/** Keeps the newest `keep` turn directories (by modification time); a failed removal is reported, not thrown.
 * A volume left mounted (a turn interrupted by a crash) is unmounted first; one that will not unmount is kept.
 * A directory in `open` (a turn the journal has no trace for yet) is never removed: its hook record is the only
 * evidence of what that turn admitted and which subagents it started, until `reconcileToolTurns` journals it. */
export function pruneToolTurns(root, keep = TOOL_TURNS_KEPT, detach = detachScratch, open = new Set()) {
  const base = join(root, TOOL_TURNS_DIRECTORY);
  let names;
  try { names = readdirSync(base); } catch { return { removed: 0, failed: 0 }; }
  const dirs = names.filter(name => !open.has(name)).map(name => ({ name, at: lstatSync(join(base, name)).mtimeMs })).sort((a, b) => b.at - a.at);
  let removed = 0, failed = 0;
  for (const { name } of dirs.slice(keep)) {
    try {
      if (!detach(join(base, name))) { failed++; continue; }
      rmSync(join(base, name), { recursive: true, force: true }); removed++;
    } catch { failed++; }
  }
  return { removed, failed };
}

/** The journal row recording a turn's trace (its admitted calls and Rule 114 child edges). `ended` is the state of an
 * edge with no returned result: `cancelled` when the operator's stop or a withdrawal ended it, else `unknown`. */
/** Shell network requests a trace row keeps (the rest are counted). */
export const EGRESS_KEPT = 64;
function traceRow({ id, attempt, trace, authority, ended, redactText, workspace, at, network = null }) {
  const egress = trace.egress ?? [];
  return { kind: 'tool-turn', phase: 'trace', id, attempt, consistent: trace.consistent,
    // Rule 41: every shell network request the checkpoint decided, its decision and outcome (`network` says whether the
    // checkpoint ran: `checkpoint`, `none`, or `unavailable: <reason>` when the shell ran offline).
    ...(network !== null ? { network, egress: egress.slice(0, EGRESS_KEPT).map(row => ({ ...row, url: redactText(row.url) })),
      egressOmitted: Math.max(0, egress.length - EGRESS_KEPT), ...(trace.egressErrors ? { egressErrors: trace.egressErrors } : {}),
      ...(trace.egressBudgetSpent ? { egressBudgetSpent: true } : {}) } : {}),
    calls: trace.calls.slice(0, 64).map(call => ({ ...call, input: redactText(call.input),
      result: call.result === null ? null : redactText(call.result) })),
    // `parent` is the turn that owns the edge and its reservation; `parentAgent` the subagent that started it (null: the turn).
    edges: trace.children.slice(0, SUBSCRIPTION_TOOL_LIMITS.maxChildren).map(edge => ({ child: edge.toolUse, agent: edge.agent,
      parent: `${id}#${String(attempt)}`, parentAgent: edge.parentAgent ?? null, authority, budget: { modelTurns: SUBSCRIPTION_TOOL_LIMITS.childMaxTurns,
        toolCalls: `shared ${String(SUBSCRIPTION_TOOL_LIMITS.maxToolCalls)} per turn` },
      exitTest: 'returns its final message as the subagent tool result', placement: 'in the turn\'s harness process on this machine',
      transport: 'claude-code Agent tool',
      resultDestination: edge.parentAgent ? `the tool result of subagent ${edge.parentAgent}` : 'the parent turn\'s tool result', cancellation: 'ends with the turn\'s process group',
      state: edge.state === 'returned' ? 'returned' : ended, result: edge.result === null ? null : redactText(edge.result) })),
    workspaceBytes: workspace === null ? null : workspaceBytes(workspace), at };
}

/** Rule 114 recovery, run at launch before any tool turn starts (the process owner makes this runner the root's only
 * one, so no open turn is still running): each turn the journal holds open whose directory survives an interrupted run
 * gets its trace journaled from the hook's synced record, under the authority its admission config recorded, with every
 * child that did not return marked `unknown` (its outcome was never observed; nothing is re-run). A turn with no
 * surviving directory stays open (its outcome unknown, as status says). Returns the keys it closed. */
export function reconcileToolTurns({ journal, root, redactText, now }) {
  const closed = [];
  for (const key of [...(journal.view.toolTurns?.open ?? [])]) {
    const at = key.lastIndexOf('#'), id = key.slice(0, at), attempt = Number(key.slice(at + 1));
    const stateDirectory = join(root, TOOL_TURNS_DIRECTORY, toolTurnSlug(id, attempt), 'state');
    let config;
    try { config = JSON.parse(readFileSync(join(stateDirectory, 'config.json'), 'utf8')); } catch { continue; }
    const authority = typeof config?.authority === 'string' && config.authority ? config.authority : 'unrecorded';
    journal.append(traceRow({ id, attempt, trace: readToolTrace(stateDirectory), authority, ended: 'unknown', redactText,
      workspace: null, at: now(), network: 'interrupted' }));
    closed.push(key);
  }
  return closed;
}

/**
 * One tool turn, as the runner runs it (Part Thirteen §9, docs/17-harness-adapters). Its whole liability, every model turn the policy
 * allows beyond the answer's own reserved attempt, is reserved against the operator's call cap before
 * dispatch and retained (MF4). A short allowance, or a packet the longer tool system prompt would overflow,
 * answers this turn without tools (`fallback`), recorded. The reservation is durable before anything is
 * allocated or launched, so a crash leaves it open and visible. The hook's trace is journaled after the
 * turn whatever its outcome; a tool result with no admitted call before it (a tool that ran past the hook)
 * refuses the answer instead of trusting it. `invoke(toolTurn)` runs the admitted route; `redactText` scrubs
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
  authority = 'unrecorded', mcp = null, stopped = () => false, scratch = attachScratch, detach = detachScratch,
  egress = startEgressCheckpoint, toolchain = toolchainReads }) {
  const extra = SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1;
  const refuse = reason => { journal.append({ kind: 'tool-turn', phase: 'refused', id, reason, at: now() }); return fallback(); };
  if (!toolTurnFits(journal.view)) return refuse('call cap');
  if (Buffer.byteLength(prepared) + Buffer.byteLength(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT) > promptLimit) return refuse('prompt size');
  const attempt = journal.view.toolTurns?.invocations ?? 0;
  const children = toolChildrenFit(journal.view);
  // Rule 114: the edge's authority and budget share are durable before dispatch, with the turn's whole liability.
  journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt, calls: extra + children * SUBSCRIPTION_TOOL_LIMITS.childMaxTurns,
    delegation: { children, turnsEach: SUBSCRIPTION_TOOL_LIMITS.childMaxTurns, type: SUBSCRIPTION_SUBAGENT_TYPE, authority },
    ...(mcp ? { mcp: { servers: Object.keys(mcp.servers), reads: mcp.reads.length, digest: mcp.digest } } : {}), at: now() });
  let turn = null, result, failure = null, checkpoint = null, network = 'none';
  try {
    // The shell's network: one egress checkpoint for this turn. If it cannot start, the turn runs with the shell offline
    // (the sandbox then reaches no address at all), and the trace says so.
    const tools = egress ? toolchain() : null;
    turn = prepareToolTurn({ root, operation: id, attempt, operations, children, mcp, scratch, authority, egress: tools });
    if (egress) {
      try { checkpoint = await egress(turn.stateDirectory); recordEgressPort(turn.stateDirectory, checkpoint.port); network = 'checkpoint'; }
      catch (error) { network = `unavailable: ${String(error?.message ?? error).slice(0, 256)}`; }
    }
    result = await invoke({ scratch: turn.scratch, workspace: turn.workspace, stateDirectory: turn.stateDirectory, hook: turn.hook, deniedRoots,
      ...(turn.mcp ? { mcp: turn.mcp } : {}), ...(checkpoint ? { egress: { port: checkpoint.port, reads: tools.reads } } : {}) });
  } catch (error) { failure = error; }
  // The checkpoint ends with the turn: no shell request can start after the harness has gone.
  if (checkpoint) await checkpoint.stop();
  const trace = turn ? readToolTrace(turn.stateDirectory) : { calls: [], children: [], egress: [], consistent: true };
  const ended = stopped() ? 'cancelled' : 'unknown';
  journal.append(traceRow({ id, attempt, trace, authority, ended, redactText, workspace: turn ? turn.workspace : null, at: now(), network }));
  // The workspace is scratch: nothing reads it after the turn, so its volume goes now (a failed unmount is retried by prune).
  if (turn) detach(turn.directory);
  pruneToolTurns(root, TOOL_TURNS_KEPT, detach, openToolTurnSlugs(journal.view));
  if (failure) throw failure;
  if (!trace.consistent) throw Error('preview: a tool ran without its admission record');
  return { result, turn, trace };
}

/** Truthful status lines for the operator's status reply (Rule 84): which tools exist, and what they did.
 * Without a tool activation the briefing already says there are no tools; `off` names why the default did not turn them on. */
export function toolStatusLines(view, enabled, off = null) {
  if (!enabled) return off ? [`Tools: off (${off}); answers are text only.`] : [];
  const stats = view.toolTurns ?? { invocations: 0, reservedCalls: 0, refusedCap: 0, toolCalls: 0, toolRefusals: 0, inconsistent: 0, open: [] };
  return [`Tools: the harness's full built-in set (${SUBSCRIPTION_TOOL_NAMES.length} tools, each call decided at the admission hook) and the `
      + 'root\'s MCP servers, in a private per-turn workspace; shell sandboxed, its network through a per-turn checkpoint (public reads '
      + 'only); web reads only; subagents may delegate within the turn\'s budget; consequential effects go through the effect doorway.',
    `Tool turns: ${stats.invocations} run (${stats.reservedCalls} model attempts reserved for them), ${stats.toolCalls} tool calls admitted, `
      + `${stats.toolRefusals} refused, ${stats.refusedCap} turns answered without tools because the call allowance was short`
      + `${stats.children ? `, ${stats.children.started} subagents started (${stats.children.returned} returned, ${stats.children.cancelled} cancelled, ${stats.children.unknown} unknown)` : ''}`
      + `${stats.refusedPrompt ? `, ${stats.refusedPrompt} because the packet left no room for the tool instructions` : ''}`
      + `${stats.egress ? `, ${stats.egress.admitted} shell network reads admitted, ${stats.egress.refused} shell network requests refused` : ''}`
      + `${stats.inconsistent ? `, ${stats.inconsistent} turns refused because a tool ran without its admission record` : ''}`
      + `${stats.open?.length ? `, ${stats.open.length} without a recorded trace yet (running now, or interrupted with an unknown outcome)` : ''}.`];
}
