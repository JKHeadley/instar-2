import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Fixtures substitute the model and Jev (int11's faithfulness check runs before a summary commits).
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(37);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:follow-up', configurationDigest: 'sha256:follow-up', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string, sender = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: sender }, text, date: 1790000000 + id * 60 } });

it('carries the previous turn’s last named person into a short follow-up after replay and sends only replies', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-follow-up-')));
  const path = join(root, 'journal.encrypted');
  const packets: Record<string, { lastNamedPerson?: { name: string; message: string; from: string }; capability: string }> = {};
  let sends = 0;
  const ports = { now: () => 1790000000000, stopped: () => false,
    model: async ({ question, context }: { question: string; context: string }) => {
      const packet = JSON.parse(context);
      packets[question] = packet;
      if (question === 'I met Sam and Priya yesterday.')
        return JSON.stringify({ reply: 'Tell me more.', memory: [], dated: [], lastNamedPerson: 'Priya' });
      if (question === 'and her birthday?')
        return JSON.stringify({ reply: `I don't know ${packet.lastNamedPerson?.name}'s birthday.`, memory: [], dated: [], lastNamedPerson: null });
      return JSON.stringify({ reply: 'Okay.', memory: [], dated: [], lastNamedPerson: null });
    },
    send: async () => ++sends, checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    const empty = worker.probe('and her birthday?');
    if ('reason' in empty) throw Error(empty.reason);
    expect(JSON.parse(empty.context).lastNamedPerson).toBeUndefined();
    worker.intake([update(1, 'I met Sam and Priya yesterday.')]);
    await worker.drain();
    expect(journal.view.order[0]?.lastNamedPerson).toBe('Priya');
    expect(sends).toBe(1);
    journal.close();

    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    const probe = worker.probe('and her birthday?');
    if ('reason' in probe) throw Error(probe.reason);
    expect(JSON.parse(probe.context).lastNamedPerson).toMatchObject({ name: 'Priya',
      message: 'I met Sam and Priya yesterday.', from: 'the operator (verified sender)' });
    expect(JSON.parse(probe.context).capability).toContain('judge the reference from the conversation');
    expect(sends).toBe(1);
    worker.intake([update(2, 'and her birthday?')]);
    await worker.drain();
    expect(packets['and her birthday?']?.lastNamedPerson?.name).toBe('Priya');
    expect(journal.view.order[1]?.intent).toContain("I don't know Priya's birthday");
    expect(sends).toBe(2);
    await worker.drain();
    expect(sends).toBe(2);
    expect(journal.view.order.map(turn => turn.sent)).toEqual([1, 2]);
    const after = worker.probe('anything else?');
    if ('reason' in after) throw Error(after.reason);
    expect(JSON.parse(after.context).lastNamedPerson).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not carry an unsupported, absent, or foreign person cue or reuse an older name', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-follow-up-guard-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const selections = new Map([[1, 'Mira'], [2, 'Sam'], [3, 'Nora']]);
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      model: async ({ id }: { id: string }) => JSON.stringify({ reply: 'Okay.', memory: [], dated: [],
        lastNamedPerson: selections.get(Number(id.split(':').at(-1))) ?? null }),
      send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Sam is my friend.')]);
    await worker.drain();
    expect(journal.view.order[0]?.lastNamedPerson).toBeUndefined(); // Mira was invented.
    let probe = worker.probe('and her birthday?');
    if ('reason' in probe) throw Error(probe.reason);
    expect(JSON.parse(probe.context).lastNamedPerson).toBeUndefined();

    worker.intake([update(2, 'I talked to Sam.'), update(3, 'Nora sent a note.', 99)]);
    await worker.drain();
    expect(journal.view.order[1]?.lastNamedPerson).toBe('Sam');
    expect(journal.view.order[2]?.accepted).toBe(false);
    probe = worker.probe('and his birthday?');
    if ('reason' in probe) throw Error(probe.reason);
    expect(JSON.parse(probe.context).lastNamedPerson?.name).toBe('Sam');

    worker.intake([update(4, 'No person in this message.')]);
    await worker.drain();
    probe = worker.probe('and his birthday?');
    if ('reason' in probe) throw Error(probe.reason);
    expect(JSON.parse(probe.context).lastNamedPerson).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('omits a selected name when accepted forgetting removes it from the source, including after replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-follow-up-forget-')));
  const path = join(root, 'journal.encrypted');
  try {
    const ports = { now: () => 1790000000000, stopped: () => false,
      model: async ({ id, question, context }: { id: string; question: string; context: string }) => {
        if (id.startsWith('summary:')) {
          const packet = JSON.parse(context);
          const source = packet.memoryCandidates.find((item: { message: string }) => item.message.includes('Priya Shah'));
          return JSON.stringify({ summary: 'The operator asked to forget a name.', people: [],
            memory: [{ mode: 'forget', source: source.id, quote: 'Priya Shah' }] });
        }
        return JSON.stringify({ reply: 'Understood.', memory: [], dated: [],
          lastNamedPerson: question.includes('Priya Shah') ? 'Priya Shah' : null });
      }, send: async () => 1, checkOutbound: () => {} };
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'I met Priya Shah yesterday.')]); await worker.drain();
    worker.intake([update(2, 'Forget the name Priya Shah.')]); await worker.drain();
    expect(journal.view.memory).toMatchObject([{ mode: 'forget', source: journal.view.order[0]!.id, quote: 'Priya Shah' }]);
    expect(journal.view.order[1]?.lastNamedPerson).toBe('Priya Shah');
    journal.close();

    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    const probe = worker.probe('And her birthday?');
    if ('reason' in probe) throw Error(probe.reason);
    const packet = JSON.parse(probe.context);
    expect(packet.memory).toMatchObject([{ mode: 'forgotten' }]);
    expect(packet.lastNamedPerson).toBeUndefined();
    expect(probe.context).not.toContain('Priya Shah');
    expect(packet.history.at(-1)?.user).toContain('[withheld: operator correction or forgetting]');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
