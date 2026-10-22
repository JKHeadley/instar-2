import { createHash } from 'node:crypto';
import { decode } from '../../src/index.js';
import { DEFAULT_SUBSCRIPTION_DOORWAY, subscriptionDoorway, subscriptionInvocationPolicy, subscriptionPolicyFor, validateSubscriptionActivation,
  SUBSCRIPTION_PREVIEW_EXPIRY, SUBSCRIPTION_CONVERSATION_FRAMING } from '../../src/assembly/production-provider.js';
import type { SubscriptionActivationRecord, SubscriptionDoorway, SubscriptionFraming } from '../../src/assembly/production-provider.js';
import type { ProviderSubscriptionProfile } from '../../src/assembly/provider-credential-custodian.js';

export const OWNER_WINDOW_MS = 300000;
export const STAGE2_SETTINGS = Object.freeze({ automaticRetries: 0, maxTokens: 2048 });
export const STAGE2_OUTPUT_SCHEMA = Object.freeze({ type: 'Decision' });
export const STAGE2_ROUTE = 'preview-subscription';
export const STAGE2_DISCLOSURE = 'Supervised unconfined subscription preview; charge and quiescence UNKNOWN';
import { encoded } from './canonical.js';
export { encoded };

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
/** The registered adapter owns the exact policy and prompt; absent a doorway, preserve historical v2. */
export function stage2Policy(model: string, framing?: string, doorwayId?: string) {
  const doorway = subscriptionDoorway(doorwayId ?? DEFAULT_SUBSCRIPTION_DOORWAY);
  const selected = framing ?? (doorwayId === undefined ? 'preview-decision-system-v2' : doorway.conversationFraming);
  return { policy: doorway.policyFor(model, selected), system: doorway.systemFor(model, selected) };
}
export function inputMeasurements(question: string, context: string, submitted: string, framing?: string, doorwayId?: string) {
  const { system: prompt, policy } = stage2Policy('', framing, doorwayId), maximum = policy.maxPromptBytes, system = Buffer.byteLength(prompt, 'utf8');
  return Object.freeze({ system, prompt: system + Buffer.byteLength(submitted, 'utf8'), question: Buffer.byteLength(question), context: Buffer.byteLength(context),
    submitted: Buffer.byteLength(submitted), maximum });
}
export function requireInputBound(question: string, context: string, submitted: string, framing?: string, doorwayId?: string): void {
  const lengths = inputMeasurements(question, context, submitted, framing, doorwayId);
  if (lengths.submitted > lengths.maximum || lengths.prompt > lengths.maximum)
    throw Object.assign(new Error('preview: complete input bound'), { previewBound: lengths });
}
/** Includes identities, sourceResult and escaping, not just the visible text. */
export function requireOutboundBound(message: unknown, maxBytes: number): string {
  const bytes = encoded(message).bytes;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 4096 || Buffer.byteLength(bytes) > maxBytes)
    throw new Error('preview: complete outbound bound');
  return bytes;
}
export function stage2Description(model: string, framing?: string, doorwayId?: string) {
  const policy = stage2Policy(model, framing, doorwayId).policy;
  return Object.freeze({ owner: 'part-ten' as const, provider: subscriptionDoorway(doorwayId ?? DEFAULT_SUBSCRIPTION_DOORWAY).provider, model, route: STAGE2_ROUTE,
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
  profile: ProviderSubscriptionProfile; model: string; framing?: string; doorwayId?: string }) {
  const { policy: invocationPolicy, system } = stage2Policy(input.model, input.framing, input.doorwayId);
  return Object.freeze({ ...(input.doorwayId === undefined ? {} : { doorway: input.doorwayId }), activationReference: input.activation.reference,
    activationDigest: encoded(input.activation).hash, profileDigest: encoded(input.profile).hash,
    invocationPolicyDigest: encoded(invocationPolicy).hash,
    systemPromptDigest: `sha256:${createHash('sha256').update(system, 'utf8').digest('hex')}`,
    framing: invocationPolicy.framing, invocationPolicy });
}
export { subscriptionInvocationPolicy, subscriptionPolicyFor, SUBSCRIPTION_CONVERSATION_FRAMING };

export function stage2RouteFactory(input: {
  activation: SubscriptionActivationRecord; profile: ProviderSubscriptionProfile; model: string;
  io: import('../../src/assembly/production-provider.js').SubscriptionProviderIO;
  now: () => number; active: () => boolean; framing?: string; doorwayId?: string;
  /** A registered doorway's route constructor (default: the default registered doorway's). */
  create?: SubscriptionDoorway['create'];
}) {
  return ({ evidence, context, current, deadline }: any) => {
    const p = input.profile, a = input.activation;
    const doorway = subscriptionDoorway(input.doorwayId ?? DEFAULT_SUBSCRIPTION_DOORWAY);
    const { policy } = stage2Policy(input.model, input.framing, input.doorwayId);
    const { parserReference, parserVersion, terminalReasonField, successfulFinalReplyReasons } = doorway.contract;
    const source = { version: a.profileDigest, parserReference, parserVersion,
      endpoint: p.loginProfileIdentity, account: p.expectedAccount, credentialReference: p.reference,
      controller: 'preview-local-recorder', executableArtifact: p.artifact,
      provider: doorway.provider, model: input.model, route: STAGE2_ROUTE };
    const terminal = { version: a.profileDigest, parserReference, parserVersion,
      terminalReasonField, successfulFinalReplyReasons };
    // The id names the exact contract value, so a re-recorded profile or activation
    // gets its own evidence row instead of reusing one that states the old contract.
    const record = (predicate: string, value: unknown) => evidence(a.reference, encoded(value).hash, predicate, undefined,
      { id: `proof:${predicate}:${a.reference}:${encoded(value).hash}`, strength: 'attestation',
        claim: { subject: a.reference, predicate, value } }).id;
    const sourceEvidence = record('provider-response-source-contract', source);
    const terminalEvidence = record('provider-response-terminal-contract', terminal);
    const result = (input.create ?? doorway.create)({ ...input, io: { ...input.io, execute: command => {
      if (!current() || !input.active() || input.now() + command.timeout > deadline) throw new Error('preview: provider current authority refused');
      return input.io.execute(command);
    } }, provider: doorway.provider, route: STAGE2_ROUTE,
      disclosure: STAGE2_DISCLOSURE, context, credential: (() => { const result = decode('SecretRef', { type: 'SecretRef', schemaVersion: 1, vault: 'preview', name: p.reference }, context); if (result.kind !== 'Success') throw Error('preview: credential reference refused'); return result.value; })(), resolveProfile: reference => {
        if (reference.vault !== 'preview' || reference.name !== p.reference) throw new Error('preview: profile refused');
        return p;
      }, adapterEvidenceContract: { reference: a.reference, version: a.profileDigest,
        parserReference, parserVersion, endpoint: p.loginProfileIdentity,
        account: p.expectedAccount, credentialReference: p.reference, controller: source.controller,
        sourceEvidence: [sourceEvidence], terminalEvidence, terminalReasonField,
        successfulFinalReplyReasons, strength: doorway.sourceStrength, maxMetadataBytes: policy.maxMetadataBytes,
        maxRawTerminalBytes: policy.maxRawTerminalBytes, maxCaptureBytes: policy.maxCaptureBytes } });
    if (result.kind !== 'Success') throw new Error(`preview: subscription route refused: ${result.detail}`);
    return result.value;
  };
}
