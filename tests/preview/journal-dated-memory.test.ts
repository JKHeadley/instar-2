import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { HOLDING_REPLY, JEV_MODEL, REPLY_RULES } from './reply-check.js';
import { SOURCE_PINS, sourcePacket } from './briefing.js';
import { readFileSync } from 'node:fs';
import { dueState, parseDatedItem, withinNext48Hours } from './dated-memory.js';

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

it('does not turn a partial date or unqualified hour into a certain calendar fact', () => {
  const parse = (when: string) => parseDatedItem('one', when, when, start, 'America/Los_Angeles');
  expect(parse('tomorrow at 3:30')).toMatchObject({ day: '2026-09-27', ambiguity: 'AM or PM unspecified' });
  expect(parse('tomorrow at 3:30').time).toBeUndefined();
  expect(parse('day after tomorrow').day).toBeUndefined();
  expect(parse('day after tomorrow').ambiguity).toBeTruthy();
  expect(parse('last Thursday').day).toBeUndefined();
  expect(parse('last Thursday').ambiguity).toBeTruthy();
  expect(parse('tomorrow at 15:30')).toMatchObject({ day: '2026-09-27', time: '15:30' });
  expect(parse('tomorrow at 3 pm')).toMatchObject({ day: '2026-09-27', time: '15:00' });
  expect(parse('tomorrow at 3 pm.')).toMatchObject({ day: '2026-09-27', time: '15:00' });
});

it('resolves tomorrow and next Friday from the operator civil day across midnight and DST', () => {
  const parse = (when: string, at: number, zone = 'America/Los_Angeles') =>
    parseDatedItem('one', `Deadline ${when}`, when, at, zone).day;
  expect(parse('tomorrow', Date.UTC(2026, 8, 27, 6, 59))).toBe('2026-09-27');
  expect(parse('tomorrow', Date.UTC(2026, 8, 27, 7, 1))).toBe('2026-09-28');
  expect(parse('tomorrow', Date.UTC(2026, 8, 27, 6, 59), 'UTC')).toBe('2026-09-28');
  expect(parse('next Friday', Date.UTC(2026, 8, 24, 17))).toBe('2026-10-02');
  expect(parse('next Friday', Date.UTC(2026, 8, 25, 17))).toBe('2026-10-02');
  expect(parseDatedItem('one', 'Deadline this Friday', 'this Friday', Date.UTC(2026, 8, 25, 17),
    'America/Los_Angeles')).toMatchObject({ ambiguity: 'this weekday has more than one common reading' });
  expect(parse('next Friday', Date.UTC(2026, 9, 30, 17))).toBe('2026-11-06');
  expect(parse('tomorrow', Date.UTC(2026, 2, 8, 9, 30))).toBe('2026-03-09');
  expect(parse('tomorrow', Date.UTC(2026, 2, 8, 10, 30))).toBe('2026-03-09');
  expect(parse('tomorrow', Date.UTC(2026, 10, 1, 8, 30))).toBe('2026-11-02');
  expect(parse('tomorrow', Date.UTC(2026, 10, 1, 9, 30))).toBe('2026-11-02');
});

