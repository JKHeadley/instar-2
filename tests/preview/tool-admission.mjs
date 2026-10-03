// The tool turn's admission decision (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule). Pure: every input is
// passed in, so the executable hook (tool-admission-hook.mjs) and the tests run the same function.
// Deny by default. Ordinary in-workspace file tools and sandboxed shell commands are admitted. A shell
// command is not judged by the words it contains: what it can reach is enforced where it runs (the
// sandbox's read, write, network and process scope, the bounded volume, the per-file limit). A delegation
// and a consequential tool (an MCP tool, an unsandboxed shell) are decided by the host's admission checkpoint
// (admission-gate.mjs), which records the delegation as a durable child edge, or passes the exact operation
// and input to the effect owner, before the call runs. A route with no checkpoint refuses both.
import { basename, dirname, join, resolve, sep } from 'node:path';

const SHELL_SAFE_PATH = /^\/[A-Za-z0-9_./@-]+$/u;
/** Prepended to every admitted shell command. Claude Code 2.1.280 exports its own messaging inbox
 * socket and token into the Bash tool (residual 6); the sandbox already refuses unix-socket connects,
 * and this removes both values from the command's environment as well. `TMPDIR` points at the turn's
 * own scratch volume (the harness's shared default is refused for writes), and `ulimit -f` bounds each
 * file a command writes (65536 blocks of 512 bytes). `tmp` is absolute and shell-safe. */
export function toolShellPrefix(tmp) {
  if (typeof tmp !== 'string' || !SHELL_SAFE_PATH.test(tmp)) throw Error('tool admission: shell temporary directory absent');
  return `unset CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_MESSAGING_SOCKET; export TMPDIR=${tmp}; ulimit -f 65536; `;
}
/** System locations a confined shell reads to run at all (the tool turn's runtime list, plus the installed tool
 * prefixes and the command-line developer tools that `python3` and `git` resolve through). Nothing under a home,
 * a mounted volume, a login profile or the runner root is on it. */
export const SHELL_RUNTIME_READS = Object.freeze(['/bin', '/sbin', '/usr/bin', '/usr/sbin', '/usr/lib', '/usr/libexec', '/usr/share',
  '/usr/local', '/opt/homebrew', '/System', '/Library/Developer/CommandLineTools', '/private/var/select', '/private/etc', '/dev']);
const SBPL_PATH = /^\/[A-Za-z0-9_./@-]+$/u;
/**
 * The confined shell's macOS sandbox profile (`shell-sandbox-v1`), for a harness whose own sandbox is not used: a
 * delegated session, and the Codex tool turn (`codex exec` cannot confine reads itself). File contents are readable
 * only from the workspace, its temporary directory and the runtime list; writes reach only those two; there is no
 * network, no signal to any other process, and no keychain service. A path's existence stays visible (metadata),
 * its contents do not. Every `Bash` call is rewritten to run under it (`sandboxedShellCommand`).
 */
export function shellSandboxProfile({ workspace, tmp }) {
  if (![workspace, tmp].every(path => typeof path === 'string' && SBPL_PATH.test(path)))
    throw Error('tool admission: confined shell paths must be absolute and plain');
  const subpaths = paths => paths.map(path => `(subpath "${path}")`).join(' ');
  return ['(version 1)', '(allow default)', '(deny network*)',
    '(deny file-read-data (subpath "/"))', `(allow file-read-data (literal "/") ${subpaths([...SHELL_RUNTIME_READS, workspace, tmp])})`,
    '(deny file-write* (subpath "/"))',
    `(allow file-write* ${subpaths([workspace, tmp])} (literal "/dev/null") (literal "/dev/zero") (regex #"^/dev/tty") (regex #"^/dev/fd/"))`,
    '(deny signal)', '(allow signal (target self))',
    '(deny mach-lookup (global-name "com.apple.SecurityServer") (global-name "com.apple.securityd.xpc") (global-name "com.apple.security.agent"))',
    ''].join('\n');
}
const quoted = text => `'${String(text).replaceAll("'", "'\\''")}'`;
/** One shell command, run under the confined profile with a clean environment: no inherited variable (a harness
 * token or socket) reaches it, `TMPDIR` is the step's own, and `ulimit -f` bounds each file it writes. */
