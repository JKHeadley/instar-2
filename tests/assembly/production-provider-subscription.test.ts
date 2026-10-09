import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, subscriptionInvocationPolicy, subscriptionConversationPolicy,
  SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT,
  SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT, SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY,
  SUBSCRIPTION_THINKING_ENV, subscriptionActivationEndAllowed, subscriptionPolicyFor,
  validateSubscriptionActivation, subscriptionDoorway, subscriptionSessionPolicy, claudeSubscriptionStatusAccepted } from '../../src/assembly/production-provider.js';
import { SESSION_WORK_RESIDUAL } from '../../src/assembly/production-session-work.js';
import type { SubscriptionActivationRecord } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture, value } from '../facts/fixtures.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const hash = (value: unknown) => canonical(value).kind === 'Success' ?
  (canonical(value) as { kind: 'Success'; value: { hash: string } }).value.hash : '';
function fixture(options: { descriptor?: boolean; status?: object; terminal?: string; pending?: boolean; resultBytes?: number; rawBytes?: number; tokens?: number; invalidUtf8?: boolean; malformedAuth?: boolean; conversation?: boolean } = {}) {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'subscription-offline-'))); roots.push(root);
  const home = join(root, 'home'), configDirectory = join(root, 'config'), workingDirectory = join(root, 'work');
  for (const path of [home, configDirectory, workingDirectory]) mkdirSync(path, { mode: 0o700 });
  const executable = join(root, 'synthetic-cli.mjs');
  const report = join(root, 'commands.jsonl');
  const status = { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', analyticsDisabled: true,
    projectsDirectory: `${configDirectory}/projects`, configDirectory, email: 'synthetic@example.invalid',
    orgId: 'synthetic-organization', orgName: 'synthetic', subscriptionType: 'max', ...options.status };
  // A descriptor login (the host hands the CLI its token): the CLI reports that and nothing of an account.
  const reported = options.descriptor ? { loggedIn: true, authMethod: 'oauth_token', apiProvider: 'firstParty', analyticsDisabled: false,
    projectsDirectory: `${configDirectory}/projects`, configDirectory, ...options.status } : status;
  const answer = JSON.stringify({ ...f.decisionInput(), conclusion: { ...f.decisionInput().conclusion, subject: 'preview-stage2-answer', predicate: 'answer-text', value: 'café <世界> &' } });
  const result = options.resultBytes ? answer + ' '.repeat(options.resultBytes - Buffer.byteLength(answer)) : answer;
  const terminal = options.terminal ?? JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result,
    session_id: 'synthetic-call', usage: { input_tokens: 10, output_tokens: options.tokens ?? 20 }, total_cost_usd: 1.25 });
  const frame = options.rawBytes ? terminal + ' '.repeat(options.rawBytes - Buffer.byteLength(terminal)) : terminal;
  const raw = options.invalidUtf8 ? Buffer.from([0xff, 0xfe]) : Buffer.from(frame);
  const source = `#!${process.execPath}\nimport {appendFileSync} from 'node:fs';
    let stdin='';for await(const chunk of process.stdin)stdin+=chunk;
    appendFileSync(${JSON.stringify(report)},JSON.stringify({args:process.argv.slice(2),env:process.env,cwd:process.cwd(),stdin})+'\\n');
    if(process.argv[2]==='--version')process.stdout.write('2.1.280 (Claude Code)\\n');
    else if(process.argv[2]==='auth')process.stdout.write(${JSON.stringify(options.malformedAuth ? '{' : JSON.stringify(reported))});
    else if(process.argv.slice(2).filter(v=>v==='--system-prompt').length!==1 || process.argv[process.argv.indexOf('--system-prompt')+1]!==${JSON.stringify(options.conversation ? SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT : SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT)})process.exit(42);
    else ${options.pending ? 'setInterval(()=>{},1000)' : `process.stdout.write(Buffer.from(${JSON.stringify(raw.toString('base64'))},'base64'))`};\n`;
  writeFileSync(executable, source); chmodSync(executable, 0o700);
  let active = true;
  const physical = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => !active });
  const launched: Record<string, string>[] = [];
  const io = { ...physical, ...(options.descriptor ? { descriptorLogin: true as const } : {}),
    execute: (input: any) => { launched.push(input.env); return physical.execute(input); } };
  const seed = { type: 'ProviderSubscriptionProfile' as const, schemaVersion: 1 as const, reference: 'subscription-login',
    home, configDirectory, workingDirectory, expectedAccount: status.email, organization: status.orgId, plan: 'max' as const,
    executable, artifact: `sha256:${createHash('sha256').update(source).digest('hex')}`, version: '2.1.280',
    activationReference: 'activation:synthetic', loginProfileIdentity: '', managedConfigurationDigest: '' };
  const profile: ProviderSubscriptionProfile = Object.freeze({ ...seed, ...io.inspectSubscriptionProfile(seed) });
  const model = 'claude-synthetic-exact-1';
  const activation: SubscriptionActivationRecord = { type: 'SubscriptionActivationRecord', schemaVersion: 1,
    reference: profile.activationReference, waiver: 'synthetic-waiver', p11: 'synthetic-p11', reviewedHead: 'synthetic-head',
    trial: 'synthetic-trial', baseConfigurationDigest: hash('synthetic-config'), profileDigest: hash(profile),
    executable, artifact: profile.artifact, version: profile.version, model,
    invocationPolicyDigest: hash(options.conversation ? subscriptionConversationPolicy(model) : subscriptionInvocationPolicy(model)), expectedAccount: profile.expectedAccount,
    observedAccount: profile.expectedAccount, authSource: 'claude.ai', operatorAssertion: 'synthetic-disabled-extra-usage-assertion',
    assertedAt: 1, observer: 'synthetic-observer', observedAt: 2, method: 'synthetic-observation', safeCaptureReference: 'capture:synthetic',
    extraUsage: 'operator-asserted/unobservable', extraUsageReason: 'Synthetic account datum unavailable; assertion is actual basis',
    subscriptionLimit: 'unobservable', subscriptionLimitReason: 'Synthetic limit unavailable',
    acceptedResiduals: ['unconfined supervised preview', 'charge and quiescence unknown'], expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY };
  let resolves = 0;
  const input = { provider: 'anthropic', model, route: 'subscription-preview', disclosure: 'supervised unconfined preview',
    credential: value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: profile.reference },
      { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'preview'] } })),
    context: { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'preview'] },
      site: f.c.site, preserved: f.c.preserved }, profile, activation, io, now: () => 1000, active: () => active,
    resolveProfile: () => { resolves++; return profile; },
    ...(options.conversation ? { framing: SUBSCRIPTION_CONVERSATION_FRAMING as typeof SUBSCRIPTION_CONVERSATION_FRAMING } : {}), adapterEvidenceContract: {
      reference: activation.reference, version: activation.profileDigest, parserReference: 'claude-code-json-result', parserVersion: '1',
      endpoint: profile.loginProfileIdentity, account: profile.expectedAccount, credentialReference: profile.reference,
      controller: 'synthetic-recorder', sourceEvidence: ['synthetic-source'], terminalEvidence: 'synthetic-terminal',
      terminalReasonField: 'subtype', successfulFinalReplyReasons: ['success'], strength: 'observation' as const,
      maxMetadataBytes: 8192, maxRawTerminalBytes: 65536, maxCaptureBytes: 1048576 } };
  const bounds = { operation: 'operation:synthetic', deadline: 200000, timeout: 2000,
    maxOutputBytes: 16384, maxTokens: 2048, maxCharge: 0, automaticRetries: 0 as const };
  return { root, input, bounds, frame, answer, launched, resolves: () => resolves, stop: () => { active = false; },
    commands: () => { try { return readFileSync(report, 'utf8').trim().split('\n').map(line => JSON.parse(line)); } catch { return []; } } };
}

