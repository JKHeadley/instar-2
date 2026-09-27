import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(19);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:dedupe', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 6000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

it.each(['first', 'repeat'] as const)('keeps one restated item and withholds both sources when correcting the %s source', async target => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-dedupe-')));
  const path = join(root, 'journal.encrypted');
  const first = 'Please remember that my gym locker code is 3310.';
  const repeat = 'Remember: my gym locker code is 3310!';
  const changed = 'Please remember that my gym locker code is 4412.';
  const targetQuote = target === 'first' ? first : repeat;
  let journal = openPreviewJournal(path, key, genesis);
  const makeWorker = () => createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
    prepareModel: input => input.context,
    model: async input => {
      if (!input.id.startsWith('summary:')) return 'Noted.';
      const packet = JSON.parse(input.context) as { history: { user: string }[];
        memoryRequest?: { message: string }; memoryCandidates?: { id: string; message: string }[] };
      const memory = packet.memoryRequest?.message.startsWith('Actually')
        ? [{ mode: 'correct', source: packet.memoryCandidates!.find(item => item.message === targetQuote)!.id,
          quote: targetQuote, replacement: 'my gym locker code is 4412' }] : [];
      return JSON.stringify({ summary: memory.length ? 'The gym locker code was corrected to 4412.' : 'A gym locker code was remembered.',
        people: [], commitments: packet.history.filter(turn => turn.user.includes('remember') || turn.user.startsWith('Remember'))
          .map(turn => ({ in: 'message', quote: turn.user })), closed: [], memory });
    }, send: async () => 1, checkOutbound: () => {} });
  try {
    let worker = makeWorker();
    const say = async (id: number, text: string) => { worker.intake([update(id, text)]); await worker.drain(); await worker.summarizeIfNeeded(true); };
    await say(1, first);
    await say(2, repeat);
    expect(journal.view.commitments).toHaveLength(1);
    expect(journal.view.commitments[0]).toMatchObject({ source: 'telegram:12345678:update:1',
      sources: [{ source: 'telegram:12345678:update:2', quote: repeat }] });
    journal.close();
    journal = openPreviewJournal(path, key, genesis);
    worker = makeWorker();
    expect(journal.view.commitments).toHaveLength(1);
    let nextId = 3;
    let remembered = worker.probe('What code did I ask you to remember?');
    while (nextId < 17 && !('reason' in remembered) && !JSON.parse(remembered.context).commitments) {
      await say(nextId++, `Unrelated garden notes ${'flowers '.repeat(75)}`);
      remembered = worker.probe('What code did I ask you to remember?');
    }
    expect('reason' in remembered).toBe(false);
    if ('reason' in remembered) throw Error(remembered.reason);
    const packet = JSON.parse(remembered.context) as { capability: string;
      commitments: { items: { sources?: { message: string }[] }[] }[] };
    expect(packet.commitments).toHaveLength(1);
    expect(packet.commitments[0]!.items[0]!.sources?.[0]?.message).toBe(repeat);
    expect(packet.capability).toContain('one request or promise repeated across those later messages');

    await say(nextId++, changed);
    expect(journal.view.commitments).toHaveLength(2);
    expect(journal.view.commitments[0]!.quote).toBe(first);
    expect(journal.view.commitments[1]!.quote).toBe(changed);
    await say(nextId++, 'Actually my gym locker code is 4412, not 3310.');
    expect(journal.view.memory).toMatchObject([{ mode: 'correct', quote: targetQuote }]);
    const corrected = worker.probe('What is my gym locker code?');
    expect('reason' in corrected).toBe(false);
    if ('reason' in corrected) throw Error(corrected.reason);
    const current = JSON.parse(corrected.context) as { commitments: { message: string }[];
      recalled: { user: string }[]; history: { user: string }[] };
    expect(current.commitments).toHaveLength(1);
    expect(current.commitments[0]!.message).toBe(changed);
    expect(current.recalled.filter(item => item.user.includes('remember')).every(item => !item.user.includes('3310'))).toBe(true);
    expect(current.recalled.filter(item => item.user.includes('[withheld:'))).toHaveLength(2);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('starts a new item when an identical earlier request was closed', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-memory-reopened-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  const request = 'Please remember that I need to return the book.';
  const done = 'I returned the book, so that request is done.';
  const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
    prepareModel: input => input.context,
    model: async input => {
      if (!input.id.startsWith('summary:')) return 'Noted.';
      const packet = JSON.parse(input.context) as { history: { user: string }[]; openCommitments?: { id: number }[] };
      return JSON.stringify({ summary: 'The book request was discussed.', people: [], memory: [],
        commitments: packet.history.filter(item => item.user === request).map(() => ({ in: 'message', quote: request })),
        closed: packet.history.some(item => item.user === done) && packet.openCommitments?.length
          ? [{ id: packet.openCommitments[0]!.id, quote: done }] : [] });
    }, send: async () => 1, checkOutbound: () => {} });
  const say = async (id: number, text: string) => { worker.intake([update(id, text)]); await worker.drain(); await worker.summarizeIfNeeded(true); };
  try {
    await say(1, request);
    await say(2, done);
    expect(journal.view.closed.has(0)).toBe(true);
    await say(3, request);
    expect(journal.view.commitments).toHaveLength(2);
    expect(journal.view.commitments[1]).toMatchObject({ source: 'telegram:12345678:update:3', quote: request });
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
