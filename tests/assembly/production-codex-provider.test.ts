// Rule 30 and plan rows #399/#401: the registered Codex model doorway. Every case below runs the
// EXACT stdout bytes of real Codex turns, recorded live on 2026-10-03 against codex-cli 0.149.1 on
// this account's ChatGPT subscription (tests/preview/codex-recorded-frames.json) — a synthetic frame
// alone would not prove the parser fires on what the CLI actually prints.
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { CODEX_ADMITTED_ITEM_TYPES, CODEX_CONVERSATION_FRAMING, CODEX_CONVERSATION_SYSTEM_PROMPT,
  CODEX_LOGIN_STATUS_STDERR_LINE, CODEX_SUBSCRIPTION_DOORWAY_ID, CODEX_SUBSCRIPTION_VERSION, codexConversationPolicy,
  codexSubscriptionDoorway, codexVersionLine, createCodexSubscriptionRoute, parseCodexEventStream,
  validateCodexActivation } from '../../src/assembly/production-codex-provider.js';
import { SUBSCRIPTION_DOORWAYS, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionDoorway } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { directExecute } from './direct-execute.js';
import { factsFixture, value } from '../facts/fixtures.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const hash = (v: unknown) => (canonical(v) as { kind: 'Success'; value: { hash: string } }).value.hash;
const recorded = JSON.parse(readFileSync('tests/preview/codex-recorded-frames.json', 'utf8')) as {
  recordedAgainst: string; exitCodes: Record<string, number>; streams: Record<string, string> };

it('reads the real recorded streams: a tool-free completed turn answers, a tool-using one and a failed one do not', () => {
  expect(recorded.recordedAgainst).toBe(`codex-cli ${CODEX_SUBSCRIPTION_VERSION}`);
  const ok = parseCodexEventStream(recorded.streams.ok!);
  expect(ok).toMatchObject({ answer: 'OK', terminal: 'turn.completed', malformed: false });
  expect(ok.disallowedItems).toEqual([]);
  // Codex reports fresh and cached input separately; the complete input is their sum (13947+10624+0).
  expect(ok).toMatchObject({ inputTokens: 24571, outputTokens: 5 });
  expect(ok.thread).toMatch(/^[0-9a-f]{8}-/u);
  const decision = parseCodexEventStream(recorded.streams.decision!);
  expect(decision.terminal).toBe('turn.completed');
  expect(JSON.parse(decision.answer!)).toMatchObject({ type: 'Decision',
    conclusion: { subject: 'preview-stage2-answer', value: '4' } });
  // The load-bearing one: `codex exec` always has a shell, so a tool turn cannot be ruled out by a
  // flag. This completed turn ran a real command and is refused on its recorded item type.
  const tool = parseCodexEventStream(recorded.streams.toolUsed!);
  expect(tool.terminal).toBe('turn.completed');
  expect(tool.answer).toBe('hello');
  expect(tool.disallowedItems).toEqual(['command_execution']);
  expect(CODEX_ADMITTED_ITEM_TYPES).toEqual(['agent_message', 'reasoning']);
  const failed = parseCodexEventStream(recorded.streams.turnFailed!);
  expect(failed.terminal).toBe('turn.failed');
  expect(failed.answer).toBe(null);
  expect(failed.disallowedItems).toEqual(['error']);
  expect(failed.failureText).toContain('not supported when using Codex with a ChatGPT account');
  // A failed turn exits non-zero and a completed one exits zero, as recorded.
  expect(recorded.exitCodes).toMatchObject({ ok: 0, decision: 0, toolUsed: 0, turnFailed: 1 });
});

it('treats an unreadable line as malformed and an unknown event as nothing, without inventing an answer', () => {
  const broken = parseCodexEventStream(`{"type":"thread.started","thread_id":"t"}\nnot json\n`);
  expect(broken).toMatchObject({ malformed: true, terminal: 'none', answer: null });
  const unknown = parseCodexEventStream(`${recorded.streams.ok!}{"type":"turn.something.new"}\n`);
  expect(unknown).toMatchObject({ malformed: false, terminal: 'turn.completed', answer: 'OK' });
  expect(parseCodexEventStream('')).toMatchObject({ terminal: 'none', answer: null, inputTokens: null, outputTokens: null });
  // A usage block missing a field is no usage at all, never a partial count treated as complete.
  expect(parseCodexEventStream('{"type":"turn.completed","usage":{"input_tokens":5}}'))
    .toMatchObject({ inputTokens: null, outputTokens: null, terminal: 'turn.completed' });
});

