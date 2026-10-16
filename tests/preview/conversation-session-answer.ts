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
  // Recovery belongs to the host, not the model's reply schema. The journal adds its
  // disclosure after decoding and revision, only for an actual nonempty answer.
  return { state: 'complete', text: reading.value, reason: reading.reason, usage,
    ...(outcome.contextRecovery === id ? { contextRecovery: id } : {}) };
}
