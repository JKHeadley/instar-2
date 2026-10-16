import type { ConversationSessionOutcome } from '../../src/assembly/production-conversation-session.js';
import { readAnswer } from './answer-reading.js';
import { ModelPending, type PreviewPorts } from './journal.js';

/** Initial return and durable collection share one decoder and the normal journal consumer. */
export function conversationSessionAnswer(outcome: ConversationSessionOutcome, id: string,
  malformed: (shape: string) => void): Awaited<ReturnType<PreviewPorts['model']>> {
  if (outcome.state === 'queued') throw new ModelPending();
  if (outcome.state !== 'complete') return { state: 'uncertain' };
  const usage = { inputTokens: null, outputTokens: null, charge: null };
  const reading = readAnswer(outcome.text ?? '', { wrapped: 'accept', evidence: [id] });
  if (!reading.ok) {
    malformed(reading.shape);
    return { state: 'complete', failureClass: 'malformed', defect: reading.defect, usage };
  }
  if (!reading.value.trim()) return { state: 'complete', failureClass: 'empty', usage };
  let text = reading.value;
  if (outcome.contextRecovery) {
    const disclose = (reply: string) => `I restored this conversation after a context limit and continued your last message.\n\n${reply}`;
    // Preserve the answer object's promises, directives and other protocol fields. An empty
    // reply must still reach the ordinary empty-answer check, never become a disclosure-only answer.
    let object: unknown;
    try { object = JSON.parse(text); } catch { /* Plain answer text is also supported. */ }
    if (object && typeof object === 'object' && !Array.isArray(object)) {
      const answer = object as Record<string, unknown>;
      if (typeof answer.reply === 'string' && answer.reply.trim()) text = JSON.stringify({ ...answer, reply: disclose(answer.reply) });
    } else text = disclose(text);
  }
  return { state: 'complete', text, reason: reading.reason, usage };
}
