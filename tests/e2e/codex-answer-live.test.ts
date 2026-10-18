// Plan rows #399/#401, the other live half: one answer turn really runs on Codex. The registered
// `codex-cli-subscription` doorway builds its route against the real Codex CLI on this machine and
// returns a Decision the application's own reader accepts — so a root configured for this doorway
// answers on Codex rather than on the doorway that happened to be written first.
//
// Subscription sign-in only: the route passes no API key and sets none. It runs only where the CLI
// and a login home exist; everywhere else it skips rather than asserting an answer it never got.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { canonical, decode } from '../../src/index.js';
import { CODEX_CONVERSATION_FRAMING, CODEX_SUBSCRIPTION_DOORWAY_ID, codexConversationPolicy,
  CODEX_SUBSCRIPTION_VERSION } from '../../src/assembly/production-codex-provider.js';
import { SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionDoorway } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';
import { directExecute } from '../assembly/direct-execute.js';
import { factsFixture, value } from '../facts/fixtures.js';
// @ts-expect-error Physical host JavaScript stays outside pure core.
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';

// The route requires an exact, canonical executable path: a symlink is not the artifact it digests.
const executable = process.env.INSTAR_CODEX_EXECUTABLE === undefined ? null
  : (() => { try { return realpathSync(process.env.INSTAR_CODEX_EXECUTABLE!); } catch { return null; } })();
const loginHome = process.env.INSTAR_CODEX_LOGIN_HOME ?? null;
const model = process.env.INSTAR_CODEX_MODEL ?? 'gpt-5.6-sol';
const ready = executable !== null && existsSync(executable) && loginHome !== null
  && existsSync(join(loginHome, 'auth.json'));
const hash = (v: unknown) => (canonical(v) as { kind: 'Success'; value: { hash: string } }).value.hash;

