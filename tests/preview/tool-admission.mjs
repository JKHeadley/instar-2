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
// - A checkpointed route (a delegated session step, or a Codex tool turn: `config.gate` set) has the host's admission
//   checkpoint (admission-gate.mjs) as its live authority: a delegation is recorded there as a durable child edge, a
//   consequential tool passes its effect owner with the exact operation and input, and every shell command runs under
//   the step's own confined sandbox profile (`config.shellProfile`). A route with no checkpoint refuses a delegation of
//   that kind, and its consequential tools go to the effect doorway as above.
import { dirname, join, sep } from 'node:path';
import { isIP } from 'node:net';
import { admitEffect, decodeEffectPolicy, DEFAULT_EFFECT_POLICY, toolEffectProposal, UNAVAILABLE_EFFECT_POLICY } from './effect-doorway.mjs';

const SHELL_SAFE_PATH = /^\/[A-Za-z0-9_./@-]+$/u;
/** Prepended to every admitted shell command. Claude Code 2.1.280 exports its own messaging inbox
 * socket and token into the Bash tool (residual 6); the sandbox already refuses unix-socket connects,
 * and this removes both values from the command's environment as well. `TMPDIR` points at the turn's
 * own scratch volume (the harness's shared default is refused for writes), and `ulimit -f` bounds each
 * file a command writes (65536 blocks of 512 bytes). `tmp` is absolute and shell-safe. */
export function toolShellPrefix(tmp, egress = null) {
  if (typeof tmp !== 'string' || !SHELL_SAFE_PATH.test(tmp)) throw Error('tool admission: shell temporary directory absent');
  const base = `unset CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_MESSAGING_SOCKET; export TMPDIR=${tmp}; ulimit -f 65536; `;
  if (egress === null || egress === undefined) return base;
  const { assignments, path } = egressEnvironment(egress);
  return `${base}export ${assignments} PATH=${[...path, '$PATH'].join(':')}; `;
}
/** The shell's network checkpoint (egress-proxy.mjs) as environment: its port, the turn's own trust root (a public
 * certificate; its key stays in the admission state), a HOME the shell may write (tools keep caches and config there,
 * never in the login profile), the developer tools' own git and python3 and the runner's node first on PATH (the /usr/bin
 * shims would look up a system link outside the sandbox), and no system git configuration, so curl, git, npm and pip
 * reach the network through it. Returns the assignments and the PATH entries to put first. */
