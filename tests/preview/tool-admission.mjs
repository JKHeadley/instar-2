// The tool turn's admission decision (Part Thirteen §9 in docs/17-harness-adapters, the preview tool rule). Pure: every input is
// passed in, so the executable hook (tool-admission-hook.mjs) and the tests run the same function.
// Every tool of the harness's built-in set is offered; this decides each call. Ordinary work is admitted; a consequential
// effect goes to the effect doorway; a call whose liability the turn cannot reserve is refused for budget; a tool outside
// the classified set (a harness the adapter has not been updated for) is refused, since nothing here says what it does.
// - Ordinary: a file read or search of the workspace or the system files the shell may also read, and a file write or
//   edit inside the workspace, each decided on the resolved file (toolRoots, resolvedPath); a sandboxed shell
//   command (not judged by the words it contains: what it can reach is enforced where it runs: the sandbox's read, write,
//   network and process scope, the turn's fixed-size scratch volume, the per-file limit); a web read (WebFetch is GET
//   only, WebSearch is a search) of a public host; a subagent of the registered `worker` type within the turn's shared
//   subagent budget, started by the turn or by another subagent, recorded as a Rule 114 edge; an MCP tool the root's
//   configuration lists as a read; the harness's own bookkeeping (tool search, listing agents or schedules, rendering
//   findings, stopping its own background task); a worktree inside the workspace.
// - Consequential (the effect doorway, effect-doorway.mjs, which admits or refuses it by the purpose's four
//   consequential-effect tests under the turn's effect policy; with no policy nothing outward is granted, so each refuses):
//   an MCP tool not listed as a read (acting in a third-party account), an unsandboxed shell, a Monitor command (not shown to run inside the sandbox, which is what keeps
//   a command away from the admission state and the network; Bash in the background is the sandboxed way to watch a
//   command), sending outside the conversation, a scheduled or remote trigger, a design sync to a third-party account.
// - Skill: an inline skill adds instructions to this conversation and starts nothing, so it is ordinary work under the
//   turn's own checks; the pinned harness runs a skill in a forked agent only when the skill's resolved execution context
//   is `fork`. The turn loads no user or project skills (its setting sources are empty), so the skills it can invoke are
//   the harness's bundled ones, whose context is decided in harness code: INLINE_SKILLS names those verified inline in
//   the pinned artifact. Any other name (a skill that can fork, or one not verified) is refused, as an unclassified tool is.
// - Budget (the spend floor is the call reservation made before dispatch): Workflow, and a skill that can run forked, may
//   start agents whose number or model turns the turn cannot reserve in advance, so they are refused.
// - A web read or a listed MCP read whose effect or target the operator's effect policy registers or marks policy-sensitive
//   goes to the doorway too, so that marking decides it; otherwise it is ordinary under the operator's recorded tools grant.
// - A web read of a loopback, private, link-local or local-name host is refused: it is not "the world" but this machine
//   and its network, which the shell's sandbox already closes.
import { dirname, join, sep } from 'node:path';
import { isIP } from 'node:net';
import { admitEffect, decodeEffectPolicy, DEFAULT_EFFECT_POLICY, toolEffectProposal, UNAVAILABLE_EFFECT_POLICY } from './effect-doorway.mjs';

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
const UNRESERVABLE_TOOLS = Object.freeze({ Workflow: 'a workflow script may start any number of agents' });
/** Bundled skills of the pinned Claude Code 2.1.280 that run inline: each definition sets no fork context, no
 * `getContext`, no agent, no background and no hooks, and builds its prompt without running a command or a network
 * request (so nothing runs outside this hook). Read from the pinned artifact; a newer harness needs this list re-read. */
export const INLINE_SKILLS = Object.freeze(['claude-api', 'dataviz', 'explain-usage', 'fewer-permission-prompts', 'keybindings-help',
  'loop', 'run', 'simplify', 'update-config', 'workflow-authoring']);
