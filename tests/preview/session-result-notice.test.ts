import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, UNKNOWN_ANSWER_NOTICE, SAFETY_CEILING_NOTICE } from './journal-test-worker.js';

// Exact selected journal projection supplied by the desk, not invented raw frames.
const capture = JSON.parse(readFileSync(new URL('./fixtures/session-result-notice-969390679.json', import.meta.url), 'utf8'));
type Recorded = { id: string; update: number; at: number; modelState: 'uncertain' | 'complete'; answer?: string; intent: string; sent: number };
const recorded: Recorded[] = [capture.target, ...capture.neighbors];
const genesis = { kind: 'genesis' as const, bot: '8820318295', chat: '7654321', operator: '7654321',
  grant: 'grant:notice-replay', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 20, maxReplies: 20, maxTurns: 20, maxBytes: 131072, cursor: 0 };
const key = new Uint8Array(32).fill(42);
const update = (id: number) => ({ update_id: id, message: { chat: { id: 7654321, type: 'private' },
  from: { id: 7654321 }, text: 'Report the task result.' } });

for (const row of recorded) it(`replays recorded result ${row.update} through durable intake, notice, send and restart`, async () => {
  const root = mkdtempSync(join(tmpdir(), 'session-result-notice-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis), calls = 0;
  const sent: string[] = [];
  const ports = { now: () => row.at, stopped: () => false,
    model: async () => { calls++; return row.modelState === 'uncertain' ? { state: 'uncertain' as const } : row.answer!; },
    checkOutbound: () => {}, send: async (input: { expectedText: string }) => { sent.push(input.expectedText); return row.sent; } };
  try {
    const worker = createJournalWorker(journal, ports);
    worker.intake([update(row.update)]); await worker.drain(); await worker.drain();
    expect(calls).toBe(1);
    if (row.modelState === 'uncertain') {
      expect(sent).toEqual([UNKNOWN_ANSWER_NOTICE]);
      expect(sent[0]).toContain('Completion of your request is unconfirmed');
      expect(sent[0]).toContain('Work may have changed files or external services');
      expect(sent[0]).toContain('This attempt is not automatically retried');
      expect(sent[0]).toContain('Before resuming, the recorded work and current external state need to be checked');
      expect(sent[0]).not.toMatch(/2750|ENOSPC|merged|picking back up|retry queued|nothing changed|delivered successfully/i);
      expect(journal.view.turns.get(row.id)).toMatchObject({ modelState: 'uncertain', noticeClass: 'unknown-answer' });
      expect(journal.view.turns.get(row.id)?.answer).toBeUndefined();
    } else {
      // Recorded successful answer shapes (including a refused tool read) keep their actual content.
      expect(journal.view.turns.get(row.id)?.answer).toBe(row.answer);
      expect(journal.view.turns.get(row.id)?.noticeClass).toBeUndefined();
      expect(sent.join('')).not.toContain(UNKNOWN_ANSWER_NOTICE);
    }
    const count = sent.length;
    journal.close(); journal = openPreviewJournal(path, key);
    await createJournalWorker(journal, ports).drain();
    expect(calls).toBe(1); expect(sent).toHaveLength(count);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it.each([undefined, 6])('keeps old delivered notice bytes and classification on reopen (tool checks %s)', async toolChecks => {
  const root = mkdtempSync(join(tmpdir(), 'session-notice-history-')), path = join(root, 'journal');
  let journal = openPreviewJournal(path, key, genesis);
  const row = capture.neighbors[0] as Recorded;
  const text = toolChecks === undefined ? row.intent : `${row.intent} ${toolChecks} tool checks returned results, but those results were not verified into an answer. The requested result remains unverified; no tool work was automatically repeated.`;
  try {
    journal.append({ kind: 'intake', id: row.id, update: row.update, text: 'prior request', raw: JSON.stringify(update(row.update)), accepted: true, cursor: row.update + 1, at: row.at });
    journal.append({ kind: 'reserve', id: row.id, at: row.at });
    journal.append({ kind: 'model-uncertain', id: row.id, state: 'uncertain', ...(toolChecks === undefined ? {} : { toolChecks }), at: row.at });
    journal.append({ kind: 'notice', id: row.id, noticeClass: 'unknown-answer', at: row.at });
    journal.append({ kind: 'intent', id: row.id, text, chat: genesis.chat, update: row.update, grant: genesis.grant, at: row.at });
    journal.append({ kind: 'sent', id: row.id, message: row.sent, at: row.at });
    journal.close(); journal = openPreviewJournal(path, key);
    let context = '';
    const worker = createJournalWorker(journal, { now: () => row.at + 1000, stopped: () => false,
      model: async input => { context = input.context; return 'next answer'; }, checkOutbound: () => {}, send: async () => 1000 });
    worker.intake([update(row.update + 1)]); await worker.drain();
    expect(JSON.parse(context).history[0]).toMatchObject({ answer: null, notice: text, outcome: 'loss notice delivered; model UNKNOWN' });
    expect(journal.view.turns.get(row.id)?.intent).toBe(text);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('preserves the explicit safety halt instead of inventing a retry or a result', async () => {
  const root = mkdtempSync(join(tmpdir(), 'session-notice-halt-'));
  const journal = openPreviewJournal(join(root, 'journal'), key, genesis), sent: string[] = [];
  try {
    const worker = createJournalWorker(journal, { now: () => 1000, stopped: () => false,
      model: async () => ({ state: 'uncertain', safetyCeiling: 'deadline' }), checkOutbound: () => {},
      send: async input => { sent.push(input.expectedText); return 1; } });
    worker.intake([update(1)]); await worker.drain();
    expect(sent).toEqual([SAFETY_CEILING_NOTICE]);
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
