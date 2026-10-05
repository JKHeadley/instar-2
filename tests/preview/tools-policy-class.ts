// Rule 104 (plan #449, w4-toolsclass): the operator's standing full-tools grant (Justin, topic 102965, message 121996: the
// full tool set ON BY DEFAULT) is recorded once as covering a policy CLASS, not one build's policy digest. Every build
// rewrites the tools system prompt or the settings label, so a per-digest grant fell silently out of date at each build
// (cint-L44 went live with tools off). The class is what 121996 approved, and no more: the whole built-in tool set behind
// every checkpoint the purpose names ("the agent's ability is never reduced to satisfy a safeguard that a checkpoint can
// enforce instead"). A policy is in the class when, read from the build's own policy object (the bytes the activation's
// digest covers) and the build's own per-turn checkpoint wiring:
//   - the mandatory admission hook runs on every tool call (matcher '*'), so consequential effects reach the effect doorway;
//   - the shell is confined (the harness sandbox with no direct network, or, where the harness sandbox is bypassed, the hook
//     confining the shell itself);
//   - no flag skips the hook or permission checks, and no other settings source can replace the per-turn settings;
//   - every cap is at or below the reviewed ceiling below (turns, tool calls, subagents, budget, time, write size).
// A policy that removes or weakens any of them (the doorway, the admission hook, the sandbox, a cap) is outside the class
// and needs a new verified approval. Tool names are not part of the class: offering more or fewer tools behind the same
// hook changes ability, not a checkpoint. The stop is the runner's, outside every policy, and no policy can remove it.
import { encoded } from '../../src/assembly/boundary.js';
import { SUBSCRIPTION_DOORWAYS, subscriptionToolSettings, SUBSCRIPTION_TOOLS_FRAMING } from '../../src/assembly/production-provider.js';
import { CODEX_TOOLS_FRAMING, codexToolHookArgs } from '../../src/assembly/production-codex-provider.js';

/** The one class a standing full-tools grant may name. A changed meaning is a new class id, never an edit of this one. */
export const FULL_TOOLS_CLASS = 'full-tools-checkpointed-v1';
/** The reviewed ceilings of the class: the bounds the full-tools policy carried when 121996 was recorded against it. */
export const FULL_TOOLS_CEILINGS = Object.freeze({ maxTurns: 8, maxToolCalls: 32, maxChildren: 2, childMaxTurns: 4,
  budgetCeilingUsd: 1, timeout: 300000, maxWriteBytes: 1048576 });
export type ToolsClassVerdict = { kind: 'covered'; policyClass: string; framing: string; digest: string }
  | { kind: 'outside'; reason: string };

