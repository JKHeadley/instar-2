import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(41);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
const update = (id: number, message: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: message, date: 1790000000 + id * 60 } });

it('names a validated correction old to new once, and withholds its old clause from later context', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-ack-correct-')));
  const path = join(root, 'journal.encrypted');
  const sends: string[] = [];
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; question: string; context: string }) => {
      const packet = JSON.parse(input.context);
      if (input.id.startsWith('summary:')) {
        const source = packet.memoryCandidates?.find((item: { message: string }) => item.message.includes('East Pier'));
        return JSON.stringify({ summary: 'The cedar trail starts at West Pier.', people: [],
          memory: source ? [{ mode: 'correct', source: source.id, quote: 'The cedar trail starts at East Pier.',
            replacement: 'the cedar trail starts at West Pier.' }] : [] });
      }
      return 'Okay.';
    }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'The cedar trail starts at East Pier.')]); await worker.drain();
    worker.intake([update(2, 'Actually, the cedar trail starts at West Pier.')]); await worker.drain();
    expect(sends[1]).toBe('PREVIEW — Changed The cedar trail starts at East Pier. → the cedar trail starts at West Pier.');
    expect(sends[1]?.includes('\n')).toBe(false);
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    await worker.drain();
    expect(sends).toHaveLength(2);
    const next = worker.probe('Where does the trail start?');
    if ('reason' in next) throw Error(next.reason);
    expect(next.context).not.toContain('East Pier');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('names the forgotten subject without repeating a code value, while a no-change turn keeps its ordinary reply', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-ack-forget-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const sends: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async (input: { id: string; question: string; context: string }) => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) {
          const phrase = packet.memoryRequest?.message === 'Forget the archive access phrase.';
          const combination = packet.memoryRequest?.message === 'Forget my locker combination.';
          const quote = phrase ? 'The archive access phrase is silver crane.'
            : combination ? 'My locker combination is 7744.' : 'My gym locker code is 3310.';
          const source = packet.memoryCandidates?.find((item: { message: string }) => item.message.includes(quote));
          return JSON.stringify({ summary: 'The requested secret was forgotten.', people: [], memory: source
            ? [{ mode: 'forget', source: source.id, quote }] : [] });
        }
        return input.question === 'Forget my gym locker code.' ? 'I forgot 3310.' : 'Okay.';
      }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
    worker.intake([update(1, 'My gym locker code is 3310.')]); await worker.drain();
    worker.intake([update(2, 'Forget my gym locker code.')]); await worker.drain();
    expect(sends[1]).toBe('PREVIEW — Forgot My gym locker code.');
    expect(sends[1]).not.toContain('3310');
    worker.intake([update(3, 'How is the weather?')]); await worker.drain();
    expect(sends[2]).toBe('PREVIEW — Okay.');
    worker.intake([update(4, 'The archive access phrase is silver crane.')]); await worker.drain();
    worker.intake([update(5, 'Forget the archive access phrase.')]); await worker.drain();
    expect(sends[4]).toBe('PREVIEW — Forgot The archive access phrase.');
    expect(sends[4]).not.toContain('silver crane');
    worker.intake([update(6, 'My locker combination is 7744.')]); await worker.drain();
    worker.intake([update(7, 'Forget my locker combination.')]); await worker.drain();
    expect(sends[6]).toBe('PREVIEW — Forgot My locker combination.');
    expect(sends[6]).not.toContain('7744');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('uses a validated ordinary reply decision for an uncued correction', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-ack-uncued-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const sends: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async (input: { id: string; question: string; context: string }) => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The home city changed to Paris.', people: [], memory: [] });
        if (input.question === 'My home city changed to Paris.') {
          const source = packet.memoryCandidates?.find((item: { message: string }) => item.message.includes('home city is Rome'));
          return JSON.stringify({ reply: 'Updated.', memory: [{ mode: 'correct', source: source.id,
            quote: 'My home city is Rome.', replacement: 'My home city changed to Paris.' }] });
        }
        return 'Okay.';
      }, send: async (input: { text: string }) => { sends.push(input.text); return sends.length; }, checkOutbound: () => {} });
    worker.intake([update(1, 'My home city is Rome.')]); await worker.drain();
    worker.intake([update(2, 'My home city changed to Paris.')]); await worker.drain();
    expect(journal.view.memory).toHaveLength(1);
    expect(sends[1]).toBe('PREVIEW — Changed My home city is Rome. → My home city changed to Paris.');
    const next = worker.probe('Where do I live?');
    if ('reason' in next) throw Error(next.reason);
    expect(next.context).not.toContain('Rome');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
