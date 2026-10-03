// Part Thirteen §9 (docs/17-harness-adapters), the preview tool rule: the tool turn's exact launch. The flag set and settings are the
// configuration the w4-toolsreuse spike proved (lanes/w4-toolsreuse-PROGRESS.md, "Required configuration for
// REUSE"), widened to the full tool set (w4-toolsfull); each assertion here fails if a floor is dropped: --bare or
// --safe-mode returning (both skip settings hooks), an outward or unrecorded-delegation tool coming back, the sandbox
// loosening, the hook leaving, or a subagent starting without its edge hooks.
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, subscriptionConversationPolicy, subscriptionToolSettings, subscriptionToolsPolicy,
  SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_TOOL_DISALLOWED, SUBSCRIPTION_TOOL_LIMITS,
  SUBSCRIPTION_SUBAGENT_TYPE, SUBSCRIPTION_TOOL_NAMES, SUBSCRIPTION_TOOLS_FRAMING, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT, SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_TOOL_RUNTIME_READS,
  validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord, SubscriptionToolTurn } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture, value } from '../facts/fixtures.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const hash = (v: unknown) => (canonical(v) as { kind: 'Success'; value: { hash: string } }).value.hash;
/** Removed outright: every outward, scheduling, worktree and session-control tool, and the multi-agent tools whose children no
 * edge records (Workflow, agent teams). Agent, WebFetch and WebSearch are admitted tools now; the hook decides each call. */
const REMOVED = ['Workflow', 'CronCreate', 'CronDelete', 'CronList', 'RemoteTrigger', 'SendMessage', 'TaskStop', 'EnterWorktree',
  'ExitWorktree', 'ListAgents', 'ReportFindings', 'ScheduleWakeup', 'PushNotification', 'Monitor', 'Skill', 'TeamCreate', 'TeamDelete'];
const after = (args: readonly string[], flag: string) => args[args.indexOf(flag) + 1];

it('launches the tool turn with the proven flag set: hooks on, every delegating and outward tool removed, no persistence', () => {
  const args = subscriptionToolsPolicy('claude-synthetic-exact-1').args;
  for (const banned of ['--bare', '--safe-mode', '--dangerously-skip-permissions', '--resume', '--continue', '--add-dir'])
    expect(args).not.toContain(banned);
  // No static settings: the per-turn settings carry the hook, so nothing here may set disableAllHooks.
  expect(args).not.toContain('--settings');
  expect(after(args, '--tools')).toBe('Read,Write,Edit,Glob,Grep,Bash,WebFetch,WebSearch,Agent');
  const disallowed = args.slice(args.indexOf('--disallowedTools') + 1, args.indexOf('--agents'));
  expect([...disallowed].sort()).toEqual([...REMOVED].sort());
  expect([...SUBSCRIPTION_TOOL_DISALLOWED].sort()).toEqual([...REMOVED].sort());
  for (const tool of SUBSCRIPTION_TOOL_NAMES) expect(SUBSCRIPTION_TOOL_DISALLOWED).not.toContain(tool);
  // The one subagent type: foreground, bounded turns, the same tools without Agent (no grandchildren in a turn).
  expect(JSON.parse(after(args, '--agents')!)).toEqual({ [SUBSCRIPTION_SUBAGENT_TYPE]: { description: expect.any(String), prompt: expect.any(String),
    tools: SUBSCRIPTION_TOOL_NAMES.filter(name => name !== 'Agent'), model: 'inherit', maxTurns: SUBSCRIPTION_TOOL_LIMITS.childMaxTurns, background: false } });
  expect(after(args, '--mcp-config')).toBe('{"mcpServers":{}}');
  expect(after(args, '--setting-sources')).toBe('');
  expect(args).toEqual(expect.arrayContaining(['--strict-mcp-config', '--no-session-persistence', '--disable-slash-commands']));
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

it('tells the model exactly the tools it has, and keeps the conversation framing\'s no-tools sentence intact', () => {
  for (const name of SUBSCRIPTION_TOOL_NAMES) expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain(name);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).not.toContain('You have no tools');
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toMatch(/Bash is sandboxed: no network/u);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toMatch(/WebFetch and WebSearch read the public web \(GET only\)/u);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain(`at most ${SUBSCRIPTION_TOOL_LIMITS.maxChildren} "${SUBSCRIPTION_SUBAGENT_TYPE}" subagents`);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toMatch(/go through the effect doorway and are refused unless registered/u);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain('which tool call, by name and order, produced it');
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).toContain('You have no tools and cannot act beyond this answer; never claim otherwise.');
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT.length - SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT.length).toBeLessThan(1100);
});

