import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';
import { parseDatedItem } from './dated-memory.js';

const key = new Uint8Array(32).fill(31);
const start = Date.UTC(2026, 8, 20, 18);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:gap', configurationDigest: 'sha256:gap', expires: Date.UTC(2026, 9, 30),
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 8600, cursor: 0 }; // int12: reply instructions grew ~1.6 KB
const update = (id: number, text: string, at: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(at / 1000) } });

function seed(journal: ReturnType<typeof openPreviewJournal>) {
  const id = 'telegram:12345678:update:1';
  const text = 'Today is September 20. Keep the draft open until I approve it. Remember the outline until I finish it. '
    + 'The review is on September 21. The handoff is on September 25. The launch is on September 30.';
  journal.append({ kind: 'intake', id, update: 1, text, raw: JSON.stringify(update(1, text, start)),
    accepted: true, cursor: 2, at: start });
  journal.append({ kind: 'reserve', id, at: start });
  journal.append({ kind: 'answer', id, text: 'Today, September 20, I will keep the draft open.', at: start,
    dated: [['The review is on September 21.', 'September 21'],
      ['The handoff is on September 25.', 'September 25'],
      ['The launch is on September 30.', 'September 30']]
      .map(([quote, when]) => parseDatedItem(id, quote!, when!, start, 'America/Los_Angeles')) });
  journal.append({ kind: 'intent', id, text: 'PREVIEW — Today, September 20, I will keep the draft open.',
    chat: genesis.chat, update: 1, grant: genesis.grant, at: start });
  journal.append({ kind: 'sent', id, message: 1, at: start });
  const fillerId = 'telegram:12345678:update:2', filler = `I finished the outline. Earlier discussion: ${'background '.repeat(600)}`;
  journal.append({ kind: 'intake', id: fillerId, update: 2, text: filler, raw: JSON.stringify(update(2, filler, start)),
    accepted: true, cursor: 3, at: start });
  journal.append({ kind: 'reserve', id: fillerId, at: start });
  journal.append({ kind: 'answer', id: fillerId, text: 'Noted.', at: start });
  journal.append({ kind: 'intent', id: fillerId, text: 'PREVIEW — Noted.', chat: genesis.chat,
    update: 2, grant: genesis.grant, at: start });
  journal.append({ kind: 'sent', id: fillerId, message: 2, at: start });
  journal.append({ kind: 'summary-reserve', through: 2, at: start });
  journal.append({ kind: 'summary', through: 2, text: 'Today is September 20. The draft was open.', people: [],
    commitments: [{ in: 'message', source: id, quote: 'Keep the draft open until I approve it.' },
      { in: 'reply', source: id, quote: 'I will keep the draft open.' },
      { in: 'message', source: id, quote: 'Remember the outline until I finish it.' }],
    closed: [{ id: 2, source: fillerId, quote: 'I finished the outline.' }], at: start });
}

for (const days of [1, 3, 7]) it(`grounds the first reply after ${days} day(s) in the injected clock, dated items and open commitments`, async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-gap-')));
  const now = start + days * 86_400_000;
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis);
  try {
    seed(journal);
    journal.close();
    journal = openPreviewJournal(path, key);
    const packets: Record<string, unknown>[] = [], sent: string[] = [];
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      timeZone: 'America/Los_Angeles',
      model: async input => {
        const packet = JSON.parse(input.context) as { clock: { day: string; weekday: string }; dated: { day: string; state: string }[];
          commitments: { items: { quote: string }[] }[]; resume: { elapsedHours: number } };
        packets.push(packet as unknown as Record<string, unknown>);
        const dates = packet.dated.map(item => `${item.day} ${item.state}`).join(', ');
        const open = packet.commitments.flatMap(item => item.items.map(note => note.quote)).join(' ');
        return JSON.stringify({ reply: `${packet.clock.weekday}, ${packet.clock.day}. ${dates}. Open: ${open}`, memory: [], dated: [] });
      }, send: async input => { sent.push(input.text); return 2; }, checkOutbound: () => {} });
    worker.intake([update(3, 'Where are we now?', now)]);
    await worker.drain();
    expect(sent, JSON.stringify(journal.view.order.at(-1))).toHaveLength(1);
    const packet = packets[0]! as { clock: { day: string; weekday: string; zone: string; utc: string };
      resume: { elapsedHours: number; guidance: string }; dated: { day: string; state: string }[];
      commitments: { items: { quote: string }[] }[]; summary: { text: string } };
    expect(packet.clock).toMatchObject({ day: `2026-09-${String(20 + days).padStart(2, '0')}`,
      zone: 'America/Los_Angeles', utc: new Date(now).toISOString() });
    expect(packet.resume.elapsedHours).toBe(days * 24);
    expect(packet.resume.guidance).toContain('not this one');
    expect(packet.summary.text).toContain('Today is September 20');
    // The dated selection orders by nearness to today; compare the set chronologically.
    expect(packet.dated.map(item => [item.day, item.state]).sort()).toEqual([
      ['2026-09-21', days === 1 ? 'due' : 'overdue'],
      ['2026-09-25', days === 7 ? 'overdue' : 'upcoming'],
      ['2026-09-30', 'upcoming']]);
    expect(packet.commitments.flatMap(item => item.items.map(note => note.quote)))
      .toEqual(['Keep the draft open until I approve it.', 'I will keep the draft open.']);
    expect(sent[0]).not.toContain('outline');
    expect(sent[0]).toContain(`${packet.clock.weekday}, ${packet.clock.day}`);
    expect(sent[0]).toContain('Open: Keep the draft open until I approve it. I will keep the draft open.');
    expect(sent[0]).not.toContain('Today, September 20');
    const next = worker.probe('And what about the garden?');
    if ('reason' in next) throw Error(next.reason);
    expect(JSON.parse(next.context).resume).toBeUndefined();
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('keeps an ordinary short-gap reply focused on its question', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-gap-')));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  try {
    seed(journal);
    const worker = createJournalWorker(journal, { now: () => start + 3_600_000, stopped: () => false,
      model: async () => 'ok', send: async () => 2, checkOutbound: () => {} });
    const probe = worker.probe('How are the garden tomatoes?');
    if ('reason' in probe) throw Error(probe.reason);
    const packet = JSON.parse(probe.context) as { clock: { day: string }; resume?: unknown; commitments?: unknown };
    expect(packet.clock.day).toBe('2026-09-20');
    expect(packet.resume).toBeUndefined();
    expect(packet.commitments).toBeUndefined();
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
