// Isolated live probe only. The loader substitutes this route for the journal
// launcher; it never calls a provider or exposes the prepared prompt.
export { SUBSCRIPTION_CONVERSATION_FRAMING, subscriptionConversationPolicy,
  validateSubscriptionActivation } from '../../src/assembly/production-provider.js';

export const createClaudeCodeSubscriptionRoute = () => {
  if (process.env.INSTAR_PREVIEW_SIMULATE_MODEL_FAILURE !== '1'
    && process.env.INSTAR_PREVIEW_SIMULATE_UNKNOWN_ANSWER !== '1') throw Error('model probe not enabled');
  return { kind: 'Success', value: { invoke: async prepared => {
    const question = JSON.parse(prepared).messages[0].content;
    if (!question.startsWith('Judge this proposed reply'))
      return { state: process.env.INSTAR_PREVIEW_SIMULATE_UNKNOWN_ANSWER === '1' ? 'uncertain' : 'rejected',
        bytes: null, usage: { inputTokens: null, outputTokens: null, charge: null } };
    return { state: 'complete', bytes: JSON.stringify({ type: 'Decision', conclusion: {
      subject: 'preview-stage2-answer', value: JSON.stringify({ verdict: 'pass', ruleIds: [],
        reason: 'The fixed failure reply makes no capability or factual claim.' }) } }),
    usage: { inputTokens: null, outputTokens: null, charge: null } };
  } } };
};
