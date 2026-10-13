import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareJournalEnvelope } from './journal-envelope.js';
import { parseReplyReviewVerdict } from './reply-check.js';
import { createJournalWorker, dueObligationWork, obligationSchedule, openPreviewJournal } from './journal-test-worker.js';

const capture = JSON.parse(readFileSync(new URL('./fixtures/deferral-not-memory-2026-10-12.json', import.meta.url), 'utf8'));
const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as {
  otherShapes: { kind: string; id: string; raw: string }[] };
const shape = (kind: string) => shapes.otherShapes.find(row => row.kind === kind)!;
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

it.each(['recorded sequence', 'jev-unsure', 'jev-undecided', 'summary-uncertain', 'summary-writer', 'empty-memory-decision'])(
  'replays 46039931 with %s: preserves the answer and exactly one scheduled commitment', async mode => {
  const root = mkdtempSync(join(tmpdir(), 'deferral-not-memory-')); dirs.push(root);
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(39);
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: capture.bot, chat: capture.operator,
    operator: capture.operator, grant: 'grant:fixture', configurationDigest: 'sha256:fixture',
    expires: capture.at + 86400000, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  const sends: string[] = [], summaries: string[] = []; let reviewed = 0, judged = 0;
  const ports = { now: () => capture.at, stopped: () => false, checkOutbound: () => {},
    prepareModel: (input: Parameters<typeof prepareJournalEnvelope>[0]) => prepareJournalEnvelope(input, 'fixture', 'grant:fixture', capture.at),
    ...(mode.startsWith('jev-') ? { replyCheck: { elapsedMs: () => 0,
      jev: async () => { judged++; return { value: JSON.parse(shape(mode).raw), latencyMs: 158 }; },
      escalate: async () => { reviewed++; return { ...parseReplyReviewVerdict(JSON.parse(shape('reply-review').raw).conclusion.value),
        confidence: null, latencyMs: 1 }; } } } : {}),
    model: async (input: { id: string }) => {
      if (input.id.startsWith('summary:')) {
        const row = capture.summaries[summaries.length];
        if (!row) throw Error('unexpected third summary attempt');
        summaries.push(row.output);
        return mode === 'summary-uncertain' ? JSON.parse(shape('summary-uncertain').raw)
          : mode === 'summary-writer' ? shape('summary-writer').raw : row.output;
      }
      return mode === 'empty-memory-decision' ? JSON.stringify({ ...JSON.parse(capture.answer.output), memory: [] }) : capture.answer.output;
    }, send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: capture.update, message: { chat: { id: Number(capture.operator), type: 'private' },
      from: { id: Number(capture.operator) }, text: capture.message } }]);
    await worker.drain(); await worker.drain();
    expect(summaries).toHaveLength(mode === 'summary-uncertain' ? 1 : 2);
    if (mode.startsWith('jev-')) { expect(judged).toBeGreaterThan(0); expect(reviewed).toBeGreaterThan(0); }
    expect(journal.view.order[0]).toMatchObject({ memoryPending: true, memoryUndecided: true, memoryUnresolved: true });
    expect(sends).toEqual([JSON.parse(capture.answer.output).reply]);
    const commitments = journal.view.commitments.filter(item => item.source.endsWith(`:${capture.update}`));
    expect(commitments).toHaveLength(1);
    expect(commitments[0]).toMatchObject({ quote: JSON.parse(capture.answer.output).openLoops[0].quote, owner: 'agent', waitsOn: 'nothing' });
    expect(journal.view.memory).toEqual([]);
    const schedule = obligationSchedule(journal.view);
    expect(schedule).toHaveLength(1);
    expect(schedule[0]).toMatchObject({ key: 'commitment:0', kind: 'commitment' });
    expect(Number.isFinite(schedule[0]!.slot)).toBe(true);
    expect(dueObligationWork(journal.view, schedule[0]!.slot - 1)).toEqual([]);
    expect(dueObligationWork(journal.view, schedule[0]!.slot)).toHaveLength(1);
    journal.close(); journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports); await worker.drain();
    expect(sends).toHaveLength(1);
    expect(journal.view.commitments.filter(item => item.source.endsWith(`:${capture.update}`))).toHaveLength(1);
  } finally { journal.close(); }
});

