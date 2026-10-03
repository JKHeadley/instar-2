// Offline launcher tests only. Every other export is the real provider module; the route answers each question with the
// verbatim recorded model output named for it in INSTAR_PREVIEW_RECORDED_ANSWERS ({ "<question>": "<raw output>" }).
// A reply review passes every selected rule, a summary is a fixed short summary, and anything else is a definite refusal
// (never UNKNOWN), so no call this fixture makes is left unsettled.
import { readFileSync } from 'node:fs';
import { SUBSCRIPTION_DOORWAYS } from '../../src/assembly/production-provider.js';
export { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  validateSubscriptionActivation, SUBSCRIPTION_TOOLS_FRAMING, SUBSCRIPTION_TOOLS_SYSTEM_PROMPT,
  subscriptionToolsPolicy } from '../../src/assembly/production-provider.js';

export const DEFAULT_SUBSCRIPTION_DOORWAY = 'claude-code-subscription';
export const subscriptionDoorway = id => {
  if (id !== DEFAULT_SUBSCRIPTION_DOORWAY) throw Error(`subscription doorway ${id} is not registered`);
  return { id, contract: SUBSCRIPTION_DOORWAYS[id].contract, create: input => createClaudeCodeSubscriptionRoute(input) };
};
const usage = { inputTokens: 1, outputTokens: 1, charge: null, inputComplete: true };
const decision = value => JSON.stringify({ type: 'Decision', conclusion: { subject: 'preview-stage2-answer', value } });
export const createClaudeCodeSubscriptionRoute = () => ({ kind: 'Success', value: {
  invoke: async (prepared, invocation) => {
    const answers = JSON.parse(readFileSync(process.env.INSTAR_PREVIEW_RECORDED_ANSWERS, 'utf8'));
    const question = JSON.parse(prepared).messages[0].content;
    if (question.startsWith('Judge this proposed reply'))
      return { state: 'complete', usage, bytes: decision(Object.keys(JSON.parse(/on its own: (\{.*?\})\. For raw_path/su.exec(question)[1]))
        .map(id => `${id}: PASS | The reply states only the request it carries.`).join('\n')) };
    if (String(invocation?.operation ?? '').startsWith('summary:'))
      return { state: 'complete', usage, bytes: decision(JSON.stringify({ summary: 'The operator asked to extend the trial.', people: [] })) };
    if (typeof answers[question] === 'string') return { state: 'complete', usage, bytes: answers[question] };
    return { state: 'rejected', bytes: null, usage: { inputTokens: null, outputTokens: null, charge: null } };
  }
} });