type Policy = Readonly<Record<string, unknown>>;
const record = (value: unknown): Policy => (value && typeof value === 'object' && !Array.isArray(value) ? value as Policy : {});
const valueAfter = (args: readonly string[], flag: string): string | undefined => {
  const at = args.indexOf(flag);
  return at < 0 || args.lastIndexOf(flag) !== at ? undefined : args[at + 1];
};
const capped = (value: unknown, ceiling: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= ceiling;
/** The per-turn probe paths: plain, short, and laid out as the runner lays out a real turn. */
const PROBE = Object.freeze({ scratch: '/private/var/x/s', workspace: '/private/var/x/s/w', stateDirectory: '/Users/p/state',
  hook: Object.freeze({ node: '/Users/p/node', script: '/Users/p/tool-admission.mjs' }), deniedRoots: Object.freeze(['/Users/p/root']) });
const PROBE_HOME = '/Users/p/home';
const PROBE_EGRESS = Object.freeze({ port: 4321, reads: Object.freeze(['/opt/probe/node']) });
const PROBE_GATE = 'http://127.0.0.1:4321/0123456789abcdef0123456789abcdef/probe';
/** The reviewed system locations a confined shell may read (the build's runtime list when 121996 was recorded against the
 * class). Reading anywhere else changes the secrets checkpoint, so it is a new class, not an edit of this list. */
export const FULL_TOOLS_RUNTIME_READS = Object.freeze(['/bin', '/sbin', '/usr/bin', '/usr/sbin', '/usr/lib', '/usr/libexec',
  '/usr/share', '/System', '/private/var/select', '/private/etc', '/dev']);
/** The two root-level links the shell's read exceptions name so `/etc/hosts` reads as `/private/etc/hosts` does
 * (w4-toolpaths, plan #442). An entry for a link reopens the link node alone: the sandbox then checks the resolved target
 * against the same list, so no file outside FULL_TOOLS_RUNTIME_READS becomes readable (/var/log stays refused) and the
 * secrets checkpoint is unchanged. Exactly these two; any other link or path is still a new class. */
export const FULL_TOOLS_RUNTIME_READ_LINKS = Object.freeze(['/etc', '/var']);

function claudeCheckpoints(policy: Policy, args: readonly string[]): string | null {
  // The flags that skip settings hooks or permission checks, and the settings sources that could replace the per-turn settings.
  for (const flag of ['--safe-mode', '--bare', '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions', '--settings'])
    if (args.includes(flag)) return `the policy passes ${flag}, which skips or replaces the admission hook and sandbox settings`;
  if (valueAfter(args, '--permission-mode') !== 'default') return 'the permission mode is not default';
  if (valueAfter(args, '--setting-sources') !== '') return 'settings sources other than the per-turn settings may apply';
  if (!args.includes('--strict-mcp-config')) return 'MCP servers may come from outside the root configuration';
  if (!capped(Number(valueAfter(args, '--max-turns')), FULL_TOOLS_CEILINGS.maxTurns)) return 'the turn cap is absent or above the class ceiling';
  if (!capped(Number(valueAfter(args, '--max-budget-usd')), FULL_TOOLS_CEILINGS.budgetCeilingUsd)) return 'the budget cap is absent or above the class ceiling';
  const limits = record(policy.limits);
  for (const name of ['maxTurns', 'maxToolCalls', 'maxChildren', 'childMaxTurns', 'budgetCeilingUsd', 'timeout', 'maxWriteBytes'] as const)
    if (!capped(limits[name], FULL_TOOLS_CEILINGS[name])) return `the ${name} cap is absent or above the class ceiling`;
  // The build's own per-turn settings, with and without the shell's network checkpoint.
  for (const egress of [undefined, PROBE_EGRESS]) {
    let settings: string;
    try { settings = subscriptionToolSettings({ ...PROBE, ...(egress ? { egress } : {}) }, PROBE_HOME); }
    catch (error) { return `the per-turn settings could not be produced: ${String((error as Error)?.message ?? error)}`; }
    const why = claudeSettingsCheckpoints(settings, egress);
    if (why !== null) return why;
  }
  return null;
}

/** Whether one turn's generated Claude settings (for `PROBE`, `PROBE_HOME` and `egress`) keep every checkpoint: sandbox on and
 * unescapable, no direct network, reads closed from the root down and reopened only for the scratch volume, the reviewed
 * runtime list and the checkpoint's own reads (never the login home, the admission state, the hook or a denied root), writes
 * only to the scratch volume, and the admission hook on every call. */
export function claudeSettingsCheckpoints(json: string, egress: Readonly<{ port: number; reads: readonly string[] }> | undefined): string | null {
  let settings: Policy;
  try { settings = record(JSON.parse(json)); } catch { return 'the per-turn settings are not JSON'; }
  const sandbox = record(settings.sandbox), network = record(sandbox.network), files = record(sandbox.filesystem), hooks = record(settings.hooks);
  if (settings.disableAllHooks !== false) return 'the per-turn settings disable hooks';
  if (sandbox.enabled !== true || sandbox.failIfUnavailable !== true || sandbox.allowUnsandboxedCommands !== false)
    return 'the shell sandbox is off, optional or escapable';
  if (!Array.isArray(network.allowedDomains) || network.allowedDomains.length !== 0 || network.allowAllUnixSockets !== false
    || !Array.isArray(network.allowUnixSockets) || network.allowUnixSockets.length !== 0 || network.allowLocalBinding !== false
    || (network.httpProxyPort !== undefined && network.httpProxyPort !== egress?.port))
    return 'the shell reaches the network other than through the turn\'s checkpoint';
  if (!Array.isArray(files.denyRead) || !files.denyRead.includes('/') || JSON.stringify(files.allowWrite) !== JSON.stringify([PROBE.scratch]))
    return 'the shell reads or writes outside its workspace';
  // The read exceptions reopen paths inside the root denial, so each one must be a reviewed place: inside the scratch volume,
  // a reviewed runtime location, or one of the checkpoint's own reads. None may contain a protected path.
  const reads = files.allowRead === undefined ? [] : files.allowRead;
  if (!Array.isArray(reads)) return 'the shell\'s read exceptions are not a list';
  const within = (path: string, root: string) => path === root || path.startsWith(root === '/' ? '/' : `${root}/`);
  const protectedPaths = [PROBE_HOME, PROBE.stateDirectory, PROBE.hook.script, ...PROBE.deniedRoots];
  for (const read of reads) {
    if (typeof read !== 'string' || !read.startsWith('/') || /(?:^|\/)\.\.?(?:\/|$)/u.test(read) || read.includes('*'))
      return 'the shell\'s read exceptions are not plain absolute paths';
    if (!(within(read, PROBE.scratch) || FULL_TOOLS_RUNTIME_READS.includes(read) || FULL_TOOLS_RUNTIME_READ_LINKS.includes(read)
      || (egress?.reads ?? []).includes(read)))
      return `the shell reads ${read}, outside its workspace and the reviewed runtime list`;
    if (protectedPaths.some(path => within(path, read))) return `the shell reads ${read}, which holds the login home, admission state or a denied root`;
  }
  for (const [event, mode] of [['PreToolUse', 'pre'], ['PostToolUse', 'post'], ['SubagentStart', 'child-start'], ['SubagentStop', 'child-stop']]) {
    const entries = hooks[event as string];
    const command = `${PROBE.hook.node} ${PROBE.hook.script} ${mode} ${PROBE.stateDirectory}`;
    if (!Array.isArray(entries) || !entries.some(entry => record(entry).matcher === '*'
      && Array.isArray(record(entry).hooks) && (record(entry).hooks as unknown[]).some(hook => record(hook).command === command)))
      return `the admission hook does not run on every ${event as string}`;
  }
  return null;
}

function codexCheckpoints(policy: Policy, args: readonly string[]): string | null {
  const doorway = Object.values(SUBSCRIPTION_DOORWAYS).find(entry => entry.toolsFraming === CODEX_TOOLS_FRAMING);
  // This harness's own sandbox is bypassed, so the hook must confine the shell and stop the harness at its call ceiling.
  if (args.includes('--dangerously-bypass-approvals-and-sandbox') && !(doorway?.toolTurn?.confinedShell === true && doorway.toolTurn.harness))
    return 'the harness sandbox is bypassed without the admission hook confining the shell';
  if (!args.includes('--ephemeral')) return 'the harness keeps a session outside the journal';
  const limits = record(policy.limits);
  for (const name of ['maxTurns', 'timeout', 'maxWriteBytes'] as const)
    if (!capped(limits[name], FULL_TOOLS_CEILINGS[name])) return `the ${name} cap is absent or above the class ceiling`;
  let hookArgs: readonly string[];
  try { hookArgs = codexToolHookArgs({ ...PROBE, gate: PROBE_GATE }); }
  catch (error) { return `the per-turn admission arguments could not be produced: ${String((error as Error)?.message ?? error)}`; }
  for (const [event, mode] of [['PreToolUse', 'pre'], ['PostToolUse', 'post']])
    if (!hookArgs.some(arg => arg.startsWith(`hooks.${event as string}=[{matcher='*'`) && arg.includes(` ${PROBE.hook.script} ${mode as string} `)))
      return `the admission hook does not run on every ${event as string}`;
  return codexDispatchCheckpoint([...args, ...hookArgs]);
}

/** Whether the effective Codex launch arguments send every model call through the turn's checkpoint (`PROBE_GATE`): exactly
 * one selected provider, defined exactly once, whose base URL is that checkpoint over plain HTTP responses; no other provider
 * definition, base-URL override or profile/local-provider switch. A provider label alone proves nothing. */
export function codexDispatchCheckpoint(args: readonly string[]): string | null {
  const bypass = 'model calls bypass the dispatch checkpoint';
  if (args.some(arg => ['--profile', '-p', '--oss', '--local-provider'].includes(arg) || arg.startsWith('--profile=')
    || arg.startsWith('--local-provider='))) return `${bypass}: a profile or local provider may select the provider`;
  const overrides: string[] = [];
  for (let at = 0; at < args.length; at++) {
    const arg = args[at]!;
    if (arg === '-c' || arg === '--config') overrides.push(args[++at] ?? '');
    else if (arg.startsWith('--config=')) overrides.push(arg.slice('--config='.length));
  }
  const key = (override: string) => override.slice(0, override.indexOf('=') < 0 ? override.length : override.indexOf('=')).trim();
  const selected = overrides.filter(override => key(override) === 'model_provider');
  if (selected.length !== 1) return `${bypass}: no single selected provider`;
  const name = selected[0]!.slice(selected[0]!.indexOf('=') + 1).trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/u.test(name)) return `${bypass}: the selected provider name is not plain`;
  if (overrides.some(override => /(?:^|\.)(?:openai_base_url|chatgpt_base_url|base_url)$/u.test(key(override))
    || (key(override).startsWith('model_providers') && key(override) !== `model_providers.${name}`)))
    return `${bypass}: another provider or base URL is configured`;
  const defined = overrides.filter(override => key(override) === `model_providers.${name}`);
  if (defined.length !== 1) return `${bypass}: the selected provider is not defined exactly once`;
  const definition = defined[0]!;
  const baseUrls = [...definition.matchAll(/(?:^|[{,\s])base_url\s*=\s*"([^"]*)"/gu)].map(match => match[1]);
  if (baseUrls.length !== 1 || !baseUrls[0]!.startsWith(`${PROBE_GATE}/`)) return `${bypass}: the provider does not target the turn's checkpoint`;
  if (!/(?:^|[{,\s])wire_api\s*=\s*"responses"/u.test(definition)) return `${bypass}: the provider does not speak plain HTTP responses`;
  return null;
}

/** Whether `policy` (the build's own tools policy, whose canonical digest must be `digest`) lies in `policyClass`. */
export function toolsPolicyClassVerdict(policyClass: unknown, policy: unknown, digest: string): ToolsClassVerdict {
  const outside = (reason: string): ToolsClassVerdict => ({ kind: 'outside', reason });
  if (policyClass !== FULL_TOOLS_CLASS) return outside(`the granted policy class ${String(policyClass)} is not known to this build`);
  let hash: string;
  try { hash = (encoded(policy) as { hash: string }).hash; } catch { return outside('the presented policy is not canonical'); }
  if (hash !== digest) return outside('the presented policy is not the one the activation names');
  const p = record(policy), args = Array.isArray(p.args) && p.args.every(arg => typeof arg === 'string') ? p.args as string[] : null;
  if (!args) return outside('the policy carries no launch arguments');
  if (p.retries !== 0) return outside('the policy retries calls');
  const framing = p.framing;
  const why = framing === SUBSCRIPTION_TOOLS_FRAMING ? claudeCheckpoints(p, args)
    : framing === CODEX_TOOLS_FRAMING ? codexCheckpoints(p, args)
      : `framing ${String(framing)} is not a tools framing of the class`;
  return why === null ? { kind: 'covered', policyClass, framing: framing as string, digest } : outside(why);
}