/** Bundled skills of the pinned harness that can run in a forked agent (code-review forks unless its own checks say inline). */
const FORKING_SKILLS = Object.freeze(['code-review']);
const WORKTREE_TOOLS = Object.freeze(['EnterWorktree', 'ExitWorktree']);
/** Bounded excerpt of a tool input or result kept in the admission record. */
export const RECORD_EXCERPT_CHARS = 4096;

/** The effect doorway's admission for a tool call's proposal, under the turn's config: its effect policy (absent:
 * nothing outward by default), the register's irreversible term and the installation's accepted closed operation set. */
export function admitToolEffect(proposal, config, now) {
  const options = { ...(config.irreversibleTerm ? { irreversibleTerm: config.irreversibleTerm } : {}), now };
  let policy;
  try { policy = config.effectPolicy === undefined ? DEFAULT_EFFECT_POLICY : decodeEffectPolicy(config.effectPolicy); }
  catch (error) {
    // A configured policy that cannot be read is not "no policy": its restrictions and grants are unknown, so the
    // proposal is treated as policy-sensitive with no grant and refused, with the reason recorded (fail closed).
    const why = config.effectPolicy?.type === UNAVAILABLE_EFFECT_POLICY ? String(config.effectPolicy.reason ?? 'unavailable')
      : String(error?.message ?? error);
    const verdict = admitEffect(proposal, { ...DEFAULT_EFFECT_POLICY, policySensitive: [proposal.effect] }, config.operations ?? [], options);
    const admits = 'the installed effect policy becoming readable again, so current policy can be established';
    return { ...verdict, admitted: false, disposition: 'refused', admits,
      reason: `effect doorway refused ${proposal.effect}${proposal.target ? ` (${proposal.target})` : ''}: the installed effect policy is `
        + `unavailable (${why}), so whether it is policy-sensitive cannot be established. What would admit it: ${admits}. Nothing was `
        + 'done; tell the user plainly that this step was refused, why, and what would admit it.' };
  }
  return admitEffect(proposal, policy, config.operations ?? [], options);
}

/** Whether the turn's effect policy registers this proposal's effect (and target) or marks the effect, its target or a
 * matter it registers policy-sensitive: then the doorway, not the tool's ordinary class, decides it (the purpose's
 * policy-sensitive test). A policy that does not decode (or is marked unavailable) names everything here, so the doorway refuses it. */
function policyNames(config, proposal) {
  if (config.effectPolicy === undefined || proposal === null) return false;
  let policy; try { policy = decodeEffectPolicy(config.effectPolicy); } catch { return true; }
  const covers = entry => entry.effect === proposal.effect && (entry.target === undefined || entry.target === proposal.target);
  const registered = policy.registered.filter(covers);
  const matters = [proposal.effect, ...(proposal.target ? [proposal.target] : []), ...registered.flatMap(entry => entry.matters ?? [])];
  return registered.length > 0 || matters.some(item => policy.policySensitive.includes(item));
}

/** The file a path names, resolved as the operating system resolves it: component by component (a relative path from
 * the workspace), each symlink followed where it stands, so `link/..` leaves through the link's target rather than
 * lexically. Components past the deepest existing one are kept as written. Null when a component is a symlink that
 * does not resolve (dangling or looping): a write through it would create a file wherever it points. Null too when `..`
 * follows an absent component (`missing/../x`): the operating system refuses that lookup, and collapsing it here would
 * hand back a path whose remaining components were never resolved. `fs.exists` must not follow symlinks (lstat), so a
 * dangling link counts as present and then fails to resolve. */
