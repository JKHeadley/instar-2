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
  // The build's own per-turn settings, with and without the shell's network checkpoint: sandbox on and unescapable, no direct
  // network, reads closed from the root down, writes only to the scratch volume, and the admission hook on every call.
  for (const egress of [undefined, { port: 4321, reads: ['/opt/probe/node'] }]) {
    let settings: Policy;
    try { settings = record(JSON.parse(subscriptionToolSettings({ ...PROBE, ...(egress ? { egress } : {}) }, '/Users/p/home'))); }
    catch (error) { return `the per-turn settings could not be produced: ${String((error as Error)?.message ?? error)}`; }
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
    for (const [event, mode] of [['PreToolUse', 'pre'], ['PostToolUse', 'post'], ['SubagentStart', 'child-start'], ['SubagentStop', 'child-stop']]) {
      const entries = hooks[event as string];
      const command = `${PROBE.hook.node} ${PROBE.hook.script} ${mode} ${PROBE.stateDirectory}`;
      if (!Array.isArray(entries) || !entries.some(entry => record(entry).matcher === '*'
        && Array.isArray(record(entry).hooks) && (record(entry).hooks as unknown[]).some(hook => record(hook).command === command)))
        return `the admission hook does not run on every ${event as string}`;
    }
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
  try { hookArgs = codexToolHookArgs({ ...PROBE, gate: 'http://127.0.0.1:4321/0123456789abcdef0123456789abcdef/probe' }); }
  catch (error) { return `the per-turn admission arguments could not be produced: ${String((error as Error)?.message ?? error)}`; }
  for (const [event, mode] of [['PreToolUse', 'pre'], ['PostToolUse', 'post']])
    if (!hookArgs.some(arg => arg.startsWith(`hooks.${event as string}=[{matcher='*'`) && arg.includes(` ${PROBE.hook.script} ${mode as string} `)))
      return `the admission hook does not run on every ${event as string}`;
  if (!hookArgs.some(arg => arg.startsWith('model_provider='))) return 'model calls bypass the dispatch checkpoint';
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
