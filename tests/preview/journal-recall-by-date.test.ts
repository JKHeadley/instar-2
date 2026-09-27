import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saidDateRange, selectSaidTurns } from './memory-sentinel.js';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { REPLY_RULES } from './reply-check.js';

const at = (value: string) => Date.parse(value), zone = 'America/Los_Angeles';
const now = at('2026-09-27T19:00:00Z');

it('resolves exact calendar days and ranges, refusing invalid or unrelated dates', () => {
  expect(saidDateRange('What did I tell you on Tuesday?', now, zone)).toEqual({ from: '2026-09-22', to: '2026-09-22' });
  expect(saidDateRange('What did I say from September 21 to September 23?', now, zone))
    .toEqual({ from: '2026-09-21', to: '2026-09-23' });
  expect(saidDateRange('What did I say between 2026-09-21 and 2026-09-23?', now, zone))
    .toEqual({ from: '2026-09-21', to: '2026-09-23' });
  expect(saidDateRange('What did I say on 9/22/2026?', now, zone)).toEqual({ from: '2026-09-22', to: '2026-09-22' });
  expect(saidDateRange('What did I say yesterday?', now, zone)).toEqual({ from: '2026-09-26', to: '2026-09-26' });
  expect(saidDateRange('What did I tell you yesterday about the deadline on 2026-10-01?', now, zone)).toBeNull();
  expect(saidDateRange('What did I say between September 21 and 2026-09-23?', now, zone)).toBeNull();
  expect(saidDateRange('What did I say between September 21 and tomorrow?', now, zone)).toBeNull();
  expect(saidDateRange('What did I say on 2026-02-30?', now, zone)).toBeNull();
  expect(saidDateRange('What did I say from 2026-09-23 to 2026-09-21?', now, zone)).toBeNull();
  expect(saidDateRange('What happens on Tuesday?', now, zone)).toBeNull();
});

it('selects only in-range journal send days and ranks relevant turns before recent ones', () => {
  const candidates = [
    { text: 'The orchard gate is blue.', at: at('2026-09-22T06:59:59Z') }, // Monday in Los Angeles
    { text: 'The orchard gate is green.', at: at('2026-09-22T07:00:00Z') },
    { text: 'I bought milk.', at: at('2026-09-23T06:59:59Z') },
    { text: 'The orchard gate is red.', at: at('2026-09-23T07:00:00Z') }, // Wednesday
  ];
  const result = selectSaidTurns('What did I say about the orchard gate on Tuesday?', candidates, now, zone, 1);
  expect(result).toMatchObject({ from: '2026-09-22', to: '2026-09-22', matched: 2, indices: [1] });
  expect(selectSaidTurns('What did I say on Tuesday?', candidates, now, zone, 5)?.indices).toEqual([2, 1]);
  expect(selectSaidTurns('What happens on Tuesday?', candidates, now, zone, 5)).toBeNull();
});

