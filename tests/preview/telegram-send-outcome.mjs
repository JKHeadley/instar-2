// Rule 42: one closed classification of a Telegram sendMessage reply. A definite provider
// rejection is `refused`; anything that might have delivered is `unknown`; only a receipt
// naming exactly this chat, thread and text is `accepted`. Neither non-success is delivery.
// The bridge's own closed failure stages (src/assembly/telegram-bot-api-bridge.mjs). Kept in the
// recorded reason so a lost send can be diagnosed; anything else is dropped, never echoed.
const BRIDGE_STAGES = new Set(['resolver', 'child-exit', 'fetch-timeout', 'fetch-failure', 'body-read',
  'invalid-response', 'scan-policy', 'scan-budget', 'sealed-capture',
  // The transport's own pre-network refusals (scripts/production-boot-io.mjs): the host would not start
  // the child, or the launcher refused before its exec. Both carry `sent: false`.
  'spawn-refused', 'launch-refused']);
export function classifyTelegramSend(reply, { chat, expectedText, thread }) {
  if (!reply || reply.kind !== 'response') {
    const reason = reply?.kind === 'uncertain' ? `transport ${String(reply.limitation)}${
      BRIDGE_STAGES.has(reply.stage) ? ` at ${reply.stage}` : ''}` : 'no transport response';
    // A transport that states the network call was never made is a definite non-delivery, not UNKNOWN:
    // nothing can have reached Telegram, so this exact intent may be dispatched again without any risk
    // of a duplicate. Only the transport asserts this; a missing field is never read as proof.
    return reply?.kind === 'uncertain' && reply.sent === false
      ? { kind: 'not-sent', reason: `not sent: ${reason}` } : { kind: 'unknown', reason };
  }
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
