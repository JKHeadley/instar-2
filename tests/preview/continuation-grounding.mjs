const clipped = (value, limit) => {
  if (typeof value !== 'string') throw Error('continuation history missing');
  return value.length <= limit ? value : `${value.slice(0, limit)}\n[older text omitted from continuation]`;
};

/** Restore history after a login handoff without replaying a full model envelope. */
export function boundedContinuationGrounding(summary, turns) {
  if ((!summary || !summary.trim()) && turns.length === 0) throw Error('continuation history unavailable');
  const recent = turns.slice(-4).map(turn => {
    const envelope = JSON.parse(turn.prompt);
    const message = envelope.messages?.find(row => row.role === 'user')?.content;
    if (typeof message !== 'string' || !message.trim()) throw Error('continuation user message unavailable');
    return `RECORDED USER MESSAGE\n${clipped(message, 12000)}\nRECORDED REPLY\n${clipped(turn.intentBody ?? turn.intent, 12000)}`;
  });
  const text = ['Restore this recorded conversation as history only. Do not repeat actions or answer old questions. Wait for the next delivered input.',
    ...(summary?.trim() ? [`RECORDED SUMMARY\n${clipped(summary, 32000)}`] : []), ...recent].join('\n\n');
  if (Buffer.byteLength(text) > 128000) throw Error('continuation exceeds bounded context');
  return text;
}