it('writes settings that refuse every read from the root down except the scratch volume and the runtime, writes outside the volume, network and unix sockets, with the mandatory hook on both events', () => {
  const turn: SubscriptionToolTurn = { scratch: '/r/tool-turns/a-0/vol', workspace: '/r/tool-turns/a-0/vol/ws', stateDirectory: '/r/tool-turns/a-0/state',
    deniedRoots: ['/r', '/profile/home'], hook: { node: '/usr/local/bin/node', script: '/repo/tests/preview/tool-admission-hook.mjs' } };
  const settings = JSON.parse(subscriptionToolSettings(turn, '/profile/home'));
  expect(settings.disableAllHooks).toBe(false);
  // Claude Code 2.1.280 reads `denyRead` as regions and `allowRead` as reopenings inside them: with the root denied, only the
  // listed paths are readable (review round 1, finding 1: a neighbouring temporary file was readable under the old list).
  expect(settings.sandbox).toEqual({ enabled: true, failIfUnavailable: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: false,
    network: { allowedDomains: [], allowUnixSockets: [], allowAllUnixSockets: false, allowLocalBinding: false },
    filesystem: { allowWrite: ['/r/tool-turns/a-0/vol'],
      denyWrite: ['/tmp/claude', '/private/tmp/claude', '/profile/home/.npm/_logs', '/profile/home/.claude/debug'],
      denyRead: ['/'], allowRead: ['/r/tool-turns/a-0/vol', ...SUBSCRIPTION_TOOL_RUNTIME_READS] } });
  // Nothing in the runtime list holds user, session or runner data.
  for (const read of SUBSCRIPTION_TOOL_RUNTIME_READS) expect(read).toMatch(/^\/(bin|sbin|usr\/(bin|sbin|lib|libexec|share)|System|private\/var\/select|private\/etc|dev)$/u);
  expect(settings.permissions).toEqual({ allow: [...SUBSCRIPTION_TOOL_NAMES], deny: [...SUBSCRIPTION_TOOL_DISALLOWED] });
  for (const [event, mode] of [['PreToolUse', 'pre'], ['PostToolUse', 'post'], ['SubagentStart', 'child-start'], ['SubagentStop', 'child-stop']] as const)
    expect(settings.hooks[event]).toEqual([{ matcher: '*', hooks: [{ type: 'command',
      command: `/usr/local/bin/node /repo/tests/preview/tool-admission-hook.mjs ${mode} /r/tool-turns/a-0/state` }] }]);
  // Refused shapes: the admission state inside the volume, a hook a tool could rewrite, a path needing quoting, a workspace
  // off its volume, and a denied root, the state or the home under a readable path.
  const home = '/profile/home';
  expect(() => subscriptionToolSettings({ ...turn, stateDirectory: '/r/tool-turns/a-0/vol/state' }, home)).toThrow(/outside the workspace/u);
  // The root's MCP servers: each is allowed by name, and its launch configuration must lie in the admission state.
  const mcp = JSON.parse(subscriptionToolSettings({ ...turn, mcp: { config: '/r/tool-turns/a-0/state/mcp.json', servers: ['dummy'] } }, home));
  expect(mcp.permissions.allow).toEqual([...SUBSCRIPTION_TOOL_NAMES, 'mcp__dummy']);
  expect(() => subscriptionToolSettings({ ...turn, mcp: { config: '/r/tool-turns/a-0/vol/ws/mcp.json', servers: ['dummy'] } }, home)).toThrow(/MCP configuration/u);
  expect(() => subscriptionToolSettings({ ...turn, mcp: { config: '/r/tool-turns/a-0/state/mcp.json', servers: ['a b'] } }, home)).toThrow(/MCP configuration/u);
  expect(() => subscriptionToolSettings({ ...turn, hook: { ...turn.hook, script: '/r/tool-turns/a-0/vol/hook.mjs' } }, home)).toThrow(/outside the workspace/u);
  expect(() => subscriptionToolSettings({ ...turn, workspace: '/r/a b/ws' }, home)).toThrow(/absolute and plain/u);
  expect(() => subscriptionToolSettings({ ...turn, workspace: '/r/../ws' }, home)).toThrow(/absolute and plain/u);
  expect(() => subscriptionToolSettings({ ...turn, workspace: '/r/tool-turns/a-0/ws' }, home)).toThrow(/inside its scratch volume/u);
  expect(() => subscriptionToolSettings({ ...turn, deniedRoots: ['/usr/share/runner'] }, home)).toThrow(/under a readable path/u);
  expect(() => subscriptionToolSettings(turn, '/private/etc/home')).toThrow(/under a readable path/u);
  // A mount point too long for the harness's per-user temporary directory would push it to the shared /tmp/claude-<uid>.
  expect(() => subscriptionToolSettings({ ...turn, scratch: '/r/tool-turns/0123456789abcdef-0/vol', workspace: '/r/tool-turns/0123456789abcdef-0/vol/ws' }, home))
    .toThrow(/too long for the harness temporary directory/u);
});

