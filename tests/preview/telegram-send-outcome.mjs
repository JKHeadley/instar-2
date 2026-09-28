// Rule 42: one closed classification of a Telegram sendMessage reply. A definite provider
// rejection is `refused`; anything that might have delivered is `unknown`; only a receipt
// naming exactly this chat, thread and text is `accepted`. Neither non-success is delivery.
export function classifyTelegramSend(reply, { chat, expectedText, thread }) {
  if (!reply || reply.kind !== 'response')
    return { kind: 'unknown', reason: reply?.kind === 'uncertain' ? `transport ${String(reply.limitation)}` : 'no transport response' };
  let payload = null;
  try { payload = JSON.parse(reply.bytes); } catch { /* an unparseable body settles below */ }
  if (Number.isSafeInteger(reply.status) && reply.status >= 400 && reply.status < 500 && payload?.ok === false)
    return { kind: 'refused', reason: `telegram ${String(reply.status)}${typeof payload.description === 'string'
      ? `: ${payload.description.slice(0, 120)}` : ''}` };
  if (reply.status !== 200 || payload?.ok !== true) return { kind: 'unknown', reason: `telegram status ${String(reply.status)}` };
  return String(payload.result?.chat?.id) === chat && payload.result?.text === expectedText
    && (thread === undefined || payload.result?.message_thread_id === thread)
    && Number.isSafeInteger(payload.result?.message_id) && payload.result.message_id > 0
    ? { kind: 'accepted', message: payload.result.message_id } : { kind: 'unknown', reason: 'receipt differs from intent' };
}
