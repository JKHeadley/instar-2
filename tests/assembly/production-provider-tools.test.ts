// Part Thirteen §9 (docs/17-harness-adapters), the preview tool rule: the tool turn's exact launch. The flag set and settings are the
// configuration the w4-toolsreuse spike proved (lanes/w4-toolsreuse-PROGRESS.md, "Required configuration for
// REUSE"), widened to the harness's whole tool set (w4-toolsfull); each assertion here fails if a floor is dropped: --bare
// or --safe-mode returning (both skip settings hooks), a tool left out instead of decided at the hook, the sandbox loosening,
// the hook leaving, or a subagent starting without its edge hooks.
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, subscriptionConversationPolicy, subscriptionToolSettings, subscriptionToolsPolicy,
  SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_TOOL_LIMITS,
  SUBSCRIPTION_SUBAGENT_TYPE, SUBSCRIPTION_TOOL_NAMES, SUBSCRIPTION_TOOLS_FRAMING, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT, SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_TOOL_RUNTIME_READS,
  SUBSCRIPTION_TOOL_RUNTIME_READ_LINKS, SUBSCRIPTION_NATIVE_SYSTEM_PROMPT, SUBSCRIPTION_MAX_OUTPUT_TOKENS,
  validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord, SubscriptionToolTurn } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { COMPLETE_REQUESTED_WORK } from '../../src/assembly/tool-answer-guidance.js';
import { MEMORY_DISAMBIGUATION } from '../../src/assembly/memory-answer-guidance.js';
import { guidanceOnlyPolicyPins } from '../preview/tools-policy-class.js';
import { prepareJournalEnvelope } from '../preview/journal-envelope.js';
import { factsFixture, value } from '../facts/fixtures.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
/** The fixture's runner root holds the login home, the admission state and the turn's denied root, and production
 * refuses a turn whose home, state or denied root lies under a runtime read root (subscriptionToolSettings) — so this
 * root has to sit outside every one of them. The suite's Linux RAM temporary root is /dev/shm (tests/setup/test-tmp.ts
 * picks the first verified tmpfs), and /dev/shm is inside `/dev`, which production declares a runtime read: under
 * tmpdir() there the whole root is readable and the route refuses for a reason that has nothing to do with this unit.
 * The choice is made from the read lists themselves, not from the platform, so it holds if either one moves. The
 * fallback is the host's real temporary root, which is outside both lists on each supported platform (/tmp on Linux,
 * and /tmp resolving to /private/tmp on darwin — the same root this fixture's scratch volume already uses). /var/tmp,
 * which tests/preview/held-egress.test.ts picks, is not usable here: it lies under `/var`, a declared read LINK, and
 * this check reads the link list as well as the read list. */
const inRuntimeRead = (path: string) => [...SUBSCRIPTION_TOOL_RUNTIME_READS, ...SUBSCRIPTION_TOOL_RUNTIME_READ_LINKS]
  .some(read => path === read || path.startsWith(`${read}/`));
const RUNNER_TMP_ROOT = inRuntimeRead(realpathSync(tmpdir())) ? realpathSync('/tmp') : tmpdir();
const hash = (v: unknown) => (canonical(v) as { kind: 'Success'; value: { hash: string } }).value.hash;
/** The pinned harness's built-in tool set as its `--tools default` init frame lists it (Claude Code 2.1.280, recorded
 * 2026-10-03 under a throwaway profile: no model call), with Task named Agent, plus the tools it offers only when named
 * (Glob, Grep) or under a claude.ai login (RemoteTrigger). None is left out: the hook decides each call. */
const DEFAULT_SET = ['Bash', 'CronCreate', 'CronDelete', 'CronList', 'DesignSync', 'Edit', 'EnterWorktree', 'ExitWorktree', 'ListAgents',
  'Monitor', 'NotebookEdit', 'PushNotification', 'Read', 'ReportFindings', 'ScheduleWakeup', 'SendMessage', 'Skill', 'Agent', 'TaskStop',
  'ToolSearch', 'WebFetch', 'WebSearch', 'Workflow', 'Write'];
const CATALOG = [...DEFAULT_SET, 'Glob', 'Grep', 'RemoteTrigger'];
const after = (args: readonly string[], flag: string) => args[args.indexOf(flag) + 1];