function fixture() {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'subscription-tools-'))); roots.push(root);
  const home = join(root, 'home'), configDirectory = join(root, 'config'), workingDirectory = join(root, 'work');
  // The scratch volume's mount point is short (the harness temporary directory must fit 44 bytes), as the runner allocates it.
  const scratch = realpathSync(mkdtempSync('/private/tmp/itt-')); roots.push(scratch);
  const workspace = join(scratch, 'ws'), stateDirectory = join(root, 'turn', 'state');
  for (const path of [home, configDirectory, workingDirectory, workspace, stateDirectory]) mkdirSync(path, { recursive: true, mode: 0o700 });
  const executable = join(root, 'synthetic-cli.mjs'), report = join(root, 'commands.jsonl');
  const status = { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', analyticsDisabled: true,
    projectsDirectory: `${configDirectory}/projects`, configDirectory, email: 'synthetic@example.invalid',
    orgId: 'synthetic-organization', orgName: 'synthetic', subscriptionType: 'max' };
  const answer = JSON.stringify({ ...f.decisionInput(), conclusion: { ...f.decisionInput().conclusion, subject: 'preview-stage2-answer', predicate: 'answer-text', value: '11' } });
  const terminal = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: answer, num_turns: 4,
    session_id: 'synthetic-call', usage: { input_tokens: 10, output_tokens: 300 }, total_cost_usd: 0.05 });
  const source = `#!${process.execPath}\nimport {appendFileSync} from 'node:fs';
    let stdin='';for await(const chunk of process.stdin)stdin+=chunk;
    appendFileSync(${JSON.stringify(report)},JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),stdin,tmpdir:process.env.CLAUDE_CODE_TMPDIR??null})+'\\n');
    if(process.argv[2]==='--version')process.stdout.write('2.1.280 (Claude Code)\\n');
    else if(process.argv[2]==='auth')process.stdout.write(${JSON.stringify(JSON.stringify(status))});
    else process.stdout.write(${JSON.stringify(terminal)});\n`;
  writeFileSync(executable, source); chmodSync(executable, 0o700);
  let hooksDisabled: boolean | null = false;
  const physical = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false });
  const io = { ...physical, managedHooksDisabled: () => hooksDisabled };
  const seed = { type: 'ProviderSubscriptionProfile' as const, schemaVersion: 1 as const, reference: 'subscription-login',
    home, configDirectory, workingDirectory, expectedAccount: status.email, organization: status.orgId, plan: 'max' as const,
    executable, artifact: `sha256:${createHash('sha256').update(source).digest('hex')}`, version: '2.1.280',
    activationReference: 'activation:synthetic', loginProfileIdentity: '', managedConfigurationDigest: '' };
  const profile: ProviderSubscriptionProfile = Object.freeze({ ...seed, ...physical.inspectSubscriptionProfile(seed) });
  const model = 'claude-synthetic-exact-1';
  const activation = (framing: string): SubscriptionActivationRecord => ({ type: 'SubscriptionActivationRecord', schemaVersion: 1,
    reference: profile.activationReference, waiver: 'synthetic-waiver', p11: 'synthetic-p11', reviewedHead: 'synthetic-head',
    trial: 'synthetic-trial', baseConfigurationDigest: hash('synthetic-config'), profileDigest: hash(profile),
    executable, artifact: profile.artifact, version: profile.version, model,
    invocationPolicyDigest: hash(framing === SUBSCRIPTION_TOOLS_FRAMING ? subscriptionToolsPolicy(model) : subscriptionConversationPolicy(model)),
    expectedAccount: profile.expectedAccount, observedAccount: profile.expectedAccount, authSource: 'claude.ai',
    operatorAssertion: 'synthetic-assertion', assertedAt: 1, observer: 'synthetic-observer', observedAt: 2, method: 'synthetic-observation',
    safeCaptureReference: 'capture:synthetic', extraUsage: 'operator-asserted/unobservable', extraUsageReason: 'synthetic reason here',
    subscriptionLimit: 'unobservable', subscriptionLimitReason: 'synthetic limit reason', acceptedResiduals: ['synthetic residual'],
    expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY });
  const ctx = { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'preview'] } };
  const toolTurn: SubscriptionToolTurn = { scratch, workspace, stateDirectory, deniedRoots: [root],
    hook: { node: process.execPath, script: join(process.cwd(), 'tests/preview/tool-admission-hook.mjs') } };
  const input = (framing: string = SUBSCRIPTION_TOOLS_FRAMING, turn: SubscriptionToolTurn | null = toolTurn) => ({
    provider: 'anthropic', model, route: 'subscription-preview', disclosure: 'supervised preview',
    credential: value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: profile.reference }, ctx)),
    context: { ...ctx, site: f.c.site, preserved: f.c.preserved }, profile, activation: activation(framing), io, now: () => 1000,
    active: () => true, resolveProfile: () => profile, framing: framing as typeof SUBSCRIPTION_TOOLS_FRAMING,
    ...(turn ? { toolTurn: turn } : {}), adapterEvidenceContract: {
      reference: profile.activationReference, version: hash(profile), parserReference: 'claude-code-json-result', parserVersion: '1',
      endpoint: profile.loginProfileIdentity, account: profile.expectedAccount, credentialReference: profile.reference,
      controller: 'synthetic-recorder', sourceEvidence: ['synthetic-source'], terminalEvidence: 'synthetic-terminal',
      terminalReasonField: 'subtype', successfulFinalReplyReasons: ['success'], strength: 'observation' as const,
      maxMetadataBytes: 8192, maxRawTerminalBytes: 65536, maxCaptureBytes: 1048576 } });
  const policy = subscriptionToolsPolicy(model);
  const bounds = { operation: 'operation:synthetic', deadline: 400000, timeout: 5000, maxOutputBytes: policy.maxOutputBytes,
    maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 as const };
  return { root, workspace, stateDirectory, workingDirectory, toolTurn, input, bounds, answer, model, profile, activation,
    disableHooks: (value: boolean | null) => { hooksDisabled = value; },
    commands: () => { try { return readFileSync(report, 'utf8').trim().split('\n').map(line => JSON.parse(line)); } catch { return []; } } };
}