export function resolvedPath(workspace, path, fs) {
  const text = String(path), parts = text.split('/').filter(part => part !== '' && part !== '.');
  let real = text.startsWith('/') ? '/' : workspace;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '..') { real = dirname(real); continue; }
    const next = join(real, parts[i]);
    if (!fs.exists(next)) return parts.slice(i + 1).includes('..') ? null : join(next, ...parts.slice(i + 1));
    try { real = fs.realpath(next); } catch { return null; }
  }
  return real;
}
const under = (path, root) => path === root || path.startsWith(root === sep ? sep : root + sep);
/** Physical containment: whether the path resolves (resolvedPath) inside the workspace. */
export function containedIn(workspace, path, fs) {
  const real = resolvedPath(workspace, path, fs);
  return real !== null && under(real, workspace);
}
/** Where a tool may write: the turn's workspace and the shell's temporary directory (both on the fixed-size scratch volume,
 * the sandbox's only write root). Where it may read: those, plus the system locations the sandbox reopens for commands
 * (`config.reads`, real paths: binaries, libraries, /private/etc). The hook and the sandbox share these sets and both
 * decide on the resolved file, so no readable file is refused for how it was spelled. The sandbox decides at open (the
 * kernel), so no spelling reaches past it; the hook decides before the harness opens, so it is an early refusal and a
 * directory the agent swaps for a link between its check and the harness's open is not caught here (open, w4-toolpaths
 * review MF2). Secret material (users' homes, keychains, the runner root and its
 * vault, other roots, the admission state) lies outside both. */
