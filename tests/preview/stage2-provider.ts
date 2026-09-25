import { createHash } from 'node:crypto';
import { canonical, decode } from '../../src/index.js';
import { createClaudeCodeSubscriptionRoute, subscriptionInvocationPolicy, subscriptionPolicyFor, validateSubscriptionActivation,
  SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT, SUBSCRIPTION_CONVERSATION_FRAMING } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord, SubscriptionFraming } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';

export const OWNER_WINDOW_MS = 300000;
export const STAGE2_SETTINGS = Object.freeze({ automaticRetries: 0, maxTokens: 2048 });
export const STAGE2_OUTPUT_SCHEMA = Object.freeze({ type: 'Decision' });
export const STAGE2_ROUTE = 'preview-subscription';
export const STAGE2_DISCLOSURE = 'Supervised unconfined subscription preview; charge and quiescence UNKNOWN';
export function encoded(value: unknown) {
  const result = canonical(value);
  if (result.kind !== 'Success') throw new Error('preview: canonical encoding refused');
  return result.value;
}

/** Application bindings and retained conversation are measured data. */
export function decisionContext(bindings: unknown, selectedContext: readonly unknown[]): string {
  return encoded({ bindings, conversationKind: 'captured-telegram-updates',
    conversation: selectedContext }).bytes;
}
export function submittedEnvelope(input: { provider: string; model: string; route: string; question: string;
  context: string; floor: unknown; evidence: readonly string[]; point: string; generation: string }) {
  const { question, context, ...bindings } = input;
  return encoded({ ...bindings, messages: [{ role: 'user', content: question }, { role: 'context', content: context }],
    attachments: [], tools: [], settings: STAGE2_SETTINGS, outputSchema: STAGE2_OUTPUT_SCHEMA });
}
export function inputMeasurements(question: string, context: string, submitted: string) {
  const system = Buffer.byteLength(SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT, 'utf8');
  return Object.freeze({ system, prompt: system + Buffer.byteLength(submitted, 'utf8'), question: Buffer.byteLength(question), context: Buffer.byteLength(context),
    submitted: Buffer.byteLength(submitted), maximum: 4096 });
}
export function requireInputBound(question: string, context: string, submitted: string): void {
  const lengths = inputMeasurements(question, context, submitted);
  if (lengths.submitted > 4096 || lengths.prompt > 4096)
    throw Object.assign(new Error('preview: complete input bound'), { previewBound: lengths });
}
/** Includes identities, sourceResult and escaping, not just the visible text. */
export function requireOutboundBound(message: unknown, maxBytes: number): string {
  const bytes = encoded(message).bytes;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 4096 || Buffer.byteLength(bytes) > maxBytes)
    throw new Error('preview: complete outbound bound');
  return bytes;
}
export function stage2Description(model: string, framing?: SubscriptionFraming) {
  const policy = subscriptionPolicyFor(model, framing).policy;
  return Object.freeze({ owner: 'part-ten' as const, provider: 'anthropic', model, route: STAGE2_ROUTE,
    automaticRetries: 0 as const, maxInputBytes: policy.maxInputBytes, maxOutputBytes: policy.maxOutputBytes,
    maxCharge: 0, measured: false, basis: 'Declared additional metered demand 0 under activation policy; actual charge and quiescence UNKNOWN' });
}
export function stage2Activation(input: { activation: SubscriptionActivationRecord; profile: ProviderSubscriptionProfile;
  model: string; trial: string; configurationDigest: string; now: number; framing?: SubscriptionFraming }) {
  validateSubscriptionActivation(input.activation, input.profile, input.model, input.now, input.framing);
  if (input.activation.trial !== input.trial || input.activation.baseConfigurationDigest !== input.configurationDigest
    || input.activation.expiresAt !== SUBSCRIPTION_PREVIEW_EXPIRY) throw new Error('preview: activation trial differs');
  return encoded(input.activation).hash;
}
/** Pure descriptor of already validated deployment bindings; no live authority. */
export function stage2InvocationBinding(input: { activation: SubscriptionActivationRecord;
  profile: ProviderSubscriptionProfile; model: string; framing?: SubscriptionFraming }) {
  const { policy: invocationPolicy, system } = subscriptionPolicyFor(input.model, input.framing);
  return Object.freeze({ activationReference: input.activation.reference,
    activationDigest: encoded(input.activation).hash, profileDigest: encoded(input.profile).hash,
    invocationPolicyDigest: encoded(invocationPolicy).hash,
    systemPromptDigest: `sha256:${createHash('sha256').update(system, 'utf8').digest('hex')}`,
    framing: invocationPolicy.framing, invocationPolicy });
}
export { createClaudeCodeSubscriptionRoute, subscriptionInvocationPolicy, subscriptionPolicyFor, SUBSCRIPTION_CONVERSATION_FRAMING };

export function stage2RouteFactory(input: {
  activation: SubscriptionActivationRecord; profile: ProviderSubscriptionProfile; model: string;
  io: import('../../src/assembly/production-provider.js').SubscriptionProviderIO;
  now: () => number; active: () => boolean; framing?: SubscriptionFraming;
}) {
  return ({ evidence, context, current, deadline }: any) => {
    const p = input.profile, a = input.activation;
    const source = { version: a.profileDigest, parserReference: 'claude-code-json-result', parserVersion: '1',
      endpoint: p.loginProfileIdentity, account: p.expectedAccount, credentialReference: p.reference,
      controller: 'preview-local-recorder', executableArtifact: p.artifact,
      provider: 'anthropic', model: input.model, route: STAGE2_ROUTE };
    const terminal = { version: a.profileDigest, parserReference: 'claude-code-json-result', parserVersion: '1',
      terminalReasonField: 'subtype', successfulFinalReplyReasons: ['success'] };
    const record = (predicate: string, value: unknown) => evidence(a.reference, encoded(value).hash, predicate, undefined,
      { strength: 'attestation', claim: { subject: a.reference, predicate, value } }).id;
    const sourceEvidence = record('provider-response-source-contract', source);
    const terminalEvidence = record('provider-response-terminal-contract', terminal);
    const result = createClaudeCodeSubscriptionRoute({ ...input, io: { ...input.io, execute: command => {
      if (!current() || !input.active() || input.now() + command.timeout > deadline) throw new Error('preview: provider current authority refused');
      return input.io.execute(command);
    } }, provider: 'anthropic', route: STAGE2_ROUTE,
      disclosure: STAGE2_DISCLOSURE, context, credential: (() => { const result = decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: p.reference }, context); if (result.kind !== 'Success') throw Error('preview: credential reference refused'); return result.value; })(), resolveProfile: reference => {
        if (reference.vault !== 'preview' || reference.name !== p.reference) throw new Error('preview: profile refused');
        return p;
      }, adapterEvidenceContract: { reference: a.reference, version: a.profileDigest,
        parserReference: 'claude-code-json-result', parserVersion: '1', endpoint: p.loginProfileIdentity,
        account: p.expectedAccount, credentialReference: p.reference, controller: source.controller,
        sourceEvidence: [sourceEvidence], terminalEvidence, terminalReasonField: 'subtype',
        successfulFinalReplyReasons: ['success'], strength: 'observation', maxMetadataBytes: 8192,
        maxRawTerminalBytes: 65536, maxCaptureBytes: 1048576 } });
    if (result.kind !== 'Success') throw new Error('preview: subscription route refused');
    return result.value;
  };
}
