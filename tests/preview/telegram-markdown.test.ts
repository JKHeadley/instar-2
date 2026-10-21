// md-render-1020: the model's markdown reaches Telegram as formatting, never as literal stars and hashes
// (observer 2026-10-20 13:59; recorded proof-room message 34501 carried "**Capitulation**" with no entities).
// A formatted send Telegram refuses to parse is resent once as plain text with the markers removed; nothing
// else is ever resent. Rules 42 (a refusal stays a refusal), 116; floor: no duplicate sends.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderTelegramHtml, sendFormattedText, telegramPlainText } from './telegram-markdown.mjs';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';
import { encodeReply, splitReply } from './reply-parts.js';

// The shape of the delivered proof-room reply 34501 (strong-agent-1020, 2026-10-20), shortened.
const RECORDED_34501 = 'The working-disciplines source names a specific set of "gravity wells":\n\n'
  + '1. **Capitulation** — caving to pushback just because it was pushback.\n'
  + '2. **False-completion** — reporting a task as done when it wasn\'t verified.';
// Recorded message 34485's shape: inline code in a numbered list.
const RECORDED_34485 = 'Done, in order:\n1. Created tools-625c2b.txt\n3. Ran `wc -c` on it — result: 25 bytes';

describe('rendering', () => {
  it.each([['## C#', 'C#'], ['## Heading ##', 'Heading']])('preserves heading content: %s', (md, shown) => {
    expect(renderTelegramHtml(md)).toEqual({ html: `<b>${shown}</b>`, shown });
    expect(telegramPlainText(md)).toBe(shown);
  });
  it.each(['https://example.com/a**b**c', 'https://example.com/a`b`c', 'https://example.com/a```b```c', 'https://example.com/a?b=1&c=2'])
  ('preserves the raw destination %s while formatting its label', url => {
    expect(renderTelegramHtml(`[**docs**](${url})`).html).toBe(`<a href="${url.replaceAll('&', '&amp;')}"><b>docs</b></a>`);
    expect(telegramPlainText(`[**docs**](${url})`)).toBe(`docs (${url})`);
  });
  it('keeps links inside inline code literal', () => {
    expect(renderTelegramHtml('`[docs](https://e.com)`').html).toBe('<code>[docs](https://e.com)</code>');
  });

  it('turns each element into Telegram HTML and leaves no markers in what is shown', () => {
    const md = '# Plan\n\nSome **bold**, some *italic* and `a < b` code.\n\n- first\n- second\n\n'
      + 'See [the docs](https://example.com/a?b=1&c=2).\n\n```js\nif (a && b) x();\n```';
    const { html, shown } = renderTelegramHtml(md);
    expect(html).toContain('<b>Plan</b>');
    expect(html).toContain('<b>bold</b>');
    expect(html).toContain('<i>italic</i>');
    expect(html).toContain('<code>a &lt; b</code>');
    expect(html).toContain('• first\n• second');
    expect(html).toContain('<a href="https://example.com/a?b=1&amp;c=2">the docs</a>');
    expect(html).toContain('<pre>if (a &amp;&amp; b) x();</pre>');
    expect(shown).toBe('Plan\n\nSome bold, some italic and a < b code.\n\n• first\n• second\n\n'
      + 'See the docs.\n\nif (a && b) x();');
    expect(shown).not.toMatch(/\*\*|^#|`/mu);
  });

  it('renders the recorded proof-room replies (34501, 34485) without literal markers', () => {
    expect(renderTelegramHtml(RECORDED_34501).html).toContain('1. <b>Capitulation</b> — caving');
    expect(renderTelegramHtml(RECORDED_34501).shown).not.toContain('**');
    expect(renderTelegramHtml(RECORDED_34485).html).toContain('Ran <code>wc -c</code> on it');
  });

  it('leaves text without markdown exactly as the escaped body it is today', () => {
    for (const text of ['17 times 23 is 391.', 'snake_case_name and 2 * 3 * 4 = 24, a <tag> & more', 'a - b']) {
      expect(renderTelegramHtml(text).html).toBe(encodeReply(text));
      expect(renderTelegramHtml(text).shown).toBe(text);
    }
  });

  it('never makes a link from an unsafe scheme', () => {
    const { html } = renderTelegramHtml('[click](javascript:alert(1))');
    expect(html).not.toContain('<a');
  });

  it('plain text keeps link text with its URL and drops every marker', () => {
    expect(telegramPlainText('# Plan\n**bold** *it* `code`\n- item\n[docs](https://e.com)'))
      .toBe('Plan\nbold it code\n• item\ndocs (https://e.com)');
  });

  it('each part of a split reply renders on its own and stays within one message', () => {
    const long = Array.from({ length: 80 }, (_, i) => `## Section ${i}\n- **point ${i}** with [a link](https://e.com/${i})`).join('\n\n');
    const parts = splitReply(long)!;
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      const { shown } = renderTelegramHtml(part);
      expect(shown).not.toMatch(/\*\*|^#/mu);
      expect(Array.from(shown).length).toBeLessThanOrEqual(4096);
      expect(Array.from(telegramPlainText(part)).length).toBeLessThanOrEqual(4096);
    }
  });
});

const receipt = (text: string) => ({ kind: 'response', status: 200,
  bytes: JSON.stringify({ ok: true, result: { message_id: 9, chat: { id: 7 }, text } }) });
const parseRefusal = { kind: 'response', status: 400,
  bytes: JSON.stringify({ ok: false, error_code: 400, description: "Bad Request: can't parse entities: unexpected end tag at byte offset 12" }) };
const classify = (reply: unknown, expectedText: string) => classifyTelegramSend(reply, { chat: '7', expectedText });

describe('sending', () => {
  const md = '**Done** — see [docs](https://e.com)';
  const body = { chat_id: '7' };

  it('sends HTML once and settles on the shown text', async () => {
    const calls: Record<string, unknown>[] = [];
    const outcome = await sendFormattedText({ text: renderTelegramHtml(md).html, expectedText: renderTelegramHtml(md).shown, fallback: { text: telegramPlainText(md) }, recordRefusal: () => {}, body, classify, mayResend: () => true,
      invoke: request => { calls.push(request); return receipt(String((request.text as string).replace(/<[^>]+>/gu, ''))); } });
    expect(outcome).toEqual({ kind: 'accepted', message: 9 });
    expect(calls).toEqual([{ chat_id: '7', text: '<b>Done</b> — see <a href="https://e.com">docs</a>', parse_mode: 'HTML' }]);
  });

  it('after a parse refusal sends plain text once, with no parse mode', async () => {
    const calls: Record<string, unknown>[] = [];
    const outcome = await sendFormattedText({ text: renderTelegramHtml(md).html, expectedText: renderTelegramHtml(md).shown, fallback: { text: telegramPlainText(md) }, recordRefusal: () => {}, body, classify, mayResend: () => true,
      invoke: request => { calls.push(request); return calls.length === 1 ? parseRefusal : receipt(request.text as string); } });
    expect(outcome).toEqual({ kind: 'accepted', message: 9 });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual({ chat_id: '7', text: 'Done — see docs (https://e.com)' });
  });

  it('a plain fallback that is also refused stays refused and is not tried a third time', async () => {
    let calls = 0;
    const outcome = await sendFormattedText({ text: renderTelegramHtml(md).html, expectedText: renderTelegramHtml(md).shown, fallback: { text: telegramPlainText(md) }, recordRefusal: () => {}, body, classify, mayResend: () => true,
      invoke: () => { calls++; return parseRefusal; } });
    expect(outcome.kind).toBe('refused');
    expect(calls).toBe(2);
  });

  it.each([
    ['an unknown outcome', { kind: 'uncertain', limitation: 'timeout' }],
    ['a different refusal', { kind: 'response', status: 400, bytes: JSON.stringify({ ok: false, description: 'Bad Request: chat not found' }) }],
    ['an accepted send', receipt('Done — see docs')],
  ])('never resends after %s', async (_name, reply) => {
    let calls = 0;
    await sendFormattedText({ text: renderTelegramHtml(md).html, expectedText: renderTelegramHtml(md).shown, fallback: { text: telegramPlainText(md) }, recordRefusal: () => {}, body, classify, mayResend: () => true,
      invoke: () => { calls++; return reply; } });
    expect(calls).toBe(1);
  });

  it('a stop or lost ownership between the refusal and the fallback sends nothing more', async () => {
    let calls = 0;
    const outcome = await sendFormattedText({ text: renderTelegramHtml(md).html, expectedText: renderTelegramHtml(md).shown, fallback: { text: telegramPlainText(md) }, recordRefusal: () => {}, body, classify, mayResend: () => false,
      invoke: () => { calls++; return parseRefusal; } });
    expect(calls).toBe(1);
    expect(outcome.kind).toBe('refused');
  });

  it('a body that is not the plain encoding of its text is sent exactly as signed', async () => {
    const calls: Record<string, unknown>[] = [];
    await sendFormattedText({ text: '<b>fixed</b>', expectedText: 'fixed', recordRefusal: () => {}, body, classify, mayResend: () => true,
      invoke: request => { calls.push(request); return receipt('fixed'); } });
    expect(calls).toEqual([{ chat_id: '7', text: '<b>fixed</b>', parse_mode: 'HTML' }]);
  });
});

it('records the parse refusal before fallback and sends nothing more if persistence fails', async () => {
  let calls = 0;
  await expect(sendFormattedText({ text: '<b>Done</b>', expectedText: 'Done', fallback: { text: 'Done' }, body: {}, classify,
    mayResend: () => true, recordRefusal: () => { throw Error('disk unavailable'); },
    invoke: () => { calls++; return parseRefusal; } })).rejects.toThrow('disk unavailable');
  expect(calls).toBe(1);
});

it('a proved-not-sent plain alternative is exhausted, not permission to restart HTML', async () => {
  let calls = 0;
  const result = await sendFormattedText({ text: '<b>Done</b>', expectedText: 'Done', fallback: { text: 'Done' }, body: {},
    classify: (reply, text) => calls === 2 ? { kind: 'not-sent', reason: 'connect refused' } : classify(reply, text),
    mayResend: () => true, recordRefusal: () => {}, invoke: () => { calls++; return parseRefusal; } });
  expect(result).toEqual({ kind: 'refused', reason: 'connect refused' });
  expect(calls).toBe(2);
});

it('replays recorded summary, Jev, review and empty shapes without changing their content', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
    otherShapes: { kind: string; id: string; raw: string }[] };
  expect(fixture.otherShapes.map(row => row.id)).toEqual(['summary:715672480', '715672483', '715672482', '969389570',
    '969389923', 'telegram:8994258214:update:715672479', 'telegram:8994258214:update:715672550']);
  for (const row of fixture.otherShapes) {
    const expected = row.kind === 'delivered-reply' ? row.raw.replaceAll('\n- ', '\n• ') : row.raw;
    expect(renderTelegramHtml(row.raw).shown, row.kind).toBe(expected);
    expect(telegramPlainText(row.raw), row.kind).toBe(expected);
  }
});

it.each([true, false])('awaits retained refusal custody before the alternative (peer admitted=%s)', async admitted => {
  const events: string[] = [];
  const result = await sendFormattedText({ text: '<b>Done</b>', expectedText: 'Done', fallback: { text: 'Done' }, body: {}, classify,
    mayResend: () => true, recordRefusal: async () => { events.push('stored'); await Promise.resolve(); events.push('peer'); return admitted; },
    invoke: request => { events.push(request.parse_mode === 'HTML' ? 'html' : 'plain'); return events.length === 1 ? parseRefusal : receipt('Done'); } });
  expect(events).toEqual(admitted ? ['html', 'stored', 'peer', 'plain'] : ['html', 'stored', 'peer']);
  expect(result.kind).toBe(admitted ? 'accepted' : 'refused');
});