it('is registered as a model doorway beside the Claude one, with its own provider, parser and framings', () => {
  expect(Object.keys(SUBSCRIPTION_DOORWAYS)).toContain(CODEX_SUBSCRIPTION_DOORWAY_ID);
  for (const [id, doorway] of Object.entries(SUBSCRIPTION_DOORWAYS)) expect(doorway.id).toBe(id);
  const codex = subscriptionDoorway(CODEX_SUBSCRIPTION_DOORWAY_ID);
  expect(codex.provider).toBe('openai');
  expect(codex.contract).toMatchObject({ parserReference: 'codex-exec-jsonl-events', terminalReasonField: 'type',
    successfulFinalReplyReasons: ['turn.completed'] });
  expect(codex.conversationFraming).toBe(CODEX_CONVERSATION_FRAMING);
  // No scoped-tool framing: a client cannot borrow the Claude doorway's reviewed tool confinement.
  expect(codex.toolsFraming).toBe(null);
  expect(subscriptionDoorway('claude-code-subscription').provider).toBe('anthropic');
  expect(subscriptionDoorway('claude-code-subscription').toolsFraming).not.toBe(null);
  expect(() => subscriptionDoorway('unregistered-doorway')).toThrow('not registered');
  expect(() => codex.policyFor('gpt-5.6-sol', 'preview-conversation-v1')).toThrow(/framing unsupported/u);
  expect(codex.policyFor('gpt-5.6-sol', CODEX_CONVERSATION_FRAMING).framing).toBe(CODEX_CONVERSATION_FRAMING);
});

it('launches a tool-free, config-free, ephemeral read-only turn on the exact model, and binds its instructions', () => {
  const args = codexConversationPolicy('gpt-5.6-sol').args;
  expect(args.slice(0, 2)).toEqual(['exec', '--json']);
  for (const flag of ['--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--ephemeral'])
    expect(args).toContain(flag);
  expect(args[args.indexOf('--sandbox') + 1]).toBe('read-only');
  expect(args[args.indexOf('--model') + 1]).toBe('gpt-5.6-sol');
  expect(args.at(-1)).toBe('-');
  for (const banned of ['--dangerously-bypass-approvals-and-sandbox', '--add-dir', '--approve-for-me', 'resume'])
    expect(args).not.toContain(banned);
  // `codex exec` has no system-prompt flag, so the instructions ride stdin; the policy field is what
  // binds their text into the digest an activation record is checked against.
  expect(codexConversationPolicy('gpt-5.6-sol').system).toBe(CODEX_CONVERSATION_SYSTEM_PROMPT);
  expect(CODEX_CONVERSATION_SYSTEM_PROMPT).toContain('run no commands, read no files, change nothing, and use no tools');
  expect(CODEX_CONVERSATION_SYSTEM_PROMPT).toContain('"type":"Decision"');
  expect(hash(codexConversationPolicy('gpt-5.6-sol'))).not.toBe(hash(codexConversationPolicy('gpt-5.6-other')));
});