it('runs the model command in the turn workspace with the per-turn settings appended; preflights stay in the empty work directory', async () => {
  const f = fixture();
  const route = value(createClaudeCodeSubscriptionRoute(f.input()));
  const observed = await route.invoke('{"question":"wc"}', f.bounds);
  expect(observed).toMatchObject({ state: 'complete', bytes: f.answer, usage: { outputTokens: 300, charge: null } });
  const commands = f.commands();
  expect(commands.map(c => c.cwd)).toEqual([f.workingDirectory, f.workingDirectory, f.workspace]);
  expect(commands[2].args).toEqual([...subscriptionToolsPolicy(f.model).args, '--settings', subscriptionToolSettings(f.toolTurn, f.profile.home)]);
  expect(commands[2].stdin).toBe('{"question":"wc"}');
  // A tool route points the harness's temporary directory at the turn's volume (its preflights share the one environment).
  expect(commands.map(c => c.tmpdir)).toEqual([f.toolTurn.scratch, f.toolTurn.scratch, f.toolTurn.scratch]);
});

it('loads the root\'s MCP servers from the admission state for the model command only, never in the digest-bound policy', async () => {
  const f = fixture();
  const config = join(f.stateDirectory, 'mcp.json');
  writeFileSync(config, JSON.stringify({ mcpServers: { dummy: { command: '/usr/bin/true' } } }));
  const turn = { ...f.toolTurn, mcp: { config, servers: ['dummy'] } };
  const route = value(createClaudeCodeSubscriptionRoute({ ...f.input(), toolTurn: turn }));
  expect(await route.invoke('{"question":"mcp"}', f.bounds)).toMatchObject({ state: 'complete' });
  const commands = f.commands();
  expect(commands[2].args).toEqual([...subscriptionToolsPolicy(f.model).args, '--mcp-config', config, '--settings', subscriptionToolSettings(turn, f.profile.home)]);
  // The preflights carry no MCP configuration, and the policy (what the activation binds) keeps its empty one.
  for (const command of commands.slice(0, 2)) expect(command.args).not.toContain(config);
  expect(subscriptionToolsPolicy(f.model).args).not.toContain(config);
});

