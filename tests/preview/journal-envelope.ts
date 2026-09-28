import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { encoded } from './canonical.js';
import { ANSWER_INSTRUCTIONS } from './briefing.js';

/** The exact launcher envelope, shared with its bounded offline path proof. The
 * constitution's mind-held rules ride every conversation answer call as the application's
 * standing instructions, outside the quoted role:context data (Rules 3, 17 and 47). The
 * narrow maintenance calls (rolling summary, reply review) keep their own fixed questions. */
export const answerCall = (id: string) => !id.startsWith('summary:') && !id.endsWith(':reply-review');
export function prepareJournalEnvelope(input: { question: string; context: string; id: string },
  model: string, grant: string, at: number, maxPromptBytes?: number): string {
  const policy = subscriptionConversationPolicy(model);
  const limit = maxPromptBytes ?? policy.maxPromptBytes;
  const floor = { type: 'ActionFloor', schemaVersion: 1, actions: ['work'], default: 'work' };
  const bindings = { at, by: { judgment: 'judgment', model, route: 'preview-subscription' },
    floor, evidence: [input.id] };
  const bytes = encoded({ provider: 'anthropic', model, route: 'preview-subscription',
    messages: [{ role: 'user', content: input.question },
      { role: 'context', content: encoded({ bindings, packet: JSON.parse(input.context) }).bytes },
      ...(answerCall(input.id) ? [{ role: 'instructions', content: ANSWER_INSTRUCTIONS }] : [])],
    attachments: [], tools: [], settings: { automaticRetries: 0, maxTokens: policy.maxTokens },
    outputSchema: { type: 'Decision' }, floor, evidence: bindings.evidence, point: 'judgment', generation: grant }).bytes;
  if (Buffer.byteLength(bytes) > limit
    || Buffer.byteLength(bytes) + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT) > limit)
    throw Error('preview: complete prompt overflow');
  return bytes;
}