it('launches the tool turn with the proven flag set: hooks on, the whole built-in tool set offered, nothing removed, the session per turn', () => {
  const args = subscriptionToolsPolicy('claude-synthetic-exact-1').args;
  for (const banned of ['--bare', '--safe-mode', '--dangerously-skip-permissions', '--resume', '--continue', '--add-dir',
    '--disallowedTools', '--disallowed-tools', '--disable-slash-commands'])
    expect(args).not.toContain(banned);
  // No static settings: the per-turn settings carry the hook, so nothing here may set disableAllHooks.
  expect(args).not.toContain('--settings');
  expect(after(args, '--tools')!.split(',').sort()).toEqual([...CATALOG].sort());
  expect([...SUBSCRIPTION_TOOL_NAMES].sort()).toEqual([...CATALOG].sort());
  // The subagent type: foreground, bounded turns, and no `tools` field, so it inherits the whole set, Agent included
  // (Rule 114: a subagent may delegate in turn, within the turn's one subagent budget).
  expect(JSON.parse(after(args, '--agents')!)).toEqual({ [SUBSCRIPTION_SUBAGENT_TYPE]: { description: expect.any(String), prompt: expect.any(String),
    model: 'inherit', maxTurns: SUBSCRIPTION_TOOL_LIMITS.childMaxTurns, background: false } });
  expect(after(args, '--mcp-config')).toBe('{"mcpServers":{}}');
  expect(after(args, '--setting-sources')).toBe('');
  expect(args).toEqual(expect.arrayContaining(['--strict-mcp-config']));
  // MF5 (plan row #400): whether the harness keeps a session is per turn (the runner's kept session, or none), never in the
  // digest-bound policy, as the per-turn paths are not.
  for (const flag of ['--no-session-persistence', '--session-id']) expect(args).not.toContain(flag);
  expect(after(args, '--max-turns')).toBe(String(SUBSCRIPTION_TOOL_LIMITS.maxTurns));
  // The budget flag overshoots by one turn (spike d3): it sits one turn's margin below the ceiling.
  expect(Number(after(args, '--max-budget-usd'))).toBe(SUBSCRIPTION_TOOL_LIMITS.budgetCeilingUsd - SUBSCRIPTION_TOOL_LIMITS.oneTurnMarginUsd);
  expect(after(args, '--permission-mode')).toBe('default');
  expect(after(args, '--system-prompt')).toBe(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT);
  // The other side: the text-only conversation framing keeps its no-tools launch.
  const plain = subscriptionConversationPolicy('claude-synthetic-exact-1').args;
  expect(after(plain, '--tools')).toBe(''); expect(plain).toContain('--safe-mode');
  expect(hash(subscriptionToolsPolicy('m')) === hash(subscriptionConversationPolicy('m'))).toBe(false);
});

it('tells the model it has the whole tool set and how each call is bounded, and keeps the conversation framing\'s no-tools sentence intact', () => {
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain('the harness\'s full built-in tool set');
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).not.toContain('You have no tools');
  // The shell's network goes through the turn's checkpoint (w4-shellnet): the model is told what it can and cannot reach.
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).not.toMatch(/Bash is sandboxed: no network/u);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain('its network goes through a checkpoint: public reads work (GET, HEAD, git clone, package '
    + 'installs), local addresses are refused, and writes (other methods, git push, publish) go to the effect doorway. Clone git '
    + 'repositories under $TMPDIR.');
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toMatch(/WebFetch and WebSearch read the public web \(GET only\)/u);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain(`"${SUBSCRIPTION_SUBAGENT_TYPE}" subagents, which may start their own: at most ${SUBSCRIPTION_TOOL_LIMITS.maxChildren} in this whole turn`);
  // What the checkpoints do, as the Codex sentence says it (w4-selfdesc, live K11a 2026-10-04): never a flat refusal of
  // every outward write, which the reply read as a standing block the design does not have.
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toMatch(/Registered effects covered by standing grants run without another yes/u);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).not.toMatch(/writes \(other methods, git push, publish\) and local addresses are refused/u);
  expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).toMatch(/writes \(other methods, git push, publish\) go to the effect doorway/u);
  expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).toMatch(/one runs once the operator registers and grants it, otherwise it is refused/u);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain('which tool call, by name and order, produced it');
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).toContain('You have no tools and cannot act beyond this answer; never claim otherwise.');
  // Plan #510: the tool route runs without --safe-mode, so Claude Code injects its own account email; the prompt says that
  // login is never the operator. Completion guidance adds the inherited 508-character
  // tool-only clause; delta delivery changes neither prompt nor activation policy. The 70-character closed-set sentence
  // went with the 2026-10-13 single-machine ruling (purpose changelog): one machine has no closed operation set.
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain('is the subscription login running you, never the operator');
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).not.toContain('closed set');
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT.length - SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT.length).toBe(2697 + 508);
  const captures = JSON.parse(readFileSync(new URL('../preview/fixtures/tools-guidance-only-2026-10-15.json', import.meta.url), 'utf8'));
  const [previous, completion] = captures.builds;
  expect(previous.digest).toBe('sha256:5fed4bcfd823d950c1444a008a9c11d40824671dd8e68aa2f5908ed8534a2926');
  expect(hash(previous.policy)).toBe(previous.digest);
  // The removed closed-set sentence and shared supersession guidance are prompt-only changes:
  // the sealed guidance-only class still binds all launch, authority and resource fields.
  const closedSet = 'Irreversible outward sends remain outside the one-machine closed set. ';
  const current = subscriptionToolsPolicy('claude-sonnet-5'), prompt = current.args.indexOf('--system-prompt') + 1;
  expect(completion.policy.args[prompt].split(closedSet)).toHaveLength(2);
  const oldMemory = 'If two active memory items match the question but disagree, or refer to different people or things, '
    + 'ask one short clarifying question with a distinguishing detail. Answer directly when the question identifies one; ignore corrected or forgotten items. ';
  expect(completion.policy.args[prompt]).toContain(oldMemory);
  expect({ ...current, args: current.args.map((arg, index) => index === prompt
    ? completion.policy.args[prompt].replace(closedSet, '').replace(oldMemory, MEMORY_DISAMBIGUATION).replace('do all your reasoning there.', 'give a brief decision rationale supported by the relevant evidence.') : arg) })