// Delivered bytes are replayed as the reply field; no claim that they were model JSON.
it.each(['delivered-reply', 'empty-reply-in-recorded-context'])(
  'handles recorded %s without turning unresolved memory into an acknowledgement of a save', async kind => {
  const row = shape(kind), root = mkdtempSync(join(tmpdir(), 'deferral-shapes-')); dirs.push(root);
  const key = new Uint8Array(32).fill(40), sends: string[] = [];
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, { kind: 'genesis', bot: capture.bot,
    chat: capture.operator, operator: capture.operator, grant: 'grant:fixture', configurationDigest: 'sha256:fixture',
    expires: capture.at + 86400000, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  try {
    const worker = createJournalWorker(journal, { now: () => capture.at, stopped: () => false, checkOutbound: () => {},
      model: async input => input.id.startsWith('summary:') ? capture.summaries[0].output
        : JSON.stringify({ reply: row.raw, memoryDisposition: 'unresolved', memory: [] }),
      send: async input => { sends.push(input.expectedText); return sends.length; } });
    worker.intake([{ update_id: capture.update, message: { chat: { id: Number(capture.operator), type: 'private' },
      from: { id: Number(capture.operator) }, text: capture.message } }]);
    await worker.drain(); await worker.drain();
    expect(sends).toHaveLength(1); expect(sends[0]!.trim()).not.toBe('');
    expect(journal.view.memory).toEqual([]);
    if (row.raw) {
      expect(journal.view.order[0]!.memoryUnresolved).toBe(true);
      expect(sends[0]).toBe(row.raw.replace(/^PREVIEW — /u, ''));
    } else {
      expect(journal.view.order[0]!.memoryUnresolved).toBeUndefined();
      expect(journal.view.order[0]!.failureClass).toBe('empty');
    }
  } finally { journal.close(); }
});

it('retains an explicit unresolved save failure in the independent answer, once', async () => {
  const root = mkdtempSync(join(tmpdir(), 'deferral-save-failed-')); dirs.push(root);
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(41);
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: capture.bot, chat: capture.operator,
    operator: capture.operator, grant: 'grant:fixture', configurationDigest: 'sha256:fixture',
    expires: capture.at + 86400000, maxCalls: 30, maxReplies: 20, maxTurns: 20, maxBytes: 65536, cursor: 0 });
  const sends: string[] = [], reply = 'I could not save your preferred planning day yet.';
  const ports = { now: () => capture.at, stopped: () => false, checkOutbound: () => {},
    model: async (input: { id: string }) => input.id.startsWith('summary:') ? capture.summaries[0].output
      : JSON.stringify({ reply, memory: [], memoryDisposition: 'unresolved' }),
    send: async (input: { expectedText: string }) => { sends.push(input.expectedText); return sends.length; } };
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([{ update_id: capture.update, message: { chat: { id: Number(capture.operator), type: 'private' },
      from: { id: Number(capture.operator) }, text: 'Please remember that Friday is my preferred planning day.' } }]);
    journal.append({ kind: 'memory-undecided', id: journal.view.order[0]!.id, reason: 'summary-failed', at: capture.at });
    await worker.drain(); await worker.drain();
    expect(sends).toEqual([reply]); expect(journal.view.memory).toEqual([]);
    expect(journal.view.order[0]).toMatchObject({ memoryPending: true, memoryUndecided: true, memoryUnresolved: true });
    journal.close(); journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports); await worker.drain();
    expect(sends).toEqual([reply]); expect(journal.view.memory).toEqual([]);
  } finally { journal.close(); }
});
