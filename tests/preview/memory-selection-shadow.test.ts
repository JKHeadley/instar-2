import { describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { observeMemorySelection, shadowSelect, shadowBaseline, type ShadowInput, type MemoryShadowPorts } from './memory-selection-shadow.js';
import { at, room, key, genesis, neutral, question, fact, sourceId, update } from './recall-rank-room.js';
import { createJournalWorker, openPreviewJournal, pendingUnknownCalls } from './journal.js';
const input: ShadowInput = { question: 'Which original helps?', candidates: ['pin', 'a', 'b', 'c', 'd'].map(id => ({ id, text: `Original ${id}`, bytes: 10 })),
  actual: ['pin', 'a', 'b'], fixed: ['pin'] };
const scored = (scores: (number | null)[]) => ({ model: 'jev-1.13.0', answers: Object.fromEntries(scores.map((score, i) =>
  [`item_${i}`, score === null ? { type: 'undecided' } : { type: 'noul', noul: score }])) });
const run = (scores: (number | null)[], overrides: Partial<MemoryShadowPorts> = {}, data = input) => {
  const reservations: string[] = [];
  const ports: MemoryShadowPorts = { jev: async () => ({ value: scored(scores), latencyMs: 11 }),
    luna: async state => ({ value: JSON.stringify({ decisions: (JSON.parse(state) as { referred: string[] }).referred.map(id => ({ id, include: id !== 'b' })) }), latencyMs: 17 }), ...overrides };
  return observeMemorySelection(data, 'turn', ports, async stage => { reservations.push(stage); return true; }, () => {}).then(result => ({ result, reservations }));
};
describe('equal-budget shadow selection', () => {
  it('refers both inclusive cutoff neighbors, keeps the pin, and records only ids and ranks', async () => {
    const { result, reservations } = await run([0, .9, .58, .5, .419]);
    expect(result.status).toBe('complete');
    expect(result.cutoff).toBe(.58);
    expect(result.referred).toEqual(['b', 'c']);
    expect(result.selected).toEqual(['pin', 'a', 'c']);
    expect(result.added).toEqual(['c']); expect(result.omitted).toEqual(['b']);
    expect(result.latencyMs).toEqual({ jev: 11, luna: 17 });
    expect(reservations).toEqual(['jev', 'luna']);
    expect(JSON.stringify(result)).not.toContain('Original');
    expect(JSON.stringify(result)).not.toContain(input.question);
  });
  it('refers undecided and missing Jev answers to Luna, never treating them as confident absence', async () => {
    const { result } = await run([0, .9, .7, null]);
    expect(result.referred).toContain('c'); expect(result.referred).toContain('d');
    expect(result.status).toBe('complete');
  });
  it.each(['jev', 'luna'] as const)('%s outage preserves the exact selection', async stage => {
    const { result } = await run([0, .9, .58, .5, .1], { [stage]: async () => { throw Error('private error text'); } });
    expect(result.status).toBe('unavailable'); expect(result.selected).toEqual(input.actual);
    expect(JSON.stringify(result)).not.toContain('private error text');
  });
  it.each(['cannot_tell', 'malformed', 'foreign', 'duplicate'])('Luna %s preserves baseline', async kind => {
    const { result } = await run([0, .9, .58, .5, .1], { luna: async () => ({ latencyMs: 2, value: kind === 'malformed' ? ''
      : JSON.stringify({ decisions: kind === 'duplicate' ? [{ id: 'b', include: true }, { id: 'b', include: true }]
        : [{ id: 'b', include: kind === 'cannot_tell' ? 'cannot_tell' : true }, { id: kind === 'foreign' ? 'foreign' : 'c', include: true }] }) }) });
    expect(result.status).toBe('unavailable'); expect(result.selected).toEqual(input.actual);
  });
  it('enforces both budgets, including UTF-8 costs, without truncating or displacing pins', () => {
    const data = { ...input, candidates: input.candidates.map(c => ({ ...c, bytes: c.id === 'c' ? 31 : 10 })) };
    const budget = shadowBaseline(data).budget;
    expect(shadowSelect(data, ['c', 'd', 'a'], budget)).toEqual(['pin', 'd', 'a']);
    for (let cap = 0; cap < 40; cap++) {
      const selected = shadowSelect({ ...data, fixed: [] }, ['c', 'd', 'a', 'b'], { items: 2, bytes: cap });
      expect(selected.length).toBeLessThanOrEqual(2);
      expect(data.candidates.filter(c => selected.includes(c.id)).reduce((n, c) => n + c.bytes, 0)).toBeLessThanOrEqual(cap);
    }
  });
  it('makes no call when admission refuses or no optional room exists', async () => {
    const ports: MemoryShadowPorts = { jev: async () => { throw Error('called'); }, luna: async () => { throw Error('called'); } };
    const result = await observeMemorySelection(input, 'turn', ports, async () => false, () => { throw Error('settled'); });
    expect(result.reason).toBe('jev-not-admitted');
    expect((await run([], {}, { ...input, fixed: input.actual })).result.status).toBe('not-needed');
  });
});

it('replays the repository recorded garden-room journal: same packet on/off, records persist, omitted original can rank', async () => {
  const packets: string[] = [];
  for (const mode of ['off', 'on', 'outage'] as const) {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'memsel-room-'))), path = join(dir, 'journal.encrypted');
    try {
      const opened = room(path, 'B', [], neutral, { model: async request => { packets.push(request.context); return 'Noted.'; },
        memorySelection: { enabled: mode !== 'off', jev: async state => {
          if (mode === 'outage') throw Error('offline');
          const data = JSON.parse(state) as { candidates: { id: string }[] };
          expect(data.candidates.map(c => c.id)).toContain(sourceId(fact.update));
          return { value: scored(data.candidates.map(c => c.id === sourceId(fact.update) ? .99 : .2)), latencyMs: 4 };
        }, luna: async state => ({ value: JSON.stringify({ decisions: (JSON.parse(state) as { referred: string[] }).referred.map(id => ({ id, include: true })) }), latencyMs: 8 }) } });
      opened.worker.intake([update(question.update, question.message)]);
      await opened.worker.drain();
      const record = opened.journal.view.turns.get(sourceId(question.update))?.memorySelection?.result;
      if (mode === 'off') expect(record).toBeUndefined();
      else {
        expect(record?.status, record?.reason).toBe(mode === 'on' ? 'complete' : 'unavailable');
        if (mode === 'on') expect(record?.selected).toContain(sourceId(fact.update));
        expect(JSON.stringify(record)).not.toContain('2958');
      }
      const calls = opened.journal.view.calls;
      opened.journal.close();
      const replay = openPreviewJournal(path, key);
      expect(replay.view.turns.get(sourceId(question.update))?.memorySelection?.result).toEqual(record);
      const worker = createJournalWorker(replay, { now: () => at + 7_000_000, stopped: () => false,
        send: async () => { throw Error('repeat send'); }, checkOutbound: () => {}, model: async () => { throw Error('repeat model'); } });
      await worker.drain(); expect(replay.view.calls).toBe(calls); replay.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  expect(packets).toHaveLength(3); expect(packets[1]).toBe(packets[0]); expect(packets[2]).toBe(packets[0]);
});

