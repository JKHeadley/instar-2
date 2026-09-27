import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(41);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 100, maxReplies: 60, maxTurns: 60, maxBytes: 32768, cursor: 0 };
const raw = (update: number, text: string) => JSON.stringify({ update_id: update,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    date: 1790000000 + update * 60 } });

it('lists at most 20 active journal items newest first after forgetting and correction, including replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-list-')));
  const path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    for (let update = 1; update <= 25; update++) {
      const text = `Remember my detail ${update}.`;
      const id = `turn-${update}`;
      journal.append({ kind: 'intake', id, update, text, raw: raw(update, text),
        accepted: true, cursor: update + 1, at: 1790000000000 + update * 60000 });
      journal.append({ kind: 'reserve', id, at: 1790000000000 + update * 60000 });
      journal.append({ kind: 'answer', id, text: 'Saved.', at: 1790000000000 + update * 60000 });
      journal.append({ kind: 'intent', id, text: 'PREVIEW — Saved.', chat: genesis.chat, update,
        grant: genesis.grant, at: 1790000000000 + update * 60000 });
      journal.append({ kind: 'sent', id, message: update, at: 1790000000000 + update * 60000 });
    }
    const correction = 'Actually, my detail 24 is blue. I no longer need detail 23.';
    journal.append({ kind: 'intake', id: 'turn-26', update: 26, text: correction, raw: raw(26, correction),
      accepted: true, cursor: 27, at: 1790001560000 });
    journal.append({ kind: 'reserve', id: 'turn-26', at: 1790001560000 });
    journal.append({ kind: 'answer', id: 'turn-26', text: 'Corrected.', at: 1790001560000 });
    journal.append({ kind: 'intent', id: 'turn-26', text: 'PREVIEW — Corrected.', chat: genesis.chat,
      update: 26, grant: genesis.grant, at: 1790001560000 });
    journal.append({ kind: 'sent', id: 'turn-26', message: 26, at: 1790001560000 });
    journal.append({ kind: 'summary-reserve', through: 26, at: 1790001560000 });
    journal.append({ kind: 'summary', through: 26, text: 'The operator supplied details.', memoryFor: ['turn-26'],
      commitments: Array.from({ length: 25 }, (_, index) => ({ in: 'message' as const,
        source: `turn-${index + 1}`, quote: `Remember my detail ${index + 1}.` })),
      closed: [{ id: 22, source: 'turn-26', quote: 'I no longer need detail 23.' }],
      memory: [
        { mode: 'forget', source: 'turn-25', quote: 'Remember my detail 25.', trigger: 'turn-26' },
        { mode: 'correct', source: 'turn-24', quote: 'Remember my detail 24.',
          replacement: 'my detail 24 is blue', trigger: 'turn-26' }
      ], state: 'complete', at: 1790001560000 });
    journal.close();
    journal = openPreviewJournal(path, key);
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790001700000, stopped: () => false,
      model: async () => JSON.stringify({ reply: 'An untrusted model list.', memory: [], dated: [], memoryList: true }),
      send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
    worker.intake([JSON.parse(raw(27, 'What do you remember about me?'))]);
    await worker.drain();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('my detail 24 is blue');
    expect(sent[0]).not.toContain('Remember my detail 24.');
    expect(sent[0]).not.toContain('Remember my detail 25.');
    expect(sent[0]).not.toContain('Remember my detail 23.');
    expect(sent[0]).not.toContain('An untrusted model list.');
    expect(sent[0]).toContain('To correct or forget this');
    expect((sent[0]!.match(/^\d+\./gmu) ?? [])).toHaveLength(20);
    expect(sent[0]!.indexOf('my detail 24 is blue')).toBeLessThan(sent[0]!.indexOf('Remember my detail 22.'));
    expect(Buffer.byteLength(sent[0]!)).toBeLessThan(4096);
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(journal.view.order.at(-1)?.intent).toBe(sent[0]);
    expect(journal.view.memory).toHaveLength(2);
    const reopened = createJournalWorker(journal, { now: () => 1790001700000, stopped: () => false,
      model: async () => { throw Error('answered turn must not call again'); },
      send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
    await reopened.drain();
    expect(sent).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('leaves an ordinary answer alone when the model does not request the list', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-list-no-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async () => JSON.stringify({ reply: 'An ordinary answer.', memory: [], dated: [] }),
      send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
    worker.intake([JSON.parse(raw(1, 'Hello.'))]);
    await worker.drain();
    expect(sent).toEqual(['PREVIEW — An ordinary answer.']);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('says plainly when the journal has no active saved items', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-list-empty-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async () => JSON.stringify({ reply: 'Invented fact.', memory: [], dated: [], memoryList: true }),
      send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
    worker.intake([JSON.parse(raw(1, 'What do you remember about me?'))]);
    await worker.drain();
    expect(sent).toEqual(['PREVIEW — I have no active saved memory items about you in this preview journal.']);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('includes active dated items and reply preferences from answer frames', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-list-answers-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const datedText = 'My appointment is October 4.';
    journal.append({ kind: 'intake', id: 'turn-1', update: 1, text: datedText, raw: raw(1, datedText),
      accepted: true, cursor: 2, at: 1790000060000 });
    journal.append({ kind: 'reserve', id: 'turn-1', at: 1790000060000 });
    journal.append({ kind: 'answer', id: 'turn-1', text: 'Saved.', dated: [{ source: 'turn-1',
      quote: datedText, when: 'October 4', zone: 'UTC', day: '2026-10-04' }], at: 1790000060000 });
    journal.append({ kind: 'intent', id: 'turn-1', text: 'PREVIEW — Saved.', chat: genesis.chat,
      update: 1, grant: genesis.grant, at: 1790000060000 });
    journal.append({ kind: 'sent', id: 'turn-1', message: 1, at: 1790000060000 });
    const preference = 'Use concise answers.';
    journal.append({ kind: 'intake', id: 'turn-2', update: 2, text: preference, raw: raw(2, preference),
      accepted: true, cursor: 3, at: 1790000120000 });
    journal.append({ kind: 'reserve', id: 'turn-2', at: 1790000120000 });
    journal.append({ kind: 'answer', id: 'turn-2', text: 'Understood.', memory: [{ mode: 'prefer',
      source: 'turn-2', quote: preference, trigger: 'turn-2' }], at: 1790000120000 });
    journal.append({ kind: 'intent', id: 'turn-2', text: 'PREVIEW — Understood.', chat: genesis.chat,
      update: 2, grant: genesis.grant, at: 1790000120000 });
    journal.append({ kind: 'sent', id: 'turn-2', message: 2, at: 1790000120000 });
    journal.append({ kind: 'summary-reserve', through: 2, at: 1790000120000 });
    journal.append({ kind: 'summary', through: 2, text: 'The operator shared a date and answer preference.',
      memoryFor: ['turn-2'], state: 'complete', at: 1790000120000 });
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000200000, stopped: () => false,
      model: async () => JSON.stringify({ reply: 'Anything.', memory: [], dated: [], memoryList: true }),
      send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
    worker.intake([JSON.parse(raw(3, 'What do you remember about me?'))]);
    await worker.drain();
    expect(sent[0]).toContain('1. Use concise answers.');
    expect(sent[0]).toContain('2. My appointment is October 4.');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
