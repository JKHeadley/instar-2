import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, type JournalRecord } from './journal-test-worker.js';

const recorded = JSON.parse(readFileSync(new URL('./fixtures/reminder-idle-live-2026-10-09.json', import.meta.url), 'utf8')) as {
  cases: { older: { update: number; text: string; at: number; reply: string };
    request: { update: number; text: string; at: number; output: string }; due: string;
    failures: Extract<JournalRecord, { kind: 'summary-failed' }>[] }[] };
const key = new Uint8Array(32).fill(47);
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:reminder-idle', configurationDigest: 'sha256:offline', expires: Date.UTC(2027, 0, 1),
  maxCalls: 100, maxReplies: 50, maxTurns: 50, maxBytes: 409600, cursor: 0 };
const update = (turn: { update: number; text: string; at: number }) => ({ update_id: turn.update,
  message: { chat: { id: Number(genesis.chat), type: 'private' }, from: { id: Number(genesis.operator) },
    text: turn.text, date: Math.floor(turn.at / 1000) } });

for (const sample of recorded.cases) it(`settles exhausted background memory on idle polls and fires live request ${sample.request.update} once`, async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-reminder-idle-')));
  const path = join(root, 'journal.encrypted');
  let journal = openPreviewJournal(path, key, genesis), now = sample.older.at;
  const sent: string[] = [], calls: string[] = [];
  const ports = { now: () => now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: { id: string; question: string }) => {
      calls.push(input.id);
      if (input.question === sample.request.text) return sample.request.output;
      if (input.question === sample.older.text) return sample.older.reply;
      return JSON.stringify({ reply: 'Time to take a short walk.', memory: [] });
    }, checkOutbound: () => {}, send: async (input: { expectedText: string }) => {
      sent.push(input.expectedText); return sent.length;
    } };
  try {
    let worker = createJournalWorker(journal, ports);
    worker.intake([update(sample.older)]); await worker.drain();
    now = sample.request.at;
    worker.intake([update(sample.request)]); await worker.drain();
    expect(journal.view.dated).toMatchObject([{ remind: true, quote: sample.request.text }]);
    const older = journal.view.order[0]!;
    // Real background failures arrive AFTER the ordinary drain. No inbound turn follows them.
    const fail = (index: number) => {
      const row = sample.failures[index]!;
      journal.append({ kind: 'summary-reserve', through: row.through, at: now });
      journal.append({ ...row, at: now });
    };
    fail(0);
    expect(older.memoryPending).toBe(true);
    const before = calls.length, replies = sent.length;
    now = Date.parse(sample.due) - 1;
    await worker.sendRequested();
    // A still-retryable memory judgment keeps its existing hold.
    expect(older.memoryUndecided).toBeUndefined();
    expect(journal.view.order.filter(turn => turn.requestedAction)).toHaveLength(0);
    expect(calls).toHaveLength(before);
    fail(1);
    await worker.sendRequested();
    expect(journal.view.order.filter(turn => turn.requestedAction)).toHaveLength(0);
    now++;
    await worker.sendRequested();
    const due = journal.view.order.filter(turn => turn.requestedAction);
    expect(due).toHaveLength(1);
    expect(older.memoryUndecided).toBe(true);
    expect(due[0]).toMatchObject({ writer: { kind: 'system', id: 'preview-scheduler:8989505249' }, at: now });
    expect(sent.slice(replies)).toHaveLength(1);
    expect(sent.at(-1)).toContain('Time to take a short walk.');
    await worker.sendRequested();
    journal.close();
    journal = openPreviewJournal(path, key);
    worker = createJournalWorker(journal, ports);
    await worker.sendRequested();
    expect(sent.slice(replies)).toHaveLength(1);
    expect(calls).toHaveLength(before + 1);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