it.skipIf(!ready)('answers one real operator turn through the registered Codex doorway', async () => {
  const f = factsFixture();
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'codex-live-')));
  const home = join(root, 'home'), configDirectory = join(root, 'codex-home'), workingDirectory = join(root, 'work');
  for (const path of [home, configDirectory, workingDirectory]) mkdirSync(path, { recursive: true, mode: 0o700 });
  copyFileSync(join(loginHome!, 'auth.json'), join(configDirectory, 'auth.json'));
  // The shipped host supplies the profile inspection, realpath and executable digest. `execute` is
  // run directly here: the shipped limit shim refuses on a host whose /bin/sh cannot apply the
  // declared process limit, which would make this a test of the host's shell, not of the doorway.
  const host = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => false });
  const io = { ...host, execute: directExecute };
  const seed = { type: 'ProviderSubscriptionProfile' as const, schemaVersion: 1 as const, reference: 'subscription-login',
    home, configDirectory, workingDirectory, expectedAccount: 'operator-asserted@not-observable.invalid',
    organization: 'operator-asserted-organization', plan: 'pro' as const, executable: executable!,
    artifact: `sha256:${createHash('sha256').update(Buffer.from(io.executableBytes(executable!))).digest('hex')}`,
    version: CODEX_SUBSCRIPTION_VERSION, activationReference: 'activation:codex-live-test',
    loginProfileIdentity: '', managedConfigurationDigest: '' };
  const profile: ProviderSubscriptionProfile = Object.freeze({ ...seed, ...host.inspectSubscriptionProfile(seed) });
  const policy = codexConversationPolicy(model);
  const activation: SubscriptionActivationRecord = { type: 'SubscriptionActivationRecord', schemaVersion: 1,
    reference: profile.activationReference, waiver: 'test-only: this record activates nothing beyond this case',
    p11: 'test-only', reviewedHead: 'test-only', trial: 'session-driver unit live proof',
    baseConfigurationDigest: hash('codex-live-test'), profileDigest: hash(profile), executable: executable!,
    artifact: profile.artifact, version: profile.version, model, invocationPolicyDigest: hash(policy),
    expectedAccount: profile.expectedAccount, observedAccount: profile.expectedAccount, authSource: 'claude.ai',
    operatorAssertion: 'the signed-in ChatGPT account is the agent\'s own; this CLI reports no account',
    assertedAt: 1, observer: 'w4-sessiondriver live proof', observedAt: 2,
    method: 'codex login status plus codex --version, both checked at every call',
    safeCaptureReference: 'tests/preview/codex-recorded-frames.json',
    extraUsage: 'operator-asserted/unobservable', extraUsageReason: 'the Codex CLI reports no charge for a turn',
    subscriptionLimit: 'unobservable', subscriptionLimitReason: 'the Codex CLI reports no remaining allowance here',
    acceptedResiduals: ['the signed-in account is operator-asserted, not observed from the CLI'],
    expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY };
  const ctx = { ...f.ctx.decode, register: { ...f.ctx.decode.register, entries: [...f.ctx.decode.register.entries, 'preview'] } };
  const doorway = subscriptionDoorway(CODEX_SUBSCRIPTION_DOORWAY_ID);
  try {
    doorway.validateActivation(activation, profile, model, Date.now(), CODEX_CONVERSATION_FRAMING);
    const route = value(doorway.create({ provider: doorway.provider, model, route: 'preview-subscription',
      disclosure: 'Subscription preview; charge UNKNOWN',
      credential: value(decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: profile.reference }, ctx)),
      context: { ...ctx, site: f.c.site, preserved: f.c.preserved }, profile, activation, io,
      now: Date.now, active: () => true, resolveProfile: () => profile, framing: CODEX_CONVERSATION_FRAMING,
      adapterEvidenceContract: { reference: profile.activationReference, version: hash(profile),
        ...doorway.contract, successfulFinalReplyReasons: [...doorway.contract.successfulFinalReplyReasons],
        endpoint: profile.loginProfileIdentity, account: profile.expectedAccount,
        credentialReference: profile.reference, controller: 'w4-sessiondriver live proof',
        sourceEvidence: [profile.activationReference], terminalEvidence: profile.activationReference,
        strength: 'attestation', maxMetadataBytes: policy.maxMetadataBytes,
        maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes } }));
    expect(route).toMatchObject({ provider: 'openai', model, automaticRetries: 0 });
    const bindings = { at: 1791051039970, by: { judgment: 'answer', model: 'codex', route: 'preview-subscription' },
      evidence: ['live-proof-evidence'], floor: { type: 'ActionFloor', schemaVersion: 1, actions: ['work'], default: 'work' } };
    const envelope = JSON.stringify({ provider: 'openai', model, route: 'preview-subscription',
      messages: [{ role: 'user', content: 'In one short sentence, what is this preview for?' },
        { role: 'context', content: JSON.stringify({ bindings,
          packet: { now: '2026-10-03T18:10', audience: 'the verified operator',
            sources: [{ text: 'Instar exists to make coherence something an AI cannot lose.', provenance: 'docs/00-the-purpose.md' }],
            history: [] } }) }],
      attachments: [], tools: [], settings: { automaticRetries: 0, maxTokens: policy.maxTokens },
      outputSchema: {}, floor: bindings.floor, evidence: bindings.evidence, point: 'preview', generation: 'live-proof' });
    const observed = await route.invoke(envelope, { operation: 'operation:codex-live', deadline: Date.now() + 400_000,
      timeout: policy.timeout, maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens,
      maxCharge: 0, automaticRetries: 0 });
    expect(observed.state).toBe('complete');
    // The real turn's own identity and usage, reported by the CLI, not inferred.
    expect(observed.providerOperation).toMatch(/^[0-9a-f]{8}-/u);
    expect(observed.usage.outputTokens).toBeGreaterThan(0);
    expect(observed.usage.inputTokens).toBeGreaterThan(0);
    expect(observed.usage.charge).toBe(null);
    const decision = JSON.parse(observed.bytes!);
    expect(decision).toMatchObject({ type: 'Decision', schemaVersion: 1,
      conclusion: { subject: 'preview-stage2-answer', predicate: 'answer-text' } });
    expect(typeof decision.conclusion.value === 'string' ? decision.conclusion.value : decision.conclusion.value.reply)
      .toMatch(/\S/u);
    expect(decision.reason?.value).toBeDefined();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 600_000);
