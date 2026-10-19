/** Rules 10/26/116: the answering mind judges support from its existing packet,
 * not a keyword detector or another verifier. A source label identifies a record;
 * it does not prove the claim that record contains. No new call or send gate. */
export const CLAIM_EVIDENCE_GUIDANCE = 'Ground completion and factual claims in the recorded sources and outcomes. '
  + 'State supported claims plainly; for an unsupported claim add one short clause saying it is not verified; '
  + 'when the record is uncertain say you are not sure. A prior assertion, source label or completed model call alone is not proof. '
  + 'Do not annotate ordinary conversation, questions or quoted hypotheticals. Use available evidence before declaring it missing.';

/** A conservative, signal-only check: a reply repeats four adjacent words from
 * remembered material that arrived without a source label. Paraphrases and
 * shorter facts need human review; this must never gate a send. */
export function unlabeledRecall(packet: string, reply: string): boolean {
  let data: Record<string, unknown>;
  try { data = JSON.parse(packet) as Record<string, unknown>; } catch { return false; }
  const words = (text: string) => text.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu) ?? [];
  const answer = ` ${words(reply).join(' ')} `;
  if (!answer) return false;
  const entries: unknown[] = [data.summary, data.memorySummary, ...(Array.isArray(data.history) ? data.history : []),
    ...(Array.isArray(data.recalled) ? data.recalled : []), ...(Array.isArray(data.people) ? data.people : []),
    ...(Array.isArray(data.commitments) ? data.commitments : []),
    ...(Array.isArray(data.channelMemory) ? data.channelMemory : []),
    ...(Array.isArray(data.memory) ? data.memory : []),
    ...(Array.isArray(data.memoryCandidates) ? data.memoryCandidates : [])];
  return entries.some(entry => {
    if (!entry || typeof entry !== 'object') return false;
    const item = entry as Record<string, unknown>;
    if (typeof item.sourceLabel === 'string' && item.sourceLabel.length > 0) return false;
    const material = ['text', 'user', 'answer', 'message', 'reply', 'quote', 'replacement']
      .flatMap(key => typeof item[key] === 'string' ? [item[key] as string] : []);
    return material.some(value => {
      const tokens = words(value);
      for (let index = 0; index + 4 <= tokens.length; index++)
        if (answer.includes(` ${tokens.slice(index, index + 4).join(' ')} `)) return true;
      return false;
    });
  });
}
