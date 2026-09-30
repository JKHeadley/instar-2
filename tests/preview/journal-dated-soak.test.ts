import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { parseDatedItem, selectDatedItems, dueState, type DatedItem } from './dated-memory.js';

const key = new Uint8Array(32).fill(47);
const first = Date.parse('2026-09-27T00:00:00Z');
const day = (offset: number) => new Date(first + offset * 86_400_000).toISOString().slice(0, 10);
const weekday = (value: string) => new Date(`${value}T00:00:00Z`).getUTCDay();
const id = (number: number) => `telegram:12345678:update:${number}`;

it('offers every active matching date across 200 items and 60 simulated days', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-soak-')));
  const path = join(root, 'journal.encrypted');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:dated-soak', configurationDigest: 'sha256:dated-soak', expires: 9999999999999,
    maxCalls: 300, maxReplies: 300, maxTurns: 220, maxBytes: 32768, cursor: 0 };
  const started = first - 86_400_000;
  const active: DatedItem[] = [];
  const append = (journal: ReturnType<typeof openPreviewJournal>, number: number, text: string,
    dated: DatedItem[], memory: Array<{ mode: 'correct' | 'forget'; source: string; quote: string; trigger: string; replacement?: string }> = []) => {
    const raw = JSON.stringify({ update_id: number, message: { chat: { id: 7654321, type: 'private' },
      from: { id: 7654321 }, text, date: Math.floor(started / 1000) } });
    journal.append({ kind: 'intake', id: id(number), update: number, text, raw, accepted: true,
      cursor: number + 1, at: started });
    journal.append({ kind: 'reserve', id: id(number), at: started });
    journal.append({ kind: 'answer', id: id(number), text: 'Recorded.', dated, memory, at: started });
  };
  try {
    let journal = openPreviewJournal(path, key, genesis);
    for (let number = 1; number <= 196; number++) {
      const target = day((number - 1) % 60);
      const zone = number % 2 ? 'America/Los_Angeles' : 'Asia/Tokyo';
      const when = number % 13 === 0 ? `${target} at ${zone === 'Asia/Tokyo' ? '00:30' : '23:30'}` : target;
      const text = `Task ${number} is on ${when}.`;
      const item = parseDatedItem(id(number), text, when, started, zone);
      append(journal, number, text, [item]); active.push(item);
    }
    for (let number = 197; number <= 200; number++) {
      const name = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'][number - 197]!;
      const when = `every ${name}`;
      const text = `Weekly task ${number} is ${when}.`;
      const zone = number % 2 ? 'America/Los_Angeles' : 'Asia/Tokyo';
      const item = parseDatedItem(id(number), text, when, started, zone);
      expect(item.repeat).toBe('weekly');
      append(journal, number, text, [item]); active.push(item);
    }
    const old = active[10]!;
    const replacementDay = day(47);
    const replacementText = `Correction: task 11 is on ${replacementDay}.`;
    const replacement = parseDatedItem(id(201), replacementText, replacementDay, started, old.zone);
    append(journal, 201, replacementText, [replacement], [{ mode: 'correct', source: old.source,
      quote: old.quote, trigger: id(201), replacement: replacementText }]);
    active.splice(active.indexOf(old), 1, replacement);
    const cancelled = active[20]!;
    append(journal, 202, `Cancel ${cancelled.quote}`, [], [{ mode: 'forget', source: cancelled.source,
      quote: cancelled.quote, trigger: id(202) }]);
    active.splice(active.indexOf(cancelled), 1);
    journal.append({ kind: 'summary-reserve', through: 202, at: started });
    journal.append({ kind: 'summary', through: 202, text: 'The operator recorded dated tasks.', at: started });
    journal.close();
    journal = openPreviewJournal(path, key);
    expect(journal.view.dated).toHaveLength(201);
    expect(active).toHaveLength(199);
    const status = spawnSync(process.execPath,
      ['--no-warnings', '--loader', './scripts/slice-ts-loader.mjs', 'tests/preview/journal-agent.mjs',
        'status', '--root', root], { cwd: process.cwd(), encoding: 'utf8', timeout: 15_000,
        env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex') } });
    expect(status.status, status.stderr).toBe(0);
    expect((JSON.parse(status.stdout) as { dated: { repeat: string | null }[] }).dated
      .filter(item => item.repeat === 'weekly')).toHaveLength(4);
    let now = first, zone = 'America/Los_Angeles';
    const counts = { questions: 0, expected: 0, baselineMisses: 0, misses: 0, falsePositives: 0, fallback: 0 };
    for (let offset = 0; offset < 60; offset++) {
      zone = offset < 30 ? 'America/Los_Angeles' : 'Asia/Tokyo';
      now = Date.parse(`${day(offset)}T${offset < 30 ? '18' : '03'}:00:00Z`);
      const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, timeZone: zone,
        model: async () => 'unused', send: async () => 1, checkOutbound: () => {} });
      const nextMonday = offset + (8 - (weekday(day(offset)) || 7));
      const windows = [
        { question: 'What is on today?', from: offset, through: offset },
        { question: 'What is on tomorrow?', from: offset + 1, through: offset + 1 },
        { question: 'What is on next week?', from: nextMonday, through: nextMonday + 6 },
      ];
      for (const window of windows) {
        const probe = worker.probe(window.question);
        if ('reason' in probe) throw Error(probe.reason);
        const packet = JSON.parse(probe.context) as { dated?: DatedItem[]; moreDated?: number;
          datedScope?: { start: string; end: string; zone: string } };
        expect(packet.datedScope).toEqual({ start: day(window.from), end: day(window.through), zone });
        const expected = new Set<string>();
        for (const item of active) for (let n = window.from; n <= window.through; n++) {
          const occurrence = day(n);
          const travelDay = item.time && item.zone !== zone
            ? day(Math.round((Date.parse(`${item.day}T00:00:00Z`) - first) / 86_400_000)
              + (item.zone === 'Asia/Tokyo' ? -1 : 1)) : item.day;
          if (travelDay === occurrence || item.repeat === 'weekly' && item.day! <= occurrence
            && weekday(item.day!) === weekday(occurrence)) expected.add(`${item.source}|${occurrence}`);
        }
        const selected = (packet.dated ?? []).map(item => ({ source: item.source,
          day: (item as DatedItem & { queryDay?: string }).queryDay ?? item.day }));
        const actual = new Set(selected.filter(item => item.day && item.day >= packet.datedScope!.start
          && item.day <= packet.datedScope!.end).map(item => `${item.source}|${item.day}`));
        const answerFromPacket = [...actual].sort().join('\n');
        const expectedAnswer = [...expected].sort().join('\n');
        counts.questions++; counts.expected += expected.size;
        counts.baselineMisses += [...expected].filter(value => !new Set(active.slice(0, 10)
          .map(item => `${item.source}|${item.day}`)).has(value)).length;
        counts.misses += [...expected].filter(value => !actual.has(value)).length;
        counts.falsePositives += [...actual].filter(value => !expected.has(value)).length;
        counts.fallback += selected.length - actual.size;
        expect(selected.length).toBeLessThanOrEqual(32);
        expect(selected.length - actual.size).toBeLessThanOrEqual(4);
        expect(answerFromPacket).toBe(expectedAnswer);
      }
    }
    console.log(`dated-soak ${JSON.stringify(counts)}`);
    expect(counts.baselineMisses).toBeGreaterThan(0);
    expect(counts).toMatchObject({ questions: 180, misses: 0, falsePositives: 0 });
    expect(counts.fallback).toBeGreaterThan(0);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120_000);

