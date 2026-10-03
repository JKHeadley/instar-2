// Runner side of a tool turn (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule): the per-turn workspace on its own
// fixed-size scratch volume under the root's allocated `tool-turns` directory, the hook's state directory beside it,
// the trace read back after the turn, and bounded retention. Workspaces and traces are machine-local by declaration (Rule 113): they
// are this runner's scratch; the journal row is the durable record, and nothing here is shared or resumed.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBSCRIPTION_TOOL_LIMITS, SUBSCRIPTION_TOOL_NAMES, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT } from '../../src/assembly/production-provider.js';
import { toolTrace } from './tool-admission.mjs';

export const TOOL_TURNS_DIRECTORY = 'tool-turns';
/** Finished turn directories kept for inspection; older ones are removed (the journal keeps their trace). */
export const TOOL_TURNS_KEPT = 16;
export const TOOL_HOOK_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'tool-admission-hook.mjs');
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
 * `tmp`, all 0700 (`scratch` mounts it; tests may pass a stand-in), and the hook's config: the installation's closed
 * operation set, and the effect doorway's policy and the register's irreversible term (Part Twelve; absent policy:
 * nothing outward by default). */
export function prepareToolTurn({ root, operation, attempt, operations, effectPolicy, irreversibleTerm, node = process.execPath, scratch = attachScratch }) {
  const base = join(realpathSync(root), TOOL_TURNS_DIRECTORY);
  mkdirSync(base, { recursive: true, mode: 0o700 });
  const slug = `${createHash('sha256').update(operation, 'utf8').digest('hex').slice(0, 16)}-${String(attempt)}`;
  const turn = join(base, slug);
  mkdirSync(turn, { mode: 0o700 });
  mkdirSync(join(turn, 'state'), { mode: 0o700 });
  const volume = scratch(turn);
  mkdirSync(join(volume, 'ws'), { mode: 0o700 }); mkdirSync(join(volume, 'tmp'), { mode: 0o700 });
  const workspace = realpathSync(join(volume, 'ws')), tmp = realpathSync(join(volume, 'tmp'));
  const stateDirectory = realpathSync(join(turn, 'state'));
  writeFileSync(join(stateDirectory, 'config.json'), JSON.stringify({ workspace, tmp, maxCalls: SUBSCRIPTION_TOOL_LIMITS.maxToolCalls,
    maxWriteBytes: SUBSCRIPTION_TOOL_LIMITS.maxWriteBytes, operations: [...operations],
    ...(effectPolicy === undefined ? {} : { effectPolicy }), ...(irreversibleTerm === undefined ? {} : { irreversibleTerm }) }), { mode: 0o600 });
  return { slug, directory: turn, scratch: volume, workspace, stateDirectory, hook: { node, script: TOOL_HOOK_SCRIPT } };
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
 * refuses the answer instead of trusting it. `invoke(toolTurn)` runs the admitted route; `redactText` scrubs
 * recorded excerpts.
 */
/** Whether the call allowance holds a tool turn's whole liability. The packet that names the tools and the turn's own
 * reservation use this one predicate, so an answer is told it has tools only when its turn will run with them. The packet
 * is prepared before its base call is reserved, so it passes that call as `unreserved`; dispatch runs after it. */
export const toolTurnFits = (view, unreserved = 0) => view.calls + unreserved + SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1 <= view.limits.maxCalls;
/** The packet's side of `toolTurnFits`: its own base call is not reserved yet when it is prepared. */
export const toolPacketFits = view => toolTurnFits(view, 1);

export async function runToolTurn({ journal, root, id, prepared, promptLimit, deniedRoots, operations, effectPolicy, irreversibleTerm, invoke, fallback,
  now, redactText, scratch = attachScratch, detach = detachScratch }) {
  const extra = SUBSCRIPTION_TOOL_LIMITS.maxTurns - 1;
  const refuse = reason => { journal.append({ kind: 'tool-turn', phase: 'refused', id, reason, at: now() }); return fallback(); };
  if (!toolTurnFits(journal.view)) return refuse('call cap');
  if (Buffer.byteLength(prepared) + Buffer.byteLength(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT) > promptLimit) return refuse('prompt size');
  const attempt = journal.view.toolTurns?.invocations ?? 0;
  journal.append({ kind: 'tool-turn', phase: 'reserved', id, attempt, calls: extra, at: now() });
  let turn = null, result, failure = null;
  try {
    turn = prepareToolTurn({ root, operation: id, attempt, operations, effectPolicy, irreversibleTerm, scratch });
    result = await invoke({ scratch: turn.scratch, workspace: turn.workspace, stateDirectory: turn.stateDirectory, hook: turn.hook, deniedRoots });
  } catch (error) { failure = error; }
  const trace = turn ? readToolTrace(turn.stateDirectory) : { calls: [], consistent: true };
  journal.append({ kind: 'tool-turn', phase: 'trace', id, attempt, consistent: trace.consistent,
    calls: trace.calls.slice(0, 64).map(call => ({ ...call, input: redactText(call.input),
      result: call.result === null ? null : redactText(call.result) })),
    workspaceBytes: turn ? workspaceBytes(turn.workspace) : null, at: now() });
  // The workspace is scratch: nothing reads it after the turn, so its volume goes now (a failed unmount is retried by prune).
  if (turn) detach(turn.directory);
  pruneToolTurns(root, TOOL_TURNS_KEPT, detach);
  if (failure) throw failure;
  if (!trace.consistent) throw Error('preview: a tool ran without its admission record');
  return { result, turn, trace };
}

/** Truthful status lines for the operator's status reply (Rule 84): which tools exist, and what they did.
 * Without a tool activation the briefing already says there are no tools, and status adds nothing. */
export function toolStatusLines(view, enabled) {
  if (!enabled) return [];
  const stats = view.toolTurns ?? { invocations: 0, reservedCalls: 0, refusedCap: 0, toolCalls: 0, toolRefusals: 0, inconsistent: 0, open: [] };
  return [`Tools: ${SUBSCRIPTION_TOOL_NAMES.join(', ')}, in a private per-turn workspace; no MCP servers, subagents, web search or network.`,
    `Tool turns: ${stats.invocations} run (${stats.reservedCalls} model attempts reserved for them), ${stats.toolCalls} tool calls admitted, `
      + `${stats.toolRefusals} refused, ${stats.refusedCap} turns answered without tools because the call allowance was short`
      + `${stats.refusedPrompt ? `, ${stats.refusedPrompt} because the packet left no room for the tool instructions` : ''}`
      + `${stats.inconsistent ? `, ${stats.inconsistent} turns refused because a tool ran without its admission record` : ''}`
      + `${stats.open?.length ? `, ${stats.open.length} without a recorded trace yet (running now, or interrupted with an unknown outcome)` : ''}.`];
}