function egressEnvironment(egress) {
  const { port, ca, home, path, developer } = egress ?? {};
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535 || ![ca, home].every(value => typeof value === 'string' && SHELL_SAFE_PATH.test(value))
    || ![path, developer].every(value => value === undefined || (typeof value === 'string' && SHELL_SAFE_PATH.test(value))))
    throw Error('tool admission: shell egress checkpoint absent');
  const proxy = `http://127.0.0.1:${String(port)}`;
  // NO_PROXY is emptied: the harness exempts loopback and private ranges from its proxy, and every request, those included,
  // is to be decided (and refused) at the checkpoint, on the record.
  return { assignments: `HOME=${home} HTTPS_PROXY=${proxy} HTTP_PROXY=${proxy} https_proxy=${proxy} http_proxy=${proxy} NO_PROXY= no_proxy= `
    + `SSL_CERT_FILE=${ca} CURL_CA_BUNDLE=${ca} GIT_SSL_CAINFO=${ca} NODE_EXTRA_CA_CERTS=${ca} REQUESTS_CA_BUNDLE=${ca} PIP_CERT=${ca} `
    + `npm_config_cafile=${ca} npm_config_update_notifier=false GIT_CONFIG_NOSYSTEM=1 GIT_ATTR_NOSYSTEM=1${developer ? ` DEVELOPER_DIR=${developer}` : ''}`,
  path: [developer ? `${developer}/usr/bin` : null, path ?? null].filter(Boolean) };
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
export function shellSandboxProfile({ workspace, tmp, egress = null }) {
  const reads = egress?.reads ?? [], writes = egress?.writes ?? [];
  if (![workspace, tmp, ...reads, ...writes].every(path => typeof path === 'string' && SBPL_PATH.test(path)))
    throw Error('tool admission: confined shell paths must be absolute and plain');
  if (egress !== null && (!Number.isSafeInteger(egress.port) || egress.port < 1 || egress.port > 65535))
    throw Error('tool admission: confined shell egress port invalid');
  const subpaths = paths => paths.map(path => `(subpath "${path}")`).join(' ');
  // With the step's network checkpoint (egress-proxy.mjs), the one network path is to its loopback port: every request the
  // shell makes is decided there by the same effect doorway as a tool call, under its request and byte bounds.
  return ['(version 1)', '(allow default)', '(deny network*)',
    ...(egress !== null ? [`(allow network-outbound (remote ip "localhost:${String(egress.port)}"))`] : []),
    '(deny file-read-data (subpath "/"))', `(allow file-read-data (literal "/") ${subpaths([...SHELL_RUNTIME_READS, workspace, tmp, ...reads, ...writes])})`,
    '(deny file-write* (subpath "/"))',
    `(allow file-write* ${subpaths([workspace, tmp, ...writes])} (literal "/dev/null") (literal "/dev/zero") (regex #"^/dev/tty") (regex #"^/dev/fd/"))`,
    '(deny signal)', '(allow signal (target self))',
    '(deny mach-lookup (global-name "com.apple.SecurityServer") (global-name "com.apple.securityd.xpc") (global-name "com.apple.security.agent"))',
    ''].join('\n');
}
const quoted = text => `'${String(text).replaceAll("'", "'\\''")}'`;
/** One shell command, run under the confined profile with a clean environment: no inherited variable (a harness
 * token or socket) reaches it, `TMPDIR` is the step's own, and `ulimit -f` bounds each file it writes. */
