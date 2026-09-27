import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { inRequestedPeriod, requestedPeriod } from './period-summary.js';
import { JEV_MODEL, REPLY_RULES } from './reply-check.js';

const now = Date.UTC(2026, 8, 27, 18);
const zone = 'America/Los_Angeles';
const key = new Uint8Array(32).fill(34);
const update = (id: number, text: string, at: number) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(at / 1000) } });
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: now + 86_400_000,
  maxCalls: 50, maxReplies: 50, maxTurns: 50, maxBytes: 32768, cursor: 0 };

it('uses the installed zone and complete calendar boundaries for supported recap periods', () => {
  expect(requestedPeriod('What did we talk about this week?', now, zone)).toEqual({
    from: '2026-09-21', through: '2026-09-27', zone });
  expect(requestedPeriod('Recap last week', now, zone)).toEqual({
    from: '2026-09-14', through: '2026-09-20', zone });
  expect(requestedPeriod('Summarize this month', now, zone)?.from).toBe('2026-09-01');
  expect(requestedPeriod('Summarize the last 7 days', now, zone)?.from).toBe('2026-09-21');
  expect(requestedPeriod('Summarize 2026-09-10 to 2026-09-15', now, zone)).toEqual({
    from: '2026-09-10', through: '2026-09-15', zone });
  expect(requestedPeriod('Summarize 2026-02-30 to 2026-03-03', now, zone)).toBeNull();
  expect(requestedPeriod('What about this week?', now, zone)).toBeNull();
  expect(requestedPeriod('Summarize the last 32 days', now, zone)).toBeNull();
  const week = requestedPeriod('What did we talk about this week?', now, zone)!;
  expect(inRequestedPeriod(Date.UTC(2026, 8, 21, 6), week)).toBe(false); // Sunday in Los Angeles.
  expect(inRequestedPeriod(Date.UTC(2026, 8, 21, 7), week)).toBe(true);
});

it('recaps compacted period turns with dates and an omission count, then sends through Jev once', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-period-')));
  try {
    let journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const append = (id: number, text: string, at: number) => {
      const incoming = update(id, text, at);
      const source = `telegram:12345678:update:${id}`;
      journal.append({ kind: 'intake', id: source, update: id, text,
        raw: JSON.stringify(incoming), accepted: true, cursor: id + 1, at });
      journal.append({ kind: 'reserve', id: source, at });
      journal.append({ kind: 'answer', id: source, text: 'Noted.', at });
      journal.append({ kind: 'intent', id: source, text: 'PREVIEW — Noted.', chat: genesis.chat,
        update: id, grant: genesis.grant, at });
      journal.append({ kind: 'sent', id: source, message: id, at });
    };
    append(1, 'Previous week: the archive plan was discussed.', Date.UTC(2026, 8, 20, 18));
    for (let id = 2; id <= 18; id++) append(id, `This week topic ${id}: ${id === 2 ? 'Can we settle the launch question? Please remember to decide launch date.' : 'working notes'} ${'detail '.repeat(250)}`,
      Date.UTC(2026, 8, 21 + (id % 6), 18));
    journal.append({ kind: 'summary-reserve', through: 18, at: now });
    journal.append({ kind: 'summary', through: 18, text: 'The archive plan and launch question were discussed.',
      commitments: [{ in: 'message', source: 'telegram:12345678:update:2', quote: 'Please remember to decide launch date.' }], at: now });
    journal.close();
    journal = openPreviewJournal(join(root, 'journal.encrypted'), key);
    const packets: { period?: { from: string; through: string; total: number; omitted: number;
      turns: { date: string; user: string }[] }; periodGuide?: string; summary?: { text: string };
      commitments?: { date: string; items: { quote: string }[] }[] }[] = [];
    let jev = 0, sends = 0;
    const worker = createJournalWorker(journal, { now: () => now, timeZone: zone, stopped: () => false,
      model: async input => {
        const packet = JSON.parse(input.context); packets.push(packet);
        const commitment = packet.commitments?.[0]?.items?.[0]?.quote;
        return JSON.stringify({ reply: `This week we discussed working notes. The launch question remains open. ${commitment ? 'The launch-date commitment is open.' : ''}`,
          memory: [], dated: [] });
      },
      send: async () => ++sends, checkOutbound: () => {},
      replyCheck: { elapsedMs: () => 1, jev: async () => { jev++; return { value: { model: JEV_MODEL,
        answers: Object.fromEntries(Object.keys(REPLY_RULES).map(rule => [rule, { type: 'noul', noul: 0 }])) }, latencyMs: 100 }; },
      escalate: async () => { throw Error('unexpected review'); } } });
    const query = 'What did we talk about this week?';
    const ordinary = worker.probe('What did we talk about?');
    expect('reason' in ordinary).toBe(false);
    if (!('reason' in ordinary)) expect(JSON.parse(ordinary.context).period).toBeUndefined();
    const previous = worker.probe('What did we talk about last week?');
    expect('reason' in previous).toBe(false);
    if (!('reason' in previous)) expect(JSON.parse(previous.context).period).toMatchObject({
      from: '2026-09-14', through: '2026-09-20', total: 1, omitted: 0 });
    worker.intake([update(19, query, now)]); await worker.drain();
    expect(packets).toHaveLength(1);
    expect(packets[0]?.summary?.text).toContain('launch question');
    expect(packets[0]?.period).toMatchObject({ from: '2026-09-21', through: '2026-09-27', total: 17 });
    expect(packets[0]?.period?.turns.length).toBeGreaterThan(0);
    expect(packets[0]?.period?.turns.length).toBeLessThanOrEqual(12);
    expect(packets[0]?.period?.omitted).toBe(17 - packets[0]!.period!.turns.length);
    expect(packets[0]?.commitments?.[0]?.items[0]?.quote).toBe('Please remember to decide launch date.');
    expect(packets[0]?.commitments?.[0]?.date).toBe('2026-09-23T18:00Z');
    expect(packets[0]?.period?.turns.some(turn => turn.user.includes('Previous week'))).toBe(false);
    expect(packets[0]?.period?.turns.every(turn => turn.date.startsWith('2026-'))).toBe(true);
    expect(packets[0]?.periodGuide).toContain('Mark open questions and commitments');
    expect(packets[0]?.periodGuide).toContain('recap is partial');
    expect(jev).toBe(1); expect(sends).toBe(1);
    expect(journal.view.lastReplyCheck).toMatchObject({ path: 'jev', verdict: 'pass' });
    expect(journal.view.turns.get('telegram:12345678:update:19')?.intent).toContain('The launch-date commitment is open.');
    journal.close();
    const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key);
    expect(reopened.view.turns.get('telegram:12345678:update:19')?.sent).toBe(1);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
