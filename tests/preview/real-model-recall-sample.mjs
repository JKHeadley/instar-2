#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { createSubscriptionProviderIO } from '../../scripts/production-boot-io.mjs';
import { createClaudeCodeSubscriptionRoute, SUBSCRIPTION_CONVERSATION_FRAMING,
  subscriptionConversationPolicy, validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { installRecallStopSignals, runRealModelRecallSample } from './real-model-recall-sample.ts';

const flags = process.argv.slice(2);
const live = flags.includes('--live');
const value = name => { const index = flags.indexOf(`--${name}`); return index < 0 ? null : flags[index + 1] ?? null; };
const profilePath = value('login-profile');
if (!live || !profilePath) {
  process.stdout.write('SKIP real model recall sample: supply --live and --login-profile.\n');
} else {
  const activationPath = value('activation-record'), output = value('output');
  if (!activationPath || !output || !isAbsolute(output) || existsSync(output))
    throw Error('recall sample: require --activation-record and a new absolute --output path');
  const profile = Object.freeze(JSON.parse(readFileSync(realpathSync(profilePath), 'utf8')));
  const activationFile = realpathSync(activationPath);
  const activationBytes = readFileSync(activationFile, 'utf8');
  const activation = JSON.parse(activationBytes);
  const model = value('model') ?? 'claude-sonnet-5';
  if (model !== 'claude-sonnet-5') throw Error('recall sample: exact model must be claude-sonnet-5');
  validateSubscriptionActivation(activation, profile, model, Date.now(), SUBSCRIPTION_CONVERSATION_FRAMING);
  const policy = subscriptionConversationPolicy(model);
  const context = { site: 'preview.journal', preserved: 'preview:host', register: {
    generation: { owner: 'part-three', name: 'RegisterGeneration', id: 'preview:register' },
    entries: ['preview.journal', 'preview', 'host'], producers: ['host'], methods: [], actions: {}, subjects: {},
    sites: { 'preview.journal': 'closed', 'types.decode': 'closed' }, keys: {}, allowRedelegation: false,
    conflictStanding: { ordinary: 'delegate', authority: 'operator' } }, captures: {} };
  const contract = { reference: activation.reference, version: activation.profileDigest,
    parserReference: 'claude-code-json-result', parserVersion: '1', endpoint: profile.loginProfileIdentity,
    account: profile.expectedAccount, credentialReference: profile.reference, controller: 'preview-journal',
    sourceEvidence: [activation.reference], terminalEvidence: activation.reference, terminalReasonField: 'subtype',
    successfulFinalReplyReasons: ['success'], strength: 'attestation', maxMetadataBytes: policy.maxMetadataBytes,
    maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes };
  const stop = installRecallStopSignals();
  try {
    const active = () => { if (stop.stopped()) return false;
      try { return readFileSync(activationFile, 'utf8') === activationBytes; }
      catch { return false; } };
    const io = createSubscriptionProviderIO({ repository: process.cwd(), stopped: () => !active() });
    const routeResult = createClaudeCodeSubscriptionRoute({ context,
      credential: { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: profile.reference },
      profile, resolveProfile: () => profile, provider: 'anthropic', model, route: 'preview-subscription',
      disclosure: 'Subscription preview; charge UNKNOWN', activation, framing: SUBSCRIPTION_CONVERSATION_FRAMING,
      io, now: Date.now, active, adapterEvidenceContract: contract });
    if (routeResult.kind !== 'Success') throw Error('recall sample: subscription route refused');
    // Reserve the report path before any paid invocation. An interrupted run
    // leaves an explicit incomplete artifact instead of inviting a silent retry.
    writeFileSync(output, `${JSON.stringify({ status: 'started', model,
      note: 'Interrupted runs have unknown final call count; do not rerun automatically.' })}\n`,
      { flag: 'wx', mode: 0o600 });
    const report = await runRealModelRecallSample(model, async (prepared, id) => {
      const result = await routeResult.value.invoke(prepared, { operation: id,
        deadline: Math.min(activation.expiresAt, Date.now() + 180000), timeout: policy.timeout,
        maxOutputBytes: policy.maxOutputBytes, maxTokens: policy.maxTokens, maxCharge: 0, automaticRetries: 0 });
      const usage = result.usage ? { inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens, charge: null } : undefined;
      if (result.state !== 'complete' || !result.bytes)
        return { state: result.state === 'complete' ? 'rejected' : result.state, usage };
      try {
        const decision = JSON.parse(result.bytes);
        if (decision?.type !== 'Decision' || decision.conclusion?.subject !== 'preview-stage2-answer'
          || typeof decision.conclusion.value !== 'string') return { state: 'rejected', usage };
        return { state: 'complete', text: decision.conclusion.value, usage };
      } catch { return { state: 'rejected', usage }; }
    }, activation.trial, () => !active());
    if (!active()) throw Error('recall sample: stopped; report remains incomplete');
    writeFileSync(output, `${JSON.stringify({ status: 'complete', ...report }, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`Recall accuracy ${report.correct}/${report.total} (${(report.accuracy * 100).toFixed(1)}%); real calls ${report.calls}. Report: ${output}\n`);
    for (const miss of report.misses) process.stdout.write(`${miss.id}: ${JSON.stringify(miss)}\n`);
  } finally { stop.close(); }
}