it('refuses a tool turn when managed policy may disable the hook, when the framing and turn differ, or when a path is not canonical', async () => {
  const f = fixture();
  for (const disabled of [true, null]) {
    f.disableHooks(disabled);
    expect(createClaudeCodeSubscriptionRoute(f.input()).kind).toBe('Refused');
  }
  f.disableHooks(false);
  expect(createClaudeCodeSubscriptionRoute(f.input(SUBSCRIPTION_TOOLS_FRAMING, null)).kind).toBe('Refused');
  expect(createClaudeCodeSubscriptionRoute(f.input(SUBSCRIPTION_CONVERSATION_FRAMING, f.toolTurn)).kind).toBe('Refused');
  const link = join(f.root, 'link-ws'); symlinkSync(f.workspace, link);
  expect(createClaudeCodeSubscriptionRoute(f.input(SUBSCRIPTION_TOOLS_FRAMING, { ...f.toolTurn, workspace: link })).kind).toBe('Refused');
  // The positive neighbour: the same input with hooks observed on is admitted.
  expect(createClaudeCodeSubscriptionRoute(f.input()).kind).toBe('Success');
  expect(f.commands()).toHaveLength(0);
});

it('admits the tool policy only under an activation bound to it: a conversation activation cannot launch tools', () => {
  const f = fixture();
  expect(() => validateSubscriptionActivation(f.activation(SUBSCRIPTION_CONVERSATION_FRAMING), f.profile, f.model, 1000,
    SUBSCRIPTION_TOOLS_FRAMING)).toThrow(/policy differs/u);
  expect(() => validateSubscriptionActivation(f.activation(SUBSCRIPTION_TOOLS_FRAMING), f.profile, f.model, 1000,
    SUBSCRIPTION_TOOLS_FRAMING)).not.toThrow();
});
