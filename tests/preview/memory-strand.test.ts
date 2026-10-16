import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type JournalRecord } from './journal-test-worker.js';
import { parseReplyReviewVerdict } from './reply-check.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/memory-strand-2026-10-15.json', import.meta.url), 'utf8'));
const deferral = JSON.parse(readFileSync(new URL('./fixtures/deferral-not-memory-2026-10-12.json', import.meta.url), 'utf8'));
const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
const shape = (kind: string) => shapes.otherShapes.find(row => row.kind === kind)!;
const key = new Uint8Array(32).fill(51), dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const id = (update: number) => `telegram:${capture.bot}:update:${update}`;
const reply = JSON.stringify({ reply: 'The memory decision remains unresolved.', memory: [], memoryDisposition: 'unresolved' });

function world(mode = 'covered') {
  const dir = mkdtempSync(join(tmpdir(), 'memory-strand-')); dirs.push(dir);
  const path = join(dir, 'journal.encrypted'), records: JournalRecord[] = [], calls: string[] = [], sends: string[] = [];
  let stopped = false, interrupted = false, warnings = 0, judged = 0, reviewed = 0;
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: capture.bot, chat: capture.operator,
    operator: capture.operator, grant: 'grant:strand', configurationDigest: 'sha256:strand', expires: capture.at + 86400000,
    maxCalls: mode === 'cap' ? 7 : 60, maxReplies: 30, maxTurns: 30, maxBytes: 65536, cursor: 0 }, stage => {
    if (mode === 'restart' && stage === 'after:memory-undecided' && !interrupted) {
      interrupted = true; throw Error('restart after durable undecided');
    }
  });
  const watch = () => { const append = journal.append; journal.append = row => { append(row); records.push(row); }; };
  watch();
  const ports = { now: () => capture.at, stopped: () => stopped, checkOutbound: () => {},
    ...(mode.startsWith('jev-') ? { replyCheck: { elapsedMs: () => 0,
      jev: async () => { judged++; return { value: JSON.parse(shape(mode).raw), latencyMs: 158 }; },
      escalate: async () => { reviewed++; return { ...parseReplyReviewVerdict(JSON.parse(shape('reply-review').raw).conclusion.value), confidence: null, latencyMs: 1 }; }
    } } : {}),
    model: async (input: { id: string; context: string }) => {
      calls.push(input.id);
      if (input.id.startsWith('summary:')) {
        if (mode === 'summary-uncertain') return JSON.parse(shape(mode).raw);
        if (mode === 'summary-writer') return shape(mode).raw;
        return JSON.stringify({ summary: 'The operator asked for an answer later.', people: [], memory: [], questions: [] });
      }
      if (input.context.includes('correction judgment unresolved')) warnings++;
      if (mode === 'answer-summary-writer') return shape('summary-writer').raw;
      if (mode === 'answer-summary-uncertain') return JSON.parse(shape('summary-uncertain').raw);
      if (mode === 'delivered-reply' || mode === 'empty-reply-in-recorded-context')
        return JSON.stringify({ reply: shape(mode).raw, memory: [], memoryDisposition: 'unresolved' });
      return input.id === id(46040116) ? deferral.answer.output : reply;
    },
    send: async (input: { expectedText: string }) => {
      sends.push(input.expectedText);
      if (mode === 'unknown-send' && sends.length === 1) throw Error('unknown delivery');
      return sends.length + 100;
    } };
  let worker = createJournalWorker(journal, ports);
  for (const turn of capture.inputs) {
    worker.intake([{ update_id: turn.update, message: { chat: { id: Number(capture.operator), type: 'private' },
      from: { id: Number(capture.operator) }, text: turn.text } }]);
    if (turn.update < 46040116) {
      journal.append({ kind: 'reserve', id: id(turn.update), at: capture.at });
      journal.append({ kind: 'answer', id: id(turn.update), text: 'Recorded earlier reply.', at: capture.at });
      journal.append({ kind: 'intent', id: id(turn.update), text: 'Recorded earlier reply.', chat: capture.operator, update: turn.update, grant: 'grant:strand', at: capture.at });
      journal.append({ kind: 'sent', id: id(turn.update), message: turn.update, at: capture.at });
    }
  }
  for (const recorded of capture.summaries) {
    // Neighbor: the eligible frontier ends immediately before the request.
    const summary = recorded.through === 46040116 && ['uncovered', 'summary-writer', 'summary-uncertain'].includes(mode)
      ? { ...recorded, through: 46040115 } : mode === 'future' && recorded.through === 46040116
        ? { ...recorded, through: 46040117 } : recorded;
    journal.append({ kind: 'summary-reserve', through: summary.through, at: capture.at });
    journal.append({ kind: 'summary', ...summary, ...(mode === 'settled' && summary.through === 46040116 ? { memoryFor: [id(46040116)] } : {}),
      faithfulness: { path: 'exact', verdict: 'pass', score: null }, state: 'complete', at: capture.at });
  }
  journal.append({ kind: 'hold', id: id(46040116), reason: 'memory correction pending', at: capture.at });
  for (const update of [46040117, 46040118]) journal.append({ kind: 'hold', id: id(update), reason: 'earlier turn pending', at: capture.at });
  if (mode === 'retired') journal.view.retiredSummaries = [2]; // Inject an already-retired frontier.
  records.length = 0;
  return { get journal() { return journal; }, get worker() { return worker; }, records, calls, sends,
    get warnings() { return warnings; }, get judged() { return judged; }, get reviewed() { return reviewed; },
    stop(value: boolean) { stopped = value; },
    restart() { journal.close(); journal = openPreviewJournal(path, key); watch(); worker = createJournalWorker(journal, ports); } };
}

