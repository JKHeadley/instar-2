export { SUBSCRIPTION_CONVERSATION_FRAMING, SUBSCRIPTION_PREVIEW_EXPIRY, subscriptionConversationPolicy,
  validateSubscriptionActivation } from '../../src/assembly/production-provider.js';
import { SUBSCRIPTION_DOORWAYS } from '../../src/assembly/production-provider.js';

/** A registered test doorway: the real adapter's evidence contract with this fixture's route. */
export const DEFAULT_SUBSCRIPTION_DOORWAY = 'claude-code-subscription';
export const subscriptionDoorway = id => {
  if (id !== DEFAULT_SUBSCRIPTION_DOORWAY) throw Error(`subscription doorway ${id} is not registered`);
  return { id, contract: SUBSCRIPTION_DOORWAYS[id].contract, create: input => createClaudeCodeSubscriptionRoute(input) };
};

import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
/** Two-machine tests only: a slow model (so a test can act mid-turn) and a log of which runner called it, when asked for. */
const delayMs = Number(process.env.INSTAR_PREVIEW_CUTOVER_MODEL_DELAY_MS ?? '0');
export const createClaudeCodeSubscriptionRoute = () => ({ kind: 'Success', value: {
  invoke: async (prepared, invocation) => {
    const question = JSON.parse(prepared).messages[0].content;
    if (delayMs > 0) {
      appendFileSync(join(process.env.INSTAR_PREVIEW_CUTOVER_WORLD, 'model.jsonl'),
        `${JSON.stringify({ role: process.env.INSTAR_PREVIEW_CUTOVER_ROLE, operation: invocation?.operation ?? null })}\n`);
      await new Promise(done => setTimeout(done, delayMs));
    }
    // A live review answers one line per selected rule (the only form a new review accepts).
    const value = question.startsWith('Judge this proposed reply')
      ? Object.keys(JSON.parse(/on its own: (\{.*?\})\. For raw_path/su.exec(question)[1]))
        .map(id => `${id}: PASS | The answer repeats the operator's marker.`).join('\n') : 'Juniper is the marker.';
    return { state: 'complete', bytes: JSON.stringify({ type: 'Decision',
      conclusion: { subject: 'preview-stage2-answer', value } }),
      usage: { inputTokens: 1, outputTokens: 1, charge: null, inputComplete: true } };
  }
} });
