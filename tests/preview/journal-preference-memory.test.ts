import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, importChannelFixture, openPreviewJournal } from './journal-test-worker.js';

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

it('keeps a faithful preference summary and its source reply while still withholding forgotten facts', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-summary-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) {
          if (packet.memoryRequest?.message === 'Shorter please.') return JSON.stringify({
            summary: 'The operator requested: Shorter please.', people: [],
            memory: [{ mode: 'prefer', source: packet.memoryRequest.id, quote: 'Shorter please.' }] });
          const old = packet.memoryCandidates.find((item: { message: string }) => item.message.includes('locker code is 3310'));
          return JSON.stringify({ summary: 'The operator requested forgetting a locker code.', people: [],
            memory: [{ mode: 'forget', source: old.id, quote: 'My locker code is 3310.' }] });
        }
        return input.question === 'Shorter please.' ? 'I will keep your answer and commitment.' : 'Understood.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Shorter please.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'prefer', quote: 'Shorter please.' }]);
    expect(journal.view.order[0]?.sent).toBe(1);
    let next = worker.probe('What did I ask?');
    if ('reason' in next) throw Error(next.reason);
    let packet = JSON.parse(next.context);
    expect(journal.view.summaries.at(-1)?.text).toContain('Shorter please.');
    expect(packet.preferences).toEqual([{ text: 'Shorter please.', source: journal.view.order[0]!.id }]);
    expect(JSON.stringify(packet)).toContain('I will keep your answer and commitment.');

    worker.intake([update(2, 'My locker code is 3310.')]); await worker.drain();
    worker.intake([update(3, 'Forget my locker code.')]); await worker.drain();
    next = worker.probe('What is my locker code?');
    if ('reason' in next) throw Error(next.reason);
    packet = JSON.parse(next.context);
    expect(next.context).not.toContain('3310');
    expect(packet.memory).toContainEqual(expect.objectContaining({ mode: 'forgotten', reason: 'verified operator requested forgetting' }));
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('retires one of two same-source preferences and rejects a stale target', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-clauses-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) {
          const request = packet.memoryRequest?.message;
          if (request?.includes('Always use short answers.')) return JSON.stringify({ summary: 'Two answer preferences and a room color.',
            people: [], memory: ['Always use short answers.', 'Never use bullet lists.'].map(quote =>
              ({ mode: 'prefer', source: packet.memoryRequest.id, quote })) });
          if (request === 'Forget my short-answer preference.') return JSON.stringify({ summary: 'One preference was removed.',
            people: [], memory: [{ mode: 'forget', source: journal.view.order[0]!.id, quote: 'Always use short answers.' }] });
          if (request === 'Actually, the room is green.') return JSON.stringify({ summary: 'The room is green.',
            people: [], memory: [{ mode: 'correct', source: journal.view.order[0]!.id, quote: 'The room is blue.',
              replacement: 'the room is green.' }] });
          return JSON.stringify({ summary: 'A stale preference target was offered.', people: [],
            memory: [{ mode: 'correct', source: journal.view.order[0]!.id, quote: 'Always use short answers.',
              replacement: 'Use detailed answers.' }] });
        }
        return 'Understood.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Always use short answers. Never use bullet lists. The room is blue.')]); await worker.drain();
    expect(journal.view.memory.map(item => item.mode)).toEqual(['prefer', 'prefer']);
    worker.intake([update(2, 'Forget my short-answer preference.')]); await worker.drain();
    expect(journal.view.memory.map(item => item.mode)).toEqual(['prefer', 'prefer', 'forget']);
    let next = worker.probe('How should you answer?');
    if ('reason' in next) throw Error(next.reason);
    expect(JSON.parse(next.context).preferences).toEqual([{ text: 'Never use bullet lists.', source: journal.view.order[0]!.id }]);
    worker.intake([update(3, 'Actually, the room is green.')]); await worker.drain();
    expect(journal.view.memory.map(item => item.mode)).toEqual(['prefer', 'prefer', 'forget', 'correct']);
    worker.intake([update(4, 'Use detailed answers.')]); await worker.drain();
    expect(journal.view.memory).toHaveLength(4);
    expect(journal.view.order[3]?.memoryPending).toBe(true);
    next = worker.probe('How should you answer now?');
    if ('reason' in next) throw Error(next.reason);
    expect(JSON.parse(next.context).preferences).toEqual([{ text: 'Never use bullet lists.', source: journal.view.order[0]!.id }]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('renders an explicit reinstatement of the same preference after removal', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-preference-recapture-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const requests: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) {
          requests.push(packet.memoryRequest?.message);
          if (packet.memoryRequest?.id === journal.view.order[1]?.id) return JSON.stringify({
            summary: 'The answer preference was removed.', people: [],
            memory: [{ mode: 'forget', source: journal.view.order[0]!.id, quote: 'Shorter please.' }] });
          return JSON.stringify({ summary: 'An answer style was requested.', people: [],
            memory: [{ mode: 'prefer', source: packet.memoryRequest.id, quote: 'Shorter please.' }] });
        }
        return 'Understood.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Shorter please.')]); await worker.drain();
    worker.intake([update(2, 'Forget my answer style preference.')]); await worker.drain();
    let next = worker.probe('What style?');
    if ('reason' in next) throw Error(next.reason);
    expect(JSON.parse(next.context).preferences).toBeUndefined();
    worker.intake([update(3, 'Shorter please.')]); await worker.drain();
    expect(requests.at(-1)).toBe('Shorter please.');
    expect(journal.view.memory.map(item => item.mode)).toEqual(['prefer', 'forget', 'prefer']);
    next = worker.probe('What style now?');
    if ('reason' in next) throw Error(next.reason);
    expect(JSON.parse(next.context).preferences).toEqual([{ text: 'Shorter please.', source: journal.view.order[2]!.id }]);
    expect(JSON.parse(next.context).history?.[0]?.user).toBe('[withheld: operator correction or forgetting]');
    expect(JSON.parse(next.context).history?.at(-1)?.user).toBe('Shorter please.');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
