import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { dueState, parseDatedItem } from './dated-memory.js';

const key = new Uint8Array(32).fill(23);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:dated', configurationDigest: 'sha256:dated', expires: 9999999999999,
  maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 12000, cursor: 0 };
const start = Date.UTC(2026, 8, 26, 17);
const update = (id: number, text: string, sender = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: sender }, text,
    date: Math.floor(start / 1000) + id * 60 } });

it('parses in the operator zone, keeps an unspecified hour ambiguous, and does not invent an invalid date', () => {
  const dentist = parseDatedItem('one', 'My dentist is Thursday at 3.', 'Thursday at 3', start, 'America/Los_Angeles');
  expect(dentist).toMatchObject({ day: '2026-10-01', ambiguity: 'AM or PM unspecified', zone: 'America/Los_Angeles' });
  expect(dueState(dentist, Date.UTC(2026, 9, 1, 16))).toBe('due');
  expect(dueState(dentist, Date.UTC(2026, 9, 2, 16))).toBe('overdue');
  const invoice = parseDatedItem('two', 'Invoice on Oct 1.', 'Oct 1', start, 'America/Los_Angeles');
  expect(invoice.day).toBe('2026-10-01');
  expect(dueState(invoice, start)).toBe('upcoming');
  const precise = parseDatedItem('four', 'Invoice on Oct 1 at 3 pm.', 'Oct 1 at 3 pm', start, 'America/Los_Angeles');
  expect(precise.time).toBe('15:00');
  expect(dueState(precise, Date.UTC(2026, 9, 1, 22))).toBe('due');
  expect(dueState(precise, Date.UTC(2026, 9, 1, 22, 1))).toBe('overdue');
  const multiple = parseDatedItem('five', 'Thursday or Friday.', 'Thursday or Friday', start, 'America/Los_Angeles');
  expect(multiple).toMatchObject({ ambiguity: 'multiple possible dates' });
  expect(multiple.day).toBeUndefined();
  const invalid = parseDatedItem('three', 'Dentist on February 30.', 'February 30', start, 'America/Los_Angeles');
  expect(invalid).toMatchObject({ ambiguity: 'invalid calendar date' });
  expect(invalid.day).toBeUndefined();
  expect(dueState(invalid, start)).toBe('ambiguous');
});

it('journals verified dated items once, surfaces them on the next due message, and replays without a send', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-'))), path = join(root, 'journal.encrypted');
  try {
    let now = start, sends = 0;
    let journal = openPreviewJournal(path, key, genesis);
    const ports = { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async (input: { question: string }) => input.question.includes('invoice')
        ? JSON.stringify({ reply: 'I have the invoice date in this preview.', memory: [],
          dated: [{ quote: 'Remind me about the invoice on Oct 1.', when: 'Oct 1' }] }) : 'What would you like to know?',
      send: async () => { sends++; return sends; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Remind me about the invoice on Oct 1.'), update(2, 'Remind me about the invoice on Oct 1.', 99)]);
    await worker.drain();
    expect(journal.view.dated).toHaveLength(1);
    expect(journal.view.dated[0]).toMatchObject({ day: '2026-10-01', zone: 'America/Los_Angeles' });
    expect(worker.probe('hello')).not.toHaveProperty('context', expect.stringContaining('"dated":['));
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    now = Date.UTC(2026, 9, 1, 17);
    const due = worker.probe('hello');
    if ('reason' in due) throw Error(due.reason);
    expect(JSON.parse(due.context).dated).toMatchObject([{ state: 'due', quote: 'Remind me about the invoice on Oct 1.' }]);
    expect(JSON.parse(due.context).capability).toContain('never sends unprompted reminders');
    expect(sends).toBe(1);
    now = Date.UTC(2026, 9, 2, 17);
    const overdue = worker.probe('hello');
    if ('reason' in overdue) throw Error(overdue.reason);
    expect(JSON.parse(overdue.context).dated[0].state).toBe('overdue');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds a malformed dated proposal with intake intact and does not accept a foreign sender', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-invalid-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let sends = 0;
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async () => JSON.stringify({ reply: 'I saved it.', memory: [],
        dated: [{ quote: 'Dentist on Oct 1.', when: 'October 5' }] }),
      send: async () => { sends++; return sends; }, checkOutbound: () => {} });
    worker.intake([update(1, 'Dentist on Oct 1.', 99), update(2, 'Dentist on Oct 1.')]);
    await worker.drain();
    expect(journal.view.order[0]?.accepted).toBe(false);
    expect(journal.view.order[1]?.held).toBe('dated item invalid');
    expect(journal.view.dated).toHaveLength(0);
    expect(sends).toBe(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('withholds a corrected dated source and carries a replacement from the same verified turn', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-correct-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let now = start;
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async input => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) {
          if (packet.memoryRequest?.message?.startsWith('Forget')) {
            const corrected = packet.memoryCandidates?.find((item: { message: string }) => item.message.includes('October 3'));
            return JSON.stringify({ summary: 'The operator requested forgetting the invoice deadline.', people: [],
              memory: corrected ? [{ mode: 'forget', source: corrected.id, quote: 'the invoice deadline is October 3.' }] : [] });
          }
          const source = packet.memoryCandidates?.find((item: { message: string }) => item.message.includes('Oct 1'));
          return JSON.stringify({ summary: 'The invoice deadline was corrected to October 3.', people: [],
            memory: source ? [{ mode: 'correct', source: source.id, quote: 'The invoice deadline is Oct 1.',
              replacement: 'the invoice deadline is October 3.' }] : [] });
        }
        if (input.question === 'The invoice deadline is Oct 1.') return JSON.stringify({ reply: 'Recorded.', memory: [],
          dated: [{ quote: input.question, when: 'Oct 1' }] });
        if (input.question.startsWith('Actually')) return JSON.stringify({ reply: 'Updated.', memory: [],
          dated: [{ quote: 'the invoice deadline is October 3.', when: 'October 3' }] });
        return 'Okay.';
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'The invoice deadline is Oct 1.')]); await worker.drain();
    worker.intake([update(2, 'Actually, the invoice deadline is October 3.')]); await worker.drain();
    now = Date.UTC(2026, 9, 2, 17);
    const next = worker.probe('What is due?');
    if ('reason' in next) throw Error(next.reason);
    const packet = JSON.parse(next.context);
    expect(packet.dated).toBeUndefined(); // October 3 is upcoming; October 1 was superseded.
    expect(journal.view.dated).toHaveLength(2);
    now = Date.UTC(2026, 9, 3, 17);
    const due = worker.probe('What is due?');
    if ('reason' in due) throw Error(due.reason);
    expect(JSON.parse(due.context).dated).toMatchObject([{ day: '2026-10-03', state: 'due' }]);
    expect(due.context).not.toContain('The invoice deadline is Oct 1.');
    worker.intake([update(3, 'Forget the invoice deadline.')]); await worker.drain();
    const forgotten = worker.probe('What is due?');
    if ('reason' in forgotten) throw Error(forgotten.reason);
    expect(JSON.parse(forgotten.context).dated).toBeUndefined();
    expect(forgotten.context).not.toContain('the invoice deadline is October 3.');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
