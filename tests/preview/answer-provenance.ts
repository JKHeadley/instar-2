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
