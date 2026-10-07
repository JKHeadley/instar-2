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
  SUBSCRIPTION_TOOL_RUNTIME_READ_LINKS, SUBSCRIPTION_NATIVE_SYSTEM_PROMPT,
  validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord, SubscriptionToolTurn } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture, value } from '../facts/fixtures.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
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
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toMatch(/go through the effect doorway: one runs once the operator registers and grants it, otherwise it is refused/u);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).not.toMatch(/writes \(other methods, git push, publish\) and local addresses are refused/u);
  expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).toMatch(/writes \(other methods, git push, publish\) go to the effect doorway/u);
  expect(SUBSCRIPTION_NATIVE_SYSTEM_PROMPT).toMatch(/one runs once the operator registers and grants it, otherwise it is refused/u);
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain('which tool call, by name and order, produced it');
  expect(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT).toContain('You have no tools and cannot act beyond this answer; never claim otherwise.');
  // Plan #510: the tool route runs without --safe-mode, so Claude Code injects its own account email; the prompt says that
  // login is never the operator (+187, live cint-L50 "Luna"). The bound stays: the tool sentence is still one paragraph.
  // sb-w4-selfdesc: w4-selfdesc's effect-doorway wording lands on top of that +187, so the 1500 bound (not the unit's
  // 1400, which predates +187) is the live one; default-context-floor measures the exact growth.
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT).toContain('is the subscription login running you, never the operator');
  expect(SUBSCRIPTION_TOOLS_SYSTEM_PROMPT.length - SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT.length).toBeLessThan(1600);
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
      denyRead: ['/'], allowRead: ['/r/tool-turns/a-0/vol', ...SUBSCRIPTION_TOOL_RUNTIME_READS, '/var'] } });
  // With the turn's network checkpoint, the one reachable place is its loopback port, and its tools' locations are readable.
  const netted = JSON.parse(subscriptionToolSettings({ ...turn, egress: { port: 40001, reads: ['/usr/local/bin', '/Library/Developer/CommandLineTools'] } }, '/profile/home'));
  expect(netted.sandbox.network).toEqual({ allowedDomains: [], allowUnixSockets: [], allowAllUnixSockets: false, allowLocalBinding: false, httpProxyPort: 40001 });
  expect(netted.sandbox.filesystem.allowRead).toEqual(['/r/tool-turns/a-0/vol', ...SUBSCRIPTION_TOOL_RUNTIME_READS, '/var', '/usr/local/bin', '/Library/Developer/CommandLineTools']);
  expect(settings.sandbox.network.httpProxyPort).toBeUndefined();
  for (const port of [0, 70000, 1.5]) expect(() => subscriptionToolSettings({ ...turn, egress: { port, reads: [] } }, '/profile/home')).toThrow(/egress checkpoint port/u);
  // A tool location may never reopen the runner root, the login home or the admission state.
  expect(() => subscriptionToolSettings({ ...turn, egress: { port: 40001, reads: ['/r'] } }, '/profile/home')).toThrow(/under a readable path/u);
  expect(() => subscriptionToolSettings({ ...turn, egress: { port: 40001, reads: ['/profile'] } }, '/profile/home')).toThrow(/under a readable path/u);
  expect(() => subscriptionToolSettings({ ...turn, egress: { port: 40001, reads: ['/usr/local bin'] } }, '/profile/home')).toThrow(/absolute and plain/u);
  // Nothing in the runtime list holds user, session or runner data, and the host's own configuration is not on it
  // (w4-t2boundary, plan #615: /private/etc left the list, so a tool reads the machinery a command runs on and no more).
  for (const read of SUBSCRIPTION_TOOL_RUNTIME_READS) expect(read).toMatch(/^\/(bin|sbin|usr\/(bin|sbin|lib|libexec|share)|System|private\/var\/select|dev)$/u);
  expect(SUBSCRIPTION_TOOL_RUNTIME_READS).not.toContain('/private/etc');
  // The link spelling reopens only the root-level symlink itself (w4-toolpaths): it resolves on this platform to the
  // directory holding a listed read, so nothing behind it that is not separately listed becomes readable. `/etc` was
  // such an entry while /private/etc was listed; it is not, so neither spelling of the hosts file is reopened.
  expect(SUBSCRIPTION_TOOL_RUNTIME_READ_LINKS).toEqual(['/var']);
  expect(settings.permissions).toEqual({ allow: [...SUBSCRIPTION_TOOL_NAMES] });
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
  // A runner-private directory under a denied root (the harness user's hand-off) is accepted; anywhere else is not.
  expect(() => subscriptionToolSettings({ ...turn, mcp: { config: '/r/tool-turns/a-0/private/mcp.json', servers: ['dummy'] } }, home)).not.toThrow();
  expect(() => subscriptionToolSettings({ ...turn, mcp: { config: '/elsewhere/mcp.json', servers: ['dummy'] } }, home)).toThrow(/MCP configuration/u);
  expect(() => subscriptionToolSettings({ ...turn, hook: { ...turn.hook, script: '/r/tool-turns/a-0/vol/hook.mjs' } }, home)).toThrow(/outside the workspace/u);
  expect(() => subscriptionToolSettings({ ...turn, workspace: '/r/a b/ws' }, home)).toThrow(/absolute and plain/u);
  expect(() => subscriptionToolSettings({ ...turn, workspace: '/r/../ws' }, home)).toThrow(/absolute and plain/u);
  expect(() => subscriptionToolSettings({ ...turn, workspace: '/r/tool-turns/a-0/ws' }, home)).toThrow(/inside its scratch volume/u);
  expect(() => subscriptionToolSettings({ ...turn, deniedRoots: ['/usr/share/runner'] }, home)).toThrow(/under a readable path/u);
  expect(() => subscriptionToolSettings(turn, '/private/var/select/home')).toThrow(/under a readable path/u);
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
    appendFileSync(${JSON.stringify(report)},JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),stdin,tmpdir:process.env.CLAUDE_CODE_TMPDIR??null,
      memory:process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY??null,compact:process.env.DISABLE_AUTO_COMPACT??null})+'\\n');
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
  // No kept session given: the harness persists nothing.
  expect(commands[2].args).toEqual([...subscriptionToolsPolicy(f.model).args, '--settings', subscriptionToolSettings(f.toolTurn, f.profile.home),
    '--no-session-persistence']);
  expect(commands[2].stdin).toBe('{"question":"wc"}');
  // A tool route points the harness's temporary directory at the turn's volume (its preflights share the one environment), and
  // turns off the harness's own memory and its silent compaction.
  expect(commands.map(c => c.tmpdir)).toEqual([f.toolTurn.scratch, f.toolTurn.scratch, f.toolTurn.scratch]);
  expect(commands.map(c => [c.memory, c.compact])).toEqual([['1', '1'], ['1', '1'], ['1', '1']]);
});