function fixture() {
  const f = factsFixture();
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'codex-doorway-'))); roots.push(root);
  const home = join(root, 'home'), configDirectory = join(root, 'codex-home'), workingDirectory = join(root, 'work');
  for (const path of [home, configDirectory, workingDirectory]) mkdirSync(path, { recursive: true, mode: 0o700 });
  const executable = join(root, 'synthetic-codex.mjs'), report = join(root, 'commands.jsonl');
  let stream = recorded.streams.ok!, exit = 0;
  const source = `#!${process.execPath}\nimport {appendFileSync,readFileSync} from 'node:fs';
    let stdin='';for await(const chunk of process.stdin)stdin+=chunk;
    appendFileSync(${JSON.stringify(report)},JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),stdin,codexHome:process.env.CODEX_HOME??null,keys:Object.keys(process.env).sort()})+'\\n');
    if(process.argv[2]==='--version')process.stdout.write(${JSON.stringify(`${codexVersionLine(CODEX_SUBSCRIPTION_VERSION)}\n`)});
    else if(process.argv[2]==='login')process.stderr.write(${JSON.stringify(`${CODEX_LOGIN_STATUS_STDERR_LINE}\n`)});
    else {const plan=JSON.parse(readFileSync(${JSON.stringify(join(root, 'plan.json'))},'utf8'));process.stdout.write(plan.stream);process.exitCode=plan.exit;}\n`;
  writeFileSync(executable, source); chmodSync(executable, 0o700);
  const plan = () => writeFileSync(join(root, 'plan.json'), JSON.stringify({ stream, exit }));
  plan();
  // The profile inspection, realpath and executable-digest checks come from the shipped host. Its
  // `execute` does not: the shipped limit shim refuses (exit 125) on a host whose /bin/sh cannot
  // apply the declared process limit — correctly, but it would make this case a test of the host's
  // shell rather than of the route. `execute` here honours the same contract: exact executable,
  // closed environment, fixed cwd, stdin, timeout and byte bound.
  const host = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false });
  let authMode: 'chatgpt' | 'apikey' | 'absent' | null = 'chatgpt';
  const physical = { ...host, execute: directExecute, codexAuthMode: () => authMode };
  const seed = { type: 'ProviderSubscriptionProfile' as const, schemaVersion: 1 as const, reference: 'subscription-login',
    home, configDirectory, workingDirectory, expectedAccount: 'synthetic@example.invalid', organization: 'synthetic-organization',
    plan: 'pro' as const, executable, artifact: `sha256:${createHash('sha256').update(source).digest('hex')}`,
    version: CODEX_SUBSCRIPTION_VERSION, activationReference: 'activation:synthetic-codex',
    loginProfileIdentity: '', managedConfigurationDigest: '' };
  const profile: ProviderSubscriptionProfile = Object.freeze({ ...seed, ...host.inspectSubscriptionProfile(seed) });
  const model = 'gpt-5.6-sol';
  const policy = codexConversationPolicy(model);
  const activation = (policyDigest = hash(policy)): SubscriptionActivationRecord => ({ type: 'SubscriptionActivationRecord',
    schemaVersion: 1, reference: profile.activationReference, waiver: 'synthetic-waiver', p11: 'synthetic-p11',
    reviewedHead: 'synthetic-head', trial: 'synthetic-trial', baseConfigurationDigest: hash('synthetic-config'),
    profileDigest: hash(profile), executable, artifact: profile.artifact, version: profile.version, model,
    invocationPolicyDigest: policyDigest, expectedAccount: profile.expectedAccount,
    observedAccount: profile.expectedAccount, authSource: 'claude.ai', operatorAssertion: 'synthetic-assertion',
    assertedAt: 1, observer: 'synthetic-observer', observedAt: 2, method: 'synthetic-observation',
    safeCaptureReference: 'capture:synthetic', extraUsage: 'operator-asserted/unobservable',
    extraUsageReason: 'the Codex CLI reports no account and no charge', subscriptionLimit: 'unobservable',
    subscriptionLimitReason: 'the Codex CLI reports no remaining subscription allowance here',
    acceptedResiduals: ['the signed-in ChatGPT account is operator-asserted, not observed from the CLI'],
    expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY });
  const ctx = { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'preview'] } };
  const input = (overrides: Record<string, unknown> = {}) => ({
    provider: 'openai', model, route: 'preview-subscription', disclosure: 'Subscription preview; charge UNKNOWN',
    credential: value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: profile.reference }, ctx)),
    context: { ...ctx, site: f.c.site, preserved: f.c.preserved }, profile, activation: activation(),
    io: physical, now: () => 1000, active: () => true, resolveProfile: () => profile, framing: CODEX_CONVERSATION_FRAMING,
    adapterEvidenceContract: { reference: profile.activationReference, version: hash(profile),
      parserReference: 'codex-exec-jsonl-events', parserVersion: '1', endpoint: profile.loginProfileIdentity,
      account: profile.expectedAccount, credentialReference: profile.reference, controller: 'synthetic-recorder',
      sourceEvidence: ['synthetic-source'], terminalEvidence: 'synthetic-terminal', terminalReasonField: 'type',
      successfulFinalReplyReasons: ['turn.completed'], strength: 'attestation' as const,
      maxMetadataBytes: policy.maxMetadataBytes, maxRawTerminalBytes: policy.maxRawTerminalBytes,
      maxCaptureBytes: policy.maxCaptureBytes }, ...overrides });
  const bounds = { operation: 'operation:synthetic', deadline: 400000, timeout: 5000, maxOutputBytes: policy.maxOutputBytes,
    maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 as const };
  return { root, profile, model, policy, activation, input, bounds, workingDirectory, configDirectory,
    io: physical, authMode: (mode: 'chatgpt' | 'apikey' | 'absent' | null) => { authMode = mode; },
    serve: (name: string, code = recorded.exitCodes[name] ?? 0) => { stream = recorded.streams[name]!; exit = code; plan(); },
    serveText: (text: string, code: number) => { stream = text; exit = code; plan(); },
    commands: () => { try { return readFileSync(report, 'utf8').trim().split('\n').map(line => JSON.parse(line)); } catch { return []; } } };
}