export function toolRoots(config) {
  const writes = [config.workspace, ...(typeof config.tmp === 'string' ? [config.tmp] : [])];
  return { writes, reads: [...writes, ...(Array.isArray(config.reads) ? config.reads.filter(root => typeof root === 'string' && root.startsWith('/')) : [])] };
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
 * {workspace (real path), tmp (the shell's temporary directory), maxCalls, maxWriteBytes, operations, effectPolicy?,
 * irreversibleTerm?, children? {max, type}, mcpReads?}; `n` is this call's 1-based count in the step (maxCalls + 1 once
 * every slot is taken); `fs` gives exists/realpath and, for a web read, `addresses(host)` (the host's resolved addresses,
 * or null when they could not be resolved); `child` is the subagent slot this call took (children.max + 1 once every slot
 * is taken); `now` (ms) checks a grant's expiry. Returns {decision, reason, kind?, doorway?, updatedInput?}: `doorway` is
 * present exactly when the call reached the effect doorway.
 */
export function admitToolCall(call, config, n, fs, child = 1, now) {
  const tool = String(call?.tool_name ?? ''), input = call?.tool_input ?? {};
  const deny = (reason, kind) => ({ decision: 'deny', reason, ...(kind ? { kind } : {}) });
  // Part Twelve: the doorway's whole decision rides the admission record (Rule 41), so status and the answer can report it.
  // A tool the doorway's own vocabulary does not name (sending, scheduling, a remote trigger, Monitor) proposes `tool:<kind>`,
  // which no default classifies, so it is classified worst-case on every test.
  const effect = kindOf => { const proposal = toolEffectProposal(tool, input) ?? { effect: `tool:${kindOf}`, target: tool.slice(0, 256) },
    verdict = admitToolEffect(proposal, config, now);
    const doorway = { effect: verdict.effect, ...(verdict.target ? { target: verdict.target } : {}), tests: verdict.tests,
      disposition: verdict.disposition, ...(verdict.grant ? { grant: verdict.grant } : {}), ...(verdict.admits ? { admits: verdict.admits } : {}) };
    const kind = kindOf;
    return verdict.admitted ? { decision: 'allow', reason: verdict.reason, kind, doorway } : { ...deny(verdict.reason, kind), doorway }; };
  if (!Number.isSafeInteger(n) || n < 1) return deny('admission count unavailable');
  if (n > config.maxCalls) return deny(`per-step call cap ${config.maxCalls} reached (call ${n})`);
  // A file tool or search is decided on the file its path resolves to, against the turn's read or write set, and the
  // harness is handed that resolved path, so a swap of the final link after this check does not redirect the call. A
  // directory swapped for a link after this check still can (review MF2, open): this is the early refusal, not the boundary.
  const roots = toolRoots(config);
  const place = (path, set) => {
    if (typeof path !== 'string' || path.length === 0) return { ok: false, why: 'path absent' };
    const real = resolvedPath(config.workspace, path, fs);
    if (real === null) return { ok: false, why: `path does not resolve: ${path} (a symlink in it points nowhere, or \`..\` follows a missing directory)` };
    const via = real === path ? '' : ` (resolves to ${real})`;
    return roots[set].some(root => under(real, root)) ? { ok: true, real, changed: real !== path }
      : { ok: false, why: `${String(path)}${via}`, real };
  };
  const inside = path => place(path, 'writes').ok;
  const rewrite = (key, at) => (at.changed ? { updatedInput: { ...input, [key]: at.real } } : {});
  if (FILE_TOOLS.includes(tool)) {
    const key = tool === 'NotebookEdit' ? 'notebook_path' : 'file_path', path = input[key];
    const at = place(path, tool === 'Read' ? 'reads' : 'writes');
    if (!at.ok) return deny(tool === 'Read' ? `path outside the workspace and the system files: ${at.why}`
      : `path outside the workspace: ${at.why}`, 'scope');
    if (tool === 'Write' && Buffer.byteLength(String(input.content ?? '')) > config.maxWriteBytes)
      return deny(`write larger than ${config.maxWriteBytes} bytes`, 'scope');
    return { decision: 'allow', reason: tool === 'Read' ? 'ordinary file read' : 'ordinary in-workspace file operation', ...rewrite(key, at) };
  }
  if (SEARCH_TOOLS.includes(tool)) {
    const at = place(input.path ?? config.workspace, 'reads');
    if (!at.ok) return deny(`search outside the workspace and the system files: ${at.why}`, 'scope');
    const shape = tool === 'Glob' ? String(input.pattern ?? '') : String(input.glob ?? '');
    if (shape.startsWith('/') || shape.includes('..')) return deny(`search pattern outside the workspace: ${shape}`, 'scope');
    return { decision: 'allow', reason: 'ordinary search', ...(input.path === undefined ? {} : rewrite('path', at)) };
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
    if (policyNames(config, toolEffectProposal(tool, input))) return effect('network');
    return { decision: 'allow', reason: 'web read (GET) of a public host', kind: 'network-read' };
  }
  if (tool === 'WebSearch') {
    if (policyNames(config, toolEffectProposal(tool, input))) return effect('network');
    return { decision: 'allow', reason: 'web search', kind: 'network-read' };
  }
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
    if (Array.isArray(config.mcpReads) && config.mcpReads.includes(tool) && !policyNames(config, toolEffectProposal(tool, input))) return { decision: 'allow', reason: 'MCP read the root configuration lists', kind: 'mcp-read' };
    return effect('mcp');
  }
  if (Object.hasOwn(OUTWARD_TOOLS, tool)) return effect(OUTWARD_TOOLS[tool]);
  if (BOOKKEEPING_TOOLS.includes(tool)) return { decision: 'allow', reason: 'harness bookkeeping' };
  if (WORKTREE_TOOLS.includes(tool)) {
    const path = input.path ?? input.worktree_path;
    if (path !== undefined && !inside(path)) return deny(`worktree outside the workspace: ${String(path)}`, 'scope');
    return { decision: 'allow', reason: 'worktree inside the workspace' };
  }
  if (tool === 'Skill') {
    const name = String(input.skill ?? '').replace(/^\//u, '');
    if (INLINE_SKILLS.includes(name)) return { decision: 'allow', reason: `inline skill ${name}: its instructions join this turn, which starts nothing` };
    if (FORKING_SKILLS.includes(name)) return deny(`skill ${name} can run in a forked agent, whose model turns this turn cannot reserve `
      + 'before dispatch (the spend floor); delegate through Agent instead', 'budget');
    return deny(`skill ${name || '(none)'} is not one this harness is known to run inline: refused by default`);
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
  const calls = [], admitted = new Map(), children = [], started = [];
  let consistent = true, malformed = 0;
  for (const line of lines) {
    let row; try { row = JSON.parse(line); } catch { malformed++; continue; }
    if (row?.phase === 'pre') {
      const entry = { n: row.n, tool: row.tool, input: excerpt(row.input), decision: row.decision, reason: row.reason,
        ...(row.kind ? { kind: row.kind } : {}), ...(row.doorway ? { doorway: row.doorway } : {}),
        ...(typeof row.agent === 'string' ? { agent: row.agent } : {}), result: null };
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
