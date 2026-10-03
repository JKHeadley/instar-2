// The tool turn's admission decision (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule). Pure: every input is
// passed in, so the executable hook (tool-admission-hook.mjs) and the tests run the same function.
// Every tool of the harness's built-in set is offered; this decides each call. Ordinary work is admitted; a consequential
// effect goes to the effect doorway; a call whose liability the turn cannot reserve is refused for budget; a tool outside
// the classified set (a harness the adapter has not been updated for) is refused, since nothing here says what it does.
// - Ordinary: file tools (Read, Write, Edit, NotebookEdit) inside the workspace; workspace search; a sandboxed shell
//   command (not judged by the words it contains: what it can reach is enforced where it runs: the sandbox's read, write,
//   network and process scope, the turn's fixed-size scratch volume, the per-file limit); a web read (WebFetch is GET
//   only, WebSearch is a search) of a public host; a subagent of the registered `worker` type within the turn's shared
//   subagent budget, started by the turn or by another subagent, recorded as a Rule 114 edge; an MCP tool the root's
//   configuration lists as a read; the harness's own bookkeeping (tool search, listing agents or schedules, rendering
//   findings, stopping its own background task); a worktree inside the workspace.
// - Consequential (the effect doorway's admission, which admits only an operation the installed profile registers for that
//   tool effect; the single-machine profile registers none, so each refuses): an MCP tool not listed as a read (acting in a
//   third-party account), an unsandboxed shell, a Monitor command (not shown to run inside the sandbox, which is what keeps
//   a command away from the admission state and the network; Bash in the background is the sandboxed way to watch a
//   command), sending outside the conversation, a scheduled or remote trigger, a design sync to a third-party account.
// - Budget (the spend floor is the call reservation made before dispatch): Workflow and Skill may start agents whose
//   number or model turns the turn cannot reserve in advance (a workflow script, a forked skill), so they are refused.
// - A web read of a loopback, private, link-local or local-name host is refused: it is not "the world" but this machine
//   and its network, which the shell's sandbox already closes.
import { basename, dirname, join, resolve, sep } from 'node:path';
import { isIP } from 'node:net';

const SHELL_SAFE_PATH = /^\/[A-Za-z0-9_./@-]+$/u;
/** The variables through which common clients (curl, git, node and npm, Python's requests and pip) take a trust root: each
 * names the turn's egress checkpoint authority, so a command's TLS to any host is the checkpoint's. */
export const EGRESS_CA_VARIABLES = Object.freeze(['SSL_CERT_FILE', 'CURL_CA_BUNDLE', 'GIT_SSL_CAINFO', 'NODE_EXTRA_CA_CERTS',
  'REQUESTS_CA_BUNDLE', 'PIP_CERT', 'npm_config_cafile']);
/** The proxy variables clients read (curl, git, npm and pip each read some of them), all naming the checkpoint by address. */
export const EGRESS_PROXY_VARIABLES = Object.freeze(['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'all_proxy',
  'npm_config_proxy', 'npm_config_https_proxy']);
/** Prepended to every admitted shell command. Claude Code 2.1.280 exports its own messaging inbox
 * socket and token into the Bash tool (residual 6); the sandbox already refuses unix-socket connects,
 * and this removes both values from the command's environment as well. `TMPDIR` points at the turn's
 * own scratch volume (the harness's shared default is refused for writes), and `ulimit -f` bounds each
 * file a command writes (65536 blocks of 512 bytes). `tmp` is absolute and shell-safe. With the turn's
 * egress checkpoint (`egress` {ca, bin, developer?, port?}), the clients' trust-root variables name its authority certificate, the
 * proxy variables name it by address once it runs (`port`), npm keeps its cache on the volume, the readable toolchain directories (`bin`) lead PATH, and `DEVELOPER_DIR` names the developer tools
 * behind macOS's git shim. */
