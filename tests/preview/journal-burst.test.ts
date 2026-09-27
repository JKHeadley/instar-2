import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, journalPollLimit, openPreviewJournal, raiseJournalCaps } from './journal.js';

const key = new Uint8Array(32).fill(31);
const genesis = (maxTurns = 10) => ({ kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 40, maxReplies: 20, maxTurns, maxBytes: 32768, cursor: 0 });
const message = (update_id: number, text: string, message_id = update_id, reply_to_message?: { message_id: number }) => ({ update_id,
  message: { message_id, chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
    ...(reply_to_message ? { reply_to_message } : {}) } });
const burst = [
  message(1, 'The status is green.', 41),
  message(2, 'Give me the first answer.', 42),
  { update_id: 3, edited_message: { message_id: 41, chat: { id: 7654321, type: 'private' },
    from: { id: 7654321 }, text: 'The status remains green.' } },
  ...[4, 5, 6].map(id => message(id, `Question ${id}.`)),
  message(7, 'Why did you say first answer?', 47, { message_id: 101 }),
  ...[8, 9, 10].map(id => message(id, `Question ${id}.`)),
];

it('fsyncs a ten-update burst in update order across a mid-batch crash, merges the edit, and sends once per other turn', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-burst-'))), path = join(root, 'journal.encrypted');
  try {
    let interrupted = false;
    let journal = openPreviewJournal(path, key, genesis(), stage => {
      if (!interrupted && stage === 'after:intake' && journal.view.order.length === 5) {
        interrupted = true; throw Error('crash after fifth durable update');
      }
    });
    expect(journalPollLimit(journal.view)).toBe(10);
    const ports = { now: () => 1790000000000, stopped: () => false,
      model: async (input: { id: string; question: string; context: string }) => {
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The status remains green.', people: [], questions: [], memory: [] });
        packets.push({ id: input.id, packet: JSON.parse(input.context) });
        return `answer to ${input.question}`;
      },
      summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
      send: async (input: { update: number }) => { sent.push(input.update); return 100 + sent.length; },
      checkOutbound: () => {} };
    const packets: { id: string; packet: Record<string, unknown> }[] = [], sent: number[] = [];
    const worker = createJournalWorker(journal, ports);
    expect(() => worker.intake([...burst].reverse())).toThrow('crash after fifth durable update');
    expect(journal.view.cursor).toBe(6);
    journal.close();

    journal = openPreviewJournal(path, key);
    expect(journal.view.order.map(turn => turn.update)).toEqual([1, 2, 3, 4, 5]);
    expect(journalPollLimit(journal.view)).toBe(5);
    expect(createJournalWorker(journal, ports).intake([...burst].reverse())).toBe(11);
    expect(journal.view.order.map(turn => turn.update)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(journalPollLimit(journal.view)).toBe(0);
    expect(journal.view.order[2]).toMatchObject({ editOf: journal.view.order[0]!.id, replaces: journal.view.order[0]!.id });
    await createJournalWorker(journal, ports).drain();
    expect(journal.view.order[0]?.held).toBe('superseded by edit');
    expect(sent).toEqual([2, 4, 5, 6, 7, 8, 9, 10]);
    const replyPacket = packets.find(item => item.id.endsWith(':7'))?.packet;
    expect(replyPacket?.replyProvenance).toMatchObject({ update: 2 });
    const calls = journal.view.calls, replies = journal.view.replies;
    journal.close();
    journal = openPreviewJournal(path, key);
    const resumed = createJournalWorker(journal, ports);
    resumed.intake(burst); await resumed.drain();
    expect(journal.view.order).toHaveLength(10);
    expect(journal.view.calls).toBe(calls);
    expect(journal.view.replies).toBe(replies);
    expect(sent).toEqual([2, 4, 5, 6, 7, 8, 9, 10]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('leaves the cursor before the first unrecorded update at the turn cap and resumes after a durable raise', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-burst-cap-'))), path = join(root, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis(5));
    const ports = { now: () => 1790000000000, stopped: () => false,
      model: async () => 'answer', send: async () => 1, checkOutbound: () => {} };
    expect(createJournalWorker(journal, ports).intake(burst)).toBe(6);
    expect(journalPollLimit(journal.view)).toBe(0);
    expect(journal.view.order.map(turn => turn.update)).toEqual([1, 2, 3, 4, 5]);
    journal.close();
    journal = openPreviewJournal(path, key);
    raiseJournalCaps(journal, { maxCalls: 40, maxReplies: 20, maxTurns: 10, maxBytes: 32768,
      authority: 'grant:cap-raise', at: 1790000000000 });
    expect(journalPollLimit(journal.view)).toBe(5);
    expect(createJournalWorker(journal, ports).intake(burst)).toBe(11);
    expect(journal.view.order.map(turn => turn.update)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds later ordinary burst turns when an earlier edit judgment cannot finish', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-burst-held-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis());
    const sent: number[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async (input: { id: string }) => input.id.startsWith('summary:')
        ? { state: 'rejected' as const, failureClass: 'rejected' as const } : 'answer',
      send: async (input: { update: number }) => { sent.push(input.update); return sent.length; },
      checkOutbound: () => {} });
    worker.intake(burst.slice(0, 5));
    await worker.drain();
    expect(journal.view.cursor).toBe(6);
    expect(sent).toEqual([]);
    expect(journal.view.order[0]?.held).toBe('superseded by edit');
    expect(journal.view.order[1]?.held).toBe('memory correction pending');
    expect(journal.view.order[3]?.held).toBe('earlier turn pending');
    expect(journal.view.order[4]?.held).toBe('earlier turn pending');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