it.each(['covered', 'restart', 'jev-unsure', 'jev-undecided', 'delivered-reply', 'empty-reply-in-recorded-context', 'answer-summary-writer', 'answer-summary-uncertain'])(
  'releases the recorded covered frontier and queued answers (%s)', async mode => {
  const w = world(mode);
  try {
    if (mode === 'restart') { await expect(w.worker.drain()).rejects.toThrow('restart after durable undecided'); w.restart(); }
    await w.worker.drain();
    expect(w.journal.view.turns.get(id(46040116))!.memoryUndecided).toBe(true);
    expect(w.records.filter(row => row.kind === 'memory-undecided')).toEqual(mode === 'restart' ? [] : [
      { kind: 'memory-undecided', id: id(46040116), reason: 'summary-covered', at: capture.at }]);
    expect(w.calls.filter(call => call.startsWith('summary:'))).toEqual([]);
    expect(w.warnings).toBe(2); // Later turns carry the unresolved correction; its own packet asks for the decision.
    if (mode.startsWith('jev-')) { expect(w.judged).toBeGreaterThan(0); expect(w.reviewed).toBeGreaterThan(0); }
    for (const update of [46040116, 46040117, 46040118]) {
      const turn = w.journal.view.turns.get(id(update))!;
      expect(turn.sent).toBeDefined(); expect(turn.held).toBeUndefined();
    }
    const bubbles = [46040116, 46040117, 46040118].reduce((count, update) =>
      count + 1 + (w.journal.view.turns.get(id(update))!.replyParts?.length ?? 0), 0);
    expect(w.sends).toHaveLength(bubbles); expect(w.sends.every(text => text.trim().length > 0)).toBe(true);
    expect(w.journal.view.memory).toEqual([]);
    w.restart(); await w.worker.drain(); expect(w.sends).toHaveLength(bubbles);
    expect(w.journal.view.turns.get(id(46040116))!.memoryUndecided).toBe(true);
  } finally { w.journal.close(); }
});

it.each(['uncovered', 'settled', 'summary-writer', 'summary-uncertain'])(
  'preserves the existing decision path for %s', async mode => {
  const w = world(mode);
  try {
    await w.worker.drain(); await w.worker.drain();
    expect(w.records.some(row => row.kind === 'memory-undecided' && row.reason === 'summary-covered')).toBe(false);
    if (mode === 'settled') {
      expect(w.journal.view.turns.get(id(46040116))!.memoryUndecided).toBeUndefined();
      expect(w.calls.some(call => call.startsWith('summary:'))).toBe(false);
    } else expect(w.calls.some(call => call.startsWith('summary:'))).toBe(true);
    if (mode === 'uncovered') { expect(w.journal.view.summaries.some(s => s.memoryFor?.includes(id(46040116)))).toBe(true); }
    expect(w.journal.view.turns.get(id(46040116))!.sent).toBeDefined();
  } finally { w.journal.close(); }
});

it('honors stop before and after restart, then releases retained intake after resume', async () => {
  const w = world();
  try {
    w.stop(true); await expect(w.worker.drain()).rejects.toThrow();
    w.restart(); await expect(w.worker.drain()).rejects.toThrow();
    expect(w.calls).toEqual([]); expect(w.sends).toEqual([]); expect(w.journal.view.order).toHaveLength(7);
    w.stop(false); await w.worker.drain(); expect(w.sends).toHaveLength(3);
  } finally { w.journal.close(); }
});

it('never repeats an UNKNOWN send after restart', async () => {
  const w = world('unknown-send');
  try {
    await w.worker.drain();
    const first = w.journal.view.turns.get(id(46040116))!;
    expect(first.intent).toBeDefined(); expect(first.sent).toBeUndefined();
    const sent = [...w.sends]; w.restart(); await w.worker.drain();
    expect(w.sends).toEqual(sent); expect(w.journal.view.turns.get(id(46040116))!.sent).toBeUndefined();
  } finally { w.journal.close(); }
});

it('keeps a recorded stop across restart without calls or sends', async () => {
  const w = world();
  try {
    w.journal.append({ kind: 'stop', reason: 'operator', at: capture.at });
    w.restart(); await expect(w.worker.drain()).rejects.toThrow();
    expect(w.calls).toEqual([]); expect(w.sends).toEqual([]);
    expect(w.journal.view.order).toHaveLength(7);
    expect(w.journal.view.turns.get(id(46040116))!.memoryUndecided).toBeUndefined();
  } finally { w.journal.close(); }
});

it('keeps the durable call cap across restart while retaining queued intake', async () => {
  const w = world('cap');
  try {
    await w.worker.drain();
    expect(w.calls).toEqual([]); expect(w.journal.view.calls).toBe(7);
    w.restart(); await w.worker.drain();
    expect(w.calls).toEqual([]); expect(w.journal.view.calls).toBe(7);
    expect(w.journal.view.order).toHaveLength(7);
  } finally { w.journal.close(); }
});

it.each(['future', 'retired'])('does not recover from an ineligible %s summary', async mode => {
  const w = world(mode);
  try {
    await w.worker.drain();
    expect(w.records.some(row => row.kind === 'memory-undecided' && row.reason === 'summary-covered')).toBe(false);
    expect(w.calls.some(call => call.startsWith('summary:'))).toBe(true);
  } finally { w.journal.close(); }
});