it('starts or resumes the kept session the runner names, on the model command only, and refuses a malformed session id', async () => {
  const f = fixture(), id = '0f4c2b1e-8d7a-4c3b-9e2f-1a2b3c4d5e6f';
  for (const resume of [false, true]) {
    const turn = { ...f.toolTurn, session: { id, resume } };
    expect(await value(createClaudeCodeSubscriptionRoute({ ...f.input(), toolTurn: turn })).invoke('{"question":"s"}', f.bounds)).toMatchObject({ state: 'complete' });
  }
  const models = f.commands().filter(c => c.stdin.length > 0);
  expect(models.map(c => c.args.slice(-2))).toEqual([['--session-id', id], ['--resume', id]]);
  for (const c of f.commands().filter(c => c.stdin.length === 0)) expect(c.args).not.toContain(id);
  expect(createClaudeCodeSubscriptionRoute({ ...f.input(), toolTurn: { ...f.toolTurn, session: { id: '--continue', resume: true } } }).kind).toBe('Refused');
});

it('loads the root\'s MCP servers from the admission state for the model command only, never in the digest-bound policy', async () => {
  const f = fixture();
  const config = join(f.stateDirectory, 'mcp.json');
  writeFileSync(config, JSON.stringify({ mcpServers: { dummy: { command: '/usr/bin/true' } } }));
  const turn = { ...f.toolTurn, mcp: { config, servers: ['dummy'] } };
  const route = value(createClaudeCodeSubscriptionRoute({ ...f.input(), toolTurn: turn }));
  expect(await route.invoke('{"question":"mcp"}', f.bounds)).toMatchObject({ state: 'complete' });
  const commands = f.commands();
  expect(commands[2].args).toEqual([...subscriptionToolsPolicy(f.model).args, '--mcp-config', config, '--settings', subscriptionToolSettings(turn, f.profile.home),
    '--no-session-persistence']);
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
