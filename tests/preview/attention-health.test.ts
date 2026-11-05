import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal, LOOP_REVISIT_MS, type JournalRecord } from './journal-test-worker.js';
import { createAttentionSurface } from './attention-surface.js';
import { AttentionQueue, applyAttentionRecord, type AttentionState } from './attention-queue.js';
import { PROGRESS_STALL_MS } from './obligations.js';

it.each(['stalled-work', 'recovery-unknown', 'delivery-unknown'] as const)('actual obligation producer preserves %s without creating an effect', async condition => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'attention-health-'))), path = join(root, 'journal.encrypted');
  const key = new Uint8Array(32).fill(47);
  let now = 1790000000000, unknown = false, machine = 'owner';
  const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'health-test', configurationDigest: 'sha256:offline', expires: 9_999_999_999_999,
    maxCalls: 32, maxReplies: 32, maxTurns: 40, maxBytes: 32768, cursor: 0 };
  let journal = openPreviewJournal(path, key, genesis);
  const sent: string[] = [], calls: string[] = [];
  const promise = 'I will look into the invoice question later today.';
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    model: async input => { calls.push(input.id); return input.question === 'Please check the invoice.'
      ? JSON.stringify({ reply: promise, openLoops: [{ kind: 'deferral', quote: promise, waitsOn: 'nothing' }] }) : JSON.stringify({ reply: 'Here is the result.', selectedReports: ['commitment:0'] }); },
    send: async ({ text }) => { sent.push(text); return unknown ? null : sent.length; }, checkOutbound: () => {} });
  const surface = () => createAttentionSurface(journal, { now: () => now, machine, admitted: () => true, replicated: async () => true });
  try {
    worker.intake([{ update_id: 1, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
      text: 'Please check the invoice.', date: Math.floor(now / 1000) } }]);
    await worker.drain(); expect(journal.view.commitments).toHaveLength(1);
    await surface().maintain(); expect(surface().list().items).toHaveLength(0);
    now += LOOP_REVISIT_MS + 1;
    // Actual recorded work-start/result shapes, not an invented model verdict.
    const recorded = JSON.parse(readFileSync(new URL('./fixtures/work-recovery-2026-10-15.json', import.meta.url), 'utf8'));
    const start = { ...recorded.workStart, slot: now, at: now } as Extract<JournalRecord, { kind: 'obligation-start' }>;
    journal.append(start);
    if (condition === 'stalled-work') {
      now += PROGRESS_STALL_MS; await surface().maintain();
      expect(surface().list().items.some(i => i.id.includes(condition))).toBe(false);
      now++;
    } else if (condition === 'recovery-unknown') {
      journal.append({ kind: 'obligation-result', obligation: start.obligation, slot: start.slot,
        outcome: 'uncertain', recoveryHeld: true, at: now });
    } else {
      journal.append({ ...recorded.workResult, slot: start.slot, at: now } as JournalRecord);
      unknown = true;
      worker.intake([{ update_id: 2, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 },
        text: 'Any news?', date: Math.floor(now / 1000) } }]);
      await worker.drain();
    }
    const effects = [calls.length, sent.length];
    await surface().maintain();
    expect(surface().list().items.find(i => i.id.includes(condition))).toMatchObject({ status: 'OPEN', lane: 'agent-health' });
    journal.compact(); journal.close(); journal = openPreviewJournal(path, key); machine = 'successor';
    const size = journal.size; await surface().maintain(); await surface().maintain();
    expect(journal.size).toBe(size); expect([calls.length, sent.length]).toEqual(effects);
    if (condition === 'stalled-work') {
      journal.append({ ...recorded.workResult, slot: start.slot, at: now } as JournalRecord);
      await surface().maintain();
      expect(surface().list().items.find(i => i.id.includes(condition))?.status).toBe('DONE');
    }
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});

it('refuses new health identities at capacity without eviction or repeated capacity churn, and permits existing refresh', () => {
  let state: AttentionState | undefined;
  let writes = 0;
  const queue = new AttentionQueue({ state: () => state, append: row => { state = applyAttentionRecord(state, row, 'operator'); writes++; } }, () => 1000);
  const identity = { producer: 'health', conditionType: 'held', subject: 'agent' };
  const details = { title: 'Work is held', summary: 'One step', category: 'health', priority: 'NORMAL' as const };
  queue.observeHealth(identity, true, details);
  state!.items = Array.from({ length: 2000 }, (_, i) => ({ ...state!.items[0]!, ...(i ? { id: `seed-${i}` } : {}) }));
  expect(queue.observeHealth({ ...identity, subject: 'new' }, true, details)).toBe('capacity');
  const before = writes;
  expect(queue.observeHealth({ ...identity, subject: 'another' }, true, details)).toBe('capacity');
  expect(writes).toBe(before); expect(state!.items).toHaveLength(2000);
  expect(queue.observeHealth(identity, true, { ...details, summary: 'Two steps' })).toBe('recorded');
  expect(state!.items[0]?.summary).toBe('Two steps');
  expect(state!.conditionCapacity?.observations).toBe(1);
});
