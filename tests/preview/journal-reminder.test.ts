import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(29);
const start = Date.UTC(2026, 8, 26, 17);
const morning = Date.UTC(2026, 8, 27, 15);
const faithfulSummary = async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } });
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:reminder', configurationDigest: 'sha256:reminder', expires: Date.UTC(2026, 8, 28),
  maxCalls: 20, maxReplies: 4, maxTurns: 10, maxBytes: 12000, cursor: 0 };
const reminderGrant = (at: number) => ({ kind: 'reminder-grant' as const, reference: 'operator:reminders',
  trial: genesis.grant, surface: 'telegram-private-chat' as const, scope: 'initiated-dated-reminders' as const,
  custodian: genesis.operator, recovery: 'unknown-never-retry' as const, at });
const update = (id: number, text: string, sender = 7654321, thread?: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: sender }, text,
    date: Math.floor(start / 1000) + id * 60, ...(thread === undefined ? {} : { message_thread_id: thread }) } });

it('sends once in the operator morning, with a durable intent and one reply slot across restart', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reminder-'))), path = join(root, 'journal.encrypted');
  try {
    let now = start;
    const sent: { text: string; thread?: number }[] = [];
    const ports = { now: () => now, stopped: () => false,
      model: async () => JSON.stringify({ reply: 'Recorded.', memory: [],
        dated: [{ quote: 'Dentist tomorrow at 3 pm.', when: 'tomorrow at 3 pm' }] }),
      checkOutbound: () => {}, send: async (value: { expectedText: string; thread?: number }) => {
        sent.push({ text: value.expectedText, ...(value.thread === undefined ? {} : { thread: value.thread }) });
        return sent.length;
      } };
    let journal = openPreviewJournal(path, key, genesis), worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Dentist tomorrow at 3 pm.', 7654321, 17), update(2, 'Dentist tomorrow at 3 pm.', 44)]);
    await worker.drain();
    expect(journal.view.dated).toHaveLength(1);
    expect(journal.view.replies).toBe(1);
    now = morning - 1;
    await worker.sendReminders();
    expect(sent).toHaveLength(1);
    now = morning;
    await worker.sendReminders();
    expect(sent).toHaveLength(1); // the reply trial alone grants no initiated send.
    journal.append(reminderGrant(now));
    await worker.sendReminders();
    expect(sent[1]).toEqual({ text: 'PREVIEW reminder: Dentist tomorrow at 3 pm. today at 15:00', thread: 17 });
    expect(journal.view.replies).toBe(2);
    expect(journal.view.reminders.size).toBe(1);
    journal.close();
    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    await worker.sendReminders();
    expect(sent).toHaveLength(2);
    expect(journal.view.reminders.size).toBe(1);
    expect(journal.view.replies).toBe(2);
    journal.close();
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs', 'status', '--root', root],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
        env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(status.status, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout).reminders).toEqual({ intents: 1, accepted: 1, unknown: 0, grant: 'operator:reminders' });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('never retries an unknown send and rejects a late-day dispatch', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reminder-guards-'))), path = join(root, 'journal.encrypted');
  try {
    let now = start, stopped = false, sends = 0;
    const ports = { now: () => now, stopped: () => stopped,
      model: async (input: { question: string }) => JSON.stringify({ reply: 'Recorded.', memory: [], dated: [{
        quote: input.question, when: input.question.includes('tomorrow') ? 'tomorrow' : 'this Sunday' }] }),
      checkOutbound: () => {}, send: async () => { sends++; return null; } };
    let journal = openPreviewJournal(path, key, { ...genesis, maxReplies: 2 }), worker = createJournalWorker(journal, ports);
    journal.append(reminderGrant(start));
    worker.intake([update(1, 'Invoice tomorrow.')]); await worker.drain();
    now = morning + 4 * 3600000; await worker.sendReminders(); // noon is outside the morning window.
    expect(sends).toBe(1);
    now = morning; await worker.sendReminders();
    expect(sends).toBe(2);
    expect(journal.view.replies).toBe(2);
    expect([...journal.view.reminders.values()][0]?.sent).toBeUndefined();
    journal.close();
    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    await worker.sendReminders();
    expect(sends).toBe(2); // unknown is a consumed slot, not a retry.
    stopped = true;
    await expect(worker.sendReminders()).rejects.toThrow('preview stopped');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('suppresses a forgotten item before its morning and keeps the original journal evidence', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reminder-forget-')));
  try {
    let now = start, sends = 0;
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    journal.append(reminderGrant(start));
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async (input: { id: string; question: string; context: string }) => {
        if (input.id.startsWith('summary:')) {
          const source = JSON.parse(input.context).memoryCandidates.find((item: { message: string }) =>
            item.message.includes('Dentist tomorrow.'));
          return JSON.stringify({ summary: 'The operator forgot the dentist item.', people: [],
            memory: [{ mode: 'forget', source: source.id, quote: 'Dentist tomorrow.' }] });
        }
        return input.question.startsWith('Forget')
          ? JSON.stringify({ reply: 'Forgotten.', memory: [], dated: [] })
          : JSON.stringify({ reply: 'Recorded.', memory: [], dated: [{ quote: 'Dentist tomorrow.', when: 'tomorrow' }] });
      }, summaryCheck: faithfulSummary, checkOutbound: () => {}, send: async () => ++sends });
    worker.intake([update(1, 'Dentist tomorrow.')]); await worker.drain();
    worker.intake([update(2, 'Forget the dentist item.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'forget', quote: 'Dentist tomorrow.' }]);
    now = morning;
    await worker.sendReminders();
    expect(sends).toBe(2);
    expect(journal.view.dated).toHaveLength(1);
    expect(journal.view.reminders.size).toBe(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds reminders through replay for an undecided forget, but sends unrelated items after a settled forget', async () => {
  for (const settled of [false, true]) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reminder-memory-')));
    const path = join(root, 'journal.encrypted');
    try {
      let now = start;
      const sent: string[] = [];
      const ports = { now: () => now, stopped: () => false, checkOutbound: () => {}, summaryCheck: faithfulSummary,
        send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; },
        model: async (input: { id: string; question: string; context: string }) => {
          if (input.id.startsWith('summary:')) {
            if (!settled) throw Error('summary unavailable');
            const source = JSON.parse(input.context).memoryCandidates.find((item: { message: string }) =>
              item.message.includes('Dentist tomorrow.'));
            return JSON.stringify({ summary: 'The operator withdrew an appointment.', people: [],
              memory: [{ mode: 'forget', source: source.id, quote: 'Dentist tomorrow.' }] });
          }
          if (input.question.startsWith('Forget')) return JSON.stringify({ reply: 'Noted.', memory: [],
            memoryDisposition: settled ? 'settled' : 'unresolved' });
          return JSON.stringify({ reply: 'Recorded.', memory: [], dated: [
            { quote: 'Dentist tomorrow.', when: 'tomorrow' }, { quote: 'Invoice tomorrow.', when: 'tomorrow' }] });
        } };
      let journal = openPreviewJournal(path, key, genesis);
      journal.append(reminderGrant(start));
      let worker = createJournalWorker(journal, ports);
      worker.intake([update(1, 'Dentist tomorrow. Invoice tomorrow.')]); await worker.drain();
      worker.intake([update(2, 'Forget the dentist item.')]); await worker.drain();
      expect(journal.view.order[1]?.memoryUndecided === true).toBe(!settled);
      expect(journal.view.memory.length).toBe(settled ? 1 : 0);
      now = morning;
      await worker.sendReminders();
      expect(sent).toHaveLength(settled ? 3 : 2);
      if (settled) expect(sent[2]).toBe('PREVIEW reminder: Invoice tomorrow. today at time unspecified');
      journal.close();
      journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
      await worker.sendReminders();
      expect(sent).toHaveLength(settled ? 3 : 2);
      expect(journal.view.reminders.size).toBe(settled ? 1 : 0);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('withholds a repeated forgotten clause while reminding an unrelated item after replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reminder-repeat-forget-')));
  const path = join(root, 'journal.encrypted');
  try {
    let now = start;
    const sent: string[] = [];
    const ports = { now: () => now, stopped: () => false, checkOutbound: () => {}, summaryCheck: faithfulSummary,
      send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; },
      model: async (input: { id: string; question: string; context: string }) => {
        if (input.id.startsWith('summary:')) {
          const source = JSON.parse(input.context).memoryCandidates.find((item: { message: string }) =>
            item.message.includes('Dentist tomorrow.'));
          return JSON.stringify({ summary: 'The operator withdrew an appointment.', people: [],
            memory: [{ mode: 'forget', source: source.id, quote: 'Dentist tomorrow.' }] });
        }
        if (input.question.startsWith('Forget')) return JSON.stringify({ reply: 'Forgotten.', memory: [] });
        return JSON.stringify({ reply: 'Recorded.', memory: [], dated: [{ quote: input.question, when: 'tomorrow' }] });
      } };
    let journal = openPreviewJournal(path, key, { ...genesis, maxReplies: 6 });
    journal.append(reminderGrant(start));
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'Dentist tomorrow.'), update(2, 'Dentist tomorrow.'), update(3, 'Invoice tomorrow.')]);
    await worker.drain();
    worker.intake([update(4, 'Forget the dentist item.')]); await worker.drain();
    expect(journal.view.dated).toHaveLength(3);
    expect(journal.view.memory).toMatchObject([{ mode: 'forget', quote: 'Dentist tomorrow.' }]);
    journal.close();
    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    now = morning;
    await worker.sendReminders();
    expect(sent).toHaveLength(5);
    expect(sent[4]).toBe('PREVIEW reminder: Invoice tomorrow. today at time unspecified');
    journal.close();
    journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    await worker.sendReminders();
    expect(sent).toHaveLength(5);
    expect(journal.view.reminders.size).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('holds ambiguous dates and a latched stop while a settled day-only item uses an honest time', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reminder-bounds-')));
  try {
    let now = start, stopped = false, sends = 0;
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { ...genesis, maxReplies: 4 });
    journal.append(reminderGrant(start));
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => stopped,
      model: async (input: { question: string }) => JSON.stringify({ reply: 'Recorded.', memory: [], dated: [{
        quote: input.question, when: input.question.includes('tomorrow') ? 'tomorrow' : 'this Sunday' }] }),
      checkOutbound: () => {}, send: async () => ++sends });
    worker.intake([update(1, 'Invoice tomorrow.'), update(2, 'Lunch this Sunday.')]); await worker.drain();
    now = morning;
    stopped = true;
    await expect(worker.sendReminders()).rejects.toThrow('preview stopped');
    expect(sends).toBe(2);
    stopped = false;
    await worker.sendReminders();
    expect(sends).toBe(3);
    expect([...journal.view.reminders.values()][0]?.text).toBe('PREVIEW reminder: Invoice tomorrow. today at time unspecified');
    expect(journal.view.replies).toBe(3);
    expect(journal.view.dated[1]?.ambiguity).toBeTruthy();
    await worker.sendReminders();
    expect(sends).toBe(3);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses a reminder when the reply cap or outbound secret wall prevents it', async () => {
  for (const reason of ['cap', 'secret']) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), `preview-reminder-${reason}-`)));
    try {
      let now = start, sends = 0;
      const journal = openPreviewJournal(join(root, 'journal.encrypted'), key,
        { ...genesis, maxReplies: reason === 'cap' ? 1 : 2 });
      journal.append(reminderGrant(start));
      const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
        model: async () => JSON.stringify({ reply: 'Recorded.', memory: [],
          dated: [{ quote: 'Invoice tomorrow.', when: 'tomorrow' }] }),
        checkOutbound: text => { if (reason === 'secret' && text.startsWith('PREVIEW reminder:')) throw Error('secret'); },
        send: async () => ++sends });
      worker.intake([update(1, 'Invoice tomorrow.')]); await worker.drain();
      now = morning; await worker.sendReminders();
      expect(sends).toBe(1);
      expect(journal.view.reminders.size).toBe(0);
      journal.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