it('answers from a real completed turn: version and sign-in preflights first, then the model command on stdin', async () => {
  const f = fixture();
  const route = value(createCodexSubscriptionRoute(f.input()));
  const observed = await route.invoke('{"question":"wc"}', f.bounds);
  expect(observed).toMatchObject({ state: 'complete', bytes: 'OK',
    usage: { inputTokens: 24571, outputTokens: 5, charge: null, inputComplete: true } });
  const commands = f.commands();
  expect(commands.map(c => c.args[0])).toEqual(['--version', 'login', 'exec']);
  expect(commands[1].args).toEqual(['login', 'status']);
  expect(commands[2].args).toEqual([...f.policy.args]);
  // The instructions ride stdin ahead of the envelope, because the CLI takes no system prompt.
  expect(commands[2].stdin).toBe(`${CODEX_CONVERSATION_SYSTEM_PROMPT}\n\n{"question":"wc"}`);
  // Subscription sign-in only: no API key is passed and none is set, so a metered key cannot be spent.
  expect(commands[2].keys).toEqual(['CODEX_HOME', 'HOME', 'PATH']);
  expect(commands[2].codexHome).toBe(f.configDirectory);
  expect(commands.map(c => c.cwd)).toEqual([f.workingDirectory, f.workingDirectory, f.workingDirectory]);
});

it('refuses a completed turn that used a tool, and reports a failed turn as rejected with its own reason', async () => {
  const f = fixture();
  f.serve('toolUsed');
  const tooled = await value(createCodexSubscriptionRoute(f.input())).invoke('{"question":"wc"}', f.bounds);
  // The turn completed and carried an answer; it is still refused, because the run did something
  // the answer does not account for.
  expect(tooled).toMatchObject({ state: 'rejected', bytes: null });
  f.serve('turnFailed');
  const failed = await value(createCodexSubscriptionRoute(f.input())).invoke('{"question":"wc"}', f.bounds);
  expect(failed.state).toBe('rejected');
  f.serve('ok');
  // The positive neighbour on the same fixture: a tool-free completed turn still answers.
  expect(await value(createCodexSubscriptionRoute(f.input())).invoke('{"question":"wc"}', f.bounds))
    .toMatchObject({ state: 'complete', bytes: 'OK' });
});

it('keeps an unexplained outcome uncertain, and reads a failed turn from its event rather than its exit code', async () => {
  const f = fixture();
  // A turn whose stream says completed but whose process exited non-zero is a contradiction, so it
  // stays uncertain instead of being answered from a stream the process disowned.
  f.serve('ok', 1);
  expect((await value(createCodexSubscriptionRoute(f.input())).invoke('{"q":1}', f.bounds)).state).toBe('uncertain');
  // No terminal event at all: nothing to classify, so nothing is claimed.
  f.serveText('{"type":"thread.started","thread_id":"t"}\n{"type":"turn.started"}\n', 0);
  expect((await value(createCodexSubscriptionRoute(f.input())).invoke('{"q":1}', f.bounds)).state).toBe('uncertain');
  // A completed turn with an unreadable line is refused, never answered past the part that parsed.
  f.serveText(`${recorded.streams.ok!}not json\n`, 0);
  expect((await value(createCodexSubscriptionRoute(f.input())).invoke('{"q":1}', f.bounds)).state).toBe('rejected');
  // turn.failed with a zero exit is still the provider's own reason: rejected, not hidden behind the code.
  f.serve('turnFailed', 0);
  expect((await value(createCodexSubscriptionRoute(f.input())).invoke('{"q":1}', f.bounds)).state).toBe('rejected');
  // A withdrawn activation refuses before any command runs.
  const g = fixture();
  expect(createCodexSubscriptionRoute(g.input({ active: () => false })).kind).toBe('Refused');
  expect(g.commands()).toHaveLength(0);
});