export function toolShellPrefix(tmp, egress = null) {
  if (typeof tmp !== 'string' || !SHELL_SAFE_PATH.test(tmp)) throw Error('tool admission: shell temporary directory absent');
  let network = '';
  if (egress) {
    const bin = egress.bin ?? [], developer = egress.developer ?? null, port = egress.port ?? null;
    if (typeof egress.ca !== 'string' || !SHELL_SAFE_PATH.test(egress.ca) || !Array.isArray(bin)
      || !bin.every(dir => typeof dir === 'string' && SHELL_SAFE_PATH.test(dir))
      || !(developer === null || (typeof developer === 'string' && SHELL_SAFE_PATH.test(developer)))
      || !(port === null || (Number.isSafeInteger(port) && port > 0 && port < 65536))) throw Error('tool admission: egress paths absent');
    const proxy = port === null ? '' : ` ${EGRESS_PROXY_VARIABLES.map(name => `${name}=http://127.0.0.1:${String(port)}`).join(' ')}`;
    // git reads /etc/gitconfig through the /etc link and the home's config, both outside the sandbox, so it skips them. The
    // sandbox never lets a command write a `.git/config` or `.git/hooks` (the harness itself runs git outside the sandbox, and
    // such a file could make it run code), so `git clone` and `git init` keep their git directory on the volume
    // (`--separate-git-dir`, under tmp/git-dirs) with an empty template; the checkout is where it would be.
    network = `mkdir -p ${tmp}/git-template ${tmp}/git-dirs; git() { case "$1" in clone|init) local sub="$1"; shift; `
      + `command git "$sub" --separate-git-dir="${tmp}/git-dirs/$$-$RANDOM" "$@";; *) command git "$@";; esac; }; `
      + `export ${EGRESS_CA_VARIABLES.map(name => `${name}=${egress.ca}`).join(' ')} npm_config_cache=${tmp}/npm-cache${proxy}`
      + ` GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TEMPLATE_DIR=${tmp}/git-template`
      + `${developer ? ` DEVELOPER_DIR=${developer}` : ''}${bin.length ? ` PATH=${bin.join(':')}:$PATH` : ''}; `;
  }
  return `unset CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_MESSAGING_SOCKET; export TMPDIR=${tmp}; ulimit -f 65536; ${network}`;
}
export const FILE_TOOLS = Object.freeze(['Read', 'Write', 'Edit', 'NotebookEdit']);
const SEARCH_TOOLS = Object.freeze(['Glob', 'Grep']);
/** The subagent tool under both names the pinned harness accepts. */
export const SUBAGENT_TOOLS = Object.freeze(['Agent', 'Task']);
/** Tools that, if they ever reached the hook, would act outward: each is the effect doorway's, named by its effect. */
const OUTWARD_TOOLS = Object.freeze({ SendMessage: 'send', PushNotification: 'send', RemoteTrigger: 'network-write',
  DesignSync: 'network-write', CronCreate: 'schedule', CronDelete: 'schedule', ScheduleWakeup: 'schedule', Monitor: 'unsandboxed' });
/** The harness's own bookkeeping: no effect outside the turn's process and workspace. */
const BOOKKEEPING_TOOLS = Object.freeze(['ToolSearch', 'ListAgents', 'CronList', 'ReportFindings', 'TaskStop']);
/** Tools that may start agents the turn cannot reserve before dispatch (their count or model turns are not bounded). */
const UNRESERVABLE_TOOLS = Object.freeze({ Workflow: 'a workflow script may start any number of agents',
  Skill: 'a skill may run in a forked agent with no turn bound' });
const WORKTREE_TOOLS = Object.freeze(['EnterWorktree', 'ExitWorktree']);
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

/** Ports a shell network request may reach: the web's own (http 80, https 443). */
export const EGRESS_PORTS = Object.freeze({ 'http:': 80, 'https:': 443 });
/** What one shell HTTP request does, read from its method and path alone (never its body or the words of the command):
 * `read` for GET and HEAD and for git's fetch negotiation (a POST to `…/git-upload-pack`, which only asks for objects),
 * `write` for everything else. A push is a write from its first request: git's push discovery
 * (`…/info/refs?service=git-receive-pack`) and its upload (`…/git-receive-pack`). */
