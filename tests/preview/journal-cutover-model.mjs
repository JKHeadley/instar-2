export { SUBSCRIPTION_CONVERSATION_FRAMING, subscriptionConversationPolicy,
  validateSubscriptionActivation } from '../../src/assembly/production-provider.js';

export const createClaudeCodeSubscriptionRoute = () => ({ kind: 'Success', value: {
  invoke: async prepared => {
    const question = JSON.parse(prepared).messages[0].content;
    const value = question.startsWith('Judge this proposed reply')
      ? 'PASS | The answer repeats the operator\'s marker.' : 'Juniper is the marker.';
    return { state: 'complete', bytes: JSON.stringify({ type: 'Decision',
      conclusion: { subject: 'preview-stage2-answer', value } }),
      usage: { inputTokens: 1, outputTokens: 1, charge: null, inputComplete: true } };
  }
} });