it('quotes bounded dated originals when a summary covers the requested range', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-recall-summary-')));
  const key = new Uint8Array(32).fill(31);
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
      configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 20, maxReplies: 20,
      maxTurns: 20, maxBytes: 5000, cursor: 0 });
    for (let id = 1; id <= 9; id++) {
      const when = id === 9 ? '2026-09-23T08:00:00Z' : `2026-09-22T${String(id + 7).padStart(2, '0')}:00:00Z`;
      const text = id === 2 ? `The orchard gate is green. ${'x'.repeat(220)}` : `Ordinary note ${id}. ${'x'.repeat(220)}`;
      journal.append({ kind: 'intake', id: `telegram:12345678:update:${id}`, update: id, text, raw: JSON.stringify({
        message: { from: { id: 7654321 }, date: Math.floor(at(when) / 1000) } }), accepted: true,
      cursor: id + 1, at: now });
    }
    journal.append({ kind: 'summary-reserve', through: 9, at: now });
    journal.append({ kind: 'summary', through: 9, text: 'Several ordinary notes and an orchard gate detail.', at: now });
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: zone,
      model: async () => 'unused', send: async () => 1, checkOutbound: () => {} });
    const result = worker.probe('What did I tell you about the orchard gate on Tuesday?');
    expect('reason' in result).toBe(false);
    if ('reason' in result) throw Error(result.reason);
    const packet = JSON.parse(result.context);
    expect(packet.historyMode).toBe('summary-plus-recent');
    expect(packet.recalled.length).toBeLessThanOrEqual(5);
    expect(packet.recalled[0].user).toContain('The orchard gate is green.');
    expect(packet.recalled.every((item: { date: string }) => item.date.startsWith('2026-09-22'))).toBe(true);
    expect(packet.saidRange).toMatchObject({ matched: 8 });
    for (const question of ['What did I tell you yesterday about the deadline on 2026-10-01?',
      'What did I say between September 21 and 2026-09-23?']) {
      const ambiguous = worker.probe(question);
      expect('reason' in ambiguous).toBe(false);
      if ('reason' in ambiguous) throw Error(ambiguous.reason);
      const ordinary = JSON.parse(ambiguous.context);
      expect(ordinary.saidRange).toBeUndefined();
      expect(ordinary.historyMode).toBe('summary-plus-recent');
    }
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each([false, true])('anchors yesterday to Telegram send time across midnight (replayed: %s)', async replayed => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-recall-midnight-')));
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(44);
  const sent = at('2026-09-27T06:59:50Z'); // September 26, 23:59:50 in Los Angeles
  const clock = replayed ? at('2026-09-27T07:00:10Z') : at('2026-09-27T06:59:55Z');
  const update = (id: number, text: string, when: number) => ({ update_id: id,
    message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text,
      date: Math.floor(when / 1000) } });
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline',
    expires: 9999999999999, maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 32768, cursor: 0 });
  try {
    const source = update(1, 'The orchard gate is green.', at('2026-09-25T19:00:00Z'));
    const query = update(2, 'What did I tell you yesterday?', sent);
    let packet: { saidRange?: { from: string; to: string; matched: number } } | undefined;
    const ports = { now: () => clock, stopped: () => false, timeZone: zone,
      model: async (input: { question: string; context: string }) => {
        if (input.question === query.message.text) packet = JSON.parse(input.context);
        return 'Understood.';
      },
      replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: { model: 'jev-1.13.0',
        answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 1 }),
        escalate: async () => { throw Error('unexpected escalation'); } },
      checkOutbound: () => {}, send: async () => 1 };
    let worker = createJournalWorker(journal, ports);
    worker.intake([source, query]);
    if (replayed) {
      journal.close();
      journal = openPreviewJournal(path, key);
      worker = createJournalWorker(journal, ports);
    }
    await worker.drain();
    expect(packet?.saidRange).toEqual({ from: '2026-09-25', to: '2026-09-25', matched: 1 });
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('uses the normal journal, Jev and send path, with dated bounded evidence after replay and forgetting', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-recall-date-')));
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(29);
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 32768, cursor: 0 };
  const update = (id: number, text: string, when: string) => ({ update_id: id,
    message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(at(when) / 1000) } });
  let journal = openPreviewJournal(path, key, genesis);
  let checks = 0, sent = 0, asked: unknown;
  const ports = { now: () => now, stopped: () => false, timeZone: zone,
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.question.startsWith('What did I tell')) {
        asked = JSON.parse(input.context);
        return 'On September 22, you told me about the orchard gate.';
      }
      return 'Understood.';
    },
    replyCheck: { elapsedMs: () => 100, jev: async () => { checks++; return { value: { model: 'jev-1.13.0',
      answers: Object.fromEntries(Object.keys(REPLY_RULES).map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 1 }; },
    escalate: async () => { throw Error('unexpected escalation'); } },
    checkOutbound: () => {}, send: async () => ++sent };
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(1, 'The orchard gate is blue.', '2026-09-22T07:00:00Z'),
      update(2, 'The private code is silver fox.', '2026-09-22T08:00:00Z'),
      update(3, 'Wednesday was quiet.', '2026-09-23T08:00:00Z')]);
    await worker.drain();
    journal.append({ kind: 'summary-reserve', through: 3, at: now });
    journal.append({ kind: 'summary', through: 3, text: 'Tuesday included the orchard gate and a private code.',
      memory: [{ mode: 'forget', source: journal.view.order[1]!.id, quote: 'The private code is silver fox.',
        trigger: journal.view.order[2]!.id }], at: now });
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    worker.intake([update(4, 'What did I tell you on Tuesday?', '2026-09-27T18:00:00Z')]);
    await worker.drain();
    const packet = asked as { saidRange: { from: string; to: string; matched: number }; recalled: { date: string; user: string }[];
      history: { date: string; user: string }[] };
    expect(packet.saidRange).toEqual({ from: '2026-09-22', to: '2026-09-22', matched: 1 });
    expect(packet.recalled).toHaveLength(1);
    expect(packet.recalled[0]).toMatchObject({ date: '2026-09-22T07:00Z', user: 'The orchard gate is blue.' });
    expect(JSON.stringify(packet)).not.toContain('silver fox');
    expect(packet.history.some(item => item.user === 'Wednesday was quiet.' && !!item.date)).toBe(true);
    expect(journal.view.lastReplyCheck?.path).toBe('jev');
    expect(checks).toBe(4);
    expect(sent).toBe(4);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
