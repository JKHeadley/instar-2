import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type MemoryChange } from './journal-test-worker.js';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
const at = 1792000000000;
const key = new Uint8Array(32).fill(73);
function world() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'precompact-'))); roots.push(root);
  const path = join(root, 'journal');
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'test:precompact', configurationDigest: 'sha256:test', expires: at + 86400000,
    maxCalls: 200, maxReplies: 100, maxTurns: 100, maxBytes: 32000, cursor: 0 };
  let journal = openPreviewJournal(path, key, genesis);
  let now = at + 1000;
  const calls: string[] = [];
  let hold: (() => Promise<void>) | undefined;
  let stopped = false;
  let reviewHold: (() => Promise<void>) | undefined;
  const packets: string[] = [];
  const makeWorker = () => createJournalWorker(journal, { now: () => now, stopped: () => stopped,
    summaryCheck: async () => {
      await reviewHold?.();
      return { model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } };
    },
    model: async input => {
      calls.push(input.id); packets.push(input.context);
      if (hold) await hold();
      return input.id.startsWith('summary:') ? JSON.stringify({ summary: 'The marker is cedar; checking the garden is still owed.',
        people: [], memory: [], commitments: [], questions: [] }) : 'The marker is cedar.';
    }, send: async () => journal.view.replies + 1, checkOutbound: () => {} });
  let worker = makeWorker();
  const seed = (n: number, memory?: MemoryChange[], undo?: { change: number }) => {
    const id = `telegram:12345678:update:${n}`, text = 'The marker is cedar. Check the garden. ' + 'Garden observations. '.repeat(150);
    const raw = JSON.stringify({ update_id: n, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text } });
    journal.append({ kind: 'intake', id, update: n, text, raw, accepted: true, cursor: n + 1, at: at + n });
    journal.append({ kind: 'reserve', id, at: at + n });
    journal.append({ kind: 'answer', id, text: 'Noted.', ...(memory ? { memory } : {}), ...(undo ? { undo } : {}), at: at + n });
    journal.append({ kind: 'intent', id, text: 'Noted.', chat: genesis.chat, update: n, grant: genesis.grant, at: at + n });
    journal.append({ kind: 'sent', id, message: n, at: at + n });
  };
  return { get journal() { return journal; }, get worker() { return worker; }, calls, packets, seed, path,
    stop: () => { stopped = true; },
    reopen: () => { journal.close(); journal = openPreviewJournal(path, key); worker = makeWorker(); }, advance: (ms: number) => { now += ms; },
    reviewHold: (fn: () => Promise<void>) => { reviewHold = fn; },
    hold: (fn?: () => Promise<void>) => { hold = fn; } };
}

it('waits for an idle turn before proactive pressure compaction, then advances without another inbound', async () => {
  const w = world();
  try {
    for (let n = 1; n <= 8; n++) w.seed(n);
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>(done => { entered = done; });
    const waiting = new Promise<void>(done => { release = done; });
    w.hold(async () => { entered(); await waiting; });
    w.worker.intake([{ update_id: 9, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'What was the marker?' } }]);
    const answering = w.worker.drain(); await started;
    const compacting = w.worker.summarizeIfNeeded();
    await Promise.resolve();
    const during = [...w.calls];
    release(); await answering; await compacting; w.hold();
    expect(during.filter(id => id.startsWith('summary:'))).toEqual([]);
    await w.worker.summarizeIfNeeded();
    expect(w.journal.view.summaries.length).toBeGreaterThan(0);
  } finally { w.journal.close(); }
});

it('paces subsequent automatic passes but leaves forced recovery available', async () => {
  const w = world();
  try {
    for (let n = 1; n <= 8; n++) w.seed(n);
    await w.worker.summarizeIfNeeded();
    expect(w.journal.view.summaries.length).toBeGreaterThan(0);
    for (let n = 9; n <= 16; n++) w.seed(n);
    const before = w.calls.length;
    w.reopen(); // cooldown is journal-derived, not reset by a new worker/process
    await w.worker.summarizeIfNeeded();
    expect(w.calls).toHaveLength(before);
    w.advance(600000);
    await w.worker.summarizeIfNeeded();
    expect(w.calls.length).toBeGreaterThan(before);
    for (let n = 17; n <= 24; n++) w.seed(n);
    const cooled = w.calls.length;
    await w.worker.summarizeIfNeeded(true);
    expect(w.calls.length).toBeGreaterThan(cooled);
  } finally { w.journal.close(); }
});


