import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, importChannelItems, openPreviewJournal } from './journal.js';
import { statedFacts } from './memory-sentinel.js';

const key = new Uint8Array(32).fill(37);
const now = 1790000000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: now + 1000000,
  maxCalls: 40, maxReplies: 40, maxTurns: 40, maxBytes: 8000, cursor: 0 };
const update = (id: number, text: string, from = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: from }, text, date: 1790000000 + id * 60 } });

it('only emits quotes present verbatim in the projected source', () => {
  expect(statedFacts('My notebook cover is blue.')).toEqual([
    { subject: 'my notebook cover', value: 'blue', quote: 'My notebook cover is blue' }
  ]);
  expect(statedFacts('My notebook cover ```example``` is blue.')).toEqual([]);
  expect(statedFacts('My notebook cover ```\nexample\n``` is blue.')).toEqual([]);
});

it('does not scan old assertions for a question, but still detects a later assertion', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-contradiction-question-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const packets: Record<string, unknown>[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => { packets.push(JSON.parse(input.context) as Record<string, unknown>); return 'Noted.'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My notebook cover is blue.')]); await worker.drain();
    worker.intake([update(2, 'What color is my notebook cover?')]); await worker.drain();
    worker.intake([update(3, 'My notebook cover is green.')]); await worker.drain();
    expect(packets[1]?.contradictions).toBeUndefined();
    expect(packets[2]?.contradictions).toMatchObject([{ subject: 'my notebook cover',
      earlier: { update: 1, quote: 'My notebook cover is blue' },
      operator: { update: 3, quote: 'My notebook cover is green' } }]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('flags two sourced values after compaction and replay without changing memory', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-contradiction-')));
  const path = join(root, 'journal.encrypted');
  const packets: Record<string, unknown>[] = [];
  const ports = { now: () => now, stopped: () => false,
    prepareModel: (input: { context: string }) => { const packet = JSON.parse(input.context);
      if (packet.historyMode === 'complete' && packet.history.length > 0) throw Error('force compact fixture');
      return input.context; },
    model: async (input: { id: string; question: string; context: string }) => {
      const packet = JSON.parse(input.context) as Record<string, unknown>;
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator has a gym locker code.', people: [] });
      packets.push(packet);
      return 'I will check whether you want me to update that memory.';
    }, send: async () => 1, checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'My gym locker code is 3310.')]); await worker.drain();
    journal.append({ kind: 'summary-reserve', through: 1, at: now });
    journal.append({ kind: 'summary', through: 1, text: 'The operator has a gym locker code.', at: now });
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    worker.intake([update(2, 'My gym locker code is 4412.')]); await worker.drain();
    const packet = packets.at(-1)!;
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.contradictions).toMatchObject([{ subject: 'my gym locker code',
      earlier: { update: 1, from: 'the operator (verified sender)', quote: 'My gym locker code is 3310' },
      operator: { update: 2, from: 'the operator (verified sender)', quote: 'My gym locker code is 4412' } }]);
    expect(journal.view.memory).toEqual([]);
    expect(journal.view.order[1]?.sent).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('leaves equal values, different subjects, quoted text and other senders unflagged', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-contradiction-neighbors-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const packets: Record<string, unknown>[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => { if (input.id.startsWith('summary:')) return 'Summary.';
        packets.push(JSON.parse(input.context) as Record<string, unknown>); return 'Noted.'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My gym locker code is 3310.')]); await worker.drain();
    worker.intake([update(2, 'My gym locker code is 3310.')]); await worker.drain();
    worker.intake([update(3, 'My bike locker code is 4412.')]); await worker.drain();
    worker.intake([update(4, '"My gym locker code is 4412."')]); await worker.drain();
    worker.intake([update(5, 'My gym locker code is 4412.', 999)]); await worker.drain();
    expect(packets.slice(1).every(packet => packet.contradictions === undefined)).toBe(true);
    expect(journal.view.memory).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('labels an imported earlier value as export metadata, without granting it correction authority', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-contradiction-channel-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    importChannelItems(journal, [{ source: 'conversation', account: 'agent@example.test', id: 'mail-1',
      from: 'sender@example.test', at: now - 60000, text: 'The studio opening day is Friday.' }], 'agent@example.test', now);
    let packet: Record<string, unknown> = {};
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => { if (input.id.startsWith('summary:')) return 'Summary.';
        packet = JSON.parse(input.context) as Record<string, unknown>; return 'Should I update that memory?'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'The studio opening day is Saturday.')]); await worker.drain();
    expect(packet.contradictions).toMatchObject([{ subject: 'the studio opening day',
      earlier: { from: 'channel import: sender@example.test (export metadata)', quote: 'The studio opening day is Friday' },
      operator: { quote: 'The studio opening day is Saturday' } }]);
    expect(journal.view.memory).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('lets the optional signal yield when prompt preparation cannot fit it', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-contradiction-fit-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const packets: Record<string, unknown>[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      prepareModel: input => { const packet = JSON.parse(input.context);
        if (packet.contradictions?.length) throw Error('fixture prompt limit');
        return input.context; },
      model: async input => { if (input.id.startsWith('summary:')) return 'Summary.';
        packets.push(JSON.parse(input.context) as Record<string, unknown>); return 'Noted.'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My test notebook cover is blue.')]); await worker.drain();
    worker.intake([update(2, 'My test notebook cover is green.')]); await worker.drain();
    expect(packets[1]?.contradictions).toBeUndefined();
    expect(journal.view.order[1]?.sent).toBe(1);
    expect(journal.view.order[1]?.held).toBeUndefined();
    expect(journal.view.memory).toEqual([]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
