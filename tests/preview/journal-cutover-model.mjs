export { SUBSCRIPTION_CONVERSATION_FRAMING, subscriptionConversationPolicy,
  validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { SUBSCRIPTION_DOORWAYS } from '../../src/assembly/production-provider.js';

/** A registered test doorway: the real adapter's evidence contract with this fixture's route. */
export const DEFAULT_SUBSCRIPTION_DOORWAY = 'claude-code-subscription';
export const subscriptionDoorway = id => {
  if (id !== DEFAULT_SUBSCRIPTION_DOORWAY) throw Error(`subscription doorway ${id} is not registered`);
  return { id, contract: SUBSCRIPTION_DOORWAYS[id].contract, create: input => createClaudeCodeSubscriptionRoute(input) };
};

export const createClaudeCodeSubscriptionRoute = () => ({ kind: 'Success', value: {
  invoke: async prepared => {
    const question = JSON.parse(prepared).messages[0].content;
    // A live review answers one line per selected rule (the only form a new review accepts).
    const value = question.startsWith('Judge this proposed reply')
      ? Object.keys(JSON.parse(/on its own: (\{.*?\})\. For raw_path/su.exec(question)[1]))
        .map(id => `${id}: PASS | The answer repeats the operator's marker.`).join('\n') : 'Juniper is the marker.';
    return { state: 'complete', bytes: JSON.stringify({ type: 'Decision',
      conclusion: { subject: 'preview-stage2-answer', value } }),
      usage: { inputTokens: 1, outputTokens: 1, charge: null, inputComplete: true } };
  }
} });
