import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Fixtures substitute the model and Jev (int11's faithfulness check runs before a summary commits).
import { createJournalWorker, openPreviewJournal, UNLINKED_EDIT_FLAG, withoutCorrectedHistory } from './journal-test-worker.js';
import { selfState } from './self-state.js';

const key = new Uint8Array(32).fill(29);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 16000, cursor: 0 };
const message = (update_id: number, text: string, message_id = 42, from = 7654321) => ({ update_id,
  message: { message_id, chat: { id: 7654321, type: 'private' }, from: { id: from }, date: 1790000000, text } });
const edit = (update_id: number, text: string, message_id = 42, from = 7654321) => ({ update_id,
  edited_message: { message_id, chat: { id: 7654321, type: 'private' }, from: { id: from },
    date: 1790000000, edit_date: 1790001000, text } });
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-message-edit-')));

it('records a fact edit against the original turn, corrects memory, and never replies to the edit', async () => {
  const directory = root(), path = join(directory, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    const sends: number[] = [];
    const ports = { now: () => 1790002000000, stopped: () => false,
      model: async (input: { id: string; context: string }) => {
        const packet = JSON.parse(input.context);
        if (input.id.startsWith('summary:')) {
          if (packet.memoryRequest?.editedTurn) {
            expect(packet.memoryCandidates[0]).toMatchObject({ message: 'The launch is on Tuesday.' });
            return JSON.stringify({ summary: 'The launch is on Thursday.', people: [], memory: [{ mode: 'correct',
              source: packet.memoryRequest.replaces, quote: 'The launch is on Tuesday.',
              replacement: 'The launch is on Thursday.' }] });
          }
          return JSON.stringify({ summary: 'The launch is Thursday.', people: [], memory: [] });
        }
        return JSON.stringify({ reply: 'Understood.', memory: [], dated: [] });
      }, send: async (input: { update: number }) => { sends.push(input.update); return sends.length; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([message(1, 'The launch is on Tuesday.')]); await worker.drain();
    expect(sends).toEqual([1]);
    expect(worker.intake([edit(2, 'The launch is on Thursday.')])).toBe(3);
    await worker.drain();
    expect(sends).toEqual([1]);
    expect(journal.view.order[1]).toMatchObject({ editOf: journal.view.order[0]!.id,
      replaces: journal.view.order[0]!.id });
    expect(journal.view.order[1]?.intent).toBeUndefined();
    expect(journal.view.memory).toMatchObject([{ source: journal.view.order[0]!.id,
      trigger: journal.view.order[1]!.id, replacement: 'The launch is on Thursday.' }]);
    const state = selfState(journal.view, { launches: [], unreadable: 0 }, 1790002000000, 'UTC');
    expect(state).toContain('1 so far');
    expect(state).toContain('Telegram edits recorded: 1');
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    worker.intake([edit(2, 'The launch is on Thursday.')]); await worker.drain();
    expect(sends).toEqual([1]);
    expect(journal.view.order).toHaveLength(2);
    const probe = worker.probe('When is the launch?');
    expect('reason' in probe).toBe(false);
    if ('reason' in probe) throw Error(probe.reason);
    expect(probe.context).toContain('Thursday');
    expect(withoutCorrectedHistory(probe.context)).not.toContain('Tuesday');
    expect(readFileSync(path, 'utf8')).not.toContain('Thursday');
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('keeps a foreign edit out, and delivers an unlinked operator edit to the mind with its flag (Rule 14)', async () => {
  const directory = root();
  try {
    const journal = openPreviewJournal(join(directory, 'journal.encrypted'), key, genesis);
    let calls = 0, sends = 0;
    const worker = createJournalWorker(journal, { now: () => 1790002000000, stopped: () => false,
      model: async () => { calls++; return 'reply'; }, send: async () => { sends++; return 1; }, checkOutbound: () => {} });
    worker.intake([edit(1, 'orphan'), message(2, 'Known fact.'), edit(3, 'foreign', 42, 99), edit(4, 'different message', 99)]);
    await worker.drain();
    expect(journal.view.cursor).toBe(5);
    expect(journal.view.order.map(turn => turn.accepted)).toEqual([true, true, false, true]);
    expect(journal.view.order[0]?.text).toBe(`${UNLINKED_EDIT_FLAG}\norphan`);
    expect(journal.view.order[0]?.editOf).toBeUndefined();
    expect(calls).toBe(3);
    expect(sends).toBe(3);
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('does not send a stale answer when the message is edited before its first drain', async () => {
  const directory = root();
  try {
    const journal = openPreviewJournal(join(directory, 'journal.encrypted'), key, genesis);
    const sends: number[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790002000000, stopped: () => false,
      model: async input => input.id.startsWith('summary:')
        ? JSON.stringify({ summary: 'The launch is on Thursday.', people: [], memory: [{ mode: 'correct',
          source: journal.view.order[0]!.id, quote: 'The launch is on Tuesday.', replacement: 'The launch is on Thursday.' }] })
        : 'The launch is on Thursday.',
      send: async input => { sends.push(input.update); return sends.length; }, checkOutbound: () => {} });
    worker.intake([message(1, 'The launch is on Tuesday.'), edit(2, 'The launch is on Thursday.')]);
    await worker.drain();
    expect(journal.view.order[0]?.held).toBe('superseded by edit');
    expect(journal.view.memory).toHaveLength(1);
    expect(sends).toEqual([]);
    worker.intake([message(3, 'When is the launch?', 43)]); await worker.drain();
    expect(sends).toEqual([3]);
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('keeps successive revisions attached to one original and treats a wording edit as no fact correction', async () => {
  const directory = root();
  try {
    const journal = openPreviewJournal(join(directory, 'journal.encrypted'), key, genesis);
    let sends = 0;
    const worker = createJournalWorker(journal, { now: () => 1790002000000, stopped: () => false,
      model: async input => {
        if (!input.id.startsWith('summary:')) return 'Understood.';
        const packet = JSON.parse(input.context);
        if (packet.memoryRequest?.message === 'The launch is Thursday.') {
          expect(packet.memoryCandidates[0].message).toBe('The launch is on Thursday.');
          return JSON.stringify({ summary: 'The launch is on Thursday.', people: [], memory: [] });
        }
        return JSON.stringify({ summary: 'The launch is on Thursday.', people: [], memory: [{ mode: 'correct',
          source: packet.memoryRequest.replaces, quote: 'The launch is on Tuesday.', replacement: 'The launch is on Thursday.' }] });
      }, send: async () => ++sends, checkOutbound: () => {} });
    worker.intake([message(1, 'The launch is on Tuesday.')]); await worker.drain();
    worker.intake([edit(2, 'The launch is on Thursday.')]); await worker.drain();
    worker.intake([edit(3, 'The launch is Thursday.')]); await worker.drain();
    expect(sends).toBe(1);
    expect(journal.view.order[2]).toMatchObject({ editOf: journal.view.order[0]!.id,
      replaces: journal.view.order[1]!.id });
    expect(journal.view.memory).toHaveLength(1);
    const probe = worker.probe('When is the launch?');
    expect('reason' in probe).toBe(false);
    if ('reason' in probe) throw Error(probe.reason);
    expect(probe.context).toContain('The launch is Thursday.');
    expect(withoutCorrectedHistory(probe.context)).not.toContain('Tuesday');
    expect(journal.view.order[2]?.memoryUndecided).toBeUndefined();
    worker.intake([message(4, 'When is the launch?', 43)]); await worker.drain();
    expect(sends).toBe(2);
    expect(journal.view.order[3]?.sent).toBeDefined();
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('allows a later edit to restore an earlier fact, including after replay', async () => {
  const directory = root(), path = join(directory, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    const sends: number[] = [];
    const ports = { now: () => 1790002000000, stopped: () => false,
      model: async (input: { id: string; context: string }) => {
        if (!input.id.startsWith('summary:')) return 'Understood.';
        const packet = JSON.parse(input.context);
        if (!packet.memoryRequest?.editedTurn) return JSON.stringify({ summary: 'The launch is on Tuesday.', people: [], memory: [] });
        const restored = packet.memoryRequest.message === 'The launch is on Tuesday.';
        expect(packet.memoryCandidates[0].message).toBe(restored ? 'The launch is on Thursday.' : 'The launch is on Tuesday.');
        return JSON.stringify({ summary: packet.memoryRequest.message, people: [], memory: [{ mode: 'correct',
          source: packet.memoryRequest.replaces, quote: packet.memoryCandidates[0].message,
          replacement: packet.memoryRequest.message }] });
      }, send: async (input: { update: number }) => { sends.push(input.update); return sends.length; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([message(1, 'The launch is on Tuesday.')]); await worker.drain();
    worker.intake([edit(2, 'The launch is on Thursday.')]); await worker.drain();
    worker.intake([edit(3, 'The launch is on Tuesday.')]); await worker.drain();
    expect(journal.view.memory).toHaveLength(2);
    expect(journal.view.order[2]?.memoryUndecided).toBeUndefined();
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    const probe = worker.probe('When is the launch?');
    expect('reason' in probe).toBe(false);
    if ('reason' in probe) throw Error(probe.reason);
    expect(probe.context).toContain('The launch is on Tuesday.');
    expect(withoutCorrectedHistory(probe.context)).not.toContain('The launch is on Thursday.');
    worker.intake([message(4, 'When is the launch?', 43)]); await worker.drain();
    expect(sends).toEqual([1, 4]);
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('withdraws an edited claim without inventing a replacement', async () => {
  const directory = root(), path = join(directory, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    const sends: number[] = [];
    const ports = { now: () => 1790002000000, stopped: () => false,
      model: async (input: { id: string; context: string }) => {
        if (!input.id.startsWith('summary:')) return 'Understood.';
        const packet = JSON.parse(input.context);
        return packet.memoryRequest?.editedTurn
          ? JSON.stringify({ summary: 'The operator withdrew the launch claim.', people: [], memory: [{ mode: 'forget',
            source: packet.memoryRequest.replaces, quote: 'The launch is on Tuesday.' }] })
          : JSON.stringify({ summary: 'The launch is on Tuesday.', people: [], memory: [] });
      }, send: async (input: { update: number }) => { sends.push(input.update); return sends.length; }, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([message(1, 'The launch is on Tuesday.')]); await worker.drain();
    worker.intake([edit(2, 'I withdraw that claim.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'forget', source: journal.view.order[0]!.id,
      trigger: journal.view.order[1]!.id }]);
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    const probe = worker.probe('What was the launch date?');
    expect('reason' in probe).toBe(false);
    if ('reason' in probe) throw Error(probe.reason);
    expect(probe.context).not.toContain('The launch is on Tuesday.');
    worker.intake([message(3, 'What was the launch date?', 43)]); await worker.drain();
    expect(sends).toEqual([1, 3]);
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it.each(['unresolved', 'malformed'] as const)('releases later replies after %s edit judgment and preserves uncertainty through replay', async failure => {
  const directory = root(), path = join(directory, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let sends = 0;
    const ports = { now: () => 1790002000000, stopped: () => false,
      model: async (input: { id: string; context: string }) => {
        if (!input.id.startsWith('summary:')) return 'ok';
        const packet = JSON.parse(input.context);
        return packet.memoryRequest?.editedTurn
          ? failure === 'malformed' ? 'not a JSON judgment'
            : JSON.stringify({ summary: 'The launch is on Tuesday.', people: [], memory: [], memoryDisposition: 'unresolved' })
          : JSON.stringify({ summary: 'The edit is unresolved.', people: [], memory: [] });
      }, send: async () => ++sends, checkOutbound: () => {} };
    let worker = createJournalWorker(journal, ports);
    worker.intake([message(1, 'The launch is on Tuesday.')]); await worker.drain();
    worker.intake([edit(2, 'The launch is on Thursday.'), message(3, 'When is the launch?', 43)]);
    await worker.drain();
    expect(sends).toBe(1);
    expect(journal.view.order[2]?.held).toBe('memory correction pending');
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    expect(journal.view.order[1]?.editOf).toBe(journal.view.order[0]?.id);
    await worker.drain();
    expect(sends).toBe(2);
    expect(journal.view.order[1]?.memoryUndecided).toBe(true);
    expect(journal.view.order[2]?.held).toBeUndefined();
    const probe = worker.probe('Another question');
    expect('reason' in probe).toBe(false);
    if ('reason' in probe) throw Error(probe.reason);
    expect(probe.context).toContain('undecidedEdits');
    expect(probe.context).toContain('The launch is on Thursday.');
    worker.intake([message(4, 'Unrelated question', 44)]); await worker.drain();
    expect(sends).toBe(3);
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