export function sandboxedShellCommand(command, { profile, workspace, tmp }) {
  if (![profile, workspace, tmp].every(path => typeof path === 'string' && SHELL_SAFE_PATH.test(path)))
    throw Error('tool admission: confined shell paths absent');
  return `/usr/bin/sandbox-exec -f ${profile} /usr/bin/env -i PATH=${SHELL_RUNTIME_READS.filter(p => /bin$/u.test(p)).join(':')}`
    + `:/usr/local/bin:/opt/homebrew/bin HOME=${workspace} TMPDIR=${tmp} /bin/zsh -c ${quoted(`ulimit -f 65536; ${command}`)}`;
}
/** The paths a Codex `apply_patch` call names, or null when its text is not a patch this reads. */
export function patchPaths(text) {
  if (typeof text !== 'string' || !text.startsWith('*** Begin Patch')) return null;
  const paths = [];
  for (const line of text.split('\n')) {
    const match = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/u.exec(line);
    if (match) paths.push(match[1].trim());
  }
  return paths.length > 0 ? paths : null;
}
/** Tools that start another agent thread (a subagent): Claude Code's, and Codex 0.156.1's as its hook names it
 * (recorded live 2026-10-03, fixtures/codex-capabilities-2026-10-03). Each one becomes a durable child edge first. */
export const DELEGATION_TOOLS = Object.freeze(['Agent', 'Task', 'spawn_agent', 'collaborationspawn_agent']);
/** Reads from the network: Claude Code's fetch and search, and Codex's web search (`webrun` to its hook). */
export const NETWORK_READ_TOOLS = Object.freeze(['WebFetch', 'WebSearch', 'webrun']);
/** The harness's own planning, output-reading and subagent-handling tools: no effect outside the step. A subagent
 * these address already has its edge. */
export const BOOKKEEPING_TOOLS = Object.freeze(['TodoWrite', 'update_plan', 'BashOutput', 'KillShell', 'collaborationwait_agent',
  'collaborationsend_input', 'collaborationclose_agent', 'collaborationresume_agent']);
export const FILE_TOOLS = Object.freeze(['Read', 'Write', 'Edit']);
const SEARCH_TOOLS = Object.freeze(['Glob', 'Grep']);
/** Bounded excerpt of a tool input or result kept in the admission record. */
export const RECORD_EXCERPT_CHARS = 4096;


/** Physical containment: resolve the symlinks of the longest existing prefix, then compare real paths. */
export function containedIn(workspace, path, fs) {
  let abs = resolve(workspace, String(path));
  const rest = [];
  while (!fs.exists(abs)) { rest.unshift(basename(abs)); const up = dirname(abs); if (up === abs) break; abs = up; }
  const real = join(fs.realpath(abs), ...rest);
  return real === workspace || real.startsWith(workspace + sep);
}

/**
 * One PreToolUse decision. `call` is the hook input ({tool_name, tool_input}); `config` is the turn's
 * {workspace (real path), tmp (the shell's temporary directory), maxCalls, maxWriteBytes, gate?}; `n` is
 * this call's 1-based count in the step (maxCalls + 1 once every slot is taken); `fs`
 * gives exists/realpath. Returns {decision, reason, kind?, updatedInput?}. `decision: 'gate'` (a delegation, an
 * effect) is decided by the host checkpoint at `config.gate`; the hook asks it before the call runs.
 */