it('admits an activation only for this doorway: its CLI version, its model shape, its policy digest', () => {
  const f = fixture();
  expect(() => validateCodexActivation(f.activation(), f.profile, f.model, 1000, CODEX_CONVERSATION_FRAMING)).not.toThrow();
  expect(() => validateCodexActivation(f.activation('sha256:other'), f.profile, f.model, 1000, CODEX_CONVERSATION_FRAMING))
    .toThrow(/policy differs/u);
  // A Claude model id cannot run through the Codex doorway, and the reverse is already refused.
  expect(() => validateCodexActivation({ ...f.activation(), model: 'claude-sonnet-5' }, f.profile, 'claude-sonnet-5', 1000,
    CODEX_CONVERSATION_FRAMING)).toThrow(/exact model absent/u);
  expect(() => validateCodexActivation({ ...f.activation(), version: '0.0.0' }, f.profile, f.model, 1000,
    CODEX_CONVERSATION_FRAMING)).toThrow(/artifact or policy differs/u);
  expect(() => validateCodexActivation(f.activation(), f.profile, f.model, SUBSCRIPTION_PREVIEW_EXPIRY + 1,
    CODEX_CONVERSATION_FRAMING)).toThrow(/expired or clock differs/u);
  expect(() => validateCodexActivation({ ...f.activation(), acceptedResiduals: [] }, f.profile, f.model, 1000,
    CODEX_CONVERSATION_FRAMING)).toThrow(/residuals absent/u);
  // The doorway's own validator is the one the registry hands out.
  expect(() => codexSubscriptionDoorway().validateActivation(f.activation(), f.profile, f.model, 1000,
    CODEX_CONVERSATION_FRAMING)).not.toThrow();
});

it('refuses a changed executable, a changed profile and a provider this doorway does not serve', () => {
  const f = fixture();
  expect(createCodexSubscriptionRoute(f.input({ profile: { ...f.profile, artifact: 'sha256:changed' } })).kind).toBe('Refused');
  expect(createCodexSubscriptionRoute(f.input({ profile: { ...f.profile, loginProfileIdentity: 'changed' } })).kind).toBe('Refused');
  expect(createCodexSubscriptionRoute(f.input({ provider: 'anthropic' })).kind).toBe('Refused');
  expect(createCodexSubscriptionRoute(f.input()).kind).toBe('Success');
});

it('spends a subscription or nothing: an API-key login, no login, and an unknown sign-in all refuse', async () => {
  const f = fixture();
  // `codex login status` exits 0 for a subscription AND for an API key, and says which only on
  // stderr, so the exit code alone cannot keep this promise. The auth-mode observation does.
  expect(CODEX_LOGIN_STATUS_STDERR_LINE).toBe('Logged in using ChatGPT');
  for (const mode of ['apikey', 'absent', null] as const) {
    f.authMode(mode);
    expect(createCodexSubscriptionRoute(f.input()).kind).toBe('Refused');
  }
  // A host that cannot make the observation at all refuses too: unknown is not subscription.
  f.authMode('chatgpt');
  expect(createCodexSubscriptionRoute(f.input({ io: { ...f.io, codexAuthMode: undefined } })).kind).toBe('Refused');
  expect(createCodexSubscriptionRoute(f.input()).kind).toBe('Success');
  // The sign-in is re-read at every call, not only at construction.
  const live = value(createCodexSubscriptionRoute(f.input()));
  f.authMode('apikey');
  expect((await live.invoke('{"q":1}', f.bounds)).state).toBe('uncertain');
  expect(f.commands()).toHaveLength(0);
});
