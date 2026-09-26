import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { encoded } from './stage2-provider.js';

/** The exact launcher envelope, shared with its bounded offline path proof. */
export function prepareJournalEnvelope(input: { question: string; context: string; id: string },
  model: string, grant: string, at: number): string {
  const policy = subscriptionConversationPolicy(model);
  const floor = { type: 'ActionFloor', schemaVersion: 1, actions: ['work'], default: 'work' };
  const bindings = { at, by: { judgment: 'judgment', model, route: 'preview-subscription' },
    floor, evidence: [input.id] };
  const bytes = encoded({ provider: 'anthropic', model, route: 'preview-subscription',
    messages: [{ role: 'user', content: input.question },
      { role: 'context', content: encoded({ bindings, packet: JSON.parse(input.context) }).bytes }],
    attachments: [], tools: [], settings: { automaticRetries: 0, maxTokens: policy.maxTokens },
    outputSchema: { type: 'Decision' }, floor, evidence: bindings.evidence, point: 'judgment', generation: grant }).bytes;
  if (Buffer.byteLength(bytes) > policy.maxInputBytes
    || Buffer.byteLength(bytes) + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT) > policy.maxPromptBytes)
    throw Error('preview: complete prompt overflow');
  return bytes;
}