export function egressRequestKind(method, target) {
  const verb = String(method ?? '').toUpperCase();
  let url; try { url = new URL(String(target)); } catch { return 'write'; }
  const path = url.pathname;
  if (path.endsWith('/git-receive-pack') || (path.endsWith('/info/refs') && url.searchParams.get('service') === 'git-receive-pack'))
    return 'write';
  if (verb === 'GET' || verb === 'HEAD') return 'read';
  if (verb === 'POST' && path.endsWith('/git-upload-pack')) return 'read';
  return 'write';
}
/**
 * One shell network request at the turn's egress checkpoint (egress-checkpoint.mjs): the sandbox lets a command reach
 * nothing but that checkpoint, which terminates TLS under the turn's own ephemeral authority and so sees each request's
 * method and full URL. `request` is {method, url} (absolute http(s) URL); `addresses` the target's addresses as the
 * checkpoint itself resolved them (the checkpoint then connects only to an address it checked); `operations` the installed
 * profile's registered operations. A read of a public host on the web's ports is ordinary work; anything else that is
 * well-formed is a network write for the effect doorway, which refuses it unless the profile registers `tool:network-write`.
 * Returns {decision, reason, kind?}.
 */
export function admitEgress(request, addresses, operations) {
  const deny = (reason, kind) => ({ decision: 'deny', reason, ...(kind ? { kind } : {}) });
  const target = webReadHost(request?.url);
  if (target.host === null) return deny(`shell network refused: ${target.reason}`, 'scope');
  const url = new URL(String(request.url));
  const port = url.port === '' ? EGRESS_PORTS[url.protocol] : Number(url.port);
  if (port !== EGRESS_PORTS[url.protocol]) return deny(`shell network refused: port ${String(port)} is not the web's ${url.protocol} port`, 'scope');
  if (!Array.isArray(addresses) || addresses.length === 0) return deny(`shell network refused: ${target.host} did not resolve`, 'scope');
  if (!addresses.every(publicAddress)) return deny(`shell network refused: ${target.host} resolves to a non-public address`, 'scope');
  if (egressRequestKind(request.method, request.url) === 'read')
    return { decision: 'allow', reason: `shell network read (${String(request.method).toUpperCase()}) of a public host`, kind: 'network-read' };
  const admitted = admitToolEffect('network-write', operations);
  return admitted.admitted ? { decision: 'allow', reason: admitted.reason, kind: 'network-write' } : deny(admitted.reason, 'network-write');
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
    const path = tool === 'NotebookEdit' ? input.notebook_path : input.file_path;
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
      updatedInput: { ...input, command: toolShellPrefix(config.tmp, config.egress ?? null) + command } };
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
    // Rule 114: the turn or any of its subagents may delegate; every subagent, at any depth, takes a slot of the turn's one
    // reserved budget, so the reservation covers the whole tree.
    const children = config.children ?? { max: 0, type: null };
    if (input.subagent_type !== children.type || typeof children.type !== 'string')
      return deny(`subagent type ${String(input.subagent_type ?? '(default)')} is not this turn's registered type ${String(children.type)}`, 'scope');
    if (!Number.isSafeInteger(child) || child < 1 || child > children.max)
      return deny(`no subagent budget left in this turn (${String(children.max)} reserved)`, 'budget');
    if (typeof input.prompt !== 'string' || !input.prompt.trim()) return deny('empty subagent prompt');
    // The child runs in the foreground so its result returns to this turn as the tool result; only the registered fields pass.
    const by = typeof call?.agent_id === 'string' && call.agent_id ? `, started by subagent ${call.agent_id}` : '';
    return { decision: 'allow', reason: `subagent ${child} of ${children.max}, ${children.type}${by}`, kind: 'subagent',
      updatedInput: { description: String(input.description ?? 'subagent'), prompt: input.prompt, subagent_type: children.type,
        run_in_background: false } };
  }
  if (tool.startsWith('mcp__')) {
    if (Array.isArray(config.mcpReads) && config.mcpReads.includes(tool)) return { decision: 'allow', reason: 'MCP read the root configuration lists', kind: 'mcp-read' };
    return effect('mcp');
  }
  if (Object.hasOwn(OUTWARD_TOOLS, tool)) return effect(OUTWARD_TOOLS[tool]);
  if (BOOKKEEPING_TOOLS.includes(tool)) return { decision: 'allow', reason: 'harness bookkeeping' };
  if (WORKTREE_TOOLS.includes(tool)) {
    const path = input.path ?? input.worktree_path;
    if (path !== undefined && !inside(path)) return deny(`worktree outside the workspace: ${String(path)}`, 'scope');
    return { decision: 'allow', reason: 'worktree inside the workspace' };
  }
  if (Object.hasOwn(UNRESERVABLE_TOOLS, tool)) return deny(`${UNRESERVABLE_TOOLS[tool]}, whose model turns this turn cannot reserve `
    + 'before dispatch (the spend floor); delegate through Agent instead', 'budget');
  return deny(`unclassified tool ${tool || '(none)'}: refused by default`);
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
 * subagent edges (Rule 114): each admitted subagent call, the agent that made it (`parentAgent`, null for the turn
 * itself), the child the harness started for it, and its result; `open` when no result came back (the runner records it
 * cancelled or unknown).
 */
