import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { encoded } from './stage2-provider.js';
import { ENVELOPE_FLOOR } from './model-call-boundary.js';

/** The exact launcher envelope, shared with its bounded offline path proof. */
export function prepareJournalEnvelope(input: { question: string; context: string; id: string;
    /** Rule 29: the verified principal whose input this turn is; quoted material never gets one. */
    writer?: { id: string; kind: string; adapter: string } },
  model: string, grant: string, at: number, maxPromptBytes?: number): string {
  const policy = subscriptionConversationPolicy(model);
  const limit = maxPromptBytes ?? policy.maxPromptBytes;
  // Rule 57: the one local floor; a returned Decision is checked against this same value.
  const floor = ENVELOPE_FLOOR;
  const bindings = { at, by: { judgment: 'judgment', model, route: 'preview-subscription' },
    floor, evidence: [input.id], ...(input.writer ? { writer: input.writer } : {}) };
  const bytes = encoded({ provider: 'anthropic', model, route: 'preview-subscription',
    messages: [{ role: 'user', content: input.question },
      { role: 'context', content: encoded({ bindings, packet: JSON.parse(input.context) }).bytes }],
    attachments: [], tools: [], settings: { automaticRetries: 0, maxTokens: policy.maxTokens },
    outputSchema: { type: 'Decision' }, floor, evidence: bindings.evidence, point: 'judgment', generation: grant }).bytes;
  if (Buffer.byteLength(bytes) > limit
    || Buffer.byteLength(bytes) + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT) > limit)
    throw Error('preview: complete prompt overflow');
  return bytes;
}