it('stores the Telegram turn-time date in the default operator zone and sends its absolute date once', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-relative-'))), path = join(root, 'journal.encrypted');
  try {
    let sends = 0, journal = openPreviewJournal(path, key, genesis);
    const ports = { now: () => Date.UTC(2026, 8, 27, 7, 1), stopped: () => false,
      model: async (input: { question: string }) => JSON.stringify({ reply: 'Tomorrow is the deadline.', memory: [],
        dated: [{ quote: input.question, when: input.question.includes('next Friday') ? 'next Friday' : 'tomorrow' }] }),
      send: async () => ++sends, checkOutbound: () => {} };
    const earlier = update(1, 'The deadline is tomorrow.');
    earlier.message.date = Math.floor(Date.UTC(2026, 8, 27, 6, 59) / 1000);
    let worker = createJournalWorker(journal, ports);
    worker.intake([earlier]); await worker.drain();
    expect(journal.view.dated).toMatchObject([{ day: '2026-09-27', zone: 'America/Los_Angeles' }]);
    expect(journal.view.order[0]?.intent).toContain('2026-09-27 (America/Los_Angeles)');
    expect(journal.view.order[0]?.intent).toContain('Tomorrow is the deadline');
    expect(sends).toBe(1);
    const friday = update(2, 'The appointment is next Friday.');
    friday.message.date = Math.floor(Date.UTC(2026, 8, 25, 17) / 1000);
    worker.intake([friday]); await worker.drain();
    expect(journal.view.dated[1]).toMatchObject({ day: '2026-10-02', zone: 'America/Los_Angeles' });
    expect(journal.view.order[1]?.intent).toContain('2026-10-02 (America/Los_Angeles)');
    expect(sends).toBe(2);
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    await worker.drain();
    expect(sends).toBe(2);
    expect(journal.view.dated).toHaveLength(2);
    journal.close();
    const status = (args: string[]) => spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
        'status', '--root', root, ...args],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10000 });
    const defaultStatus = status([]), utcStatus = status(['--time-zone', 'UTC']);
    expect(defaultStatus.status).toBe(0);
    expect(utcStatus.status).toBe(0);
    expect(JSON.parse(defaultStatus.stdout).self).toContain('time zone America/Los_Angeles');
    expect(JSON.parse(utcStatus.stdout).self).toContain('time zone UTC');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps the answer and an ambiguous-hour question beside the verified date', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-answer-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false,
      model: async input => JSON.stringify({ reply: { answer: input.question.includes('invoice')
        ? '2 + 2 = 4. Your invoice is due tomorrow.' : 'Do you mean 3:30 AM or PM?',
      dateAcknowledgement: 'The deadline is now in memory.' }, memory: [],
        dated: [{ quote: input.question.includes('invoice') ? 'The invoice is due tomorrow.' : input.question,
          when: input.question.includes('invoice') ? 'tomorrow' : 'tomorrow at 3:30' }] }),
      send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
    worker.intake([update(1, 'The invoice is due tomorrow. Also, what is 2 + 2?'),
      update(2, 'My dentist appointment is tomorrow at 3:30.')]);
    await worker.drain();
    expect(sent[0]).toContain('2 + 2 = 4.');
    expect(sent[0]).toContain('2026-09-27 (America/Los_Angeles)');
    expect(sent[0]).not.toContain('The deadline is now in memory.');
    expect(sent[1]).toContain('Do you mean 3:30 AM or PM?');
    expect(sent[1]).toContain('2026-09-27 (America/Los_Angeles); AM or PM unspecified');
    expect(journal.view.dated[1]).toMatchObject({ day: '2026-09-27', ambiguity: 'AM or PM unspecified' });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('shrinks dated projections for summary and later replies without losing journaled dates', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-fit-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
      { ...genesis, maxCalls: 16, maxReplies: 16, maxBytes: 4500 });
    const packets: Array<{ id: string; packet: Record<string, unknown> }> = [];
    let sends = 0;
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context) as Record<string, unknown>;
        packets.push({ id: input.id, packet });
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator has dated invoice events.',
          people: [], memory: [], commitments: [], closed: [] });
        if (input.question === 'Hello') return JSON.stringify({ reply: 'Hello.', memory: [], dated: [] });
        return JSON.stringify({ reply: 'I have the invoice date.', memory: [],
          dated: [{ quote: input.question, when: 'tomorrow' }] });
      }, send: async () => ++sends, checkOutbound: () => {} });
    for (let id = 1; id <= 7; id++) {
      worker.intake([update(id, `Invoice ${id} for ${'the prepared design materials and delivery work '.repeat(6)}is due tomorrow.`)]);
      await worker.drain(); await worker.summarizeIfNeeded();
    }
    worker.intake([update(8, 'Hello')]); await worker.drain();
    expect(sends).toBe(8);
    expect(journal.view.order[7]?.held).toBeUndefined();
    expect(journal.view.dated).toHaveLength(7);
    const hello = packets.find(item => item.id === journal.view.order[7]?.id)?.packet;
    expect(hello).toBeDefined();
    expect(hello?.moreDated).toBeGreaterThan(0);
    expect(packets.some(item => item.id.startsWith('summary:') &&
      typeof item.packet.moreDated === 'number' && item.packet.moreDated > 0)).toBe(true);
    expect(journal.view.calls).toBeLessThan(16);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
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
    expect(worker.probe('hello')).toHaveProperty('context', expect.stringContaining('"state":"upcoming"'));
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

