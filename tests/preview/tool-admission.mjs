// The tool turn's admission decision (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule). Pure: every input is
// passed in, so the executable hook (tool-admission-hook.mjs) and the tests run the same function.
// Ordinary work is admitted; a consequential effect goes to the effect doorway; anything unregistered is refused.
// - Ordinary: file tools inside the workspace; workspace search; a sandboxed shell command (not judged by the words it
//   contains: what it can reach is enforced where it runs: the sandbox's read, write, network and process scope, the
//   turn's fixed-size scratch volume, the per-file limit); a web read (WebFetch is GET only, WebSearch is a search) of a
//   public host; one bounded subagent of the registered `worker` type, recorded as a Rule 114 edge; an MCP tool the
//   root's configuration lists as a read.
// - Consequential (the effect doorway's admission, which admits only an operation the installed profile registers for that
//   tool effect; the single-machine profile registers none, so each refuses): an MCP tool not listed as a read (acting in a
//   third-party account), an unsandboxed shell, sending outside the conversation, a scheduled or remote trigger.
// - A web read of a loopback, private, link-local or local-name host is refused: it is not "the world" but this machine
//   and its network, which the shell's sandbox already closes.
import { basename, dirname, join, resolve, sep } from 'node:path';
import { isIP } from 'node:net';

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
/** The subagent tool under both names the pinned harness accepts. */
export const SUBAGENT_TOOLS = Object.freeze(['Agent', 'Task']);
/** Tools that, if they ever reached the hook, would act outward: each is the effect doorway's, named by its effect. */
const OUTWARD_TOOLS = Object.freeze({ SendMessage: 'send', PushNotification: 'send', RemoteTrigger: 'network-write',
  CronCreate: 'schedule', CronDelete: 'schedule', ScheduleWakeup: 'schedule' });
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

