// Rule 42: one closed classification of a Telegram sendMessage reply. A definite provider
// rejection is `refused`; anything that might have delivered is `unknown`; only a receipt
// naming this chat, thread and text (only trailing space/LF removal allowed) is `accepted`.
// Neither non-success is delivery. See reviews/receipt-trailing-space-1013-change-review.md.
// The bridge's own closed failure stages (src/assembly/telegram-bot-api-bridge.mjs). Kept in the
// recorded reason so a lost send can be diagnosed; anything else is dropped, never echoed.
const BRIDGE_STAGES = new Set(['resolver', 'child-exit', 'fetch-timeout', 'fetch-failure', 'body-read',
  'invalid-response', 'scan-policy', 'scan-budget', 'sealed-capture',
  // The transport's own pre-network refusals (scripts/production-boot-io.mjs): the host would not start
  // the child, or the launcher refused before its exec. Both carry `sent: false`.
  'spawn-refused', 'launch-refused']);
const TRANSPORT_CODES = new Set(['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT',
  'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT', 'UND_ERR_ABORTED', 'EPIPE']);
const TRANSPORT_SYSCALLS = new Set(['connect', 'getaddrinfo', 'read', 'write']);
function transportReason(reply) {
  if (!Array.isArray(reply.transportErrors)) return '';
  const errors = reply.transportErrors.slice(0, 8).filter(error => TRANSPORT_CODES.has(error?.code))
    .map(error => `${error.code}${TRANSPORT_SYSCALLS.has(error.syscall) ? `/${error.syscall}` : ''}`);
  return errors.length ? ` (${[...new Set(errors)].join(', ')})` : '';
}
// Telegram's TDLib fix_formatted_text removes terminal U+0020/U+000A after parsing entities.
// Compare in one direction only: an exact echo or the complete removal of that suffix.
// No Unicode trim(), leading/interior cleanup, entity decoding, or normalization of the receipt.
// Keep the signed intent unchanged; this never revisits an already UNKNOWN dispatch.
function textMatches(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string' || actual.length === 0) return false;
  return actual === expected || actual === expected.replace(/[ \n]+$/u, '');
}
function textDifference(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string')
    return ` type=${typeof actual}`;
  let at = 0;
  while (at < actual.length && at < expected.length && actual[at] === expected[at]) at++;
  // Never echo provider/user content, even an unrecognized secret. Reveal only whitespace shape
  // near the first differing UTF-16 code unit; all other units become dots before JSON escaping.
  const excerpt = text => JSON.stringify(text.slice(Math.max(0, at - 2), at + 8).replace(/[^ \n\r\t]/g, '.'));
  return ` len=${expected.length}/${actual.length} at=${at} excerpt=${excerpt(expected)}/${excerpt(actual)}`;
}
export function classifyTelegramSend(reply, { chat, expectedText, thread, forum = false }) {
  if (!reply || reply.kind !== 'response') {
    const reason = reply?.kind === 'uncertain' ? `transport ${String(reply.limitation)}${
      BRIDGE_STAGES.has(reply.stage) ? ` at ${reply.stage}` : ''}${transportReason(reply)}` : 'no transport response';
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
  const result = payload.result;
  const fields = [];
  if (String(result?.chat?.id) !== chat) fields.push('chat');
  if (!(thread === undefined ? !forum || result?.message_thread_id === undefined || result?.message_thread_id === 1
    : result?.message_thread_id === thread)) fields.push('thread');
  if (!Number.isSafeInteger(result?.message_id) || result.message_id <= 0) fields.push('message_id');
  if (!textMatches(result?.text, expectedText)) fields.push('text');
  if (!fields.length) return { kind: 'accepted', message: result.message_id };
  // Fits the existing settlement/journal reason bound; no new log, raw receipt or retry path.
  return { kind: 'unknown', reason: (`receipt differs from intent: ${fields.join(',')}${fields.includes('text')
    ? textDifference(result?.text, expectedText) : ''}`).slice(0, 200) };
}