it('spawns the synthetic subscription CLI with exact bytes, args and allowlisted env; raw positive cost remains unknown', async () => {
  const f = fixture(); const route = value(createClaudeCodeSubscriptionRoute(f.input));
  const observed = await route.invoke('{"exact":"question 世界"}', f.bounds);
  expect(observed).toMatchObject({ state: 'complete', bytes: f.answer, usage: { charge: null }, retryBlocked: false });
  expect(observed.responseEvidenceDraft?.terminal.rawBase64).toBe(Buffer.from(f.frame).toString('base64'));
  expect(f.resolves()).toBe(1); expect(Object.isFrozen(route.custodyProof)).toBe(true);
  const commands = f.commands(); expect(commands).toHaveLength(3);
  expect(commands[2].args).toEqual(subscriptionInvocationPolicy(f.input.model).args);
  expect(commands[0].args).toEqual(['--version']); expect(commands[1].args).toEqual(['auth', 'status', '--json']);
  expect(commands[2].args.filter((arg: string) => arg === '--system-prompt')).toHaveLength(1);
  expect(commands[2].args[commands[2].args.indexOf('--system-prompt') + 1]).toBe(SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT);
  expect(commands[2].stdin).toBe('{"exact":"question 世界"}');
  expect(Object.keys(f.launched[2]!).sort()).toEqual(['PATH', 'HOME', 'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_MAX_RETRIES',
    'CLAUDE_CODE_MAX_OUTPUT_TOKENS', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'MAX_THINKING_TOKENS'].sort());
  expect(Object.keys(commands[2].env).filter(key => key !== '__CF_USER_TEXT_ENCODING').sort()).toEqual(Object.keys(f.launched[2]!).sort());
  expect(commands[0].env).toEqual(commands[2].env); expect(commands[1].env).toEqual(commands[2].env);
  expect(commands[2].args).not.toContain('--max-budget-usd'); expect(commands[2].args).not.toContain('--bare');
});

