/** Existing journal call accounting and subscription doorway for the copied
 * 1.x prompts. The callback is the launcher's single recorded provider boundary;
 * physical deadline/token checks remain in that provider owner. */
import type { ConfinedProviderRoute } from '../../src/assembly/provider-invocation.js';
import type { SubscriptionPolicyBounds } from '../../src/assembly/production-provider.js';
import type { JournalView } from './journal.js';
import type { HubRecord } from './collaboration-hub.js';
import type { HubModelRequest } from './hub-model-contract.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { readAnswer } from './answer-reading.js';

export function createHubModelRoute(host: {
  view(): JournalView; now(): number; admitted(): boolean; replicated(): Promise<boolean>;
  append(row: HubRecord): void; model: string; policy: SubscriptionPolicyBounds;
  recordedCall(judgment: 'hub-intent' | 'hub-brief', bytes: string,
    bounds: Parameters<ConfinedProviderRoute['invoke']>[1]): ReturnType<ConfinedProviderRoute['invoke']>;
}) {
  return async (id: string, request: HubModelRequest): Promise<string | null> => {
    const intent = request.promptId === 'hub-intent-v1';
    if ((!intent && request.promptId !== 'open-conversation-brief-v1')
      || request.maxTokens !== (intent ? 200 : 320) || request.timeoutMs !== (intent ? 4000 : 15000)
      || request.maxTokens > host.policy.maxTokens || request.timeoutMs > host.policy.timeout
      || !host.admitted() || host.view().collaboration?.modelCalls?.some(call => call.id === id)) return null;
    const at = host.now(), deadline = Math.min(host.view().expires, at + request.timeoutMs);
    if (deadline <= at + 100) return null;
    const envelope = JSON.parse(prepareJournalEnvelope({ question: request.prompt,
      context: JSON.stringify({ runnerTask: intent ? 'hub-intent' : 'hub-brief' }), id: `hub:${id}` },
    host.model, host.view().genesis.grant, at, Math.min(host.policy.maxPromptBytes, host.view().limits.maxBytes)));
    envelope.settings.maxTokens = request.maxTokens;
    // The exact copied question is unchanged. Current framing supplies the
    // existing runner-task envelope; its raw provider output is recorded too.
    host.append({ kind: 'collaboration', action: 'model-reserve', id, promptId: intent ? 'hub-intent-v1' : 'open-conversation-brief-v1',
      maxTokens: request.maxTokens, maxInputTokens: host.view().limits.maxBytes, deadline, at });
    if (!await host.replicated() || !host.admitted() || host.now() >= deadline - 100) return null;
    let result;
    try {
      result = await host.recordedCall(intent ? 'hub-intent' : 'hub-brief', JSON.stringify(envelope), {
        operation: `hub:${id}`, deadline, timeout: request.timeoutMs, maxTokens: request.maxTokens,
        maxOutputBytes: host.policy.maxOutputBytes, maxCharge: 0, automaticRetries: 0 });
    } catch { return null; }
    if (!host.admitted()) return null;
    host.append({ kind: 'collaboration', action: 'model-settle', id, at: host.now(),
      ...(result.usage ? { usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
        charge: null, ...(result.usage.inputComplete ? { inputComplete: true as const } : {}) } } : {}) });
    if (result.state !== 'complete' || !result.bytes || host.now() > deadline) return null;
    if (intent) return result.bytes;
    const reading = readAnswer(result.bytes, { evidence: [`hub:${id}`] });
    return reading.ok ? reading.value : result.bytes;
  };
}
