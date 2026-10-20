import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, replyFormatting } from './journal-test-worker.js';
import { sendFormattedText } from './telegram-markdown.mjs';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';

const key = new Uint8Array(32).fill(7);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 100, maxReplies: 100, maxTurns: 100,
  maxBytes: 262144, cursor: 0 };
const recorded = JSON.parse(readFileSync(new URL('./fixtures/markdown-recorded-2026-10-20.json', import.meta.url), 'utf8')) as {
  messages: { id: number; message: string }[]; bridgeRefusal: unknown; bridgeMarkdown: string; bridgeShown: string };
const refusal = { kind: 'response' as const, status: 400, bytes: JSON.stringify(recorded.bridgeRefusal) };
const answer = '## C#\n**Done** — [docs](https://example.com/a**b**c)';
const cases = [ ...(['accepted', 'fallback', 'unknown'] as const).map(mode => ({ name: mode, mode, answer })),
  ...recorded.messages.map(message => ({ name: `recorded Telegram ${message.id}`, mode: 'fallback' as const, answer: message.message })) ];
it.each(cases)('journal preparation binds transmitted bytes and replay: $name', async ({ mode, answer }) => {
  const dir = mkdtempSync(join(tmpdir(), 'markdown-preparation-')), path = join(dir, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis);
  const calls: Record<string, unknown>[] = [];
  const ports = { now: () => 1000, stopped: () => false, checkOutbound: () => {}, model: async () => JSON.stringify({ reply: answer, memory: [] }),
    send: async (input: Parameters<Parameters<typeof createJournalWorker>[1]['send']>[0]) => {
      if (!input.target?.startsWith('reply:')) return 99;
      const target = input.target, formatting = input.formatting!;
      expect(replyFormatting(journal.view, target)).toEqual(formatting);
      expect(journal.verifyOutbound(input.provenance, { target, chat: input.chat, body: input.text })).toBe(true);
      expect(journal.verifyOutbound(input.provenance, { target, chat: input.chat, body: answer })).toBe(false);
      expect(journal.verifyOutbound(formatting.fallback.provenance, { target, chat: input.chat, body: formatting.fallback.text + 'changed' })).toBe(false);
      expect(journal.verifyOutbound(formatting.fallback.provenance, { target: target + 'other', chat: input.chat, body: formatting.fallback.text })).toBe(false);
      return sendFormattedText({ text: input.text, expectedText: input.expectedText, fallback: formatting.fallback, body: { chat_id: input.chat },
        recordRefusal: response => journal.append({ kind: 'send-format-refused', target, response: response as typeof refusal, at: 1000 }),
        mayResend: () => true,
        classify: (response, shown) => classifyTelegramSend(response, { chat: input.chat, expectedText: shown }),
        invoke: body => {
          const fallback = body.parse_mode === undefined;
          expect(journal.verifyOutbound(fallback ? formatting.fallback.provenance : input.provenance,
            { target, chat: input.chat, body: body.text as string })).toBe(true);
          if (fallback) expect(replyFormatting(journal.view, target)?.refusal).toEqual(refusal);
          calls.push(body);
          if (calls.length === 1 && mode === 'fallback') return refusal;
          if (mode === 'unknown') return { kind: 'uncertain', limitation: 'timeout' };
          return { kind: 'response', status: 200, bytes: JSON.stringify({ ok: true,
            result: { message_id: 9, chat: { id: 7654321 }, text: fallback ? formatting.fallback.text : formatting.shown } }) };
        } });
    } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'Tell me about C#' } }]);
    await worker.drain();
    expect(calls).toHaveLength(mode === 'fallback' ? 2 : 1);
    expect(calls[0]!.text).toMatch(/<(b|code)>/u);
    if (answer.includes('C#')) {
      expect(calls[0]!.text).toContain('<b>C#</b>');
      expect(calls[0]!.text).toContain('href="https://example.com/a**b**c"');
    }
    const turn = journal.view.order[0]!, saved = structuredClone(turn.formatting);
    expect(saved?.refusal).toEqual(mode === 'fallback' ? refusal : undefined);
    if (answer.includes('C#')) expect(saved?.fallback.text).toContain('https://example.com/a**b**c');
    journal.compact();
    journal.close(); journal = openPreviewJournal(path, key);
    expect(journal.view.order[0]!.formatting).toEqual(saved);
    await createJournalWorker(journal, ports).drain();
    expect(calls).toHaveLength(mode === 'fallback' ? 2 : 1);
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('restart dispatches only unstarted continuation parts from their stored preparation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'markdown-parts-')), path = join(dir, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis), stopped = false;
  const long = Array.from({ length: 100 }, (_, i) => `## C# ${i}\n**Done** — [docs](https://example.com/a**b**c)`).join('\n\n');
  const calls: string[] = [];
  try {
    const ports = { now: () => 1000, stopped: () => stopped, checkOutbound: () => {},
      model: async () => JSON.stringify({ reply: long, memory: [] }),
      send: async (input: Parameters<Parameters<typeof createJournalWorker>[1]['send']>[0]) => {
        calls.push(input.text); stopped = true; return 1;
      } };
    const worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'Give me the sections' } }]);
    await expect(worker.drain()).rejects.toThrow('stopped');
    const saved = structuredClone(journal.view.order[0]!.replyParts!);
    expect(saved.length).toBeGreaterThan(0);
    journal.close(); journal = openPreviewJournal(path, key); stopped = false;
    await createJournalWorker(journal, { ...ports, model: async () => { throw Error('must not regenerate'); }, send: async input => {
      const part = saved[calls.length - 1]!;
      expect(input.text).toBe(part.body);
      expect(input.expectedText).toBe(part.formatting!.shown);
      expect(input.formatting).toEqual(part.formatting);
      expect(journal.verifyOutbound(input.provenance, { target: input.target!, chat: input.chat, body: input.text })).toBe(true);
      calls.push(input.text); return calls.length;
    } }).drain();
    expect(calls).toHaveLength(saved.length + 1);
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});
