/** Rule 11: replay the recorded S inputs through the real journal answer path.
 * The snapshot has projected memory/reasons and delivered text, not raw model outputs.
 * The answer strings below reconstruct those reasons; the fixture preserves that distinction.
 * lost-answer/journal-recall-lookup additionally replay captured raw Decision outputs. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/recall-meaning-2026-10-24.json', import.meta.url), 'utf8')) as {
  turns: { label: string; question: string; update: number; memory: { source: string; replacement: string }[]; recalledIds: string[];
    memoryLookup: unknown; answerReason?: string; delivered: string }[] };
const key = new Uint8Array(32).fill(41);
const genesis = { kind: 'genesis' as const, bot: '8813073094', chat: '7812716706', operator: '7812716706',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 409600, cursor: 0 };
const raw = (update: number, text: string) => ({ update_id: update,
  message: { chat: { id: Number(genesis.chat), type: 'private' }, from: { id: Number(genesis.operator) }, text, date: 1792880000 } });

async function replay(index: number, reply: string | { answer: string }, question?: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-recall-meaning-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const recorded = fixture.turns[index]!;
  for (const memory of recorded.memory) {
    const update = Number(memory.source.split(':').at(-1)), text = memory.replacement!;
    journal.append({ kind: 'intake', id: memory.source, update, text, raw: JSON.stringify(raw(update, text)),
      accepted: true, cursor: update + 1, at: 1792880000000 + update });
    journal.append({ kind: 'reserve', id: memory.source, at: 1792880000000 + update });
    journal.append({ kind: 'answer', id: memory.source, text: 'Noted.', memory: [{ mode: 'remember', source: memory.source, quote: text, trigger: memory.source }], at: 1792880000000 + update });
    journal.append({ kind: 'intent', id: memory.source, text: 'Noted.', chat: genesis.chat, update,
      grant: genesis.grant, at: 1792880000000 + update });
    journal.append({ kind: 'sent', id: memory.source, message: update, at: 1792880000000 + update });
  }
  // Additional synthetic pressure, not claimed as the recorded garden-log bytes.
  // Keep the recorded facts outside verbatim history, as in the live S turn.
  for (let update = 367054083; update <= 367054098; update++) {
    const id = `telegram:${genesis.bot}:update:${update}`;
    const text = 'Garden rows watered at dawn; mulch damp; soil loose after rain. '.repeat(75);
    journal.append({ kind: 'intake', id, update, text, raw: JSON.stringify(raw(update, text)),
      accepted: true, cursor: update + 1, at: 1792880000000 + update });
    journal.append({ kind: 'reserve', id, at: 1792880000000 + update });
    journal.append({ kind: 'answer', id, text: 'Noted.', at: 1792880000000 + update });
    journal.append({ kind: 'intent', id, text: 'Noted.', chat: genesis.chat, update,
      grant: genesis.grant, at: 1792880000000 + update });
    journal.append({ kind: 'sent', id, message: update, at: 1792880000000 + update });
  }
  journal.append({ kind: 'summary-reserve', through: 367054098, at: 1792888000000 });
  // Synthetic concept proposal exercises the existing recall owner; no new search behavior.
  journal.append({ kind: 'summary', through: 367054098, text: 'The operator recorded personal facts and garden logs.',
    concepts: [{ source: 'telegram:8813073094:update:367054059', terms: ['dentist', 'teeth', 'dental care'] }],
    at: 1792888000000 });
  const sent: string[] = [], packets: { recalled?: { id: string }[]; datedDecision: string }[] = [];
  const worker = createJournalWorker(journal, { now: () => 1792889000000, stopped: () => false,
    model: async input => {
      packets.push(JSON.parse(input.context));
      return JSON.stringify({ reply, memory: [], dated: [], memoryList: true });
    }, send: async input => { sent.push(input.text); return input.update; }, checkOutbound: () => {} });
  try {
    worker.intake([raw(recorded.update, question ?? recorded.question)]);
    await worker.drain();
    return { sent, packets };
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}

it.each([false, true])('keeps the fact answer even with the historical list flag (structured=%s)', async structured => {
  const recorded = fixture.turns[0]!;
  expect(recorded.answerReason).toContain('Doctor Okafor');
  expect(recorded.delivered).toContain('Here are 20 active memory items');
  const answer = 'You said your dentist is Doctor Okafor.';
  const result = await replay(0, structured ? { answer } : answer);
  expect(result.sent).toEqual([expect.stringContaining(answer)]);
  expect(result.sent[0]).not.toContain('active memory items');
  expect(result.packets[0]!.recalled?.map(item => item.id)).toContain('telegram:8813073094:update:367054059');
});

it('keeps the late fact and never-said answers instead of listing unrelated memory', async () => {
  expect((await replay(1, { answer: 'The spare cabin key hangs behind the barometer.' })).sent)
    .toEqual([expect.stringContaining('The spare cabin key hangs behind the barometer.')]);
  // The delivered never-said text is captured, not a reconstructed answer.
  const negative = fixture.turns[2]!.delivered;
  expect(negative).not.toContain('active memory items');
  expect((await replay(2, { answer: negative })).sent).toEqual([expect.stringContaining(negative)]);
});

it.each(['', { answer: '' }])('an explicit inventory request still lists with an empty answer: %j', async reply => {
  const result = await replay(0, reply, 'List what you remember about me.');
  expect(result.sent[0]).toContain('Here are 20 active memory items');
  expect(result.sent[0]).toContain('older active items not shown');
  expect(result.packets[0]!.datedDecision).toContain('only for inventories');
  expect(result.packets[0]!.datedDecision).toContain('reply.answer:""');
});