it('discloses a crowded day, keeps matched dates first, and repeats only after its first occurrence', () => {
  const today = Date.parse('2026-10-05T18:00:00Z');
  const items = Array.from({ length: 40 }, (_, index) => parseDatedItem(`source:${index}`,
    `Item ${index} on 2026-10-05.`, '2026-10-05', today, 'America/Los_Angeles'));
  items.push(parseDatedItem('tomorrow', 'An item on 2026-10-06.', '2026-10-06', today, 'America/Los_Angeles'));
  const selection = selectDatedItems(items, 'What is today?', today, 'America/Los_Angeles');
  expect(selection.items).toHaveLength(32);
  expect(selection.omitted).toBe(9);
  expect(selection.items.every(item => item.day === '2026-10-05')).toBe(true);
  const unresolved = parseDatedItem('unresolved', 'Maybe October or November.', 'October or November',
    today, 'America/Los_Angeles');
  expect(selectDatedItems([items[0]!, unresolved], 'What is today?', today, 'America/Los_Angeles').items)
    .toMatchObject([{ day: '2026-10-05', state: 'due' }, { state: 'ambiguous' }]);
  const weekly = parseDatedItem('weekly', 'Every Monday', 'every Monday',
    Date.parse('2026-10-04T18:00:00Z'), 'America/Los_Angeles');
  expect(weekly.day).toBe('2026-10-05');
  expect(dueState(weekly, Date.parse('2026-10-05T18:00:00Z'))).toBe('due');
  expect(dueState(weekly, Date.parse('2026-10-06T18:00:00Z'))).toBe('upcoming');
  expect(dueState(weekly, Date.parse('2026-10-12T18:00:00Z'))).toBe('due');
  expect(selectDatedItems([weekly], 'What is next week?', today, 'America/Los_Angeles').items[0])
    .toMatchObject({ day: '2026-10-12', repeat: 'weekly' });
});