export function admitToolCall(call, config, n, fs) {
  const tool = String(call?.tool_name ?? ''), input = call?.tool_input ?? {};
  const deny = (reason, kind) => ({ decision: 'deny', reason, ...(kind ? { kind } : {}) });
  const effect = () => typeof config.gate === 'string' ? { decision: 'gate', kind: 'effect', reason: 'consequential: the effect owner decides' }
    : deny(`consequential tool ${tool}: this route has no effect owner; refused by default`, 'effect');
  if (!Number.isSafeInteger(n) || n < 1) return deny('admission count unavailable');
  if (n > config.maxCalls) return deny(`per-step call cap ${config.maxCalls} reached (call ${n})`);
  const inside = path => typeof path === 'string' && path.length > 0 && containedIn(config.workspace, path, fs);
  if (FILE_TOOLS.includes(tool)) {
    const path = input.file_path;
    if (!inside(path)) return deny(`path outside the workspace: ${String(path)}`, 'scope');
    if (tool === 'Write' && Buffer.byteLength(String(input.content ?? '')) > config.maxWriteBytes)
      return deny(`write larger than ${config.maxWriteBytes} bytes`, 'scope');
    return { decision: 'allow', reason: 'ordinary in-workspace file operation' };
  }
  if (SEARCH_TOOLS.includes(tool)) {
    const path = input.path ?? config.workspace;
    if (!inside(path)) return deny(`search outside the workspace: ${String(path)}`, 'scope');
    const shape = tool === 'Glob' ? String(input.pattern ?? '') : String(input.glob ?? '');
    if (shape.startsWith('/') || shape.includes('..')) return deny(`search pattern outside the workspace: ${shape}`, 'scope');
    return { decision: 'allow', reason: 'ordinary in-workspace search' };
  }
  if (tool === 'Bash') {
    const command = String(input.command ?? '');
    if (!command.trim()) return deny('empty command');
    // A confined shell (`shellProfile` set) runs every command under the step's own sandbox profile, whatever the
    // harness asked for; otherwise the harness's own sandbox bounds it and an unsandboxed request is an effect.
    if (config.shellProfile) return { decision: 'allow', reason: 'confined command',
      updatedInput: { ...input, command: sandboxedShellCommand(command, { profile: config.shellProfile, workspace: config.workspace, tmp: config.tmp }) } };
    if (input.dangerouslyDisableSandbox) return effect();
    return { decision: 'allow', reason: 'sandboxed command',
      updatedInput: { ...input, command: toolShellPrefix(config.tmp) + command } };
  }
  if (tool === 'apply_patch') {
    const patch = String(input.command ?? input.input ?? '');
    const paths = patchPaths(patch);
    if (paths === null) return deny('unreadable patch', 'scope');
    const outside = paths.find(path => !inside(path));
    if (outside !== undefined) return deny(`path outside the workspace: ${outside}`, 'scope');
    if (Buffer.byteLength(patch) > config.maxWriteBytes) return deny(`patch larger than ${config.maxWriteBytes} bytes`, 'scope');
    return { decision: 'allow', reason: 'ordinary in-workspace patch' };
  }
  if (tool.startsWith('mcp__')) return effect();
  if (NETWORK_READ_TOOLS.includes(tool))
    return config.networkReads === true ? { decision: 'allow', reason: 'network read' } : deny(`network read ${tool} not admitted on this route`);
  if (DELEGATION_TOOLS.includes(tool) && config.delegation === true)
    return typeof config.gate === 'string' ? { decision: 'gate', kind: 'delegation', reason: 'delegation: recorded as a child edge first' }
      : deny('delegation needs the admission checkpoint to record its edge; this route has none', 'delegation');
  if (BOOKKEEPING_TOOLS.includes(tool) && config.delegation === true) return { decision: 'allow', reason: 'harness bookkeeping' };
  return deny(`unregistered tool ${tool || '(none)'}: refused by default`);
}

/** The hook's stdout for a decision: a deny, or an allow carrying the rewritten shell command. */
export function hookOutput(decision) {
  if (decision.decision === 'deny') return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: decision.reason } };
  if (decision.updatedInput) return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow',
    permissionDecisionReason: decision.reason, updatedInput: decision.updatedInput } };
  return null;
}

const excerpt = value => { const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return text.length > RECORD_EXCERPT_CHARS ? `${text.slice(0, RECORD_EXCERPT_CHARS)}…[truncated]` : text; };
/**
 * Reads the hook's admission record into the trace the runner journals (Rule 41 provenance: which
 * tool call produced which result). `consistent` is false when a tool result has no admitted call
 * before it: a tool ran past the hook, so the turn's outcome cannot be trusted.
 */
export function toolTrace(lines) {
  const calls = [], admitted = new Map();
  let consistent = true, malformed = 0;
  for (const line of lines) {
    let row; try { row = JSON.parse(line); } catch { malformed++; continue; }
    if (row?.phase === 'pre') {
      const entry = { n: row.n, tool: row.tool, input: excerpt(row.input), decision: row.decision, reason: row.reason,
        ...(row.kind ? { kind: row.kind } : {}), result: null };
      calls.push(entry);
      if (row.decision === 'allow' && typeof row.id === 'string') admitted.set(row.id, entry);
    } else if (row?.phase === 'post') {
      const entry = typeof row.id === 'string' ? admitted.get(row.id) : undefined;
      if (!entry || entry.tool !== row.tool || entry.result !== null) { consistent = false; continue; }
      entry.result = excerpt(row.result);
    } else malformed++;
  }
  return { calls, consistent: consistent && malformed === 0,
    admitted: calls.filter(call => call.decision === 'allow').length, refused: calls.filter(call => call.decision !== 'allow').length };
}
