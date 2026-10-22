// @ts-nocheck -- desk renewal script and journal CLI are exercised as shipped JavaScript.
import { MEMORY_DISAMBIGUATION } from '../../src/assembly/memory-answer-guidance.js';
import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { productionGroundingSourceDigest } from '../../scripts/check-assembly-contracts.mjs';
import { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  subscriptionInvocationPolicy, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { encoded } from './stage2-provider.js';
import { renewActivation } from './renew-activation.mjs';
import { activationMatchesJournal, openPreviewJournal, renewJournalExpiry } from './journal.js';
import { offlineOperatorMessage, writeOperatorRecords } from './successive-fixture.js';

// Preserve the recorded policy/prompt before the reviewed memory-supersession guidance.
const HISTORICAL_MEMORY = 'If two active memory items match the question but disagree, or refer to different people or things, ask one short clarifying question with a distinguishing detail. Answer directly when the question identifies one; ignore corrected or forgotten items. ';

const PRIOR_EXPIRY = 1791837600000; // 2026-10-12T20:40:00Z, the record being renewed (itself renewed from 2026-09-28).
const PRIOR_COMMIT = 'a735faee'; // live runner-frozen-cint-L33 build.
const NOW = 1790520000000; // 2026-09-27T14:40:00Z, fixed so no assertion reads the host clock.
const model = 'claude-sonnet-5';
const profile = Object.freeze({ type: 'ProviderSubscriptionProfile', schemaVersion: 1, reference: 'preview-s2-profile-test',
  home: '/tmp/h', configDirectory: '/tmp/c', workingDirectory: '/tmp/w', expectedAccount: 'luna@example.invalid',
  organization: 'org', plan: 'max', loginProfileIdentity: 'sha256:identity', executable: '/tmp/claude.exe',
  artifact: 'sha256:artifact', version: '2.1.280', activationReference: 'preview-s2-activation-v2-2026-09-23',
  managedConfigurationDigest: 'sha256:managed' });
const current = { type: 'SubscriptionActivationRecord', schemaVersion: 1, reference: profile.activationReference,
  waiver: 'waiver', p11: 'p11', reviewedHead: 'old head', trial: 'preview-trial:test', baseConfigurationDigest: 'sha256:config',
  profileDigest: encoded(profile).hash, executable: profile.executable, artifact: profile.artifact, version: '2.1.280', model,
  invocationPolicyDigest: encoded(subscriptionConversationPolicy(model)).hash, expectedAccount: profile.expectedAccount,
  observedAccount: profile.expectedAccount, authSource: 'claude.ai', operatorAssertion: 'operator OAuth 2026-09-23',
  assertedAt: 1790211900000, observer: 'old observer', observedAt: 1790218397444, method: 'auth status', safeCaptureReference: 'capture',
  extraUsage: 'observed-disabled', extraUsageReason: 'disabled', subscriptionLimit: 'available', subscriptionLimitReason: 'old reading',
  acceptedResiduals: ['charge and quiescence remain UNKNOWN by design'], expiresAt: PRIOR_EXPIRY };
const currentBytes = JSON.stringify(current, null, 2);
const observation = { reference: profile.activationReference, reviewedHead: 'bl-activation-renewal head', assertedAt: 1790512000000,
  observedAt: 1790512740000, method: 'journal call-outcome diagnostics + pool quota reading', observer: 'echo desk',
  safeCaptureReference: 'status capture', observedAccount: profile.expectedAccount, subscriptionLimit: 'available',
  subscriptionLimitReason: 'pool quota reading: not exhausted' };
const conversation = (record, p = profile, now = NOW) =>
  validateSubscriptionActivation(record, p, model, now, SUBSCRIPTION_CONVERSATION_FRAMING);

it('pins the reviewed expiry and completion policy while keeping expiry out of invocation policies', () => {
  expect(SUBSCRIPTION_PREVIEW_EXPIRY).toBe(Date.UTC(2026, 10, 12, 21, 40));
  expect(SUBSCRIPTION_PREVIEW_EXPIRY - PRIOR_EXPIRY).toBe(31 * 24 * 3600 * 1000 + 3600 * 1000);
  // The brief-rationale wording changes the policy, so existing installations need a policy-successor record.
  // The expiry itself never enters an invocation policy.
  const policy = subscriptionConversationPolicy(model);
  expect(policy.args.join(' ')).toContain(MEMORY_DISAMBIGUATION);
  expect(policy.args.join(' ')).not.toContain(HISTORICAL_MEMORY);
  const historical = { ...policy, args: policy.args.map(arg => arg.replace(MEMORY_DISAMBIGUATION, HISTORICAL_MEMORY).replace('give a brief decision rationale supported by the relevant evidence.', 'do all your reasoning there.')) };
  const historicalDigest = encoded(historical).hash;
  expect(historicalDigest).toBe('sha256:7b1d9af257f848e9cef4abad31771394af1cb4e1b6062a4538d3442a2045f220');
  expect(encoded(policy).hash).not.toBe(historicalDigest);
  expect(() => conversation({ ...current, expiresAt: SUBSCRIPTION_PREVIEW_EXPIRY,
    invocationPolicyDigest: historicalDigest })).toThrow('artifact or policy differs');