it('coalesces exact repeated clauses for the same local day without losing either source turn', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reminder-repeat-')));
  try {
    let now = start, sends = 0;
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    journal.append(reminderGrant(start));
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => JSON.stringify({ reply: 'Recorded.', memory: [],
        dated: [{ quote: 'Invoice tomorrow.', when: 'tomorrow' }] }),
      checkOutbound: () => {}, send: async () => ++sends });
    worker.intake([update(1, 'Invoice tomorrow.'), update(2, 'Invoice tomorrow.')]); await worker.drain();
    expect(journal.view.dated).toHaveLength(2);
    now = morning;
    await worker.sendReminders();
    expect(sends).toBe(3);
    expect(journal.view.reminders.size).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('aggregates distinct items into one fixed-line notification for the same day and topic', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reminder-batch-')));
  try {
    let now = start;
    const sent: string[] = [];
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    journal.append(reminderGrant(start));
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => JSON.stringify({ reply: 'Recorded.', memory: [], dated: [
        { quote: 'Dentist tomorrow at 3 pm.', when: 'tomorrow at 3 pm' },
        { quote: 'Invoice tomorrow at 5 pm.', when: 'tomorrow at 5 pm' }] }),
      checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return sent.length; } });
    worker.intake([update(1, 'Dentist tomorrow at 3 pm. Invoice tomorrow at 5 pm.', 7654321, 17)]);
    await worker.drain();
    now = morning;
    await worker.sendReminders();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toBe('PREVIEW reminder: Dentist tomorrow at 3 pm. today at 15:00\n'
      + 'PREVIEW reminder: Invoice tomorrow at 5 pm. today at 17:00');
    expect(journal.view.reminders.size).toBe(1);
    expect(journal.view.replies).toBe(2);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not create a second push for an item recorded after the daily topic batch', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reminder-late-')));
  try {
    let now = start, sends = 0;
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    journal.append(reminderGrant(start));
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async (input: { question: string }) => JSON.stringify({ reply: 'Recorded.', memory: [],
        dated: [{ quote: input.question, when: input.question.includes('tomorrow') ? 'tomorrow' : 'September 27' }] }),
      checkOutbound: () => {}, send: async () => ++sends });
    worker.intake([update(1, 'Invoice tomorrow.')]); await worker.drain();
    now = morning; await worker.sendReminders();
    expect(sends).toBe(2);
    worker.intake([update(2, 'Dentist September 27.')]); await worker.drain();
    await worker.sendReminders();
    expect(sends).toBe(3); // ordinary answer only; one morning push for this topic and day.
    expect(journal.view.dated).toHaveLength(2);
    expect(journal.view.reminders.size).toBe(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
