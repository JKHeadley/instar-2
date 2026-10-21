// md-render-1020: the model writes markdown; Telegram shows it only as HTML formatting. This renders a reply's
// markdown (headings, bullets, bold, italics, code, fenced code, tables, links) as Telegram HTML, ported in small
// from Instar 1.x's TelegramMarkdownFormatter (src/messaging/TelegramMarkdownFormatter.ts, the proven pipeline:
// extract code first, escape, then emphasis, headings, bullets and links). Anything it does not recognise stays
// literal text, escaped exactly as `encodeReply` escapes it today.
//
// `sendFormattedText` is the one physical send of a reply. If Telegram refuses the formatted send as unparsable
// (a 4xx "can't parse entities", which proves no message was created), the same reply is sent once more as plain
// text with the markers removed. That is the only resend: an accepted, unknown or other refused outcome is final
// (Rules 42 and 116; floor: no duplicate sends).

const PUA = /[\u{100000}-\u{10FFFD}]/gu;
const MARK = String.fromCodePoint(0x10fffd);
const slot = n => `${MARK}${String.fromCodePoint(0x100000 + n)}${MARK}`;
const SLOT = /\u{10FFFD}([\u{100000}-\u{10FFFC}])\u{10FFFD}/gu;
/** Longer bodies are not converted (a regex-cost guard, as in 1.x); a reply part is far below it. */
const MAX_INPUT = 32768;

const escapeText = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttribute = s => escapeText(s.replace(/[\x00-\x1f\x7f]/gu, '')).replaceAll('"', '&quot;');
const unescapeText = s => s.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&');
const safeUrl = raw => /^(https?|tg|mailto):\S+$/iu.test(raw.trim()) ? raw.trim() : null;

/** Fenced code, tables and inline code, set aside before anything else is read as markdown. */
function extract(text, held, render) {
  const out = [];
  for (let i = 0; i < text.length;) {
    const end = text.startsWith('```', i) ? text.indexOf('```', i + 3) : -1;
    if (end === -1) { out.push(text[i]); i++; continue; }
    const newline = text.indexOf('\n', i + 3);
    const inner = text.slice(newline !== -1 && newline < end ? newline + 1 : i + 3, end).replace(/\n$/u, '');
    held.push(render.pre(inner)); out.push(slot(held.length - 1)); i = end + 3;
  }
  const lines = out.join('').split('\n'), kept = [];
  const row = s => /^\s*\|.{1,2000}\|\s*$/u.test(s), separator = s => /^\s*\|[\s\-:|]{1,2000}\|\s*$/u.test(s);
  for (let i = 0; i < lines.length;) {
    let j = i;
    while (j < lines.length && row(lines[j])) j++;
    const block = lines.slice(i, j);
    if (block.some(separator) && block.some(line => !separator(line))) {
      held.push(render.pre(block.filter(line => !separator(line)).join('\n'))); kept.push(slot(held.length - 1)); i = j;
    } else { kept.push(lines[i]); i++; }
  }
  return kept.join('\n').replace(/`([^`\n]{1,500})`/gu, (_m, inner) => { held.push(render.code(inner)); return slot(held.length - 1); });
}

/** `[text](url)` with balanced parentheses in the URL; an unsafe scheme stays literal. */
function links(text, render) {
  const out = [];
  for (let i = 0; i < text.length;) {
    const close = text[i] === '[' ? text.slice(i + 1, i + 501).search(/[\]\n]/u) : -1;
    if (close === -1 || text[i + 1 + close] !== ']' || text[i + 2 + close] !== '(') { out.push(text[i]); i++; continue; }
    const start = i + 3 + close;
    let depth = 1, end = -1;
    for (let k = start; k < Math.min(text.length, start + 2048) && text[k] !== '\n'; k++) {
      if (text[k] === '(') depth++;
      else if (text[k] === ')' && --depth === 0) { end = k; break; }
    }
    const url = end === -1 ? null : safeUrl(render.raw(text.slice(start, end)));
    if (url === null) { out.push(text[i]); i++; continue; }
    out.push(render.link(text.slice(i + 1, i + 1 + close), url)); i = end + 1;
  }
  return out.join('');
}

function convert(markdown, render) {
  const held = [];
  let text = render.escape(extract(markdown.replaceAll('\0', '').replace(PUA, ''), held, render));
  text = text.replace(/\*\*\*([^*\n]{1,200}?)\*\*\*/gu, (_m, t) => render.bold(render.italic(t)))
    .replace(/\*\*([^*\n]{1,200}?)\*\*/gu, (_m, t) => render.bold(t))
    .replace(/(^|[\s(,.;:!?])\*(?!\s)([^*\n]{1,200}?)(?<!\s)\*(?=$|[\s),.;:!?])/gmu, (_m, before, t) => before + render.italic(t))
    .replace(/^#{1,6}[ \t]+(.{1,2000}?)[ \t]*#*[ \t]*$/gmu, (_m, t) => render.bold(t))
    .replace(/^([ \t]{0,20})[-*+][ \t]+/gmu, '$1• ');
  return links(text, render).replace(SLOT, (_m, ch) => held[ch.codePointAt(0) - 0x100000] ?? '');
}

const HTML = { escape: escapeText, raw: unescapeText, pre: t => `<pre>${escapeText(t)}</pre>`, code: t => `<code>${escapeText(t)}</code>`,
  bold: t => `<b>${t}</b>`, italic: t => `<i>${t}</i>`, link: (t, url) => `<a href="${escapeAttribute(url)}">${t}</a>` };
const PLAIN = { escape: t => t, raw: t => t, pre: t => t, code: t => t, bold: t => t, italic: t => t, link: (t, url) => `${t} (${url})` };

/** A reply's Telegram HTML body and the text Telegram shows for it (what its receipt echoes back). */
export function renderTelegramHtml(markdown) {
  if (markdown.length > MAX_INPUT) return { html: escapeText(markdown), shown: markdown };
  const html = convert(markdown, HTML);
  return { html, shown: unescapeText(html.replace(/<[^>]*>/gu, '')) };
}

/** The same reply as plain text: every marker removed, each link's text kept with its URL. */
export const telegramPlainText = markdown => markdown.length > MAX_INPUT ? markdown : convert(markdown, PLAIN);

const parseRefused = reply => {
  if (reply?.kind !== 'response' || reply.status !== 400) return false;
  try { const payload = JSON.parse(reply.bytes); return payload?.ok === false && /can't parse entities/iu.test(String(payload.description)); }
  catch { return false; }
};

/** Sends one reply. `text` is its signed HTML body and `expectedText` its text; only a body that is exactly the
 * escaped text is rendered as markdown (any other body is sent as signed). `mayResend` is re-checked (stop,
 * ownership, expiry) before the single plain fallback. */
export function sendFormattedText({ text, expectedText, body, invoke, classify, mayResend }) {
  if (text !== escapeText(expectedText)) return classify(invoke({ ...body, text, parse_mode: 'HTML' }), expectedText);
  const { html, shown } = renderTelegramHtml(expectedText);
  const reply = invoke({ ...body, text: html, parse_mode: 'HTML' });
  const outcome = classify(reply, shown);
  if (outcome.kind !== 'refused' || !parseRefused(reply) || !mayResend()) return outcome;
  const plain = telegramPlainText(expectedText);
  return classify(invoke({ ...body, text: plain }), plain);
}