export function sandboxedShellCommand(command, { profile, workspace, tmp, egress = null }) {
  if (![profile, workspace, tmp].every(path => typeof path === 'string' && SHELL_SAFE_PATH.test(path)))
    throw Error('tool admission: confined shell paths absent');
  const path = `${SHELL_RUNTIME_READS.filter(p => /bin$/u.test(p)).join(':')}:/usr/local/bin:/opt/homebrew/bin`;
  // With the step's network checkpoint, the command is pointed at it (its proxy, trust root and HOME): the profile lets
  // the shell reach that port and nothing else.
  const env = egress ? (({ assignments, path: first }) => `${assignments} PATH=${[...first, path].join(':')}`)(egressEnvironment(egress))
    : `PATH=${path} HOME=${workspace}`;
  return `/usr/bin/sandbox-exec -f ${profile} /usr/bin/env -i ${env} TMPDIR=${tmp} /bin/zsh -c ${quoted(`ulimit -f 65536; ${command}`)}`;
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
/** The harness's wait on its own subagents: its completed outcome is the evidence an asynchronous spawn's edge closes on. */
export const DELEGATION_WAIT_TOOLS = Object.freeze(['collaborationwait_agent']);
/** Codex's web search, as its hook names it (`webrun`): admitted only on a route that admits network reads. */
export const CODEX_NETWORK_READ_TOOLS = Object.freeze(['webrun']);
/** On a checkpointed route, the harness's own planning, output-reading and subagent-handling tools: no effect outside
 * the step. A subagent these address already has its edge. */
export const SESSION_BOOKKEEPING_TOOLS = Object.freeze(['TodoWrite', 'update_plan', 'BashOutput', 'KillShell', 'collaborationwait_agent',
  'collaborationsend_input', 'collaborationclose_agent', 'collaborationresume_agent']);
export const FILE_TOOLS = Object.freeze(['Read', 'Write', 'Edit', 'NotebookEdit']);
const SEARCH_TOOLS = Object.freeze(['Glob', 'Grep']);
/** The subagent tool under both names the pinned harness accepts. */
export const SUBAGENT_TOOLS = Object.freeze(['Agent', 'Task']);
/** Tools that, if they ever reached the hook, would act outward: each is the effect doorway's, named by its effect. */
export const OUTWARD_TOOLS = Object.freeze({ SendMessage: 'send', PushNotification: 'send', RemoteTrigger: 'network-write',
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

/** The proposals a consequential (or policy-named) tool call makes at the effect doorway: the doorway's own vocabulary
 * (toolEffectProposal), each host a Codex web call names by URL in any of its operations (an `open`, a `find`, a click or
 * a search alike: an explicit URL never loses its host by becoming a generic search) and, for any operation that is not a
 * page read by URL reference, its search, or `tool:<kind>` on the tool's name for a tool that vocabulary does not name
 * (sending, scheduling, a remote trigger, Monitor), which no default classifies, so it is classified worst-case on every test. */
export function toolCallProposals(tool, input) {
  if (CODEX_NETWORK_READ_TOOLS.includes(tool)) {
    const hostOf = text => { try { const url = new URL(String(text)); return /^https?:$/u.test(url.protocol) && url.hostname
      ? url.hostname.replace(/^\[|\]$/gu, '').slice(0, 256) : null; } catch { return null; } };
    const urls = (value, depth = 0) => typeof value === 'string' ? [hostOf(value)].filter(Boolean)
      : value && typeof value === 'object' && depth < 4 ? Object.values(value).flatMap(item => urls(item, depth + 1)) : [];
    const hosts = new Set();
    let other = false;
    for (const [key, value] of Object.entries(input ?? {})) {
      if (key === 'response_length' || value === undefined || value === null || (Array.isArray(value) && value.length === 0)) continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        for (const host of urls(item)) hosts.add(host);
        if (hostOf(item?.ref_id) === null) other = true;
      }
    }
    return [...[...hosts].map(target => ({ effect: 'tool:network', target })),
      ...(other || hosts.size === 0 ? [{ effect: 'tool:network', target: 'web-search' }] : [])];
  }
  const kind = Object.hasOwn(OUTWARD_TOOLS, tool) ? OUTWARD_TOOLS[tool] : 'unclassified';
  return [toolEffectProposal(tool, input) ?? { effect: `tool:${kind}`, target: tool.slice(0, 256) }];
}
/** The effect doorway's decision for one tool call, the same whether one target or many: each proposal keeps its own
 * decision (a Codex web target the effect policy does not name is an ordinary network read, as that read alone is; one it
 * names, or any under an unreadable policy, is decided by the doorway). Any refusal refuses the call; otherwise the call is
 * consequential when any of its targets is, carrying every test that held and every grant that admitted one, so the effect
 * owner applies the never-twice identity to it. The host checkpoint's effect owner decides with this same function. */
export function admitToolCallEffect(tool, input, config, now) {
  const network = CODEX_NETWORK_READ_TOOLS.includes(tool);
  const verdicts = toolCallProposals(tool, input).map(proposal => network && !policyNames(config, proposal)
    ? { effect: proposal.effect, target: proposal.target, tests: { irreversible: false, resources: false, scope: false, policySensitive: false },
      consequential: false, admitted: true, disposition: 'ordinary',
      reason: `network read of ${proposal.target}: the effect policy does not name it, so it is an ordinary read; admitted` }
    : admitToolEffect(proposal, config, now));
  const refused = verdicts.find(verdict => !verdict.admitted);
  if (refused || verdicts.length === 1) return refused ?? verdicts[0];
  const held = verdicts.filter(verdict => verdict.consequential);
  if (held.length === 0) return { ...verdicts[0], target: verdicts.map(verdict => verdict.target).join(', ').slice(0, 256),
    reason: verdicts.map(verdict => verdict.reason).join('; ') };
  const grants = [...new Set(held.map(verdict => verdict.grant).filter(Boolean))];
  return { effect: held[0].effect, target: verdicts.map(verdict => verdict.target).join(', ').slice(0, 256),
    tests: Object.fromEntries(Object.keys(held[0].tests).map(test => [test, verdicts.some(verdict => verdict.tests?.[test] === true)])),
    consequential: true, admitted: true, disposition: held.some(verdict => verdict.disposition === 'granted') ? 'granted' : held[0].disposition,
    ...(grants.length ? { grant: grants.join(', ') } : {}), reason: verdicts.map(verdict => verdict.reason).join('; ') };
}
/** A doorway verdict as the admission record carries it (Rule 41): enough for status and the answer's refusal notice. */
export function doorwayRecord(verdict) {
  return { effect: verdict.effect, ...(verdict.target ? { target: verdict.target } : {}), tests: verdict.tests,
    disposition: verdict.disposition, ...(verdict.grant ? { grant: verdict.grant } : {}), ...(verdict.admits ? { admits: verdict.admits } : {}) };
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
 * change the agent makes on that path between its check and the harness's open is not caught here: an OPEN race,
 * pre-existing and closable only by running the harness as its own OS user (docs/defects/2026-10-03-file-tool-swap-race.md).
 * Users' homes, keychains, the runner root, other roots and the admission state lie outside both sets. */
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

/** The host and port a shell request targets (a CONNECT authority `host:port`, or an absolute http(s) URL), when the
 * host is public-looking; otherwise null with a reason. The same host rule as a web read. */
export function egressTarget(authority, scheme = 'https:') {
  let parsed; try { parsed = new URL(`${scheme}//${String(authority)}/`); } catch { return { host: null, reason: 'not a host' }; }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) return { host: null, reason: 'not a host' };
  const target = webReadHost(parsed.href);
  if (target.host === null) return target;
  const port = parsed.port ? Number(parsed.port) : (scheme === 'http:' ? 80 : 443);
  return { host: target.host, port };
}

/** Headers a server may honor in place of the request line's method. A server may follow the request line or any of them,
 * so a request is a read only when the request line and every method these headers name are reads. */
export const METHOD_OVERRIDES = Object.freeze(['x-http-method-override', 'x-http-method', 'x-method-override']);
/** The largest git fetch request body the checkpoint holds to check before forwarding (a fetch's wants and haves). */
export const GIT_FETCH_MAX_BODY = 8 * 1024 * 1024;
// A git fetch request is pkt-lines, each one of the upload-pack protocol's own requests (v0 and v2): wants, haves, the
// negotiation's end, shallow and filter options, and v2's command, capabilities and ref prefixes. Nothing else is a fetch.
const GIT_FETCH_LINE = /^(?:(?:want|have|shallow|deepen|deepen-since|deepen-not|filter|want-ref|ref-prefix|packfile-uris) [\x21-\x7e]{1,1024}|(?:command|agent|object-format|server-option|session-id)=[\x21-\x7e]{1,1024}|want [0-9a-f]{40,64}(?: [\x21-\x7e]{1,1024})*|done|thin-pack|no-progress|include-tag|ofs-delta|peel|symrefs|unborn|sideband-all|wait-for-done|deepen-relative)$/u;
const lower = headers => Object.fromEntries(Object.entries(headers ?? {}).map(([name, value]) => [name.toLowerCase(), Array.isArray(value) ? value.join(',') : String(value)]));
/** The repository a smart-HTTP git route names (`/r.git/info/refs` or `/r.git/git-upload-pack` → `/r.git`), or null. */
export function gitRepository(path, endpoint) {
  const route = String(path ?? '').split('?')[0], suffix = `/${endpoint}`;
  return route.endsWith(suffix) && route.length > suffix.length ? route.slice(0, -suffix.length) : null;
}
/** Whether a response proves its host serves git fetches for a repository: the answer to that repository's
 * upload-pack discovery (`GET <repo>/info/refs?service=git-upload-pack`) was 200 with git's advertisement type. */
export function gitAdvertisement({ method, path, status, headers }) {
  const repo = gitRepository(path, 'info/refs'), query = String(path ?? '').split('?')[1] ?? '';
  if (String(method).toUpperCase() !== 'GET' || repo === null || new URLSearchParams(query).get('service') !== 'git-upload-pack' || status !== 200) return null;
  return /^application\/x-git-upload-pack-advertisement\b/u.test(lower(headers)['content-type'] ?? '') ? repo : null;
}
/** Whether a POST is a git fetch: its repository answered its discovery as a git server in this turn (`advertised`, the
 * set of `host:port/repo` proven by gitAdvertisement), it is typed as a fetch request, and its body (`body`, already
 * decompressed when the request was gzip-encoded) is nothing but upload-pack pkt-lines. A path name or content type
 * alone proves nothing. Returns {fetch, reason}. */
export function gitFetchRequest({ origin, path, headers, body, advertised }) {
  const repo = gitRepository(path, 'git-upload-pack'), h = lower(headers);
  if (repo === null) return { fetch: false, reason: 'not a git-upload-pack route' };
  if (!advertised?.has(`${origin}${repo}`)) return { fetch: false, reason: 'the repository did not advertise git upload-pack in this turn' };
  if (!/^application\/x-git-upload-pack-request\b/u.test(h['content-type'] ?? '')) return { fetch: false, reason: 'not typed as a git fetch request' };
  if (!Buffer.isBuffer(body)) return { fetch: false, reason: 'body unreadable' };
  let at = 0, lines = 0;
  while (at < body.length) {
    const size = /^[0-9a-f]{4}$/u.test(body.toString('latin1', at, at + 4)) ? parseInt(body.toString('latin1', at, at + 4), 16) : -1;
    if (size < 0 || size === 3 || at + Math.max(size, 4) > body.length) return { fetch: false, reason: 'body is not git pkt-lines' };
    if (size >= 4) {
      const line = body.toString('latin1', at + 4, at + size).replace(/\n$/u, '');
      if (!GIT_FETCH_LINE.test(line)) return { fetch: false, reason: 'body carries a line that is not a git fetch request' };
      lines++;
    }
    at += Math.max(size, 4);
  }
  return lines > 0 ? { fetch: true, reason: 'git fetch' } : { fetch: false, reason: 'empty git request' };
}

/** Plan #507: the decision for an outward request whose text the held-secret check (`held`, text => 'clear' | 'held' |
 * 'unavailable') did not clear, or null when it cleared. No check at all (`held` null) clears nothing an owner did not
 * wire: callers that dispatch outward always pass one. */
export function heldRefusal(held, text) {
  if (typeof held !== 'function') return null;
  let verdict;
  try { verdict = held(text); } catch { verdict = 'unavailable'; }
  if (verdict === 'clear') return null;
  return verdict === 'held' ? { decision: 'deny', reason: 'the request carries a secret value the runner holds', kind: 'secret' }
    : { decision: 'deny', reason: 'the held-secret check is unavailable, so the outward request is refused', kind: 'secret' };
}
/** Plan #507: the longest text one held-secret check carries (an outward tool call's input; larger is refused, never
 * truncated, since a truncated check could miss a value in the part left out). */
export const HELD_CHECK_MAX_BYTES = 1024 * 1024;
/** Plan #507: the text an outward tool request carries off the machine (every string in its input, property names included), or null for a tool
 * whose input does not leave it (a file tool, a search, a sandboxed shell command, whose network goes through the shell's
 * checkpoint, a subagent). Outward: WebFetch, WebSearch, a Codex network read, a named outward tool, an MCP tool, and a
 * shell command run outside the sandbox. */
export function outwardText(tool, input) {
  const name = String(tool ?? '');
  const outward = name === 'WebFetch' || name === 'WebSearch' || CODEX_NETWORK_READ_TOOLS.includes(name) || Object.hasOwn(OUTWARD_TOOLS, name)
    || name.startsWith('mcp__') || (name === 'Bash' && input?.dangerouslyDisableSandbox === true);
  if (!outward) return null;
  const strings = [];
  const walk = value => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    // A property name leaves the machine too (an MCP map of query parameters or headers), so it is checked as a value is.
    else if (value && typeof value === 'object') for (const [name, item] of Object.entries(value)) { strings.push(name); walk(item); }
  };
  walk(input);
  return strings.join('\n');
}

/** The shell's network checkpoint (the egress proxy every sandboxed command is forced through): the decision for one HTTP
 * request it can see in full (method, host, path, headers), after TLS interception. A read is admitted: GET or HEAD, or a
 * git fetch proven by gitFetchRequest (`gitFetch`, its result), and only when no method-override header names anything
 * else: a request whose line or any override names a write is a write. A read of a host the operator's effect policy
 * registers or marks policy-sensitive goes to the effect doorway as `tool:network`, exactly as a WebFetch of it does.
 * Everything else (POST, PUT, PATCH, DELETE, an unproven POST to a git-upload-pack path, a git push from its discovery
 * request on, a package publish) is a network write the effect doorway decides as `tool:network-write` on the host:
 * unregistered, it is classified at its worst on all four tests and refused. `config` is the turn's admission config
 * ({operations, effectPolicy?, irreversibleTerm?}); `now` (ms) checks a grant's expiry. */
export function admitEgress({ method, path, host = null, headers = {}, gitFetch = null }, config, now, held = null) {
  const h = lower(headers), actual = String(method ?? '').trim().toUpperCase(), target = String(path ?? '');
  // Plan #507 (secrets floor, Rule 4): a request whose host, path or any header carries a held secret value is refused
  // before anything else is decided, whatever its method; a check that cannot decide refuses too (Rule 95: fail closed).
  // `held` is the runner's check (tool-turn.mjs heldVerdict); the proxy always passes it.
  const secret = heldRefusal(held, [String(host ?? ''), target, ...Object.entries(headers).map(([name, value]) =>
    `${name}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)].join('\n'));
  if (secret) return secret;
  const on = host ? { target: String(host).slice(0, 256) } : {};
  // Every method the upstream could act on: the request line's and each one an override header names (a repeated header
  // is comma-joined). An override can never downgrade the request line, and no header can hide another's write.
  const verbs = [actual, ...METHOD_OVERRIDES.filter(name => name in h).flatMap(name => h[name].split(',').map(v => v.trim().toUpperCase()))];
  const read = v => v === 'GET' || v === 'HEAD', verb = verbs.find(v => !read(v)) ?? actual;
  const query = target.includes('?') ? target.slice(target.indexOf('?') + 1) : '', route = target.split('?')[0];
  const service = new URLSearchParams(query).get('service');
  const doorway = (proposal, kind, why) => { const verdict = admitToolEffect(proposal, config, now);
    return verdict.admitted ? { decision: 'allow', reason: verdict.reason, kind }
      : { decision: 'deny', reason: why ? `${why}: ${verdict.reason}` : verdict.reason, kind }; };
  const write = reason => doorway({ effect: 'tool:network-write', ...on }, 'network-write', reason);
  const admitRead = reason => policyNames(config, { effect: 'tool:network', ...on })
    ? doorway({ effect: 'tool:network', ...on }, 'network-read', null) : { decision: 'allow', reason, kind: 'network-read' };
  if (service === 'git-receive-pack' || route.endsWith('/git-receive-pack')) return write('a git push');
  if (verbs.every(read)) return admitRead(`${actual} read`);
  if (verbs.every(v => v === 'POST') && gitFetch?.fetch === true && route.endsWith('/git-upload-pack')) return admitRead('git fetch');
  if (verb === 'POST' && route.endsWith('/git-upload-pack')) return write(`POST is a network write (not a proven git fetch: ${gitFetch?.reason ?? 'unchecked'})`);
  return write(`${verb || '(no method)'} is a network write`);
}

/**
 * One PreToolUse decision. `call` is the hook input ({tool_name, tool_input, agent_id?}); `config` is the turn's
 * {workspace (real path), tmp (the shell's temporary directory), maxCalls, maxWriteBytes, operations, effectPolicy?,
 * irreversibleTerm?, children? {max, type}, mcpReads?}; `n` is this call's 1-based count in the step (maxCalls + 1 once
 * every slot is taken); `fs` gives exists/realpath and, for a web read, `addresses(host)` (the host's resolved addresses,
 * or null when they could not be resolved); `child` is the subagent slot this call took (children.max + 1 once every slot
 * is taken); `now` (ms) checks a grant's expiry. Returns {decision, reason, kind?, doorway?, updatedInput?}: `doorway` is
 * present exactly when the call reached the effect doorway. On a checkpointed route (`config.gate`, with `shellProfile`,
 * `delegation` and `networkReads`), `decision: 'gate'` (a delegation, an effect) is decided by the host checkpoint; the
 * hook asks it before the call runs.
 */
export function admitToolCall(call, config, n, fs, child = 1, now) {
  const tool = String(call?.tool_name ?? ''), input = call?.tool_input ?? {};
  const deny = (reason, kind) => ({ decision: 'deny', reason, ...(kind ? { kind } : {}) });
  // Part Twelve: the doorway's whole decision rides the admission record (Rule 41), so status and the answer can report it.
  // A tool the doorway's own vocabulary does not name (sending, scheduling, a remote trigger, Monitor) proposes `tool:<kind>`,
  // which no default classifies, so it is classified worst-case on every test.
  // On a checkpointed route the host's effect owner decides it, by this same doorway decision under the installation's
  // current policy, and adds the stop, durable preparation and (for a consequential one) the never-twice identity.
  const effect = kind => { if (typeof config.gate === 'string') return { decision: 'gate', kind: 'effect', reason: 'the effect owner decides' };
    const verdict = admitToolCallEffect(tool, input, config, now), doorway = doorwayRecord(verdict);
    return verdict.admitted ? { decision: 'allow', reason: verdict.reason, kind, doorway } : { ...deny(verdict.reason, kind), doorway }; };
  if (!Number.isSafeInteger(n) || n < 1) return deny('admission count unavailable');
  if (n > config.maxCalls) return deny(`per-step call cap ${config.maxCalls} reached (call ${n})`);
  // A file tool or search is decided on the file its path resolves to, against the turn's read or write set, and the
  // harness is handed that resolved path, so re-pointing the presented alias after this check does not redirect the call.
  // The resolved file or a directory on its path, changed after this check, still can: an OPEN race this check does not
  // close (docs/defects/2026-10-03-file-tool-swap-race.md). This is a check at admission; only Bash is decided at open.
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
    // A confined shell (`shellProfile` set) runs every command under the step's own sandbox profile, whatever the
    // harness asked for; otherwise the harness's own sandbox bounds it and an unsandboxed request is an effect.
    if (config.shellProfile) return { decision: 'allow', reason: 'confined command',
      updatedInput: { ...input, command: sandboxedShellCommand(command, { profile: config.shellProfile, workspace: config.workspace, tmp: config.tmp,
        egress: config.egress ?? null }) } };
    if (input.dangerouslyDisableSandbox) return effect('unsandboxed');
    return { decision: 'allow', reason: 'sandboxed command',
      updatedInput: { ...input, command: toolShellPrefix(config.tmp, config.egress ?? null) + command } };
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
  if (CODEX_NETWORK_READ_TOOLS.includes(tool)) {
    if (config.networkReads !== true) return deny(`network read ${tool} not admitted on this route`);
    // A host it opens, or its search, that the operator's effect policy registers or marks policy-sensitive (or a policy
    // that cannot be read) goes to the doorway, exactly as a WebFetch or WebSearch of it does.
    if (toolCallProposals(tool, input).some(proposal => policyNames(config, proposal))) return effect('network');
    return { decision: 'allow', reason: 'network read', kind: 'network-read' };
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
  if (DELEGATION_TOOLS.includes(tool) && config.delegation === true)
    return typeof config.gate === 'string' ? { decision: 'gate', kind: 'delegation', reason: 'delegation: recorded as a child edge first' }
      : deny('delegation needs the admission checkpoint to record its edge; this route has none', 'delegation');
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
  if (BOOKKEEPING_TOOLS.includes(tool) || (SESSION_BOOKKEEPING_TOOLS.includes(tool) && config.delegation === true))
    return { decision: 'allow', reason: 'harness bookkeeping' };
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