// Live 2026-09-27: answer calls reached 8192 output tokens (thinking included) and
// were held. MAX_THINKING_TOKENS=0 is the pinned CLI's env-only thinking-off control.
// The conversation digest is int11's policy (reviewer-compact-call and related fields);
// the live frozen14 build pins sha256:557a62fa…, so an int11 switch needs a new record.
const RECORDED_DIGESTS = { 'preview-decision-system-v2': 'sha256:234293e8e209f210b23cdcf5322202065766dfe64f532f85bbea69486c0260b4',
  // 2026-10-04 flat answer protocol (plan #491: the runner builds the Decision); its predecessor sha256:aced65e6…
  // (the 2026-09-28 declaration-slot prompt, itself after efe69876…) needs a policy-successor record.
  [SUBSCRIPTION_CONVERSATION_FRAMING]: 'sha256:5817ae4bda9396f7f27a957b287c97b4965322128a03c401bc415166594e2255' } as const;
for (const conversation of [false, true]) it(`sends thinking off on the ${conversation ? 'conversation' : 'decision'} framing, args unchanged`, async () => {
  const f = fixture({ conversation });
  expect((await value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', f.bounds)).state).toBe('complete');
  const model = f.commands().filter(row => row.args.includes('--print'));
  expect(model).toHaveLength(1);
  expect(model[0].env.MAX_THINKING_TOKENS).toBe('0'); expect(f.launched.at(-1)!.MAX_THINKING_TOKENS).toBe('0');
  expect(model[0].env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe('2048');
  expect(model[0].args).toEqual((conversation ? subscriptionConversationPolicy : subscriptionInvocationPolicy)(f.input.model).args);
  expect(model[0].args.some((arg: string) => /thinking|effort/iu.test(arg))).toBe(false);
});
it('keeps both recorded activation policy digests; a policy-borne thinking field would void the activation', () => {
  const f = fixture({ conversation: true }), model = 'claude-sonnet-5';
  for (const [framing, digest] of Object.entries(RECORDED_DIGESTS)) {
    const { policy } = subscriptionPolicyFor(model, framing as keyof typeof RECORDED_DIGESTS);
    expect(hash(policy)).toBe(digest);
    expect(Object.keys(policy)).not.toContain('MAX_THINKING_TOKENS');
    expect(hash({ ...policy, ...SUBSCRIPTION_THINKING_ENV })).not.toBe(digest);
  }
  const live = { ...f.input.activation, model, invocationPolicyDigest: RECORDED_DIGESTS[SUBSCRIPTION_CONVERSATION_FRAMING] };
  expect(() => validateSubscriptionActivation(live, f.input.profile, model, 1000, SUBSCRIPTION_CONVERSATION_FRAMING)).not.toThrow();
  const moved = { ...live, invocationPolicyDigest: hash({ ...subscriptionConversationPolicy(model), ...SUBSCRIPTION_THINKING_ENV }) };
  expect(() => validateSubscriptionActivation(moved, f.input.profile, model, 1000, SUBSCRIPTION_CONVERSATION_FRAMING))
    .toThrow(/policy differs/u);
});
it('requires recorded cap authority to dispatch a conversation prompt above 32 KB', async () => {
  const f = fixture({ conversation: true }), bytes = 'x'.repeat(40000);
  expect((await value(createClaudeCodeSubscriptionRoute(f.input)).invoke(bytes, f.bounds)).state).toBe('uncertain');
  expect(f.commands()).toHaveLength(0);
  expect(createClaudeCodeSubscriptionRoute({ ...f.input, raisedPromptBytes: 131072 }).kind).toBe('Refused');
  expect(createClaudeCodeSubscriptionRoute({ ...f.input, raisedPromptBytes: 1048577,
    promptAuthority: 'Justin recorded cap frame' }).kind).toBe('Refused');
  const route = value(createClaudeCodeSubscriptionRoute({ ...f.input, raisedPromptBytes: 131072,
    promptAuthority: 'Justin recorded cap frame' }));
  expect((await route.invoke(bytes, f.bounds)).state).toBe('complete');
  expect(f.commands().at(-1)?.stdin).toBe(bytes);
});
for (const status of [{ loggedIn: false }, { authMethod: 'api_key' }, { authMethod: 'oauth_token' },
  { apiProvider: 'bedrock' }, { apiKeySource: 'ANTHROPIC_API_KEY' }, { subscriptionType: 'console' },
  { configDirectory: '/different-profile' }, { extra: 'unknown-output' }]) it(`refuses status ${JSON.stringify(status)} before model dispatch`, async () => {
  const f = fixture({ status });
  expect((await value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', f.bounds)).state).toBe('uncertain');
  expect(f.commands().some(row => row.args.includes('--print'))).toBe(false);
});
for (const terminal of ['{}', '{}\n{}', '{', JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true }),
  JSON.stringify({ type: 'result', subtype: 'tool_use', is_error: false }), 'x'.repeat(65537)])
  it('retains uncertainty without retry for an invalid, limited or extra terminal frame', async () => {
    const f = fixture({ terminal });
    expect((await value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', f.bounds)).state).toBe('uncertain');
    expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(1);
  });
it('refuses contradicted/expired activation, changed artifact, wrong account, string custody and substituted descriptor', () => {
  const f = fixture();
  for (const input of [
    { ...f.input, activation: { ...f.input.activation, extraUsage: 'contradicted' as const } },
    { ...f.input, activation: { ...f.input.activation, subscriptionLimit: 'exhausted' as const } },
    { ...f.input, now: () => SUBSCRIPTION_PREVIEW_EXPIRY },
    { ...f.input, activation: { ...f.input.activation, observedAccount: 'other' } },
    { ...f.input, resolveProfile: () => 'API_KEY' as unknown as ProviderSubscriptionProfile },
    { ...f.input, resolveProfile: () => Object.freeze({ ...f.input.profile }) },
  ]) expect(createClaudeCodeSubscriptionRoute(input).kind).toBe('Refused');
  writeFileSync(f.input.profile.executable, 'changed');
  expect(createClaudeCodeSubscriptionRoute(f.input).kind).toBe('Refused'); expect(f.commands()).toHaveLength(0);
});
// Rules 2 and 115: the custodian's frozen-descriptor check is the one that kept the shipped self-host
// command away from its own doorway when the command handed over a plain `JSON.parse` result. Both arms
// are stated here so a later repair of that command cannot be mistaken for loosening this check.
it('admits a frozen host-owned descriptor and refuses the same descriptor unfrozen, with no dispatch', () => {
  const f = fixture();
  expect(createClaudeCodeSubscriptionRoute(f.input).kind).toBe('Success');
  const mutable = { ...f.input.profile } as ProviderSubscriptionProfile;
  expect(Object.isFrozen(mutable)).toBe(false);
  expect(createClaudeCodeSubscriptionRoute({ ...f.input, profile: mutable, resolveProfile: () => mutable }).kind).toBe('Refused');
  expect(f.commands()).toHaveLength(0);
});
it('refuses managed helpers and path swaps before dispatch', async () => {
  const f = fixture(); const route = value(createClaudeCodeSubscriptionRoute(f.input));
  writeFileSync(join(f.input.profile.configDirectory, 'managed-settings.json'), JSON.stringify({ apiKeyHelper: 'never-run' }));
  expect((await route.invoke('request', f.bounds)).state).toBe('uncertain'); expect(f.commands()).toHaveLength(0);
  rmSync(join(f.input.profile.configDirectory, 'managed-settings.json'));
  const original = readFileSync(f.input.profile.executable); const other = join(f.root, 'substitute'); writeFileSync(other, original);
  rmSync(f.input.profile.executable); symlinkSync(other, f.input.profile.executable);
  expect((await route.invoke('request', f.bounds)).state).toBe('uncertain'); expect(f.commands()).toHaveLength(0);
});
it('bounds a pending physical child and never retries', async () => {
  const f = fixture({ pending: true });
  expect((await value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', { ...f.bounds, timeout: 100 })).state).toBe('uncertain');
  expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(1);
});

for (const size of [16384, 16385]) it(`checks extracted Decision ${size} at the byte boundary independently of schema`, async () => {
  const f = fixture({ resultBytes: size });
  const observation = await value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', f.bounds);
  expect(observation.state).toBe(size === 16384 ? 'complete' : 'rejected');
  if (size === 16384) { expect(Buffer.byteLength(observation.bytes!)).toBe(size); expect(JSON.parse(observation.bytes!).type).toBe('Decision'); }
  expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(1);
});
for (const size of [65536, 65537]) it(`checks complete raw terminal ${size} without accepting a clipped prefix`, async () => {
  const f = fixture({ rawBytes: size });
  const observation = await value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', f.bounds);
  expect(observation.state).toBe(size === 65536 ? 'complete' : 'uncertain');
  if (size === 65536) expect(Buffer.from(observation.responseEvidenceDraft!.terminal.rawBase64, 'base64').length).toBe(size);
  expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(1);
});
for (const tokens of [2048, 2049]) it(`enforces ${tokens} observed output tokens`, async () => {
  const f = fixture({ tokens });
  const observed = await value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', f.bounds);
  expect(observed.state).toBe(tokens === 2048 ? 'complete' : 'uncertain');
  expect(observed.usage.outputTokens).toBe(tokens);
  expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(1);
});
it('keeps available usage on uncertain conversation results and leaves unavailable usage null', async () => {
  for (const [terminal, outputTokens] of [
    [JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'candidate',
      session_id: 'synthetic-call', usage: { input_tokens: 10, output_tokens: 2049 } }), 2049],
    [JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: false,
      session_id: 'synthetic-call', usage: { input_tokens: 10, output_tokens: 2048 } }), 2048],
    [JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'candidate',
      session_id: 'synthetic-call', usage: { input_tokens: 10, output_tokens: -1 } }), null],
    ['{', null],
  ] as const) {
    const f = fixture({ conversation: true, terminal });
    const observed = await value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', f.bounds);
    expect(observed.state).toBe('uncertain');
    expect(observed.usage.outputTokens).toBe(outputTokens);
    expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(1);
  }
});
it('refuses invalid UTF-8 and malformed auth JSON with bounded uncertain outcomes', async () => {
  for (const options of [{ invalidUtf8: true }, { malformedAuth: true }]) {
    const f = fixture(options);
    expect((await value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', f.bounds)).state).toBe('uncertain');
    expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(options.invalidUtf8 ? 1 : 0);
  }
});
it('admits 4096 combined prompt bytes with unchanged stdin and refuses 4097 before even a probe', async () => {
  for (const size of [4096, 4097]) {
    const f = fixture(), bytes = '世界"\n' + 'x'.repeat(size - Buffer.byteLength(SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT) - Buffer.byteLength('世界"\n'));
    const observation = await value(createClaudeCodeSubscriptionRoute(f.input)).invoke(bytes, f.bounds);
    expect(observation.state).toBe(size === 4096 ? 'complete' : 'uncertain');
    if (size === 4096) expect(f.commands()[2].stdin).toBe(bytes); else expect(f.commands()).toHaveLength(0);
  }
});
it('refuses a changed auth account, parent-environment injection, or insufficient owner time without fallback', async () => {
  const f = fixture();
  const previous = process.env.ANTHROPIC_API_KEY;
  try {
    process.env.ANTHROPIC_API_KEY = 'synthetic-parent-contamination';
    const route = value(createClaudeCodeSubscriptionRoute(f.input));
    expect((await route.invoke('request', { ...f.bounds, deadline: 1001 })).state).toBe('uncertain');
    expect(f.commands()).toHaveLength(0);
    expect((await route.invoke('request', f.bounds)).state).toBe('complete');
    expect(f.commands()[2].env.ANTHROPIC_API_KEY).toBeUndefined();
    const changed = { ...f.input, io: { ...f.input.io, execute: async (command: any) => {
      const result = await f.input.io.execute(command);
      if (command.args[0] !== 'auth') return result;
      const text = JSON.stringify({ ...JSON.parse(result.stdout), email: 'different@example.invalid' });
      return { ...result, stdout: text, stdoutBytes: new Uint8Array(Buffer.from(text)) };
    } } };
    expect((await value(createClaudeCodeSubscriptionRoute(changed)).invoke('request', f.bounds)).state).toBe('uncertain');
    expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(1);
  } finally { if (previous === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previous; }
});

it('spends preflight time inside the reply-review deadline and dispatches only with time left', async () => {
  for (const preflightMs of [101, 1000, 29950]) {
    const f = fixture({ conversation: true });
    let clock = 1000;
    const input = { ...f.input, now: () => clock, io: { ...f.input.io,
      execute: async (command: any) => {
        const result = await f.input.io.execute(command);
        if (command.args[0] === 'auth') clock += preflightMs;
        return result;
      } } };
    const route = value(createClaudeCodeSubscriptionRoute(input));
    const result = await route.invoke('request', { ...f.bounds, deadline: 31000, timeout: 29900 });
    expect(result.state).toBe(preflightMs < 29950 ? 'complete' : 'uncertain');
    expect(f.commands()).toHaveLength(preflightMs < 29950 ? 3 : 2);
  }
});

it('refuses cached remote/server policy and orphan signature files before any child', async () => {
  for (const name of ['remote-settings.json', 'remote-settings.json.signature.json', 'policy-limits.json.signature-iat.json']) {
    const f = fixture(); const route = value(createClaudeCodeSubscriptionRoute(f.input));
    writeFileSync(join(f.input.profile.configDirectory, name), '{}');
    expect((await route.invoke('request', f.bounds)).state).toBe('uncertain');
    expect(f.commands()).toHaveLength(0);
  }
});
it('stops a pending synthetic physical child and returns UNKNOWN without fallback', async () => {
  const f = fixture({ pending: true });
  const result = value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', { ...f.bounds, timeout: 5000 });
  const timer = setInterval(() => { if (f.commands().some(row => row.args.includes('--print'))) f.stop(); }, 10);
  try { expect((await result).state).toBe('uncertain'); }
  finally { clearInterval(timer); }
  expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(1);
}, 10000);

it('refuses the old invocation policy identity before any child', () => {
  const f = fixture(), policy: any = { ...subscriptionInvocationPolicy(f.input.model) };
  delete policy.framing; delete policy.maxPromptBytes;
  policy.args = policy.args.filter((v: string) => v !== '--system-prompt' && v !== SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT);
  expect(createClaudeCodeSubscriptionRoute({ ...f.input, activation: { ...f.input.activation,
    invocationPolicyDigest: hash(policy) } }).kind).toBe('Refused');
  expect(f.commands()).toHaveLength(0);
  expect(Buffer.byteLength(SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT)).toBe(1424);
});

for (const change of ['missing', 'changed', 'duplicated']) it(`synthetic CLI refuses ${change} system argument without a positive answer`, async () => {
  const f = fixture(), execute = f.input.io.execute;
  const io = { ...f.input.io, execute: (command: any) => {
    if (command.args.includes('--print')) {
      let args = [...command.args]; const index = args.indexOf('--system-prompt');
      if (change === 'missing') args.splice(index, 2);
      if (change === 'changed') args[index + 1] += '!';
      if (change === 'duplicated') args.push('--system-prompt', SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT);
      command = { ...command, args };
    }
    return execute(command);
  } };
  expect((await value(createClaudeCodeSubscriptionRoute({ ...f.input, io })).invoke('request', f.bounds)).state).toBe('uncertain');
  expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(1);
});

// w3-renewal1012 option (b): a record at the predecessor's reviewed end runs only while the journal's current end is that
// end, so a runner on it can propose the renewal; the build alone names both ends, and nothing reads an end from the record.
it('accepts the predecessor end only while the journal is still at it, and the governed end always', () => {
  expect(SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY).toBe(Date.UTC(2026, 9, 12, 20, 40));
  expect(SUBSCRIPTION_PREVIEW_EXPIRY - SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY).toBe(31 * 24 * 3600 * 1000 + 3600 * 1000);
  const P = SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY, G = SUBSCRIPTION_PREVIEW_EXPIRY;
  expect([subscriptionActivationEndAllowed(P, P), subscriptionActivationEndAllowed(P, G), subscriptionActivationEndAllowed(P),
    subscriptionActivationEndAllowed(G, P), subscriptionActivationEndAllowed(G, G), subscriptionActivationEndAllowed(G)])
    .toEqual([true, false, false, true, true, true]);
  // Any other end is refused whatever the journal says, including the journal's own end and the 2026-09-28 end.
  for (const end of [Date.UTC(2026, 8, 28, 20, 40), P - 1, P + 1, G - 1, G + 1, Date.UTC(2026, 9, 19, 20, 40)])
    for (const journal of [undefined, P, G, end]) expect(subscriptionActivationEndAllowed(end, journal)).toBe(false);
  const f = fixture(), { profile, model } = f.input, v5 = { ...f.input.activation, expiresAt: P };
  expect(() => validateSubscriptionActivation(v5, profile, model, 1000, undefined, P)).not.toThrow();
  for (const journal of [G, undefined]) expect(() => validateSubscriptionActivation(v5, profile, model, 1000, undefined, journal))
    .toThrow('subscription activation expired or clock differs');
  // The predecessor end still expires at itself: the journal's end never extends a record past its own end.
  expect(() => validateSubscriptionActivation(v5, profile, model, P, undefined, P)).toThrow('expired or clock differs');
  expect(() => validateSubscriptionActivation({ ...v5, expiresAt: P + 1 }, profile, model, 1000, undefined, P + 1))
    .toThrow('expired or clock differs');
});

it('re-reads the journal end at every call: a predecessor-end route stops dispatching once the renewal lands', async () => {
  const f = fixture(), P = SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY;
  let journalEnd = P;
  const input = { ...f.input, activation: { ...f.input.activation, expiresAt: P }, journalEnd: () => journalEnd };
  expect(createClaudeCodeSubscriptionRoute({ ...f.input, activation: input.activation }).kind).toBe('Refused');
  const route = value(createClaudeCodeSubscriptionRoute(input));
  expect((await route.invoke('request', f.bounds)).state).toBe('complete');
  journalEnd = SUBSCRIPTION_PREVIEW_EXPIRY;                       // the renewal frame applied
  expect((await route.invoke('request', f.bounds)).state).not.toBe('complete');
  expect(f.commands().filter(row => row.args.includes('--print'))).toHaveLength(1);
  expect(createClaudeCodeSubscriptionRoute(input).kind).toBe('Refused');
  // The renewed record runs on the renewed journal (and the governed end is unaffected by the reader).
  expect(createClaudeCodeSubscriptionRoute({ ...input, activation: f.input.activation }).kind).toBe('Success');
});

it('admits Claude session work only under its own reviewed grant and a live subscription sign-in', async () => {
  const f = fixture();
  const session = subscriptionDoorway('claude-code-subscription').session;
  expect(session.framework).toBe('claude-code');
  const { profile, activation, io, model } = f.input as unknown as { profile: ProviderSubscriptionProfile;
    activation: SubscriptionActivationRecord; io: Parameters<typeof session.admit>[0]['io']; model: string };
  const policy = subscriptionSessionPolicy(model);
  expect(policy.launch).toEqual(['--dangerously-skip-permissions', '--model', model]);
  expect(policy).toMatchObject({ confinement: 'admitted-tools', effects: 'effect-doorway', admission: { framing: 'session-admission-v2', allowance: 24 } });
  const grant = { ...activation, invocationPolicyDigest: hash(policy), acceptedResiduals: [SESSION_WORK_RESIDUAL] };
  expect(() => session.validateActivation(grant, profile, model, 1000)).not.toThrow();
  // The answer activation is not a session grant; a grant without the written residual is refused.
  expect(() => session.validateActivation(activation, profile, model, 1000)).toThrow(/policy differs/u);
  expect(() => session.validateActivation({ ...grant, acceptedResiduals: ['other'] }, profile, model, 1000)).toThrow(/admitted-session residual/u);
  await expect(session.admit({ profile, io, deadline: 20_000, now: () => 1000 })).resolves.toBeUndefined();
  await expect(session.admit({ profile: { ...profile, artifact: 'sha256:changed' }, io, deadline: 20_000, now: () => 1000 }))
    .rejects.toThrow(/executable changed/u);
});
for (const status of [{ authMethod: 'api_key' }, { apiKeySource: 'ANTHROPIC_API_KEY' }, { subscriptionType: 'console' }])
  it(`refuses a delegated session on status ${JSON.stringify(status)}`, async () => {
    const f = fixture({ status });
    const { profile, io } = f.input as unknown as { profile: ProviderSubscriptionProfile;
      io: Parameters<ReturnType<typeof subscriptionDoorway>['session']['admit']>[0]['io'] };
    await expect(subscriptionDoorway('claude-code-subscription').session.admit({ profile, io, deadline: 20_000, now: () => 1000 }))
      .rejects.toThrow(/authentication status refused/u);
  });
it('accepts a descriptor login only from a host that declares the hand-off, and only in its exact shape', async () => {
  const handed = fixture({ descriptor: true });
  expect((await value(createClaudeCodeSubscriptionRoute(handed.input)).invoke('request', handed.bounds)).state).toBe('complete');
  // The same CLI report from a host that declares no hand-off is no subscription login.
  const undeclared = fixture({ status: { authMethod: 'oauth_token' } });
  expect((await value(createClaudeCodeSubscriptionRoute(undeclared.input)).invoke('request', undeclared.bounds)).state).toBe('uncertain');
  // A host that hands the login over refuses a stored one (a plain-text login the harness could open) and any other shape.
  for (const status of [{ email: 'synthetic@example.invalid' }, { authMethod: 'claude.ai' }, { loggedIn: false },
    { configDirectory: '/different-profile' }, { apiKeySource: 'ANTHROPIC_API_KEY' }, { apiProvider: 'bedrock' }]) {
    const f = fixture({ descriptor: true, status });
    expect((await value(createClaudeCodeSubscriptionRoute(f.input)).invoke('request', f.bounds)).state).toBe('uncertain');
    expect(f.commands().some(row => row.args.includes('--print'))).toBe(false);
  }
  const stored = fixture();
  const profile = (stored.input as unknown as { profile: ProviderSubscriptionProfile }).profile;
  const claudeAi = { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', analyticsDisabled: true,
    projectsDirectory: `${profile.configDirectory}/projects`, configDirectory: profile.configDirectory, email: profile.expectedAccount,
    orgId: profile.organization, orgName: 'synthetic', subscriptionType: profile.plan };
  expect(claudeSubscriptionStatusAccepted(claudeAi, profile)).toBe(true);
  expect(claudeSubscriptionStatusAccepted(claudeAi, profile, true)).toBe(false);
});
