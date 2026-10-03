// The tool turn's admission decision (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule). Pure: every input is
// passed in, so the executable hook (tool-admission-hook.mjs) and the tests run the same function.
// Deny by default. Ordinary in-workspace file tools and sandboxed shell commands are admitted. A shell
// command is not judged by the words it contains: what it can reach is enforced where it runs (the
// sandbox's read, write, network and process scope, the turn's fixed-size scratch volume, the per-file
// limit). A consequential tool (an MCP or web tool, an unsandboxed shell) goes to the effect doorway's
// admission, which admits only an operation the installed profile registers for that tool effect; the
// single-machine profile registers none, so it refuses.
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
export const FILE_TOOLS = Object.freeze(['Read', 'Write', 'Edit']);
const SEARCH_TOOLS = Object.freeze(['Glob', 'Grep']);
/** Bounded excerpt of a tool input or result kept in the admission record. */
export const RECORD_EXCERPT_CHARS = 4096;

/** The effect doorway's admission for a tool effect: admitted only when the installed profile registers
 * an operation for exactly that tool effect. The single-machine profile's closed set registers none. */
export function admitToolEffect(kind, operations) {
  const operation = `tool:${kind}`;
  if (operations.includes(operation)) return { admitted: true, reason: `registered operation ${operation}` };
  return { admitted: false, reason: `effect doorway: the installed profile registers no ${operation} operation `
    + `(registered: ${operations.join(', ') || 'none'}); refused by default` };
}

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
 * {workspace (real path), tmp (the shell's temporary directory), maxCalls, maxWriteBytes, operations}; `n` is
 * this call's 1-based count in the step (maxCalls + 1 once every slot is taken); `fs`
 * gives exists/realpath. Returns {decision, reason, kind?, updatedInput?}.
 */
export function admitToolCall(call, config, n, fs) {
  const tool = String(call?.tool_name ?? ''), input = call?.tool_input ?? {};
  const deny = (reason, kind) => ({ decision: 'deny', reason, ...(kind ? { kind } : {}) });
  const effect = kind => { const admitted = admitToolEffect(kind, config.operations); return admitted.admitted
    ? { decision: 'allow', reason: admitted.reason, kind } : deny(admitted.reason, kind); };
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
    if (input.dangerouslyDisableSandbox) return effect('unsandboxed');
    return { decision: 'allow', reason: 'sandboxed command',
      updatedInput: { ...input, command: toolShellPrefix(config.tmp) + command } };
  }
  if (tool.startsWith('mcp__')) return effect('mcp');
  if (tool === 'WebFetch' || tool === 'WebSearch') return effect('network');
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