it('launcher defaults to shadow, rejects live mode and binds Jev plus the exact authorized Luna', () => {
  const host = readFileSync(join(import.meta.dirname, 'journal-agent.mjs'), 'utf8');
  expect(host).toContain("const memorySelectionEnabled = options['memory-selection'] !== 'off'");
  expect(host).toContain("!['shadow', 'off'].includes(options['memory-selection'])");
  expect(host).toContain("callJev('jev-memory-selection', state, questions, 2000, id)");
  expect(host).toContain('options.model !== MEMORY_SHADOW_LUNA');
  expect(host).toContain("callSubscription('luna-memory-selection'");
});

it('retains the original allowance for the answer when the shared call cap has little room', async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'memsel-cap-')));
  try {
    let called = 0;
    const opened = room(join(dir, 'journal.encrypted'), 'B', [], neutral, { memorySelection: {
      jev: async () => { called++; throw Error('must not spend'); }, luna: async () => { called++; throw Error('must not spend'); } } }, { maxCalls: 50 });
    opened.worker.intake([update(question.update, question.message)]);
    await opened.worker.drain();
    expect(called).toBe(0);
    expect(opened.journal.view.turns.get(sourceId(question.update))?.memorySelection?.result?.reason).toBe('jev-not-admitted');
    expect(opened.journal.view.turns.get(sourceId(question.update))?.sent).toBe(question.update);
    opened.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('a stop after Jev prevents Luna and the answer; the shadow result cannot clear the stop', async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'memsel-stop-')));
  try {
    let stopped = false, calls = 0;
    const opened = room(join(dir, 'journal.encrypted'), 'B', [], neutral, { stopped: () => stopped, memorySelection: {
      jev: async state => { stopped = true; const data = JSON.parse(state) as { candidates: unknown[] };
        return { value: scored(data.candidates.map(() => .5)), latencyMs: 1 }; },
      luna: async () => { calls++; throw Error('stopped'); } }, model: async () => { calls++; return 'stopped'; } });
    opened.worker.intake([update(question.update, question.message)]);
    await expect(opened.worker.drain()).rejects.toThrow('preview stopped');
    expect(calls).toBe(0);
    expect(opened.journal.view.turns.get(sourceId(question.update))?.memorySelection?.result?.reason).toBe('luna-not-admitted');
    opened.journal.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('reopening an interrupted observer records unavailable even when disabled and never repeats its charge', async () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'memsel-interrupted-'))), path = join(dir, 'journal.encrypted');
  try {
    const journal = openPreviewJournal(path, key, genesis), id = sourceId(1);
    journal.append({ kind: 'intake', id, text: 'Hello', update: 1, raw: JSON.stringify(update(1, 'Hello')), accepted: true, cursor: 2, at });
    journal.append({ kind: 'reserve', id, at });
    journal.append({ kind: 'memory-selection-reserve', id, stage: 'jev', bytes: 300, baseline: shadowBaseline(input), at });
    const calls = journal.view.calls;
    journal.close();
    const replay = openPreviewJournal(path, key);
    const worker = createJournalWorker(replay, { now: () => at + 1, stopped: () => false, send: async () => 1,
      checkOutbound: () => {}, model: async () => { throw Error('must not repeat'); }, memorySelection: { enabled: false,
        jev: async () => { throw Error('must not repeat'); }, luna: async () => { throw Error('must not repeat'); } } });
    await worker.drain();
    expect(replay.view.calls).toBe(calls);
    expect(replay.view.turns.get(id)?.memorySelection?.result).toMatchObject({ status: 'unavailable', reason: 'interrupted-no-repeat', selected: input.actual });
    expect(replay.view.tokenTotals.replyCheck.unknownCalls).toBe(1);
    expect(pendingUnknownCalls(replay.view)).toContain(`memory-selection:jev:${id}`);
    expect(() => replay.append({ kind: 'memory-selection-reserve', id, stage: 'jev', bytes: 300, baseline: shadowBaseline(input), at: at + 1 })).toThrow('already recorded');
    replay.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it('does not reserve a Luna charge when its exact-model activation is absent', async () => {
  const { result, reservations } = await run([0, .9, .58, .5, .1], { lunaAvailable: () => false });
  expect(result.reason).toBe('luna-route-unavailable');
  expect(reservations).toEqual(['jev']); expect(result.selected).toEqual(input.actual);
});