it('keeps the day-after-tomorrow evidence in a summarized journal packet beside tomorrow', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-dated-fallback-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:dated-fallback', configurationDigest: 'sha256:dated-fallback',
      expires: 9999999999999, maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 32768, cursor: 0 });
    const at = Date.parse('2026-10-05T18:00:00Z');
    for (let number = 1; number <= 60; number++) {
      const source = id(number);
      const target = number === 1 ? '2026-10-07' : number === 60 ? '2026-10-06' : day(10 + number);
      const quote = number === 1 ? 'ORCHID appointment is on 2026-10-07.' : `Task ${number} is on ${target}.`;
      const text = `${quote} ${'Context for this recorded task. '.repeat(25)}`;
      const raw = JSON.stringify({ update_id: number, message: { chat: { id: 7654321, type: 'private' },
        from: { id: 7654321 }, text, date: Math.floor(at / 1000) } });
      journal.append({ kind: 'intake', id: source, update: number, text, raw, accepted: true,
        cursor: number + 1, at });
      journal.append({ kind: 'reserve', id: source, at });
      journal.append({ kind: 'answer', id: source, text: 'Recorded.',
        dated: [parseDatedItem(source, quote, target, at, 'America/Los_Angeles')], memory: [], at });
    }
    journal.append({ kind: 'summary-reserve', through: 60, at });
    journal.append({ kind: 'summary', through: 60, text: 'The operator recorded appointments and tasks.', at });
    const worker = createJournalWorker(journal, { now: () => at, stopped: () => false,
      model: async () => 'unused', send: async () => 1, checkOutbound: () => {} });
    for (const question of ['What is on tomorrow?', 'What is on the day after tomorrow?']) {
      const probe = worker.probe(question);
      if ('reason' in probe) throw Error(probe.reason);
      const packet = JSON.parse(probe.context) as { historyMode: string; dated: DatedItem[];
        datedScope: { start: string; end: string }; moreDated: number; capability: string };
      expect(packet.historyMode).toBe('summary-plus-recent');
      expect(packet.datedScope).toMatchObject({ start: '2026-10-06', end: '2026-10-06' });
      expect(packet.dated[0]).toMatchObject({ day: '2026-10-06', quote: 'Task 60 is on 2026-10-06.' });
      expect(packet.dated).toContainEqual(expect.objectContaining({ day: '2026-10-07', quote: 'ORCHID appointment is on 2026-10-07.' }));
      expect(packet.moreDated).toBeGreaterThan(0);
      expect(packet.capability).toContain('datedScope is a calendar priority hint');
    }
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