it('replies truthfully once to a malformed dated proposal across restart, retaining unresolved intake', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-invalid-')));
  try {
    const path = join(root, 'journal.encrypted');
    let journal = openPreviewJournal(path, key, genesis);
    let sends = 0, sent = '';
    const ports = { now: () => start, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async () => JSON.stringify({ reply: 'I saved it.', memory: [],
        dated: [{ quote: 'Dentist on Oct 1.', when: 'October 5' }] }),
      send: async (input: { text: string }) => { sends++; sent = input.text; return sends; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Dentist on Oct 1.', 99), update(2, 'Dentist on Oct 1.')]);
    await worker.drain();
    expect(journal.view.order[0]?.accepted).toBe(false);
    expect(journal.view.order[1]?.datedPending).toBe(true);
    expect(journal.view.dated).toHaveLength(0);
    expect(sends).toBe(1);
    expect(sent).not.toContain('I saved it');
    expect(sent).toMatch(/date.*not saved|not saved.*date/i);
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    await worker.drain();
    expect(sends).toBe(1);
    expect(journal.view.order[1]?.datedPending).toBe(true);
    expect(journal.view.dated).toHaveLength(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps separated answers and rejects every unverified date acknowledgement', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-invalid-answer-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const sent: string[] = [];
    const replies = [
      { answer: 'Use Save As to make a copy.', dateAcknowledgement: 'I saved it.' },
      { answer: '2 + 2 = 4', dateAcknowledgement: 'and I saved it.' },
      { answer: '2 + 2 = 4.', dateAcknowledgement: 'Your deadline is now in memory.' },
    ];
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false,
      model: async input => {
        expect(JSON.parse(input.context).datedDecision).toContain('reply.answer');
        return JSON.stringify({ reply: replies[Number(input.id.split(':').at(-1)) - 1], memory: [],
          dated: [{ quote: 'The invoice is due tomorrow.', when: 'October 5' }] });
      },
      send: async input => { sent.push(input.text); return sent.length; }, checkOutbound: () => {} });
    worker.intake([update(1, 'The invoice is due tomorrow. How do I make a copy?'),
      update(2, 'The invoice is due tomorrow. What is 2 + 2?'),
      update(3, 'The invoice is due tomorrow. Also, what is 2 + 2?')]);
    await worker.drain();
    expect(sent).toHaveLength(3);
    expect(sent[0]).toContain('Use Save As to make a copy.');
    expect(sent[1]).toContain('2 + 2 = 4');
    expect(sent[2]).toContain('2 + 2 = 4.');
    for (const reply of sent) {
      expect(reply).not.toContain('I saved it.');
      expect(reply).not.toContain('Your deadline is now in memory.');
      expect(reply).toContain('I have not saved a dated item.');
    }
    expect(journal.view.dated).toHaveLength(0);
    expect(journal.view.order.every(turn => turn.datedPending)).toBe(true);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('requests a date decision for every verified turn and exposes missing numeric and relative decisions', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-pending-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const decisions: string[] = [];
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false,
      model: async input => { decisions.push(JSON.parse(input.context).datedDecision ?? ''); return 'Okay.'; },
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My dentist is on 10/01/2026 at 3 pm.'), update(2, 'Invoice due in two days.')]);
    await worker.drain();
    expect(decisions).toHaveLength(2);
    expect(decisions.every(value => value.includes('dated:[]'))).toBe(true);
    expect(journal.view.order[0]?.datedPending).toBe(true);
    expect(journal.view.order[1]?.datedPending).toBe(true);
    expect(journal.view.dated).toHaveLength(0);
    const next = worker.probe('Any plans?');
    if ('reason' in next) throw Error(next.reason);
    expect(JSON.parse(next.context).datedPending).toMatchObject([{ update: 1,
      message: 'My dentist is on 10/01/2026 at 3 pm.' }, { update: 2, message: 'Invoice due in two days.' }]);
    expect(JSON.parse(next.context).dated).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps a missing date decision pending when the same turn saves a reply preference, including after replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-preference-')));
  const path = join(root, 'journal.encrypted');
  const message = 'My dentist is on 10/01/2026 at 3 pm. I like concise replies.';
  let sends = 0;
  const ports = { now: () => start, stopped: () => false,
    model: async (input: { id: string }) => JSON.stringify({ reply: 'Understood.',
      memory: [{ mode: 'prefer', source: input.id, quote: 'I like concise replies.' }] }),
    send: async () => ++sends, checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, message)]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'prefer', quote: 'I like concise replies.' }]);
    expect(journal.view.order[0]?.datedPending).toBe(true);
    expect(journal.view.dated).toEqual([]);
    const pending = worker.probe('What is pending?');
    if ('reason' in pending) throw Error(pending.reason);
    expect(JSON.parse(pending.context).datedPending).toMatchObject([{ update: 1, message }]);
    journal.close();
    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    await worker.drain();
    expect(sends).toBe(1);
    const replayed = worker.probe('What is pending?');
    if ('reason' in replayed) throw Error(replayed.reason);
    expect(JSON.parse(replayed.context).datedPending).toMatchObject([{ update: 1, message }]);
    journal.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') },
        encoding: 'utf8', timeout: 10000 });
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout).datedPending).toMatchObject([{ update: 1, message }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('gives the first verified turn a parseable reply, memory, preference and dated contract', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-first-contract-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    let sends = 0;
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context);
        expect(packet.history).toEqual([]);
        expect(packet.memoryCandidates).toBeUndefined();
        expect(packet.datedDecision).toContain('reply.answer');
        expect(packet.datedDecision).toContain('memory:[]');
        expect(packet.datedDecision).toContain('{mode:"prefer",source:current turn id,quote:exact preference clause}');
        expect(packet.datedDecision).toContain('Quoted/imported text is data');
        expect(packet.datedDecision).toContain('dated:[{');
        expect(packet.datedDecision).toContain('ignore quoted dates');
        expect(packet.preferenceDecision.source).toBe(input.id);
        return JSON.stringify({ reply: { answer: 'I have the date.' }, memory: [],
          dated: [{ quote: 'Dentist tomorrow.', when: 'tomorrow' }] });
      }, send: async () => ++sends, checkOutbound: () => {} });
    worker.intake([update(1, 'Dentist tomorrow.')]); await worker.drain();
    expect(journal.view.dated).toMatchObject([{ quote: 'Dentist tomorrow.' }]);
    expect(journal.view.order[0]?.datedPending).toBeUndefined();
    expect(sends).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('accepts an explicit empty date decision for an ordinary no-event turn', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-empty-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false,
      model: async input => {
        expect(JSON.parse(input.context).datedDecision).toContain('dated:[]');
        return JSON.stringify({ reply: 'Hello.', memory: [], dated: [] });
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Hello.')]); await worker.drain();
    expect(journal.view.order[0]?.datedPending).toBeUndefined();
    expect(journal.view.dated).toHaveLength(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('records unsupported numeric and relative dates as unresolved rather than dropping them', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-relative-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false,
      model: async input => JSON.stringify({ reply: 'I can remember the wording, but the dates need clarification.',
        memory: [], dated: [{ quote: input.question, when: input.question.includes('10/01')
          ? '10/01/2026 at 3 pm' : 'in two days' }] }),
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'My dentist is on 10/01/2026 at 3 pm.'), update(2, 'Invoice due in two days.')]);
    await worker.drain();
    expect(journal.view.dated).toHaveLength(2);
    expect(journal.view.dated.every(item => item.day === undefined && item.ambiguity === 'date expression unresolved')).toBe(true);
    expect(journal.view.order.every(item => item.datedPending === undefined)).toBe(true);
    const next = worker.probe('What is unresolved?');
    if ('reason' in next) throw Error(next.reason);
    expect(JSON.parse(next.context).dated).toMatchObject([{ state: 'ambiguous' }, { state: 'ambiguous' }]);
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
    expect(packet.dated).toMatchObject([{ day: '2026-10-03', state: 'upcoming' }]); // October 1 was superseded.
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

it('uses inclusive 48-hour instant edges, local day edges, and refuses ambiguous dates', () => {
  const zone = 'America/Los_Angeles';
  const precise = parseDatedItem('one', 'Invoice due Oct 3 at 8 am.', 'Oct 3 at 8 am', start, zone);
  const event = Date.UTC(2026, 9, 3, 15);
  expect(withinNext48Hours(precise, event - 48 * 60 * 60 * 1000 - 1)).toBe(false);
  expect(withinNext48Hours(precise, event - 48 * 60 * 60 * 1000)).toBe(true);
  expect(withinNext48Hours(precise, event)).toBe(true);
  expect(withinNext48Hours(precise, event + 1)).toBe(false);
  const dayOnly = parseDatedItem('two', 'Invoice due Oct 3.', 'Oct 3', start, zone);
  expect(withinNext48Hours(dayOnly, Date.UTC(2026, 8, 30, 6, 59))).toBe(false);
  expect(withinNext48Hours(dayOnly, Date.UTC(2026, 9, 1, 7))).toBe(true);
  expect(withinNext48Hours(dayOnly, Date.UTC(2026, 9, 4, 7))).toBe(false);
  expect(withinNext48Hours(parseDatedItem('three', 'Meet tomorrow at 3.', 'tomorrow at 3', start, zone), start)).toBe(true);
  expect(withinNext48Hours(parseDatedItem('three', 'Meet on Thursday or Friday.', 'Thursday or Friday', start, zone), start)).toBe(false);
  // The repeated 1:30 during the fall clock change has a future occurrence.
  const fold = parseDatedItem('four', 'Meet Nov 1, 2026 at 1:30 am.', 'Nov 1, 2026 at 1:30 am', start, zone);
  expect(withinNext48Hours(fold, Date.UTC(2026, 10, 1, 8, 45))).toBe(true);
});

it('adds one short imminent clause to the next checked intent and replays its marker', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-imminent-'))), path = join(root, 'journal.encrypted');
  try {
    let now = start;
    const sends: string[] = [];
    let journal = openPreviewJournal(path, key, genesis);
    const ports = { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async (input: { question: string }) => JSON.stringify({ reply: 'Okay.', memory: [],
        dated: input.question.includes('Invoice due')
          ? [{ quote: 'Invoice due Oct 3 at 8 am.', when: 'Oct 3 at 8 am' }] : [] }),
      send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; },
      checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Invoice due Oct 3 at 8 am.')]); await worker.drain();
    expect(sends[0]).not.toContain('Upcoming:'); // save turn is not the next reply
    now = Date.UTC(2026, 9, 1, 14, 59, 59, 999);
    worker.intake([update(2, 'Hello')]); await worker.drain();
    expect(sends[1]).not.toContain('Upcoming:');
    now = Date.UTC(2026, 9, 1, 15);
    worker.intake([update(3, 'Hello again')]); await worker.drain();
    expect(sends[2]).toContain('Upcoming: Invoice due Oct 3 at 8 am. (2026-10-03 08:00).');
    expect(sends[2]!.match(/Upcoming:/gu)).toHaveLength(1);
    expect(journal.view.mentionedDates.size).toBe(1);
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    expect(journal.view.mentionedDates.size).toBe(1);
    worker.intake([update(4, 'Another question')]); await worker.drain();
    expect(sends[3]).not.toContain('Upcoming:');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('fits an upcoming clause inside visible and encoded limits, leaving an omitted item eligible after replay', async () => {
  for (const [name, answer, included] of [
    ['visible-fit', 'a'.repeat(3970), true],
    ['visible-overflow', 'a'.repeat(4040), false],
    ['encoded-overflow', '<'.repeat(1010), false],
  ] as const) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), `preview-imminent-${name}-`)));
    const path = join(root, 'journal.encrypted');
    try {
      let now = start;
      const sends: string[] = [], checked: string[] = [];
      let journal = openPreviewJournal(path, key, genesis);
      const ports = { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
        model: async (input: { question: string }) => JSON.stringify({
          reply: input.question === 'Long' ? answer : 'Okay.', memory: [],
          dated: input.question.includes('Invoice due')
            ? [{ quote: 'Invoice due Oct 3 at 8 am.', when: 'Oct 3 at 8 am' }] : [] }),
        send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; },
        checkOutbound: () => {}, replyCheck: {
          jev: async (text: string) => { checked.push(text); return { value: { model: JEV_MODEL,
            answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: 0 }])) }, latencyMs: 1 }; },
          escalate: async () => { throw Error('unexpected review'); }, elapsedMs: () => 0 } };
      let worker = createJournalWorker(journal, ports);
      worker.intake([update(1, 'Invoice due Oct 3 at 8 am.')]); await worker.drain();
      now = Date.UTC(2026, 9, 1, 15);
      worker.intake([update(2, 'Long')]); await worker.drain();
      expect(sends[1]).toBe(`PREVIEW — ${answer}${included ? ' Upcoming: Invoice due Oct 3 at 8 am. (2026-10-03 08:00).' : ''}`);
      expect(checked[1]).toBe(sends[1]);
      expect(journal.view.order[1]?.held).toBeUndefined();
      expect(journal.view.mentionedDates.size).toBe(included ? 1 : 0);
      journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
      await worker.drain();
      expect(sends).toHaveLength(2);
      worker.intake([update(3, 'Short')]); await worker.drain();
      expect(sends[2]?.includes('Upcoming:')).toBe(!included);
      expect(journal.view.mentionedDates.size).toBe(1);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('delivers upcoming-date behavior in the prepared packet and source briefing', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-imminent-briefing-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => start, stopped: () => false,
      model: async () => 'Okay.', send: async () => 1, checkOutbound: () => {} });
    const prepared = worker.probe('Hello');
    if ('reason' in prepared) throw Error(prepared.reason);
    expect(JSON.parse(prepared.context).capability).toContain('within 48 hours');
    expect(JSON.parse(prepared.context).capability).toContain('remembered across restarts');
    const sources = sourcePacket(path => readFileSync(path, 'utf8'), SOURCE_PINS,
      { providerAttempts: 30, expiresAt: genesis.expires });
    expect(sources.sources.find(source => source.id === 'capability-note')?.text).toContain('unprompted reminder');
    expect(sources.sources.find(source => source.id === 'capability-note')?.text).toContain('remembered across restarts');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not repeat an imminent item after an UNKNOWN send intent', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-imminent-unknown-'))), path = join(root, 'journal.encrypted');
  try {
    let now = start, sends = 0;
    let journal = openPreviewJournal(path, key, genesis);
    const ports = { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async (input: { question: string }) => JSON.stringify({ reply: 'Okay.', memory: [],
        dated: input.question.includes('Invoice due')
          ? [{ quote: 'Invoice due Oct 3 at 8 am.', when: 'Oct 3 at 8 am' }] : [] }),
      send: async () => { sends++; return sends === 2 ? null : sends; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Invoice due Oct 3 at 8 am.')]); await worker.drain();
    now = Date.UTC(2026, 9, 1, 15);
    worker.intake([update(2, 'Hello')]); await worker.drain();
    expect(journal.view.order[1]?.intent).toContain('Upcoming:');
    expect(journal.view.order[1]?.sent).toBeUndefined();
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    worker.intake([update(3, 'More')]); await worker.drain();
    expect(sends).toBe(3);
    expect(journal.view.order[2]?.intent).not.toContain('Upcoming:');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('keeps an imminent item eligible when the reply check replaces its candidate', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-imminent-check-'))), path = join(root, 'journal.encrypted');
  try {
    let now = start, rejectOnce = true;
    const sends: string[] = [];
    const journal = openPreviewJournal(path, key, genesis);
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async (input: { question: string }) => JSON.stringify({ reply: 'Okay.', memory: [],
        dated: input.question.includes('Invoice due')
          ? [{ quote: 'Invoice due Oct 3 at 8 am.', when: 'Oct 3 at 8 am' }] : [] }),
      send: async input => { sends.push(input.expectedText); return sends.length; }, checkOutbound: () => {},
      replyCheck: {
        jev: async text => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES)
          .map(id => [id, { type: 'noul', noul: rejectOnce && text.includes('Upcoming:') && id === 'raw_path' ? 1 : 0 }])) }, latencyMs: 1 }),
        escalate: async () => { rejectOnce = false; return { verdict: 'violation' as const, ruleIds: ['raw_path' as const], confidence: 1, latencyMs: 1 }; },
        elapsedMs: () => 0 } });
    worker.intake([update(1, 'Invoice due Oct 3 at 8 am.')]); await worker.drain();
    now = Date.UTC(2026, 9, 1, 15);
    worker.intake([update(2, 'Hello')]); await worker.drain();
    expect(sends[1]).toBe(HOLDING_REPLY);
    expect(journal.view.mentionedDates.size).toBe(0);
    worker.intake([update(3, 'Another question')]); await worker.drain();
    expect(sends[2]).toContain('Upcoming: Invoice due Oct 3 at 8 am.');
    expect(journal.view.mentionedDates.size).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('rechecks a candidate when the 48-hour edge moves after a durable check', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-imminent-recheck-'))), path = join(root, 'journal.encrypted');
  try {
    let now = start, failAtCheck = false, reviews = 0;
    const sends: string[] = [];
    let journal = openPreviewJournal(path, key, genesis, stage => {
      if (failAtCheck && stage === 'after:reply-check') { failAtCheck = false; throw Error('simulated stop'); }
    });
    const ports = { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
      model: async (input: { question: string }) => JSON.stringify({ reply: 'Okay.', memory: [],
        dated: input.question.includes('Invoice due')
          ? [{ quote: 'Invoice due Oct 3 at 8 am.', when: 'Oct 3 at 8 am' }] : [] }),
      send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; }, checkOutbound: () => {},
      replyCheck: {
        jev: async () => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES)
          .map(id => [id, { type: 'noul', noul: 0 }])) }, latencyMs: 1 }),
        escalate: async () => { reviews++; return { verdict: 'pass' as const, ruleIds: [], confidence: 1, latencyMs: 1 }; },
        elapsedMs: () => 0 } };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Invoice due Oct 3 at 8 am.')]); await worker.drain();
    now = Date.UTC(2026, 9, 1, 14, 59, 59, 999);
    worker.intake([update(2, 'Hello')]);
    failAtCheck = true;
    await expect(worker.drain()).rejects.toThrow('simulated stop');
    expect(journal.view.order[1]?.intent).toBeUndefined();
    journal.close();
    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    now = Date.UTC(2026, 9, 1, 15);
    await worker.drain();
    expect(reviews).toBe(1);
    expect(sends[1]).toContain('Upcoming: Invoice due Oct 3 at 8 am.');
    expect(journal.view.mentionedDates.size).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('replays the exact completed paid review when the 48-hour edge moves', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-imminent-paid-replay-'))), path = join(root, 'journal.encrypted');
  try {
    let now = start, stopAfterReview = false, reviews = 0;
    const sends: string[] = [];
    let journal = openPreviewJournal(path, key, genesis);
    const ports = { now: () => now, stopped: () => stopAfterReview, timeZone: 'America/Los_Angeles',
      model: async (input: { question: string }) => JSON.stringify({ reply: 'Okay.', memory: [],
        dated: input.question.includes('Invoice due')
          ? [{ quote: 'Invoice due Oct 3 at 8 am.', when: 'Oct 3 at 8 am' }] : [] }),
      send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; }, checkOutbound: () => {},
      replyCheck: {
        jev: async (text: string) => ({ value: { model: JEV_MODEL, answers: Object.fromEntries(Object.keys(REPLY_RULES)
          .map(id => [id, { type: 'noul', noul: text === 'PREVIEW — Okay.' && now !== start && id === 'raw_path' ? 0.5 : 0 }])) }, latencyMs: 1 }),
        escalate: async () => { reviews++; stopAfterReview = true;
          return { verdict: 'pass' as const, ruleIds: [], confidence: 1, latencyMs: 1 }; },
        elapsedMs: () => 0 } };
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Invoice due Oct 3 at 8 am.')]); await worker.drain();
    now = Date.UTC(2026, 9, 1, 14, 59, 59, 999);
    worker.intake([update(2, 'Hello')]);
    await expect(worker.drain()).rejects.toThrow('preview stopped');
    expect(journal.view.order[1]?.replyChecks?.at(-1)).toMatchObject({ path: 'subscription', verdict: 'pass' });
    expect(journal.view.order[1]?.intent).toBeUndefined();
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    now = Date.UTC(2026, 9, 1, 15); stopAfterReview = false;
    await worker.drain();
    expect(reviews).toBe(1);
    expect(sends[1]).toBe('PREVIEW — Okay.');
    expect(journal.view.order[1]?.held).toBeUndefined();
    expect(journal.view.mentionedDates.size).toBe(0);
    worker.intake([update(3, 'Next')]); await worker.drain();
    expect(sends[2]).toContain('Upcoming: Invoice due Oct 3 at 8 am.');
    expect(journal.view.mentionedDates.size).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
