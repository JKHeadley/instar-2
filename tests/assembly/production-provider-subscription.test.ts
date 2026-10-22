import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, createSubscriptionVersionCheck, subscriptionInvocationPolicy, subscriptionConversationPolicy,
  SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT,
  SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT, SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY,
  SUBSCRIPTION_THINKING_ENV, subscriptionActivationEndAllowed, subscriptionPolicyFor,
  validateSubscriptionActivation, subscriptionDoorway, subscriptionSessionPolicy, claudeSubscriptionStatusAccepted } from '../../src/assembly/production-provider.js';
import { SESSION_WORK_RESIDUAL } from '../../src/assembly/production-session-work.js';
import { CODEX_SUBSCRIPTION_VERSION, codexSessionPolicy } from '../../src/assembly/production-codex-provider.js';
import type { ProductionProviderIO, SubscriptionActivationRecord } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture, value } from '../facts/fixtures.js';
import { providerFixture, refused } from '../model-provider/fixture.js';
import { observationCheck } from '../../src/judgment/model-adapter.js';
import thinkingCapture from '../preview/fixtures/thinking-floor-opus-2026-10-20.json' with { type: 'json' };
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const hash = (value: unknown) => canonical(value).kind === 'Success' ?
  (canonical(value) as { kind: 'Success'; value: { hash: string } }).value.hash : '';
function fixture(options: { descriptor?: boolean; status?: object; terminal?: string; pending?: boolean; resultBytes?: number; rawBytes?: number; tokens?: number; thinking?: unknown; invalidUtf8?: boolean; malformedAuth?: boolean; conversation?: boolean } = {}) {
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
    session_id: 'synthetic-call', usage: { input_tokens: 10, output_tokens: options.tokens ?? 20,
      ...(options.thinking === undefined ? {} : { output_tokens_details: { thinking_tokens: options.thinking } }) }, total_cost_usd: 1.25 });
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
const CURRENT_DIGESTS = { 'preview-decision-system-v2': 'sha256:ddf74607ea84a54ad11e7db935e7516d8a4bad0065087402afdc2ecec334e074',
  // 2026-10-21 shared supersession guidance; activation requires a verified policy successor.
  [SUBSCRIPTION_CONVERSATION_FRAMING]: 'sha256:e37f3dc22da0ed80e8eb69bc5be320babb6586f3a72b47474a8fafc41763f0d1' } as const;
