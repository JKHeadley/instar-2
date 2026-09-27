import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { prepareJournalEnvelope } from './journal-envelope.js';

const key = new Uint8Array(32).fill(31);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 40, maxReplies: 40, maxTurns: 40, maxBytes: 16000, cursor: 0 };
const update = (id: number, text: string, from = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: from }, text, date: 1790000000 + id * 60 } });
const root = () => realpathSync(mkdtempSync(join(tmpdir(), 'preview-inventory-')));
const workerFor = (journal: ReturnType<typeof openPreviewJournal>, prepareModel?: (context: string) => void) =>
  createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
    ...(prepareModel ? { prepareModel: (input: { context: string }) => { prepareModel(input.context); return input.context; } } : {}),
    model: async () => 'Understood.', send: async () => 1, checkOutbound: () => {} });
const packetFor = (worker: ReturnType<typeof workerFor>, question: string) => {
  const probe = worker.probe(question);
  if ('reason' in probe) throw Error(probe.reason);
  return JSON.parse(probe.context);
};

it('replays a source-dated inventory of people, correction, forgotten marker, commitments, channel and dated turns', () => {
  const directory = root(), path = join(directory, 'journal.encrypted');
  try {
    let journal = openPreviewJournal(path, key, genesis);
    for (const [index, message] of [
      'Sam is my colleague.', 'Sam has a blue bicycle.', 'Sam locker code is 3310.',
      'Forget Sam locker code.', 'Please remember to ask Sam about the project.',
    ].entries()) journal.append({ kind: 'intake', id: `telegram:12345678:update:${index + 1}`, update: index + 1,
      text: message, raw: JSON.stringify(update(index + 1, message)), accepted: true, cursor: index + 2,
      at: 1790000000000 + index * 60000 });
    journal.append({ kind: 'channel-item', item: { source: 'email', account: 'agent@example.test', id: 'mail-7',
      from: 'sam@example.test', at: 1790000100000, subject: 'Project', text: 'Sam sent the project notes.' }, at: 1790000100000 });
    journal.append({ kind: 'summary-reserve', through: 5, at: 1790000200000 });
    journal.append({ kind: 'summary', through: 5, text: 'Sam is a colleague with a bicycle.',
      people: [{ name: 'Sam', source: 'telegram:12345678:update:1', quote: 'Sam is my colleague.' }],
      commitments: [{ in: 'message', source: 'telegram:12345678:update:5', quote: 'remember to ask Sam about the project' }],
      memoryFor: ['telegram:12345678:update:4'],
      memory: [{ mode: 'forget', source: 'telegram:12345678:update:3', quote: 'Sam locker code is 3310.',
        trigger: 'telegram:12345678:update:4' }], at: 1790000200000 });
    for (const [id, message] of [[6, 'Sam works in sales.'], [7, 'Actually Sam works in design.']] as const)
      journal.append({ kind: 'intake', id: `telegram:12345678:update:${id}`, update: id,
        text: message, raw: JSON.stringify(update(id, message)), accepted: true, cursor: id + 1, at: 1790000000000 + id * 60000 });
    journal.append({ kind: 'reserve', id: 'telegram:12345678:update:7', at: 1790000300000 });
    journal.append({ kind: 'answer', id: 'telegram:12345678:update:7', text: 'Understood.',
      memory: [{ mode: 'correct', source: 'telegram:12345678:update:6', quote: 'Sam works in sales.',
        replacement: 'Sam works in design.', trigger: 'telegram:12345678:update:7' }], at: 1790000300000 });
    journal.close();
    journal = openPreviewJournal(path, key);
    const packet = packetFor(workerFor(journal), 'What do you remember about Sam?');
    const items = packet.inventory.items as { kind: string; source: string; date: string; text?: string; status?: string }[];
    expect(new Set(items.map(item => item.kind))).toEqual(new Set(['person', 'forgotten', 'correction', 'commitment', 'channel', 'dated']));
    expect(items.every(item => item.source && item.date)).toBe(true);
    expect(items.find(item => item.kind === 'person')).toMatchObject({ source: 'telegram update 1',
      date: '2026-09-21T14:14Z', text: 'Sam is my colleague.' });
    expect(items.find(item => item.kind === 'forgotten')).toMatchObject({ source: 'telegram update 4',
      status: 'withheld at verified operator request' });
    expect(items.find(item => item.kind === 'correction')).toMatchObject({ source: 'telegram update 7',
      text: 'Sam works in design.' });
    expect(items.find(item => item.kind === 'channel')).toMatchObject({ from: 'sam@example.test', date: '2026-09-21T14:15Z' });
    expect(packet.inventory.truncated).toBe(false);
    expect(JSON.stringify(packet)).not.toContain('3310');
    expect(JSON.stringify(packet)).not.toContain('Sam works in sales.');
    expect(packet.capability).toContain('lexical miss is never evidence');
    expect(packetFor(workerFor(journal), 'What do you know about me?').inventory.items.length).toBeGreaterThan(0);
    expect(packetFor(workerFor(journal), 'How is the weather?').inventory).toBeUndefined();
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('reports selection and prompt limits without claiming a complete inventory', () => {
  const directory = root();
  try {
    const journal = openPreviewJournal(join(directory, 'journal.encrypted'), key, genesis);
    for (let index = 1; index <= 25; index++) {
      const message = `Sam project item ${index}.`;
      journal.append({ kind: 'intake', id: `telegram:12345678:update:${index}`, update: index,
        text: message, raw: JSON.stringify(update(index, message)), accepted: true, cursor: index + 1,
        at: 1790000000000 + index * 60000 });
    }
    const full = packetFor(workerFor(journal), 'What do you remember about Sam?');
    expect(full.inventory).toMatchObject({ total: 25, shown: 20, truncated: true });
    const fit = packetFor(workerFor(journal, context => {
      if (JSON.parse(context).inventory?.shown > 3) throw Error('fixture prompt bound');
    }), 'What do you remember about Sam?');
    expect(fit.inventory).toMatchObject({ total: 25, shown: 3, truncated: true });
    expect(fit.inventory.items.every((item: { source: string; date: string }) => item.source && item.date)).toBe(true);
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('does not offer the inventory on a nonoperator turn', async () => {
  const directory = root();
  try {
    const journal = openPreviewJournal(join(directory, 'journal.encrypted'), key, genesis);
    const contexts: string[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => { contexts.push(input.context); return input.context; },
      model: async () => 'Understood.', send: async () => 1, checkOutbound: () => {} });
    journal.append({ kind: 'intake', id: 'telegram:12345678:update:1', update: 1,
      text: 'What do you remember about Sam?', raw: JSON.stringify(update(1, 'What do you remember about Sam?', 888)),
      accepted: true, cursor: 2, at: 1790000000000 });
    await worker.drain();
    expect(JSON.parse(contexts[0]!).inventory).toBeUndefined();
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('does not expose forgotten content encoded in imported metadata or candidate IDs', () => {
  const directory = root();
  try {
    const journal = openPreviewJournal(join(directory, 'journal.encrypted'), key, genesis);
    const quote = 'The archive phrase is silver crane.';
    const item = { source: 'email' as const, account: 'agent@example.test', id: `archive-7 ${quote}`,
      from: `sender ${quote}`, at: 1790000100000, subject: 'Archive', text: quote };
    journal.append({ kind: 'channel-item', item, at: item.at });
    const request = 'Forget the archive phrase.';
    journal.append({ kind: 'intake', id: 'telegram:12345678:update:1', update: 1, text: request,
      raw: JSON.stringify(update(1, request)), accepted: true, cursor: 2, at: 1790000000000 });
    journal.append({ kind: 'summary-reserve', through: 1, at: 1790000200000 });
    journal.append({ kind: 'summary', through: 1, text: 'The operator asked to forget an archive detail.',
      memoryFor: ['telegram:12345678:update:1'], memory: [{ mode: 'forget',
        source: `channel:${JSON.stringify([item.source, item.account, item.id])}`, quote,
        trigger: 'telegram:12345678:update:1' }], at: 1790000200000 });
    const packet = packetFor(workerFor(journal), 'What do you remember about the archive?');
    expect(packet.inventory.items.some((entry: { kind: string }) => entry.kind === 'forgotten')).toBe(true);
    expect(JSON.stringify(packet)).not.toContain('silver crane');
    expect(packet.channelMemory?.[0]?.sourceId).toContain('[withheld: operator correction or forgetting]');
    expect(packet.memoryCandidates?.some((entry: { id: string }) => entry.id.includes('silver crane'))).not.toBe(true);
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it('drains an accepted memory question when the ordinary envelope fits but even empty inventory does not', async () => {
  const directory = root();
  try {
    const g = { ...genesis, maxBytes: 6860 };
    const journal = openPreviewJournal(join(directory, 'journal.encrypted'), key, g);
    const question = 'What do you know about me? Context: '.padEnd(2500, 'x');
    const full = workerFor(journal).probe(question);
    if ('reason' in full) throw Error(full.reason);
    expect(JSON.parse(full.context).inventory).toMatchObject({ total: 0, shown: 0 });
    expect(() => prepareJournalEnvelope({ question, context: full.context, id: 'telegram:12345678:update:1' },
      'claude-opus-5-5', g.grant, 1790000000000, g.maxBytes)).toThrow('overflow');
    const contexts: string[] = [], sent: number[] = [];
    const worker = createJournalWorker(journal, { now: () => 1790000000000, stopped: () => false,
      prepareModel: input => { const prepared = prepareJournalEnvelope(input,
        'claude-opus-5-5', g.grant, 1790000000000, g.maxBytes);
        contexts.push(input.context); return prepared; },
      model: async () => 'Understood.', send: async () => { sent.push(1); return 1; }, checkOutbound: () => {} });
    worker.intake([update(1, question)]);
    await worker.drain();
    expect(contexts).toHaveLength(1);
    expect(JSON.parse(contexts[0]!).inventory).toBeUndefined();
    expect(JSON.parse(contexts[0]!).capability).not.toContain('inventory is a bounded');
    expect(journal.view.turns.get('telegram:12345678:update:1')).toMatchObject({ sent: 1 });
    expect(journal.view.calls).toBe(1);
    expect(sent).toHaveLength(1);
    journal.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
