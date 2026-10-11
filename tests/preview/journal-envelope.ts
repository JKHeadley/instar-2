import { SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT, subscriptionConversationPolicy } from '../../src/assembly/production-provider.js';
import { encoded } from './canonical.js';
import { ANSWER_INSTRUCTIONS, MEMORY_LOOKUP_INSTRUCTIONS } from './briefing.js';
import { ENVELOPE_FLOOR } from './model-call-boundary.js';

/** The exact launcher envelope, shared with its bounded offline path proof. The
 * constitution's mind-held rules ride every conversation answer call as the application's
 * standing instructions, outside the quoted role:context data (Rules 3, 17 and 47). The
 * narrow maintenance calls (rolling summary, reply review) keep their own fixed questions. */
export const answerCall = (id: string) => !id.startsWith('summary:') && !id.endsWith(':reply-review');
export function prepareJournalEnvelope(input: { question: string; context: string; id: string;
    /** Rule 29: the verified principal whose input this turn is; quoted material never gets one. */
    writer?: { id: string; kind: string; adapter: string } },
  model: string, grant: string, at: number, maxPromptBytes?: number): string {
  const policy = subscriptionConversationPolicy(model);
  const limit = maxPromptBytes ?? policy.maxPromptBytes;
  // Rule 57: the one local floor; a returned Decision is checked against this same value.
  const floor = ENVELOPE_FLOOR;
  const packet = JSON.parse(input.context);
  // Update 969390343's replay returned a memory-lookup object instead of using web
  // tools when that protocol was present but unavailable. Ground it in actual
  // availability, identically before and after compaction (Rules 47, 78).
  const instructions = packet.memoryLookup === 'offered'
    ? `${ANSWER_INSTRUCTIONS}\n${MEMORY_LOOKUP_INSTRUCTIONS}` : ANSWER_INSTRUCTIONS;
  const bindings = { at, by: { judgment: 'judgment', model, route: 'preview-subscription' },
    floor, evidence: [input.id], ...(input.writer ? { writer: input.writer } : {}) };
  const bytes = encoded({ provider: 'anthropic', model, route: 'preview-subscription',
    messages: [{ role: 'user', content: input.question },
      { role: 'context', content: encoded({ bindings, packet }).bytes },
      ...(answerCall(input.id) ? [{ role: 'instructions', content: instructions }] : [])],
    attachments: [], tools: [], settings: { automaticRetries: 0, maxTokens: policy.maxTokens },
    outputSchema: { type: 'Decision' }, floor, evidence: bindings.evidence, point: 'judgment', generation: grant }).bytes;
  if (Buffer.byteLength(bytes) > limit
    || Buffer.byteLength(bytes) + Buffer.byteLength(SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT) > limit)
    throw Error('preview: complete prompt overflow');
  return bytes;
}

/** The tool turn's workspace notice (Rules 33, 84), carried in the packet it grounds: `packet.workspace` of the role:context
 * message, so the agent is told which kept files may still disagree with memory (or that the workspace was lost) in the
 * input it answers from. An empty notice leaves the envelope byte-for-byte. */
export function withWorkspaceNotice(bytes: string, notice: string): string {
  if (!notice) return bytes;
  const envelope = JSON.parse(bytes) as { messages: { role: string; content: string }[] };
  const context = envelope.messages.find(message => message.role === 'context');
  if (!context) throw Error('preview: envelope has no context message');
  const value = JSON.parse(context.content) as { packet: Record<string, unknown> };
  context.content = encoded({ ...value, packet: { ...value.packet, workspace: notice } }).bytes;
  return encoded(envelope).bytes;
}