/** Whether an IP address is on the public internet (not loopback, private, link-local, shared, multicast or reserved). */
export function publicAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)));
  }
  if (version === 6) {
    const bytes = ipv6Bytes(address);
    if (bytes === null) return false;
    const embedded = bytes.slice(12).join('.');
    // IPv4-mapped (::ffff:a.b.c.d, however written) and NAT64 (64:ff9b::/96) carry an IPv4 address: classify that.
    if (bytes.slice(0, 10).every(b => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff) return publicAddress(embedded);
    if (bytes[0] === 0 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && bytes.slice(4, 12).every(b => b === 0))
      return publicAddress(embedded);
    // ::/96 (unspecified, loopback, deprecated IPv4-compatible), unique-local fc00::/7, link-local fe80::/10, multicast ff00::/8.
    return !(bytes.slice(0, 12).every(b => b === 0) || (bytes[0] & 0xfe) === 0xfc || (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80)
      || bytes[0] === 0xff);
  }
  return false;
}
/** The 16 bytes of an IPv6 address in any textual form (compressed, hex or dotted IPv4 tail), or null. */
function ipv6Bytes(address) {
  let text = String(address).toLowerCase();
  const dotted = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/u.exec(text);
  if (dotted) {
    if (isIP(dotted[2]) !== 4) return null;
    const [a, b, c, d] = dotted[2].split('.').map(Number);
    text = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const parts = half => (half === '' ? [] : half.split(':'));
  const head = parts(halves[0]), tail = halves.length === 2 ? parts(halves[1]) : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill('0'), ...tail];
  if (groups.length !== 8 || !groups.every(g => /^[0-9a-f]{1,4}$/u.test(g))) return null;
  return groups.flatMap(g => { const v = parseInt(g, 16); return [v >> 8, v & 0xff]; });
}
/** The host a web read targets, when it is a plain http(s) URL naming a public-looking host; otherwise null with a reason. */
export function webReadHost(url) {
  let parsed; try { parsed = new URL(String(url)); } catch { return { host: null, reason: 'not a URL' }; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { host: null, reason: `scheme ${parsed.protocol} is not a web read` };
  if (parsed.username || parsed.password) return { host: null, reason: 'credentials in a URL are refused' };
  const host = parsed.hostname.replace(/^\[|\]$/gu, '').toLowerCase();
  if (isIP(host)) return publicAddress(host) ? { host } : { host: null, reason: `address ${host} is not public` };
  if (!host.includes('.') || /\.(?:local|localhost|internal|lan|home|arpa)$/u.test(host) || host === 'localhost')
    return { host: null, reason: `host ${host} is a local name` };
  return { host };
}

/**
 * One PreToolUse decision. `call` is the hook input ({tool_name, tool_input, agent_id?}); `config` is the turn's
 * {workspace (real path), tmp (the shell's temporary directory), maxCalls, maxWriteBytes, operations, children?
 * {max, type}, mcpReads?}; `n` is this call's 1-based count in the step (maxCalls + 1 once every slot is taken);
 * `fs` gives exists/realpath and, for a web read, `addresses(host)` (the host's resolved addresses, or null when they
 * could not be resolved); `child` is the subagent slot this call took (children.max + 1 once every slot is taken).
 * Returns {decision, reason, kind?, updatedInput?}.
 */
export function admitToolCall(call, config, n, fs, child = 1) {
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
  if (tool === 'WebFetch') {
    // WebFetch only ever issues a GET; what it may reach is a public host.
    const target = webReadHost(input.url);
    if (target.host === null) return deny(`web read refused: ${target.reason}`, 'scope');
    if (!isIP(target.host)) {
      const addresses = fs.addresses?.(target.host) ?? null;
      if (!Array.isArray(addresses) || addresses.length === 0) return deny(`web read refused: ${target.host} did not resolve`, 'scope');
      if (!addresses.every(publicAddress)) return deny(`web read refused: ${target.host} resolves to a non-public address`, 'scope');
    }
    return { decision: 'allow', reason: 'web read (GET) of a public host', kind: 'network-read' };
  }
  if (tool === 'WebSearch') return { decision: 'allow', reason: 'web search', kind: 'network-read' };
  if (SUBAGENT_TOOLS.includes(tool)) {
    const children = config.children ?? { max: 0, type: null };
    if (typeof call?.agent_id === 'string' && call.agent_id.length > 0) return deny('a subagent may not start another subagent in this turn', 'scope');
    if (input.subagent_type !== children.type || typeof children.type !== 'string')
      return deny(`subagent type ${String(input.subagent_type ?? '(default)')} is not this turn's registered type ${String(children.type)}`, 'scope');
    if (!Number.isSafeInteger(child) || child < 1 || child > children.max)
      return deny(`no subagent budget left in this turn (${String(children.max)} reserved)`, 'budget');
    if (typeof input.prompt !== 'string' || !input.prompt.trim()) return deny('empty subagent prompt');
    // The child runs in the foreground so its result returns to this turn as the tool result; only the registered fields pass.
    return { decision: 'allow', reason: `subagent ${child} of ${children.max}, ${children.type}`, kind: 'subagent',
      updatedInput: { description: String(input.description ?? 'subagent'), prompt: input.prompt, subagent_type: children.type,
        run_in_background: false } };
  }
  if (tool.startsWith('mcp__')) {
    if (Array.isArray(config.mcpReads) && config.mcpReads.includes(tool)) return { decision: 'allow', reason: 'MCP read the root configuration lists', kind: 'mcp-read' };
    return effect('mcp');
  }
  if (Object.hasOwn(OUTWARD_TOOLS, tool)) return effect(OUTWARD_TOOLS[tool]);
  return deny(`unregistered tool ${tool || '(none)'}: refused by default`);
}

/** The hook's stdout for a decision: a deny, or an allow carrying the rewritten input. */
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
 * before it: a tool ran past the hook, so the turn's outcome cannot be trusted. `children` are the turn's
 * subagent edges (Rule 114): each admitted subagent call, the child the harness started for it, and its
 * result; `open` when no result came back (the runner records it cancelled or unknown).
 */
export function toolTrace(lines) {
  const calls = [], admitted = new Map(), children = [], started = [];
  let consistent = true, malformed = 0;
  for (const line of lines) {
    let row; try { row = JSON.parse(line); } catch { malformed++; continue; }
    if (row?.phase === 'pre') {
      const entry = { n: row.n, tool: row.tool, input: excerpt(row.input), decision: row.decision, reason: row.reason,
        ...(row.kind ? { kind: row.kind } : {}), ...(typeof row.agent === 'string' ? { agent: row.agent } : {}), result: null };
      calls.push(entry);
      if (row.decision === 'allow' && typeof row.id === 'string') admitted.set(row.id, entry);
      if (row.decision === 'allow' && row.kind === 'subagent' && typeof row.id === 'string')
        children.push({ toolUse: row.id, slot: row.child ?? null, agent: null, started: false, stopped: false, state: 'open', result: null });
    } else if (row?.phase === 'post') {
      const entry = typeof row.id === 'string' ? admitted.get(row.id) : undefined;
      if (!entry || entry.tool !== row.tool || entry.result !== null) { consistent = false; continue; }
      entry.result = excerpt(row.result);
      const edge = children.find(item => item.toolUse === row.id);
      if (edge) { edge.state = 'returned'; edge.result = entry.result; if (typeof row.agent === 'string') edge.agent = row.agent; }
    } else if (row?.phase === 'child-start' && typeof row.agent === 'string') started.push(row.agent);
    else if (row?.phase === 'child-stop' && typeof row.agent === 'string') started.push(`stop:${row.agent}`);
    else malformed++;
  }
  // Link each started child to its subagent call: by the agent id its result named, else in start order.
  const starts = started.filter(item => !item.startsWith('stop:')), stops = new Set(started.filter(item => item.startsWith('stop:')).map(item => item.slice(5)));
  const unclaimed = starts.filter(agent => !children.some(edge => edge.agent === agent));
  for (const edge of children) {
    if (edge.agent === null && unclaimed.length) edge.agent = unclaimed.shift();
    edge.started = edge.agent !== null && starts.includes(edge.agent);
    edge.stopped = edge.agent !== null && stops.has(edge.agent);
  }
  return { calls, children, consistent: consistent && malformed === 0,
    admitted: calls.filter(call => call.decision === 'allow').length, refused: calls.filter(call => call.decision !== 'allow').length };
}