it('keeps the reviewed prefix when a later reply starts during a summary', async () => {
  const w = world();
  try {
    for (let n = 1; n <= 8; n++) w.seed(n);
    let releaseSummary!: () => void, releaseAnswer!: () => void, entered!: () => void;
    const summaryWait = new Promise<void>(done => { releaseSummary = done; });
    const answerWait = new Promise<void>(done => { releaseAnswer = done; });
    const started = new Promise<void>(done => { entered = done; });
    w.hold(() => summaryWait);
    const compacting = w.worker.summarizeIfNeeded();
    await new Promise(done => setImmediate(done));
    w.hold(async () => { entered(); await answerWait; });
    w.worker.intake([{ update_id: 9, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'What was the marker?' } }]);
    const answering = w.worker.drain(); await started;
    releaseSummary(); await compacting;
    const chosen = JSON.parse(w.packets[0]!).history.at(-1).id;
    expect(w.journal.view.summaries.at(-1)?.through).toBe(Number(chosen.split(':').at(-1)));
    expect(w.journal.view.summaries.at(-1)!.through).toBeLessThan(9);
    expect(w.journal.view.lastSummaryFailure).toBeNull();
    expect(w.journal.view.order.at(-1)?.sent).toBeUndefined();
    releaseAnswer(); await answering; w.hold();
    expect(w.journal.view.order.at(-1)?.sent).toBeDefined();
    w.advance(600000); await w.worker.summarizeIfNeeded();
    expect(w.journal.view.summaries.length).toBeGreaterThan(0);
    expect(w.packets.at(-1)).toContain('cedar');
  } finally { w.journal.close(); }
});

it('does not spend for a short conversation, a stop, or an exhausted call budget', async () => {
  const w = world();
  try {
    w.seed(1); await w.worker.summarizeIfNeeded(); expect(w.calls).toEqual([]);
    for (let n = 2; n <= 8; n++) w.seed(n);
    w.journal.view.calls = w.journal.view.limits.maxCalls;
    await w.worker.summarizeIfNeeded(); expect(w.calls).toEqual([]);
    w.journal.view.calls = 8; w.stop();
    await w.worker.summarizeIfNeeded(); expect(w.calls).toEqual([]);
  } finally { w.journal.close(); }
});

it.each(['forget', 'undo'] as const)('refuses a reviewed prefix when %s completes while review is in flight', async mode => {
  const w = world();
  try {
    for (let n = 1; n <= 7; n++) w.seed(n);
    w.seed(8, mode === 'undo' ? [{ mode: 'correct', source: 'telegram:12345678:update:1',
      trigger: 'telegram:12345678:update:8', quote: 'Garden observations.', replacement: 'The marker is cedar.' }] : undefined);
    let release!: () => void, entered!: () => void;
    const waiting = new Promise<void>(done => { release = done; });
    const started = new Promise<void>(done => { entered = done; });
    w.reviewHold(async () => { entered(); await waiting; });
    const compacting = w.worker.summarizeIfNeeded(); await started;
    w.seed(9, mode === 'undo' ? undefined : [{ mode: 'forget', source: 'telegram:12345678:update:1', trigger: 'telegram:12345678:update:9',
      quote: 'The marker is cedar.' }], mode === 'undo' ? { change: 0 } : undefined);
    release(); await compacting;
    expect(w.journal.view.summaries).toEqual([]);
    expect(w.journal.view.lastSummaryFailure?.reason).toBe('summary built before a memory change');
    expect(w.journal.view.summaryReservations.size).toBe(0);
    expect(w.journal.view.memory).toHaveLength(1);
  } finally { w.journal.close(); }
});
