import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, importChannelFixture, openPreviewJournal } from './journal.js';
import { statedFacts } from './memory-sentinel.js';

const key = new Uint8Array(32).fill(91);
const now = 1790000000000;
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: now + 1000000,
  maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: 1790000000 + id * 60 } });

it('recognizes an ordinary reschedule only from an exact direct clause', () => {
  expect(statedFacts('The launch moved from October to November.')).toEqual([
    { subject: 'the launch', value: 'in november', quote: 'The launch moved from October to November' }
  ]);
  expect(statedFacts('"The launch moved from October to November."')).toEqual([]);
  expect(statedFacts('> The launch moved from October to November.')).toEqual([]);
});

it('keeps the newest fact current and dated old values retrievable through successive restarts', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-fact-update-')));
  const path = join(root, 'journal.encrypted');
  const packets: Record<string, unknown>[] = [];
  const ports = { now: () => now, stopped: () => false,
    prepareModel: (input: { context: string }) => {
      const packet = JSON.parse(input.context) as { historyMode?: string; history?: unknown[] };
      if (packet.historyMode === 'complete' && (packet.history?.length ?? 0) > 4) throw Error('force compact fixture');
      return input.context;
    },
    model: async (input: { id: string; context: string }) => {
      if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'The operator discussed the launch.', people: [], memory: [] });
      const packet = JSON.parse(input.context) as Record<string, unknown> & {
        contradictions?: { earlier: { id: string; quote: string }; operator: { quote: string } }[] };
      packets.push(packet);
      const conflict = packet.contradictions?.[0];
      return JSON.stringify({ reply: 'Noted.', memory: conflict ? [{ mode: 'update', source: conflict.earlier.id,
        quote: conflict.earlier.quote, replacement: conflict.operator.quote }] : [], dated: [] });
    }, send: async () => 1, checkOutbound: () => {} };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    let worker = createJournalWorker(journal, ports);
    const values = ['October', 'November', 'December', 'January', 'February', 'March', 'April', 'May',
      'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    worker.intake([update(1, 'The launch is in October.')]); await worker.drain();
    worker.intake([update(2, 'The studio launch is in March.')]); await worker.drain();
    worker.intake([update(3, 'The launch moved from October to November.')]); await worker.drain();
    expect(journal.view.memory).toHaveLength(1);
    expect(journal.view.memory[0]).toMatchObject({ historical: true, quote: 'The launch is in October',
      replacement: 'The launch moved from October to November' });
    journal.append({ kind: 'summary-reserve', through: 3, at: now });
    journal.append({ kind: 'summary', through: 3, text: 'The launch moved from October to November. The studio launch is in March.', at: now });
    for (let index = 2; index < values.length; index++) {
      if (index % 3 === 0) {
        journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
      }
      const id = index + 2;
      worker.intake([update(id, `The launch is in ${values[index]}.`)]); await worker.drain();
      expect(journal.view.memory.length, `value ${values[index]}`).toBe(index);
      expect(journal.view.order.at(-1)?.sent).toBe(1);
      expect(journal.view.memory.at(-1)?.historical).toBe(true);
      if (values[index] === 'October') {
        const seen = worker.probe('What do you remember about the launch?');
        expect('context' in seen).toBe(true);
        if ('context' in seen) {
          const probe = JSON.parse(seen.context) as { history: { user: string }[];
            memorySearch: { items: { status: string; quote: string }[] } };
          expect(probe.history.some(item => item.user.includes('The launch is in October'))).toBe(true);
          expect(probe.memorySearch.items[0]).toMatchObject({ status: 'current', quote: 'The launch is in October.' });
        }
      }
    }
    journal.close(); journal = openPreviewJournal(path, key); worker = createJournalWorker(journal, ports);
    worker.intake([update(18, 'What do you remember about the launch?')]); await worker.drain();
    const packet = packets.at(-1)! as { historyMode: string; memorySearch: { items: { status: string; quote: string; date: string }[] };
      history: { user: string }[]; summary?: { text: string } };
    expect(packet.memorySearch.items[0]).toMatchObject({ status: 'current', quote: 'The launch is in December.' });
    expect(packet.memorySearch.items.some(item => item.status === 'superseded'
      && item.quote === 'The launch is in November' && Boolean(item.date))).toBe(true);
    expect(packet.memorySearch.items.every(item => Boolean(item.date))).toBe(true);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.history.some(item => item.user === 'The launch is in November.')).toBe(false);
    expect(packet.memorySearch.items.some(item => item.status === 'current'
      && item.quote === 'The studio launch is in March.')).toBe(true);
    expect(packet.history.some(item => item.user.includes('The launch is in December'))).toBe(true);
    expect(journal.view.memory).toHaveLength(values.length - 1);
    expect(journal.view.memory.every(change => change.source !== journal.view.order[1]?.id)).toBe(true);
    worker.intake([update(19, 'What do you remember about the launch in October?')]); await worker.drain();
    const october = packets.at(-1)! as { memorySearch: { items: { status: string; quote: string; date: string }[] } };
    expect(october.memorySearch.items.some(item => item.status === 'superseded'
      && item.quote === 'The launch is in October' && Boolean(item.date))).toBe(true);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not supersede an unrelated subject even if the model proposes an update', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-fact-update-negative-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const packets: Record<string, unknown>[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context) as Record<string, unknown>;
        packets.push(packet);
        if (packets.length === 1) return JSON.stringify({ reply: 'Noted.', memory: [], dated: [] });
        return JSON.stringify({ reply: 'I updated it.', memory: [{ mode: 'update',
          source: journal.view.order[0]!.id, quote: 'The launch is in October',
          replacement: 'The studio launch is in November' }], dated: [] });
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'The launch is in October.')]); await worker.drain();
    worker.intake([update(2, 'The studio launch is in November.')]); await worker.drain();
    expect(packets[1]?.contradictions).toBeUndefined();
    expect(journal.view.memory).toEqual([]);
    expect(journal.view.order[1]?.held).toBe('memory correction pending');
    expect(journal.view.order[1]?.sent).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('does not promote an imported claim into an automatic operator update', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-fact-update-import-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    importChannelFixture(journal, [{ source: 'email', account: 'agent@example.test', id: 'mail-1',
      from: 'sender@example.test', at: now - 60000, text: 'The launch is in October.' }], 'agent@example.test', now);
    let offered = false;
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context) as { contradictions?: {
          earlier: { id: string; quote: string }; operator: { quote: string } }[] };
        const conflict = packet.contradictions?.[0];
        offered = Boolean(conflict);
        return JSON.stringify({ reply: 'Noted.', memory: conflict ? [{ mode: 'update', source: conflict.earlier.id,
          quote: conflict.earlier.quote, replacement: conflict.operator.quote }] : [], dated: [] });
      }, send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'The launch is in November.')]); await worker.drain();
    expect(offered).toBe(true);
    expect(journal.view.memory).toEqual([]);
    expect(journal.view.order[0]?.held).toBe('memory correction pending');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
