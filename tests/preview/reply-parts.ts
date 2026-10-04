/** Telegram's per-message bound, as the send path measures it: the HTML-escaped body in UTF-8 bytes (never fewer
 * than its characters), and the plain text Telegram echoes back. */
export const TELEGRAM_MESSAGE_LIMIT = 4096;
/** The most messages one reply is split into. A model answer is capped at 16384 output bytes, so this bound is far
 * above any answer the route can produce; only a reply past it is still answered with the too-long notice. */
export const MAX_REPLY_PARTS = 10;
/** Room kept in every part for its position marker (" (1/2)" on the first, "PREVIEW (2/2) — " on the rest). */
const MARKER_ROOM = 32;

/** The Telegram HTML body of a plain reply. */
export const encodeReply = (reply: string) => reply.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
/** Whether one message carries this text: the plain text and its encoded body both inside the bound. */
export const fitsOneMessage = (text: string) => {
  const body = encodeReply(text);
  return Buffer.byteLength(text) <= TELEGRAM_MESSAGE_LIMIT && Buffer.byteLength(body) <= TELEGRAM_MESSAGE_LIMIT;
};

const PREFIX = /^PREVIEW(?=$|[\s:—])(?:\s*[:—])?\s*/u;
/** Splits `text` into pieces each within `budget` encoded bytes, at the latest paragraph break, else line break, else
 * sentence end, else space in the second half of the piece; a hard cut at a code point only when none exists. */
function pieces(text: string, budget: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest) {
    if (Buffer.byteLength(encodeReply(rest)) <= budget) { out.push(rest); break; }
    const points = Array.from(rest);
    // The longest prefix (in code points) whose encoded body stays inside the budget.
    let low = 0, high = points.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (Buffer.byteLength(encodeReply(points.slice(0, mid).join(''))) <= budget) low = mid; else high = mid - 1;
    }
    const head = points.slice(0, low).join('');
    const floor = Math.floor(head.length / 2);
    const breaks = [/\n\s*\n/gu, /\n/gu, /[.!?…](?=\s)/gu, /\s/gu];
    let cut = head.length;
    for (const pattern of breaks) {
      const found = [...head.matchAll(pattern)].map(match => match.index! + match[0].length).filter(at => at > floor && at < head.length);
      if (found.length) { cut = found.at(-1)!; break; }
    }
    if (cut === 0) cut = head.length;
    out.push(head.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  return out.filter(item => item.length > 0);
}

/** One reply as the messages that carry it, in order (the operator's direction of 2026-10-03: an answer too long for
 * one Telegram message is never refused; it is split, in order). A reply that fits is one message, unchanged. A longer
 * one is cut at natural breaks; the first part ends " (1/N)" and each later part opens "PREVIEW (k/N) — ", so every
 * message stays PREVIEW-marked and its place is readable. `tail` is a suffix kept whole in the LAST part (an operator
 * request line and its disclosure, which the operator answers by replying to the message that carries it). Returns
 * null only for a reply needing more than MAX_REPLY_PARTS messages, or a tail no single message can carry. */
export function splitReply(reply: string, tail = ''): string[] | null {
  if (fitsOneMessage(reply)) return [reply];
  const kept = tail && reply.endsWith(tail) ? tail.trim() : '';
  const main = (kept ? reply.slice(0, reply.length - tail.length) : reply).trimEnd();
  const budget = TELEGRAM_MESSAGE_LIMIT - MARKER_ROOM;
  if (kept && Buffer.byteLength(encodeReply(kept)) > budget) return null;
  const parts = pieces(main, budget);
  if (kept) {
    const last = parts.at(-1);
    if (last !== undefined && Buffer.byteLength(encodeReply(`${last}\n\n${kept}`)) <= budget) parts[parts.length - 1] = `${last}\n\n${kept}`;
    else parts.push(kept);
  }
  if (parts.length > MAX_REPLY_PARTS) return null;
  const total = parts.length;
  const marked = parts.map((part, index) => index === 0 ? `${part} (1/${String(total)})`
    : `PREVIEW (${String(index + 1)}/${String(total)}) — ${part.replace(PREFIX, '')}`);
  return marked.every(fitsOneMessage) ? marked : null;
}
/** The send target of a continuation part (k ≥ 2) of the reply to turn `id`; part 1 keeps `reply:<id>`. */
export const replyPartTarget = (id: string, part: number) => `reply-part:${String(part)}:${id}`;
