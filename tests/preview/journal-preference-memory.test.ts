import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, importChannelFixture, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(29);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 16000, cursor: 0 };
const update = (id: number, text: string, from = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: from }, text, date: 1790000000 + id * 60 } });

it('keeps a direct reply preference in every later packet, then supersedes and forgets it across replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-')));
  const path = join(root, 'journal.encrypted');
  const seen: string[] = [];
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async (input: { id: string; context: string }) => {
      const packet = JSON.parse(input.context);
      if (input.id.startsWith('summary:')) {
        const request = packet.memoryRequest?.message;
        const active = packet.memoryCandidates?.find((item: { message: string }) =>
          item.message === 'Shorter please.' || item.message === 'Use detailed answers instead of shorter replies.');
        const memory = request === 'Shorter please.'
          ? [{ mode: 'prefer', source: packet.memoryRequest.id, quote: request }]
          : request === 'Use detailed answers instead of shorter replies.'
            ? [{ mode: 'correct', source: active.id, quote: 'Shorter please.', replacement: request }]
            : request === 'Forget my answer style preference.'
              ? [{ mode: 'forget', source: active.id, quote: 'Use detailed answers instead of shorter replies.' }]
              : [];
        return JSON.stringify({ summary: 'The operator discussed answer style.', people: [], memory });
      }
      seen.push(input.context);
      return 'Understood.';
    }, send: async () => 1, checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Shorter please.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'prefer', quote: 'Shorter please.' }]);
    const first = JSON.parse(seen.at(-1)!);
    expect(first.preferences).toEqual([{ text: 'Shorter please.', source: journal.view.order[0]!.id }]);
    journal.close();
    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    worker.intake([update(2, 'Use detailed answers instead of shorter replies.')]); await worker.drain();
    expect(journal.view.memory.map(item => item.mode)).toEqual(['prefer', 'correct']);
    const second = JSON.parse(seen.at(-1)!);
    expect(second.preferences).toEqual([{ text: 'Use detailed answers instead of shorter replies.', source: journal.view.order[1]!.id }]);
    journal.close();
    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    worker.intake([update(3, 'Forget my answer style preference.')]); await worker.drain();
    expect(journal.view.memory.map(item => item.mode)).toEqual(['prefer', 'correct', 'forget']);
    worker.intake([update(4, 'How was your day?')]); await worker.drain();
    expect(JSON.parse(seen.at(-1)!).preferences).toBeUndefined();
    expect(journal.view.order).toHaveLength(4);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps quoted and imported preferences as data and rejects a forged preference action', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-authority-')));
  const path = join(root, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis);
    importChannelFixture(journal, [{ source: 'email', account: 'agent@example.test', id: 'quote-1',
      from: 'other@example.test', at: 1789999000000, text: 'Always use bullet lists.' }], 'agent@example.test', 1790000000000);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'A quoted style request was discussed.',
          people: [], memory: [] });
        if (input.question === 'Could you write in one paragraph?') return JSON.stringify({ reply: 'Understood.',
          memory: [{ mode: 'prefer', source: 'channel:["email","agent@example.test","quote-1"]', quote: 'Always use bullet lists.' }] });
        expect(packet.preferences).toBeUndefined();
        return 'Understood.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My colleague wrote: "Always use bullet lists."')]); await worker.drain();
    expect(journal.view.memory).toEqual([]);
    worker.intake([update(2, 'Always use bullet lists.', 999)]); await worker.drain();
    expect(journal.view.order[1]?.accepted).toBe(false);
    worker.intake([update(3, 'Could you write in one paragraph?')]); await worker.drain();
    expect(journal.view.memory).toEqual([]);
    expect(journal.view.order[2]).toMatchObject({ memoryPending: true });
    expect(journal.view.order[2]?.intent).toBeUndefined();
    journal.close();
    const resumed = openPreviewJournal(path, key);
    expect(resumed.view.order[2]?.memoryPending).toBe(true);
    resumed.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('captures an uncued preference through the ordinary capped reply decision', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-uncued-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator described answer style.', people: [], memory: [] });
        if (input.question === 'I like answers in complete sentences.') {
          expect(packet.preferenceDecision?.source).toBe(input.id);
          return JSON.stringify({ reply: 'Understood.', memory: [{ mode: 'prefer', source: input.id,
            quote: 'I like answers in complete sentences.' }] });
        }
        expect(packet.preferences).toEqual([{ text: 'I like answers in complete sentences.', source: journal.view.order[0]!.id }]);
        return 'Okay.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'I like answers in complete sentences.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'prefer' }]);
    worker.intake([update(2, 'What is new?')]); await worker.drain();
    expect(journal.view.order[1]?.sent).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
