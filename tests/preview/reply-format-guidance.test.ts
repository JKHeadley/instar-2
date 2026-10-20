import { expect, it } from 'vitest';
import { ANSWER_INSTRUCTIONS, MEMORY_LOOKUP_INSTRUCTIONS, REPLY_FORMAT_GUIDANCE, answerInstructions, replyFormatGuidance } from './briefing.js';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { renderTelegramHtml } from './telegram-markdown.mjs';

// md-briefing-1020: the model is told, on the turn's own platform, which markdown that platform shows,
// so a "compare three options" reply comes out as a short list rather than a table or # headings. The
// md-render-1020 renderer stays the safety net for anything written anyway.
const instructionsOf = (bytes: string) => (JSON.parse(bytes) as { messages: { role: string; content: string }[] })
  .messages.find(message => message.role === 'instructions')?.content;
const envelope = (id: string, packet: Record<string, unknown> = {}) =>
  prepareJournalEnvelope({ question: 'Give me a short comparison of three options.', context: JSON.stringify(packet), id },
    'claude-sonnet-5', 'grant', 1, 1_000_000);

it('carries the Telegram format guidance on a Telegram turn and no other platform\'s', () => {
  const instructions = instructionsOf(envelope('telegram:123:update:45'));
  expect(instructions).toBe(`${ANSWER_INSTRUCTIONS}\n${REPLY_FORMAT_GUIDANCE.telegram}`);
  expect(instructions).not.toContain(REPLY_FORMAT_GUIDANCE.slack);
  // Memory lookup keeps its place; the format line follows it once.
  expect(instructionsOf(envelope('telegram:123:update:45', { memoryLookup: 'offered' })))
    .toBe(`${ANSWER_INSTRUCTIONS}\n${MEMORY_LOOKUP_INSTRUCTIONS}\n${REPLY_FORMAT_GUIDANCE.telegram}`);
});

it('carries the Slack guidance on a Slack turn and none on a runner task', () => {
  const slack = instructionsOf(envelope('slack:C0123:1700000000.000100'));
  expect(slack).toBe(`${ANSWER_INSTRUCTIONS}\n${REPLY_FORMAT_GUIDANCE.slack}`);
  expect(slack).not.toContain(REPLY_FORMAT_GUIDANCE.telegram);
  for (const id of ['work:obligation-1:0', 'work-repair:k:0', 'prepare:telegram:1:update:2:abc', 'select-due:telegram:1:update:2:abc'])
    expect(instructionsOf(envelope(id)), id).toBe(ANSWER_INSTRUCTIONS);
  // Maintenance calls carry no answer instructions at all, so no format guidance either.
  expect(instructionsOf(envelope('summary:10'))).toBeUndefined();
  expect(instructionsOf(envelope('telegram:123:update:45:reply-review'))).toBeUndefined();
  expect(replyFormatGuidance('telegramish:1')).toBe('');
  expect(answerInstructions('work:x', false)).toBe(ANSWER_INSTRUCTIONS);
});

it('names only what the Telegram renderer shows as formatting, and steers tables and headings to a list', () => {
  const guide = REPLY_FORMAT_GUIDANCE.telegram;
  for (const [marker, tag] of [['**bold**', '<b>bold</b>'], ['*italic*', '<i>italic</i>'], ['`code`', '<code>code</code>'],
    ['```blocks```', '<pre>blocks</pre>']] as const) {
    expect(guide).toContain(marker);
    expect(renderTelegramHtml(marker).html).toBe(tag);
  }
  expect(guide).toContain('[text](url)');
  expect(renderTelegramHtml('[text](https://example.com)').html).toBe('<a href="https://example.com">text</a>');
  expect(renderTelegramHtml('- one\n- two').html).toBe('• one\n• two');
  // Neither a table nor a heading reaches Telegram as one: the table becomes a monospace block, the heading bold text.
  expect(renderTelegramHtml('| a | b |\n|---|---|\n| 1 | 2 |').html).toBe('<pre>| a | b |\n| 1 | 2 |</pre>');
  expect(renderTelegramHtml('# Options').html).toBe('<b>Options</b>');
  expect(guide).toMatch(/no tables or # headings/u);
  expect(guide).toMatch(/short list/u);
  expect(REPLY_FORMAT_GUIDANCE.slack).toMatch(/no tables or # headings/u);
  // Rule 116 / every turn carries it: each line stays short.
  for (const line of Object.values(REPLY_FORMAT_GUIDANCE)) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(160);
});