export function toolTrace(lines) {
  const calls = [], admitted = new Map(), children = [], started = [], egress = [], requests = new Map();
  let egressErrors = 0;
  let consistent = true, malformed = 0;
  for (const line of lines) {
    let row; try { row = JSON.parse(line); } catch { malformed++; continue; }
    if (row?.phase === 'pre') {
      const entry = { n: row.n, tool: row.tool, input: excerpt(row.input), decision: row.decision, reason: row.reason,
        ...(row.kind ? { kind: row.kind } : {}), ...(typeof row.agent === 'string' ? { agent: row.agent } : {}), result: null };
      calls.push(entry);
      if (row.decision === 'allow' && typeof row.id === 'string') admitted.set(row.id, entry);
      if (row.decision === 'allow' && row.kind === 'subagent' && typeof row.id === 'string')
        children.push({ toolUse: row.id, slot: row.child ?? null, agent: null, parentAgent: typeof row.agent === 'string' ? row.agent : null,
          started: false, stopped: false, state: 'open', result: null });
    } else if (row?.phase === 'post') {
      const entry = typeof row.id === 'string' ? admitted.get(row.id) : undefined;
      if (!entry || entry.tool !== row.tool || entry.result !== null) { consistent = false; continue; }
      entry.result = excerpt(row.result);
      const edge = children.find(item => item.toolUse === row.id);
      if (edge) { edge.state = 'returned'; edge.result = entry.result; if (typeof row.agent === 'string') edge.agent = row.agent; }
    } else if (row?.phase === 'egress' && Number.isSafeInteger(row.rid) && !requests.has(row.rid)) {
      // A shell network request the turn's egress checkpoint decided (recorded before it went anywhere).
      const entry = { rid: row.rid, method: String(row.method), url: excerpt(String(row.url)),
        addresses: Array.isArray(row.addresses) ? row.addresses.slice(0, 8).map(String) : [], decision: row.decision, reason: row.reason,
        ...(row.kind ? { kind: row.kind } : {}), status: null, down: 0, up: 0 };
      egress.push(entry); requests.set(row.rid, entry);
    } else if (row?.phase === 'egress-error') {
      // A request the checkpoint closed on an internal error (counted, so the loss is visible in the trace).
      egressErrors++;
    } else if (row?.phase === 'egress-done' && requests.has(row.rid)) {
      Object.assign(requests.get(row.rid), { status: row.status ?? null, down: row.down ?? 0, up: row.up ?? 0 });
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
  return { calls, children, egress, egressErrors, consistent: consistent && malformed === 0,
    admitted: calls.filter(call => call.decision === 'allow').length, refused: calls.filter(call => call.decision !== 'allow').length };
}
