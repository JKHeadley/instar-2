import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, subscriptionInvocationPolicy, SUBSCRIPTION_PREVIEW_EXPIRY } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { factsFixture, value } from '../facts/fixtures.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const hash = (value: unknown) => canonical(value).kind === 'Success' ?
  (canonical(value) as { kind: 'Success'; value: { hash: string } }).value.hash : '';
function fixture(options: { status?: object; terminal?: string; pending?: boolean } = {}) {
  const f = factsFixture(), root = realpathSync(mkdtempSync(join(tmpdir(), 'subscription-offline-'))); roots.push(root);
  const home = join(root, 'home'), configDirectory = join(root, 'config'), workingDirectory = join(root, 'work');
  for (const path of [home, configDirectory, workingDirectory]) mkdirSync(path, { mode: 0o700 });
  const executable = join(root, 'synthetic-cli.mjs');
  const report = join(root, 'commands.jsonl');
  const status = { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', analyticsDisabled: true,
    projectsDirectory: `${configDirectory}/projects`, configDirectory, email: 'synthetic@example.invalid',
    orgId: 'synthetic-organization', orgName: 'synthetic', subscriptionType: 'max', ...options.status };
  const answer = JSON.stringify({ ...f.decisionInput(), conclusion: { ...f.decisionInput().conclusion, subject: 'preview-stage2-answer', predicate: 'answer-text', value: 'café <世界> &' } });
  const frame = options.terminal ?? JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: answer,
    session_id: 'synthetic-call', usage: { input_tokens: 10, output_tokens: 20 }, total_cost_usd: 1.25 });
  const source = `#!${process.execPath}\nimport {appendFileSync} from 'node:fs';
    let stdin='';for await(const chunk of process.stdin)stdin+=chunk;
    appendFileSync(${JSON.stringify(report)},JSON.stringify({args:process.argv.slice(2),env:process.env,cwd:process.cwd(),stdin})+'\\n');
    if(process.argv[2]==='--version')process.stdout.write('2.1.280 (Claude Code)\\n');
    else if(process.argv[2]==='auth')process.stdout.write(${JSON.stringify(JSON.stringify(status))});
    else ${options.pending ? 'setInterval(()=>{},1000)' : `process.stdout.write(Buffer.from(${JSON.stringify(Buffer.from(frame).toString('base64'))},'base64'))`};\n`;
  writeFileSync(executable, source); chmodSync(executable, 0o700);
  let active = true;
  const physical = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => !active });
  const launched: Record<string, string>[] = [];
  const io = { ...physical, execute: (input: any) => { launched.push(input.env); return physical.execute(input); } };
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
    invocationPolicyDigest: hash(subscriptionInvocationPolicy(model)), expectedAccount: profile.expectedAccount,
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
    resolveProfile: () => { resolves++; return profile; }, adapterEvidenceContract: {
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
  expect(commands[2].stdin).toBe('{"exact":"question 世界"}');
  expect(Object.keys(f.launched[2]!).sort()).toEqual(['PATH', 'HOME', 'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_MAX_RETRIES',
    'CLAUDE_CODE_MAX_OUTPUT_TOKENS', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'].sort());
  expect(Object.keys(commands[2].env).filter(key => key !== '__CF_USER_TEXT_ENCODING').sort()).toEqual(Object.keys(f.launched[2]!).sort());
  expect(commands[0].env).toEqual(commands[2].env); expect(commands[1].env).toEqual(commands[2].env);
  expect(commands[2].args).not.toContain('--max-budget-usd'); expect(commands[2].args).not.toContain('--bare');
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
